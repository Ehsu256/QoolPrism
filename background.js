importScripts("common.js");

const CONTENT_SCRIPT_ID = "qoolprism";
const SERVER_ORIGIN_KEY = "serverOrigin";
const PERMISSION_PATTERN_KEY = "permissionPattern";
const YANDEX_IMAGE_MENU_ID = "yandex-image-search";
const YANDEX_IMAGES_URL = "https://yandex.com/images/";
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const IQDB_IMAGES_URL = "https://iqdb.org/";
const IQDB_IMAGE_MENU_ID = "iqdb-image-search";
const IQDB_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IQDB_MAX_DIMENSION = 7500;
const MAX_REPLACE_URL_BYTES = 20 * 1024 * 1024;
const GOOGLE_LENS_URL = "https://www.google.com/";
const GOOGLE_LENS_MENU_ID = "google-lens-image-search";

function getServerConfig(value) {
  return PhotoPrismExtensionUtils.parseServerUrl(value);
}

async function unregisterContentScript() {
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });

  if (registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({
      ids: [CONTENT_SCRIPT_ID],
    });
  }
}

async function registerContentScript(permissionPattern) {
  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: [permissionPattern],
      js: ["common.js", "content.js"],
      css: ["content.css"],
      runAt: "document_idle",
      persistAcrossSessions: true,
    },
  ]);
}

async function syncConfiguredServer() {
  const settings = await chrome.storage.local.get([
    SERVER_ORIGIN_KEY,
    PERMISSION_PATTERN_KEY,
  ]);

  if (!settings[SERVER_ORIGIN_KEY] || !settings[PERMISSION_PATTERN_KEY]) {
    await unregisterContentScript();
    return;
  }

  const config = getServerConfig(settings[SERVER_ORIGIN_KEY]);
  if (config.permissionPattern !== settings[PERMISSION_PATTERN_KEY]) {
    throw new Error("The saved PhotoPrism server permissions are inconsistent.");
  }

  const granted = await chrome.permissions.contains({
    origins: [config.permissionPattern],
  });

  if (!granted) {
    await unregisterContentScript();
    return;
  }

  await unregisterContentScript();
  await registerContentScript(config.permissionPattern);
}

async function configureServer(value) {
  const config = getServerConfig(value);
  const granted = await chrome.permissions.contains({
    origins: [config.permissionPattern],
  });

  if (!granted) {
    throw new Error("PhotoPrism site access has not been granted.");
  }

  const previous = await chrome.storage.local.get([
    SERVER_ORIGIN_KEY,
    PERMISSION_PATTERN_KEY,
  ]);

  await unregisterContentScript();

  try {
    await registerContentScript(config.permissionPattern);
  } catch (error) {
    if (previous[PERMISSION_PATTERN_KEY]) {
      const previousGranted = await chrome.permissions.contains({
        origins: [previous[PERMISSION_PATTERN_KEY]],
      });

      if (previousGranted) {
        await registerContentScript(previous[PERMISSION_PATTERN_KEY]);
      }
    }

    throw error;
  }

  await chrome.storage.local.set({
    [SERVER_ORIGIN_KEY]: config.serverOrigin,
    [PERMISSION_PATTERN_KEY]: config.permissionPattern,
  });

  let warning;
  const previousPattern = previous[PERMISSION_PATTERN_KEY];
  if (previousPattern && previousPattern !== config.permissionPattern) {
    const removed = await chrome.permissions.remove({
      origins: [previousPattern],
    });

    if (!removed) {
      warning = "The new server is configured, but access to the previous server could not be removed.";
    }
  }

  return { warning };
}

async function clearServer() {
  const settings = await chrome.storage.local.get(PERMISSION_PATTERN_KEY);
  await unregisterContentScript();
  await chrome.storage.local.remove([
    SERVER_ORIGIN_KEY,
    PERMISSION_PATTERN_KEY,
  ]);

  if (settings[PERMISSION_PATTERN_KEY]) {
    const removed = await chrome.permissions.remove({
      origins: [settings[PERMISSION_PATTERN_KEY]],
    });

    if (!removed) {
      return {
        warning: "The server was cleared, but its site permission could not be removed.",
      };
    }
  }

  return {};
}

function getImageFileName(imageUrl) {
  const fileName = imageUrl.pathname.split("/").pop();
  try {
    return decodeURIComponent(fileName) || "photoprism-image";
  } catch {
    return "photoprism-image";
  }
}

function showImageSearchError(tabId, message, title = "Yandex image search") {
  console.error(`Could not search this image (${title}).`, message);
  chrome.scripting.executeScript({
    target: { tabId },
    func: (errorTitle, errorMessage) => window.alert(`${errorTitle} failed: ${errorMessage}`),
    args: [title, message],
  }).catch((error) => {
    console.error("Could not show the image search error.", error);
  });
}

function handleGalleryMediaInPage(mediaUid, listOnly = false) {
  if (
    window.location.pathname !== "/search"
    && window.location.pathname !== "/library"
    && !window.location.pathname.startsWith("/library/")
  ) {
    throw new Error("This PhotoPrism page does not contain a photo gallery.");
  }

  const result = Array.from(document.querySelectorAll(
    "main .media.result[data-uid]",
  )).find((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && rect.width > 0
      && rect.height > 0;
  });
  if (!result) {
    throw new Error("No gallery media are currently available on this PhotoPrism page.");
  }

  const root = document.querySelector("#app")?._vnode;
  if (!root) {
    throw new Error("Could not find PhotoPrism's active gallery.");
  }

  const visited = new Set();
  let gallery;
  function findGallery(vnode, depth) {
    if (!vnode || typeof vnode !== "object" || depth > 100 || visited.has(vnode)) {
      return;
    }
    visited.add(vnode);

    if (vnode.el === result) {
      for (let component = vnode.ctx; component; component = component.parent) {
        if (typeof component.type?.methods?.openPhoto === "function") {
          gallery = component;
          return;
        }
      }
    }

    if (vnode.component) {
      findGallery(vnode.component.subTree, depth + 1);
    }
    if (vnode.suspense) {
      findGallery(vnode.suspense.activeBranch, depth + 1);
      findGallery(vnode.suspense.pendingBranch, depth + 1);
    }
    if (Array.isArray(vnode.children)) {
      vnode.children.forEach((child) => findGallery(child, depth + 1));
    }
    if (Array.isArray(vnode.dynamicChildren)) {
      vnode.dynamicChildren.forEach((child) => findGallery(child, depth + 1));
    }
  }
  findGallery(root, 0);

  const photos = gallery?.proxy?.results;

  if (listOnly) {
    if (!Array.isArray(photos)) {
      throw new Error("Could not read the media in PhotoPrism's active gallery.");
    }
    const mediaUids = photos
      .map((photo) => photo.UID)
      .filter((uid) => typeof uid === "string");
    if (!mediaUids.length) {
      throw new Error("No media are currently available in this PhotoPrism gallery.");
    }
    return { mediaUids };
  }

  if (!Array.isArray(photos)) {
    throw new Error("Could not read the media in PhotoPrism's active gallery.");
  }

  if (typeof mediaUid !== "string") {
    throw new Error("Could not identify the selected gallery media.");
  }

  const index = photos.findIndex((photo) => photo.UID === mediaUid);
  if (index < 0) {
    throw new Error("The selected media is no longer available in this PhotoPrism gallery.");
  }
  if (!gallery.proxy.openPhoto(index)) {
    throw new Error("PhotoPrism could not open the selected gallery media.");
  }
  return { opened: true };
}

