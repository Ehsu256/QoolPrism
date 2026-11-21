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
  let photoViewer;
  function findGallery(vnode, depth) {
    if (!vnode || typeof vnode !== "object" || depth > 100 || visited.has(vnode)) {
      return;
    }
    visited.add(vnode);

    const componentInstance = vnode.component;
    if (
      componentInstance
      && (componentInstance.type?.name === "PLightbox" || componentInstance.type?.__name === "PLightbox")
    ) {
      photoViewer = componentInstance;
    }

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
  const mediaIndexes = Array.isArray(photos) ? photos.reduce((indexes, photo, index) => {
    if (typeof photo?.UID === "string") {
      indexes.push(index);
    }
    return indexes;
  }, []) : [];

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

  if (photoViewer?.data?.visible && document.querySelector(".p-lightbox[aria-modal='true']")) {
    const slideshow = photoViewer.proxy?.pswp?.() || photoViewer.data.lightbox;
    const itemCount = slideshow?.getNumItems?.();
    const currentIndex = slideshow?.currIndex;
    if (
      !slideshow
      || typeof slideshow.goTo !== "function"
      || !Number.isInteger(itemCount)
      || itemCount < 2
      || !Number.isInteger(currentIndex)
      || currentIndex < 0
      || currentIndex >= itemCount
    ) {
      throw new Error("The PhotoPrism viewer is not ready to select another media item.");
    }

    const offset = Math.floor(Math.random() * (itemCount - 1));
    const randomIndex = offset >= currentIndex ? offset + 1 : offset;
    slideshow.goTo(randomIndex);
    return { opened: true };
  }

  if (!Array.isArray(photos)) {
    throw new Error("Could not read the media in PhotoPrism's active gallery.");
  }

  if (typeof mediaUid === "string") {
    const index = photos.findIndex((photo) => photo.UID === mediaUid);
    if (index < 0) {
      throw new Error("The selected media is no longer available in this PhotoPrism gallery.");
    }
    if (!gallery.proxy.openPhoto(index)) {
      throw new Error("PhotoPrism could not open the selected gallery media.");
    }
    return { opened: true };
  }

  if (!mediaIndexes.length) {
    throw new Error("No media are currently available in this PhotoPrism gallery.");
  }
  const index = mediaIndexes[Math.floor(Math.random() * mediaIndexes.length)];
  if (!gallery.proxy.openPhoto(index)) {
    throw new Error("PhotoPrism could not open the selected gallery media.");
  }

  return { opened: true };
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

const IMAGE_SEARCH_SERVICES = {
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

  if (sender.url !== chrome.runtime.getURL("options.html")) {
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