// Runs in the PhotoPrism page. Opens a random media item taken from the whole result set of
// the current gallery, not just from the items that happen to be loaded. The size of the result
// set is found through PhotoPrism's API (cached for a few minutes), and a window of media around
// the random position is fetched from the API and opened in the viewer.
async function openRandomPhotoInPage() {
  const WINDOW_SIZE = 100;
  // More media is loaded when the viewer gets this close to the end of the loaded media.
  const EDGE_DISTANCE = 25;
  const MAX_OFFSET = 100000;
  const COUNT_CACHE_MS = 5 * 60 * 1000;
  const BUSY_TIMEOUT_MS = 60 * 1000;
  const REQUEST_TIMEOUT_MS = 15000;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const lightboxIsOpen = (lightbox) => Boolean(lightbox?.data?.visible)
    || Boolean(document.querySelector(".p-lightbox[aria-modal='true']"));
  const lightboxIsBusy = (lightbox) => Boolean(lightbox?.data?.busy || lightbox?.data?.closing);
  const getSlideshow = (lightbox) => lightbox?.proxy?.pswp?.() || lightbox?.data?.lightbox?.pswp || null;
  // Resolves to true as soon as the condition is met, or to false after the time is up.
  const waitUntil = async (condition, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (Date.now() > deadline) {
        return false;
      }
      await sleep(50);
    }
    return true;
  };

  const state = window.__qoolprismRandom || (window.__qoolprismRandom = {
    busySince: 0,
    key: "",
    total: 0,
    countedAt: 0,
  });

  // Ignore presses while a previous one is still being processed. The timeout makes sure
  // that a request that never finished cannot block the feature forever.
  if (state.busySince && Date.now() - state.busySince < BUSY_TIMEOUT_MS) {
    return { opened: true, skipped: true };
  }
  state.busySince = Date.now();

  try {
    if (
      window.location.pathname !== "/search"
      && window.location.pathname !== "/library"
      && !window.location.pathname.startsWith("/library/")
    ) {
      throw new Error("This PhotoPrism page does not contain a photo gallery.");
    }

    const root = document.querySelector("#app")?._vnode;
    if (!root) {
      throw new Error("Could not find PhotoPrism's active gallery.");
    }

    // Finds the photo gallery page and the viewer (lightbox) component.
    const visited = new Set();
    let view = null;
    let lightbox = null;
    function findComponents(vnode, depth) {
      if (
        !vnode
        || typeof vnode !== "object"
        || depth > 100
        || visited.has(vnode)
        || (view && lightbox)
      ) {
        return;
      }
      visited.add(vnode);

      const instance = vnode.component;
      if (instance) {
        const type = instance.type;
        if (!lightbox && (type?.name === "PLightbox" || type?.__name === "PLightbox")) {
          lightbox = instance;
        }
        if (
          !view
          && typeof type?.methods?.openPhoto === "function"
          && typeof instance.proxy?.searchParams === "function"
          && Array.isArray(instance.proxy?.results)
        ) {
          view = instance.proxy;
        }
        findComponents(instance.subTree, depth + 1);
      }
      if (vnode.suspense) {
        findComponents(vnode.suspense.activeBranch, depth + 1);
        findComponents(vnode.suspense.pendingBranch, depth + 1);
      }
      if (Array.isArray(vnode.children)) {
        vnode.children.forEach((child) => findComponents(child, depth + 1));
      }
      if (Array.isArray(vnode.dynamicChildren)) {
        vnode.dynamicChildren.forEach((child) => findComponents(child, depth + 1));
      }
    }
    findComponents(root, 0);

    if (!view) {
      throw new Error("Could not find PhotoPrism's active photo gallery.");
    }

    const globals = view.$?.appContext?.config?.globalProperties;
    const api = view.$api || globals?.$api || window.$api;
    const events = view.$event || globals?.$event;
    if (typeof api?.get !== "function" || typeof events?.publish !== "function") {
      throw new Error("Could not access PhotoPrism's API client.");
    }

    // The same search that the gallery itself uses, without its paging.
    const baseParams = { ...view.searchParams() };
    delete baseParams.count;
    delete baseParams.offset;
    const key = JSON.stringify(baseParams);

    async function fetchMedia(offset, count) {
      const response = await api.get("photos/view", {
        params: { ...baseParams, offset, count },
        timeout: REQUEST_TIMEOUT_MS,
      });
      return Array.isArray(response?.data) ? response.data : [];
    }

    // Finds how many media the search has: doubles the offset until it is past the end,
    // then narrows the end down. The media that are already loaded give a starting point.
    async function countMedia(loaded) {
      const exists = async (offset) => (await fetchMedia(offset, 1)).length > 0;
      let known = loaded - 1;
      if (known < 0) {
        if (!(await exists(0))) {
          return 0;
        }
        known = 0;
      }

      let step = Math.max(loaded, 1);
      let end;
      for (;;) {
        const probe = Math.min(known + step, MAX_OFFSET);
        if (!(await exists(probe))) {
          end = probe;
          break;
        }
        known = probe;
        if (known >= MAX_OFFSET) {
          return MAX_OFFSET + 1;
        }
        step *= 2;
      }

      while (end - known > 1) {
        const middle = Math.floor((known + end) / 2);
        if (await exists(middle)) {
          known = middle;
        } else {
          end = middle;
        }
      }
      return known + 1;
    }

    let media = [];
    let randomIndex = 0;
    let windowStart = 0;
    for (let attempt = 0; attempt < 2 && !media.length; attempt += 1) {
      const cacheValid = attempt === 0
        && state.key === key
        && state.total > 0
        && Date.now() - state.countedAt < COUNT_CACHE_MS;
      if (!cacheValid) {
        state.total = await countMedia(attempt === 0 ? view.results.length : 0);
        state.key = key;
        state.countedAt = Date.now();
      }
      if (state.total < 1) {
        throw new Error("No media are currently available in this PhotoPrism gallery.");
      }

      randomIndex = Math.floor(Math.random() * state.total);
      windowStart = Math.max(
        0,
        Math.min(randomIndex - Math.floor(WINDOW_SIZE / 2), state.total - WINDOW_SIZE),
      );
      media = await fetchMedia(windowStart, WINDOW_SIZE);
    }
    if (!media.length) {
      state.countedAt = 0;
      throw new Error("PhotoPrism returned no media for the random selection.");
    }
    randomIndex = Math.min(randomIndex, windowStart + media.length - 1);
    const total = state.total;

    // The viewer cannot be given new media while it is open, so close it first and wait
    // until PhotoPrism has finished cleaning up. Opening too early would let that clean-up
    // wipe the new media again and leave the viewer unusable until the page is reloaded.
    if (lightboxIsOpen(lightbox)) {
      const closing = getSlideshow(lightbox);
      if (typeof closing?.close !== "function") {
        throw new Error("The PhotoPrism viewer could not be closed.");
      }

      let closedEvent = false;
      const token = events.subscribe?.("lightbox.closed", () => {
        closedEvent = true;
      });
      try {
        closing.close();
        if (!(await waitUntil(() => !lightboxIsOpen(lightbox), 5000))) {
          throw new Error("The PhotoPrism viewer did not close in time.");
        }
        await waitUntil(() => closedEvent, 1000);
      } finally {
        if (token !== undefined) {
          events.unsubscribe?.(token);
        }
      }
    }
    await waitUntil(() => !lightboxIsBusy(lightbox), 3000);
    await sleep(100);

    const Thumb = lightbox?.proxy?.model?.constructor;
    const wrap = (items) => (typeof Thumb?.wrap === "function" ? Thumb.wrap(items) : items);
    let placeholder = null;
    try {
      placeholder = typeof Thumb?.notFound === "function" ? Thumb.notFound() : null;
    } catch {
      placeholder = null;
    }
    if (!placeholder) {
      placeholder = typeof Thumb === "function" ? new Thumb() : {};
    }

    // The viewer gets a list as long as the whole result set, so that a position in the list
    // is a position in the gallery. Only the fetched window holds real media at first, the rest
    // is filled in while the user navigates (see enableEdgeLoading).
    const models = new Array(total).fill(placeholder);
    wrap(media).forEach((model, offset) => {
      models[windowStart + offset] = model;
    });

    events.publish("lightbox.open", {
      models,
      index: randomIndex,
      collection: view.model,
      context: typeof view.getContext === "function" ? view.getContext() : undefined,
    });

    if (!(await waitUntil(() => lightboxIsOpen(lightbox), 5000))) {
      throw new Error("The PhotoPrism viewer did not open.");
    }

    // The slideshow is created a little after the viewer becomes visible.
    const slideshowReady = await waitUntil(() => {
      const candidate = getSlideshow(lightbox);
      return Boolean(candidate?.currSlide) && Number.isInteger(candidate.currIndex);
    }, 5000);
    const slideshow = slideshowReady ? getSlideshow(lightbox) : null;

    // Make sure that the viewer really shows the picked media.
    if (
      slideshow
      && slideshow.currIndex !== randomIndex
      && typeof slideshow.goTo === "function"
    ) {
      slideshow.goTo(randomIndex);
    }
    console.info("QoolPrism random:", {
      total,
      windowStart,
      windowLength: media.length,
      target: randomIndex,
      shown: slideshow?.currIndex,
    });

    // Loads more media when the viewer gets close to the end of what is loaded.
    // PhotoPrism pages through its results in "rows", and several rows can end up as one media
    // item (for example the files of a stack). The row offsets therefore do not match the
    // positions of the media in the viewer. So the loaded media is extended one page at a time
    // in the row space, and the new media is placed right next to the loaded media, skipping
    // anything that is already there. This keeps the viewer free of repeated media.
    function enableEdgeLoading() {
      const lists = [lightbox?.proxy?.models, slideshow.options?.dataSource]
        .filter((list, index, all) => Array.isArray(list) && all.indexOf(list) === index);
      const picked = media[randomIndex - windowStart];
      if (
        !lists.length
        || slideshow.getNumItems?.() !== total
        || lists.some((list) => list[randomIndex]?.UID !== picked?.UID)
      ) {
        console.warn("QoolPrism random: the viewer's media list could not be extended.");
        return;
      }

      const seen = new Set(media.map((item) => item.UID));
      let loadedStart = windowStart; // Viewer position of the first loaded media.
      let loadedEnd = windowStart + media.length - 1; // Viewer position of the last loaded media.
      let fetchedLow = windowStart; // First row offset that was fetched.
      let fetchedHigh = windowStart + WINDOW_SIZE; // Row offset after the last fetched one.
      let reachedEnd = false;
      let loadingForward = false;
      let loadingBackward = false;

      function place(items, firstPosition) {
        wrap(items).forEach((model, offset) => {
          for (const list of lists) {
            list[firstPosition + offset] = model;
          }
        });
        items.forEach((item) => seen.add(item.UID));

        // Slides that were showing a placeholder pick up the media that arrived.
        const current = slideshow.currIndex;
        if (Number.isInteger(current)) {
          for (let offset = 0; offset < items.length; offset += 1) {
            if (Math.abs(firstPosition + offset - current) <= 2) {
              slideshow.refreshSlideContent?.(firstPosition + offset);
            }
          }
        }
      }

      async function loadForward() {
        if (loadingForward || reachedEnd) {
          return;
        }

        loadingForward = true;
        try {
          const offset = fetchedHigh;
          const items = await fetchMedia(offset, WINDOW_SIZE);
          fetchedHigh = offset + WINDOW_SIZE;
          if (!items.length) {
            reachedEnd = true;
            return;
          }

          const fresh = items.filter((item) => !seen.has(item.UID));
          if (fresh.length) {
            place(fresh, loadedEnd + 1);
            loadedEnd += fresh.length;
          }
        } catch (error) {
          console.warn("QoolPrism random: could not load more media.", error);
        } finally {
          loadingForward = false;
        }
      }

      async function loadBackward() {
        if (loadingBackward || fetchedLow <= 0) {
          return;
        }

        loadingBackward = true;
        try {
          const low = Math.max(0, fetchedLow - WINDOW_SIZE);
          const items = await fetchMedia(low, fetchedLow - low);
          fetchedLow = low;

          const fresh = items.filter((item) => !seen.has(item.UID));
          const usable = fresh.slice(Math.max(0, fresh.length - loadedStart));
          if (usable.length) {
            place(usable, loadedStart - usable.length);
            loadedStart -= usable.length;
          }
        } catch (error) {
          console.warn("QoolPrism random: could not load more media.", error);
        } finally {
          loadingBackward = false;
        }
      }

      function loadNearEdges() {
        const current = slideshow.currIndex;
        if (!Number.isInteger(current)) {
          return;
        }
        if (current >= loadedEnd - EDGE_DISTANCE) {
          loadForward();
        }
        if (current <= loadedStart + EDGE_DISTANCE) {
          loadBackward();
        }
      }

      slideshow.on("change", loadNearEdges);
      loadNearEdges();
    }
    if (slideshow && typeof slideshow.on === "function") {
      enableEdgeLoading();
    }
    return { opened: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  } finally {
    state.busySince = 0;
  }
}

function openGalleryCoverInPage(coverUid) {
  const cover = Array.from(document.querySelectorAll([
    ".p-page-albums .result[data-uid]:not(.placeholder)",
    ".p-page-subjects .result[data-uid]:not(.placeholder)",
    ".p-page-labels .result[data-uid]:not(.placeholder)",
    ".p-page-files .result.is-folder[data-uid]:not(.placeholder)",
  ].join(", "))).find((element) => element.getAttribute("data-uid") === coverUid);
  if (!cover) {
    throw new Error("The selected cover is no longer available on this PhotoPrism page.");
  }

  const root = document.querySelector("#app")?._vnode;
  if (!root) {
    throw new Error("Could not find PhotoPrism's active page.");
  }

  const visited = new Set();
  let page;
  function findPage(vnode, depth) {
    if (!vnode || typeof vnode !== "object" || depth > 100 || visited.has(vnode)) {
      return;
    }
    visited.add(vnode);

    if (vnode.el === cover) {
      for (let component = vnode.ctx; component; component = component.parent) {
        const results = component.proxy?.results;
        if (Array.isArray(results) && results.some((item) => item.UID === coverUid)) {
          page = component.proxy;
          return;
        }
      }
    }

    if (vnode.component) {
      findPage(vnode.component.subTree, depth + 1);
    }
    if (vnode.suspense) {
      findPage(vnode.suspense.activeBranch, depth + 1);
      findPage(vnode.suspense.pendingBranch, depth + 1);
    }
    if (Array.isArray(vnode.children)) {
      vnode.children.forEach((child) => findPage(child, depth + 1));
    }
    if (Array.isArray(vnode.dynamicChildren)) {
      vnode.dynamicChildren.forEach((child) => findPage(child, depth + 1));
    }
  }
  findPage(root, 0);

  if (!page || !Array.isArray(page.results)) {
    throw new Error("Could not find the selected cover in PhotoPrism's active page.");
  }

  const index = page.results.findIndex((item) => item.UID === coverUid);
  const item = page.results[index];
  if (index < 0 || !item) {
    throw new Error("The selected cover is no longer available on this PhotoPrism page.");
  }

  if (typeof item.isFile === "function" && !item.isFile() && typeof page.openFile === "function") {
    page.openFile(index);
    return { opened: true };
  }

  if (typeof item.route === "function") {
    const router = page.$router || page.$?.appContext?.config?.globalProperties?.$router;
    if (typeof router?.push !== "function") {
      throw new Error("PhotoPrism's page cannot open the selected cover.");
    }
    router.push(item.route(page.view));
    return { opened: true };
  }

  throw new Error("PhotoPrism cannot open the selected cover from this page.");
}

// Runs in the PhotoPrism page. Returns the UID of the media that the viewer is showing.
function getViewerMediaUidInPage() {
  try {
    const root = document.querySelector("#app")?._vnode;
    if (!root) {
      throw new Error("Could not find PhotoPrism's viewer.");
    }

    const visited = new Set();
    let lightbox = null;
    function findLightbox(vnode, depth) {
      if (!vnode || typeof vnode !== "object" || depth > 100 || visited.has(vnode) || lightbox) {
        return;
      }
      visited.add(vnode);

      const instance = vnode.component;
      if (instance) {
        if (instance.type?.name === "PLightbox" || instance.type?.__name === "PLightbox") {
          lightbox = instance;
          return;
        }
        findLightbox(instance.subTree, depth + 1);
      }
      if (vnode.suspense) {
        findLightbox(vnode.suspense.activeBranch, depth + 1);
        findLightbox(vnode.suspense.pendingBranch, depth + 1);
      }
      if (Array.isArray(vnode.children)) {
        vnode.children.forEach((child) => findLightbox(child, depth + 1));
      }
      if (Array.isArray(vnode.dynamicChildren)) {
        vnode.dynamicChildren.forEach((child) => findLightbox(child, depth + 1));
      }
    }
    findLightbox(root, 0);

    const uid = lightbox?.proxy?.model?.UID;
    if (typeof uid !== "string" || !uid) {
      throw new Error("Could not identify the media shown in the viewer.");
    }
    return { uid };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Runs in the PhotoPrism page, which is already logged in, so no extra authentication is needed.
// Uploads the new media, copies the albums, labels and people of the target media to it,
// and archives the target media.
async function replaceImageInPage(targetUid, sourceUrl, fileName) {
  const state = window.__qoolprismReplace || (window.__qoolprismReplace = { busy: false });
  if (state.busy) {
    return { error: "Another replacement is still in progress." };
  }
  state.busy = true;

  const warnings = [];
  const describe = (error) => error?.response?.data?.error
    || (error instanceof Error ? error.message : String(error));

  // Hex SHA-1 of the file, which is the hash PhotoPrism stores. SubtleCrypto only exists on
  // secure pages, so servers that are used over plain HTTP need the fallback.
  async function sha1Hex(bytes) {
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-1", bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    const padded = new Uint8Array((((bytes.length + 8) >> 6) << 6) + 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
    view.setUint32(padded.length - 4, (bytes.length << 3) >>> 0);
    const rotate = (value, bits) => (value << bits) | (value >>> (32 - bits));
    const words = new Uint32Array(80);
    let [h0, h1, h2, h3, h4] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let index = 0; index < 16; index += 1) {
        words[index] = view.getUint32(offset + (index * 4));
      }
      for (let index = 16; index < 80; index += 1) {
        words[index] = rotate(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1);
      }
      let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
      for (let index = 0; index < 80; index += 1) {
        let f;
        let k;
        if (index < 20) {
          f = (b & c) | (~b & d);
          k = 0x5A827999;
        } else if (index < 40) {
          f = b ^ c ^ d;
          k = 0x6ED9EBA1;
        } else if (index < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = 0x8F1BBCDC;
        } else {
          f = b ^ c ^ d;
          k = 0xCA62C1D6;
        }
        const next = (rotate(a, 5) + f + e + k + words[index]) >>> 0;
        e = d;
        d = c;
        c = rotate(b, 30) >>> 0;
        b = a;
        a = next;
      }
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
    }
    return [h0, h1, h2, h3, h4].map((value) => value.toString(16).padStart(8, "0")).join("");
  }

  const pickFile = (photo) => (photo.Files || []).find((file) => file.Primary) || (photo.Files || [])[0];

  // Share of the two areas that lies in both of them.
  function overlap(a, b) {
    const width = Math.min(a.X + a.W, b.X + b.W) - Math.max(a.X, b.X);
    const height = Math.min(a.Y + a.H, b.Y + b.H) - Math.max(a.Y, b.Y);
    if (width <= 0 || height <= 0) {
      return 0;
    }
    const shared = width * height;
    return shared / ((a.W * a.H) + (b.W * b.H) - shared);
  }

  try {
    const app = document.querySelector("#app");
    const globals = app?.__vue_app__?.config?.globalProperties
      || app?._vnode?.appContext?.config?.globalProperties;
    const api = globals?.$api || window.$api;
    const notify = globals?.$notify;
    const userUid = globals?.$session?.getUserUID?.();
    if (typeof api?.get !== "function" || !userUid) {
      throw new Error("Could not access PhotoPrism's API client.");
    }

    notify?.info?.("Replacing image…");

    // What the new media inherits from the target media.
    const target = (await api.get(`photos/${targetUid}`)).data;
    const albumUids = (target.Albums || [])
      .filter((album) => album?.UID && (!album.Type || album.Type === "album"))
      .map((album) => album.UID);
    const labels = (target.Labels || [])
      .filter((item) => item?.Label?.Name && item.Uncertainty < 100)
      .map((item) => ({
        Name: item.Label.Name,
        Priority: item.Label.Priority || 0,
        Uncertainty: item.Uncertainty,
      }));
    const targetFile = pickFile(target);
    const people = (targetFile?.Markers || [])
      .filter((marker) => marker.Type === "face" && !marker.Invalid && marker.Name && marker.W > 0 && marker.H > 0);

    // Upload the new media and import it into the library.
    const response = await fetch(sourceUrl);
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("The replacement file is empty.");
    }

    let name = fileName || "replacement";
    if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) {
      const subtype = (blob.type.split("/")[1] || "jpeg").split("+")[0];
      name += `.${subtype === "jpeg" ? "jpg" : subtype}`;
    }

    const hash = await sha1Hex(new Uint8Array(await blob.arrayBuffer()));
    const token = Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) => (byte % 36).toString(36)).join("");
    const formData = new FormData();
    formData.append("files", new File([blob], name, { type: blob.type }));
    await api.post(`users/${userUid}/upload/${token}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await api.put(`users/${userUid}/upload/${token}`, { albums: [] });

    // Find the imported media by the hash of its file.
    const found = (await api.get("photos", { params: { hash, count: 1 } })).data;
    const newUid = Array.isArray(found) ? found[0]?.UID : null;
    if (!newUid) {
      throw new Error("The file was uploaded, but PhotoPrism did not add it to the library.");
    }
    if (newUid === targetUid) {
      throw new Error("The replacement is identical to the media that is shown.");
    }

    for (const albumUid of albumUids) {
      await api.post(`albums/${albumUid}/photos`, { photos: [newUid] });
    }
    for (const label of labels) {
      await api.post(`photos/${newUid}/label`, label);
    }

    // People: the face areas are relative to the size of the image, so a copy with other
    // dimensions keeps them as long as it has the same proportions.
    if (people.length) {
      const created = (await api.get(`photos/${newUid}`)).data;
      const newFile = pickFile(created);
      const aspect = (file) => file.Width / file.Height;
      if (!(targetFile?.Width > 0 && targetFile?.Height > 0 && newFile?.Width > 0 && newFile?.Height > 0)) {
        warnings.push("The people were not copied because the size of the images is unknown.");
      } else if (Math.abs(aspect(newFile) - aspect(targetFile)) / aspect(targetFile) > 0.02) {
        warnings.push("The people were not copied because the new image has different proportions.");
      } else {
        const detected = (newFile.Markers || []).filter((marker) => marker.Type === "face" && !marker.Invalid);
        const used = new Set();
        for (const person of people) {
          const area = { X: person.X, Y: person.Y, W: person.W, H: person.H };
          let match = null;
          let best = 0.3;
          for (const marker of detected) {
            const score = used.has(marker.UID) ? 0 : overlap(area, marker);
            if (score > best) {
              match = marker;
              best = score;
            }
          }

          try {
            if (match) {
              used.add(match.UID);
              if (match.Name !== person.Name) {
                await api.put(`markers/${match.UID}`, { SubjSrc: "manual", Name: person.Name });
              }
            } else {
              await api.post("markers", {
                FileUID: newFile.UID,
                Type: "face",
                Src: "manual",
                ...area,
                SubjSrc: "manual",
                Name: person.Name,
              });
            }
          } catch (error) {
            warnings.push(`Could not add ${person.Name} to the new image (${describe(error)}).`);
          }
        }
      }
    }

    await api.post("batch/photos/archive", { photos: [targetUid] });
    notify?.success?.("Image replaced");
    return { warnings };
  } catch (error) {
    return { error: describe(error) };
  } finally {
    state.busy = false;
  }
}

function fetchImageFromTab(tabId, frameId, imageUrl) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "fetch-image-for-yandex", imageUrl },
      { frameId },
      (response) => {
        if (!chrome.runtime.lastError && response?.ok && response.dataUrl) {
          resolve(response);
          return;
        }

        fetch(imageUrl, { credentials: "include" })
          .then(async (result) => {
            if (!result.ok) {
              throw new Error(`The image server responded with ${result.status}.`);
            }

            const blob = await result.blob();
            if (!blob.type.startsWith("image/")) {
              throw new Error("The selected media is not an image that can be uploaded.");
            }
            if (blob.size > MAX_IMAGE_SIZE_BYTES) {
              throw new Error("The image is larger than the 20 MB upload limit.");
            }

            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = "";
            for (let offset = 0; offset < bytes.length; offset += 0x8000) {
              binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
            }

            resolve({
              ok: true,
              dataUrl: `data:${blob.type};base64,${btoa(binary)}`,
              fileName: getImageFileName(new URL(imageUrl)),
            });
          })
          .catch(reject);
      },
    );
  });
}

function waitForTabToLoad(tabId) {
  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve();
      }
    };

    timeout = setTimeout(() => fail(new Error("Yandex did not finish loading in time.")), 30000);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        fail(new Error(chrome.runtime.lastError.message));
      } else if (tab.status === "complete") {
        cleanup();
        resolve();
      }
    });
  });
}

async function uploadImageToYandex(tabId, imageData) {
  await waitForTabToLoad(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [imageData.dataUrl, imageData.fileName],
    func: async (dataUrl, fileName) => {
      const imageSearchButton = Array.from(document.querySelectorAll("button"))
        .find((button) => /image search|поиск по изображ/i.test([
          button.getAttribute("aria-label"),
          button.getAttribute("title"),
          button.innerText,
        ].filter(Boolean).join(" ")));
      imageSearchButton?.click();

      const deadline = Date.now() + 15000;
      let fileInput = null;
      while (Date.now() < deadline) {
        fileInput = document.querySelector('input[type="file"][accept*="image"]');
        if (fileInput) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!fileInput) {
        throw new Error("Yandex's image upload control could not be found.");
      }

      const [metadata, encoded] = dataUrl.split(",", 2);
      const mimeType = /^data:([^;]+)/.exec(metadata)?.[1];
      if (!mimeType || !mimeType.startsWith("image/") || !encoded) {
        throw new Error("The selected image data is invalid.");
      }

      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const file = new File([bytes], fileName, { type: mimeType });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const setFiles = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "files",
      )?.set;
      if (!setFiles) {
        throw new Error("The browser cannot provide the image to Yandex.");
      }

      setFiles.call(fileInput, transfer.files);
      fileInput.dispatchEvent(new Event("input", { bubbles: true }));
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      if (fileInput.files.length !== 1 || fileInput.files[0].name !== fileName) {
        throw new Error("Yandex did not accept the selected image.");
      }
    },
  });
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

// Re-encodes images above iqdb's upload limit as JPEG, lowering the quality and then
// the size until the file fits. Smaller images are passed through untouched.
async function shrinkImageForIqdb(imageData) {
  const original = await (await fetch(imageData.dataUrl)).blob();
  if (original.size <= IQDB_MAX_UPLOAD_BYTES) {
    return imageData;
  }

  const bitmap = await createImageBitmap(original);
  try {
    let scale = Math.min(1, IQDB_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff"; // JPEG has no transparency
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.92, 0.85, 0.75]) {
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
        if (blob.size <= IQDB_MAX_UPLOAD_BYTES) {
          return {
            ok: true,
            dataUrl: await blobToDataUrl(blob),
            fileName: `${imageData.fileName.replace(/\.[^./]+$/, "")}.jpg`,
          };
        }
      }
      scale *= 0.8;
    }
  } finally {
    bitmap.close();
  }

  throw new Error("The image could not be reduced below iqdb's 8 MB upload limit.");
}

async function uploadImageToIqdb(tabId, imageData) {
  await waitForTabToLoad(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [imageData.dataUrl, imageData.fileName],
    func: (dataUrl, fileName) => {
      const fileInput = document.querySelector('form input[type="file"]');
      if (!fileInput?.form) {
        throw new Error("iqdb's image upload form could not be found.");
      }

      const [metadata, encoded] = dataUrl.split(",", 2);
      const mimeType = /^data:([^;]+)/.exec(metadata)?.[1];
      if (!mimeType || !mimeType.startsWith("image/") || !encoded) {
        throw new Error("The selected image data is invalid.");
      }

      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type: mimeType }));
      fileInput.files = transfer.files;
      if (fileInput.files.length !== 1) {
        throw new Error("iqdb did not accept the selected image.");
      }

      // Deferred so this script can return before the page navigates to the results.
      const form = fileInput.form;
      window.setTimeout(() => form.requestSubmit(), 0);
    },
  });
}

async function uploadImageToGoogleLens(tabId, imageData) {
  await waitForTabToLoad(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [imageData.dataUrl, imageData.fileName],
    func: (dataUrl, fileName) => {
      const [metadata, encoded] = dataUrl.split(",", 2);
      const mimeType = /^data:([^;]+)/.exec(metadata)?.[1];
      if (!mimeType || !mimeType.startsWith("image/") || !encoded) {
        throw new Error("The selected image data is invalid.");
      }

      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      // Posts the image to Google Lens's upload endpoint, which opens the results right away.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://lens.google.com/v3/upload";
      form.enctype = "multipart/form-data";
      form.hidden = true;

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.name = "encoded_image";
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type: mimeType }));
      fileInput.files = transfer.files;
      if (fileInput.files.length !== 1) {
        throw new Error("Google did not accept the selected image.");
      }

      form.append(fileInput);
      document.body.append(form);

      // Deferred so this script can return before the page navigates to the results.
      window.setTimeout(() => form.submit(), 0);
    },
  });
}

const IMAGE_SEARCH_SERVICES = {
  [GOOGLE_LENS_MENU_ID]: {
    title: "Google Lens image search",
    name: "Google Lens",
    url: GOOGLE_LENS_URL,
    prepare: async (imageData) => imageData,
    upload: uploadImageToGoogleLens,
  },
  [YANDEX_IMAGE_MENU_ID]: {
    title: "Yandex image search",
    name: "Yandex",
    url: YANDEX_IMAGES_URL,
    prepare: async (imageData) => imageData,
    upload: uploadImageToYandex,
  },
  [IQDB_IMAGE_MENU_ID]: {
    title: "IQDB image search",
    name: "iqdb",
    url: IQDB_IMAGES_URL,
    prepare: shrinkImageForIqdb,
    upload: uploadImageToIqdb,
  },
};

// Opens the search site in a new tab and uploads the image there. The media is either
// an image URL on the PhotoPrism server or the data URL of a captured video frame.
function startImageSearch(service, tabId, media) {
  chrome.tabs.create({ url: service.url }, (searchTab) => {
    if (chrome.runtime.lastError || !searchTab?.id) {
      showImageSearchError(
        tabId,
        chrome.runtime.lastError?.message || `Could not open ${service.name}.`,
        service.title,
      );
      return;
    }

    const pageReady = waitForTabToLoad(searchTab.id);
    Promise.all([
      pageReady,
      media.dataUrl
        ? Promise.resolve({ ok: true, dataUrl: media.dataUrl, fileName: media.fileName })
        : fetchImageFromTab(tabId, 0, media.imageUrl),
    ])
      .then(async ([, imageData]) => service.upload(searchTab.id, await service.prepare(imageData)))
      .catch(async (error) => {
        await pageReady.catch(() => {});
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        showImageSearchError(searchTab.id, message, service.title);
      });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  syncConfiguredServer().catch((error) => {
    console.error("Could not restore PhotoPrism extension settings.", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  syncConfiguredServer().catch((error) => {
    console.error("Could not restore PhotoPrism extension settings.", error);
  });
});

// Runs in the PhotoPrism page. Captures the people list PhotoPrism loads for the viewer
// and passes each person's name and cover image hash to the extension.
function capturePersonThumbsInPage() {
  if (window.__qoolprismPersonCapture) {
    return;
  }
  window.__qoolprismPersonCapture = true;

  function isPersonListUrl(url) {
    return /\/api\/v1\/subjects\?/.test(url) && /[?&]type=person(&|$)/.test(url);
  }

  function publish(subjects) {
    if (!Array.isArray(subjects)) {
      return;
    }

    const thumbs = {};
    for (const subject of subjects) {
      if (subject && typeof subject.Name === "string" && typeof subject.Thumb === "string" && subject.Thumb) {
        thumbs[subject.Name] = subject.Thumb;
      }
    }

    window.postMessage(
      { source: "qoolprism", type: "person-thumbs", thumbs },
      window.location.origin,
    );
  }

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__qoolprismUrl = String(url);
    return nativeOpen.call(this, method, url, ...rest);
  };

  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    if (isPersonListUrl(this.__qoolprismUrl || "")) {
      this.addEventListener("load", () => {
        try {
          publish(this.responseType === "json" ? this.response : JSON.parse(this.responseText));
        } catch {
          // Not the people list; ignore.
        }
      });
    }
    return nativeSend.apply(this, args);
  };

  const nativeFetch = window.fetch;
  window.fetch = function patchedFetch(input, init) {
    const promise = nativeFetch.call(this, input, init);
    try {
      const url = typeof input === "string" ? input : input?.url;
      if (isPersonListUrl(String(url || ""))) {
        promise.then((response) => response.clone().json()).then(publish).catch(() => {});
      }
    } catch {
      // Ignore capture problems; the page's own request is unaffected.
    }
    return promise;
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message?.type === "capture-person-thumbs") {
    let senderOrigin;
    try {
      senderOrigin = new URL(sender.url).origin;
    } catch {
      sendResponse({ ok: false, error: "Could not verify the PhotoPrism tab origin." });
      return false;
    }

    if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0) {
      sendResponse({ ok: false, error: "Could not identify the PhotoPrism tab." });
      return false;
    }

    chrome.storage.local.get(SERVER_ORIGIN_KEY)
      .then((settings) => {
        if (settings[SERVER_ORIGIN_KEY] !== senderOrigin) {
          throw new Error("This tab is not the configured PhotoPrism server.");
        }

        return chrome.scripting.executeScript({
          target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
          world: "MAIN",
          func: capturePersonThumbsInPage,
        });
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "An unexpected error occurred." });
      });

    return true;
  }

  if (message?.type === "image-search") {
    if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0 || !sender.url) {
      sendResponse({ ok: false, error: "Could not identify the PhotoPrism tab." });
      return false;
    }

    let senderOrigin;
    try {
      senderOrigin = new URL(sender.url).origin;
    } catch {
      sendResponse({ ok: false, error: "Could not verify the PhotoPrism tab origin." });
      return false;
    }

    const service = Object.hasOwn(IMAGE_SEARCH_SERVICES, message.service)
      ? IMAGE_SEARCH_SERVICES[message.service]
      : null;
    if (!service) {
      sendResponse({ ok: false, error: "Unknown image search service." });
      return false;
    }

    const isVideo = message.mediaType === "video";
    let imageUrl = null;
    if (isVideo) {
      if (typeof message.dataUrl !== "string" || !message.dataUrl.startsWith("data:image/")) {
        sendResponse({ ok: false, error: "Could not capture the current video frame." });
        return false;
      }
    } else {
      try {
        imageUrl = new URL(message.imageUrl);
      } catch {
        sendResponse({ ok: false, error: "Could not identify the selected image." });
        return false;
      }
      if (imageUrl.origin !== senderOrigin) {
        sendResponse({ ok: false, error: "The selected image is not on the PhotoPrism server." });
        return false;
      }
    }

    // Requested right away, before anything is awaited, so that the click in the viewer
    // still counts as the user gesture the browser requires for the permission prompt.
    const permission = chrome.permissions.request({
      origins: [`${new URL(service.url).origin}/*`],
    });
    Promise.all([permission, chrome.storage.local.get(SERVER_ORIGIN_KEY)])
      .then(([granted, settings]) => {
        if (settings[SERVER_ORIGIN_KEY] !== senderOrigin) {
          throw new Error("This tab is not the configured PhotoPrism server.");
        }
        if (!granted) {
          throw new Error(`Allow access to ${service.name} to upload the selected ${isVideo ? "video frame" : "image"}.`);
        }

        startImageSearch(service, sender.tab.id, {
          imageUrl: imageUrl?.href,
          dataUrl: isVideo ? message.dataUrl : null,
          fileName: typeof message.fileName === "string" ? message.fileName : "photoprism-video-frame.jpg",
        });
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "An unexpected error occurred." });
      });

    return true;
  }

  if (message?.type === "replace-image") {
    if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0 || !sender.url) {
      sendResponse({ ok: false, error: "Could not identify the PhotoPrism tab." });
      return false;
    }

    let senderOrigin;
    try {
      senderOrigin = new URL(sender.url).origin;
    } catch {
      sendResponse({ ok: false, error: "Could not verify the PhotoPrism tab origin." });
      return false;
    }

    const fromUrl = message.sourceType === "url";
    let imageUrl = null;
    if (fromUrl) {
      try {
        imageUrl = new URL(message.imageUrl);
      } catch {
        sendResponse({ ok: false, error: "Enter a valid image URL." });
        return false;
      }
      if (!["http:", "https:"].includes(imageUrl.protocol)) {
        sendResponse({ ok: false, error: "The image URL must use HTTP or HTTPS." });
        return false;
      }
    } else if (typeof message.blobUrl !== "string" || !message.blobUrl.startsWith(`blob:${senderOrigin}/`)) {
      sendResponse({ ok: false, error: "Could not read the selected file." });
      return false;
    }

    // Requested right away, before anything is awaited, so that the click in the viewer
    // still counts as the user gesture the browser requires for the permission prompt.
    const permission = fromUrl
      ? chrome.permissions.request({ origins: [`${imageUrl.protocol}//${imageUrl.hostname}/*`] })
      : Promise.resolve(true);
    const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
    Promise.all([permission, chrome.storage.local.get(SERVER_ORIGIN_KEY)])
      .then(async ([granted, settings]) => {
        if (settings[SERVER_ORIGIN_KEY] !== senderOrigin) {
          throw new Error("This tab is not the configured PhotoPrism server.");
        }
        if (!granted) {
          throw new Error(`Allow access to ${imageUrl.hostname} to download the replacement image.`);
        }

        // The media is identified first, so that browsing on in the viewer cannot change the target.
        const [current] = await chrome.scripting.executeScript({
          target,
          world: "MAIN",
          func: getViewerMediaUidInPage,
        });
        if (current?.result?.error || !current?.result?.uid) {
          throw new Error(current?.result?.error || "Could not identify the media shown in the viewer.");
        }

        let source = message.blobUrl;
        let fileName = typeof message.fileName === "string" ? message.fileName : "replacement";
        if (fromUrl) {
          const result = await fetch(imageUrl.href);
          if (!result.ok) {
            throw new Error(`The image server responded with ${result.status}.`);
          }

          const blob = await result.blob();
          if (!/^(image|video)\//.test(blob.type)) {
            throw new Error("The URL does not point to an image or video file.");
          }
          if (blob.size > MAX_REPLACE_URL_BYTES) {
            throw new Error("The file is larger than the 20 MB limit for URLs.");
          }

          source = await blobToDataUrl(blob);
          fileName = getImageFileName(imageUrl);
        }

        const [replaced] = await chrome.scripting.executeScript({
          target,
          world: "MAIN",
          func: replaceImageInPage,
          args: [current.result.uid, source, fileName],
        });
        if (replaced?.result?.error) {
          throw new Error(replaced.result.error);
        }
        sendResponse({ ok: true, warnings: replaced?.result?.warnings || [] });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "An unexpected error occurred." });
      });

    return true;
  }

  if (
    ["open-random-photo", "get-gallery-media", "open-gallery-media", "open-gallery-cover"]
      .includes(message?.type)
  ) {
    if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0 || !sender.url) {
      sendResponse({ ok: false, error: "Could not identify the PhotoPrism tab." });
      return false;
    }

    let senderOrigin;
    try {
      senderOrigin = new URL(sender.url).origin;
    } catch {
      sendResponse({ ok: false, error: "Could not verify the PhotoPrism tab origin." });
      return false;
    }

    if (message.type === "open-gallery-media" && typeof message.mediaUid !== "string") {
      sendResponse({ ok: false, error: "Could not identify the selected gallery media." });
      return false;
    }
    if (message.type === "open-gallery-cover" && typeof message.coverUid !== "string") {
      sendResponse({ ok: false, error: "Could not identify the selected gallery cover." });
      return false;
    }

    const args = message.type === "get-gallery-media"
      ? [null, true]
      : message.type === "open-gallery-media"
        ? [message.mediaUid]
        : message.type === "open-gallery-cover"
          ? [message.coverUid]
        : [];
    const func = message.type === "open-gallery-cover"
      ? openGalleryCoverInPage
      : message.type === "open-random-photo"
        ? openRandomPhotoInPage
        : handleGalleryMediaInPage;
    chrome.storage.local.get(SERVER_ORIGIN_KEY)
      .then((settings) => {
        if (settings[SERVER_ORIGIN_KEY] !== senderOrigin) {
          throw new Error("This tab is not the configured PhotoPrism server.");
        }

        return chrome.scripting.executeScript({
          target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
          world: "MAIN",
          func,
          args,
        });
      })
      .then((results) => {
        if (
          message.type === "get-gallery-media"
          && Array.isArray(results[0]?.result?.mediaUids)
        ) {
          sendResponse({ ok: true, mediaUids: results[0].result.mediaUids });
          return;
        }
        if (results[0]?.result?.error) {
          throw new Error(results[0].result.error);
        }
        if (!results[0]?.result?.opened) {
          throw new Error("PhotoPrism did not open a gallery image.");
        }
        sendResponse({ ok: true });
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Could not process a PhotoPrism gallery image request.", error);
        sendResponse({ ok: false, error: messageText });
      });

    return true;
  }

  if (sender.url !== chrome.runtime.getURL("popup.html")) {
    return false;
  }

  let operation;
  if (message?.type === "configure-server" && typeof message.serverUrl === "string") {
    operation = configureServer(message.serverUrl);
  } else if (message?.type === "clear-server") {
    operation = clearServer();
  } else {
    return false;
  }

  operation
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    });

  return true;
});
