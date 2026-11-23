(function installQoolPrism() {
  if (window.__qoolprismInstalled) {
    return;
  }
  window.__qoolprismInstalled = true;

  const {
    isEditableTarget,
    navigationDirection,
    galleryNavigationDirection,
    spatialNavigationIndex,
    shouldHandleGalleryNavigation,
    shouldHandleGalleryOpen,
    navigationDirectionFromLabel,
    shouldHandleNavigation,
    shouldHandleSidebarShortcut,
    navigationSidebarItemIndex,
    shouldHandleRandomPhotoShortcut,
    viewerOptionShortcut,
    viewerDetailShortcut,
    viewerCollectionShortcut,
    viewerPeopleShortcut,
    viewerMarkerShortcut,
    viewerOptionLabelMatches,
    isPhotoGalleryPath,
    isMuteControl,
    setMediaMuted,
    setMediaVolume,
    volumeAdjustment,
    shouldHandleVolumeShortcut,
    adjustVolume,
    isValidVolume,
  } = PhotoPrismExtensionUtils;
  const VIEWER_SELECTOR = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    ".v-dialog",
    ".p-viewer",
    ".p-photo-viewer",
    '[class*="viewer" i]',
    '[class*="lightbox" i]',
  ].join(", ");
  const MEDIA_SELECTOR = "img, video";
  const CONTROL_CLASS = "qoolprism-volume";
  const AUTOPLAY_BUTTON_CLASS = "qoolprism-autoplay-toggle";
  const RANDOM_BUTTON_CLASS = "qoolprism-random-button";
  const SEARCH_BUTTON_CLASS = "qoolprism-search-button";
  const SEARCH_MENU_CLASS = "qoolprism-search-menu";
  const AUTOPLAY_ENABLED_KEY = "autoplayEnabled";
  const CLOSE_BUTTON_SELECTOR = ".pswp__top-bar .pswp__button--close-button";
  const AUTOPLAY_ICON_ON = "M10,16.5V7.5L16,12M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z";
  const AUTOPLAY_ICON_OFF = "M10,16.5L16,12L10,7.5V16.5M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z";
  // Material Design Icons "shuffle".
  const RANDOM_ICON = "M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z";
  // Material Design Icons "magnify".
  const SEARCH_ICON = "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z";
  // The ids match the image search services in background.js.
  // These items should be organized alphabetically.
  const IMAGE_SEARCH_OPTIONS = [
    {
      id: "iqdb-image-search",
      label: "IQDB",
      icon: "https://iqdb.org/favicon.ico",
    },
    {
      id: "yandex-image-search",
      label: "Yandex",
      icon: "https://yastatic.net/s3/home/services/all/all_lite/Images_v4.svg",
    },
  ];
  const PLAY_BUTTON_SELECTOR = ".pswp__play";
  const MARKER_CONFIRM_SELECTOR = ".p-meta-face-markers__confirm .p-meta-face-markers__btn--confirm";
  const MARKER_REMOVE_SELECTOR = ".p-meta-face-markers__remove-confirm .p-meta-face-markers__btn--remove";
  const MARKER_OVERLAY_SELECTOR = ".p-meta-face-markers";
  const MARKER_BOX_SELECTOR = ".p-meta-face-markers__svg g > .p-meta-face-markers__rect:not(.p-meta-face-markers__rect--draft)";
  const PERSON_ROW_SELECTOR = ".p-lightbox-sidebar .metadata__person-row[data-marker-uid]";
  const PERSON_INPUT_SELECTOR = ".meta-inline-marker input:not([type='hidden'])";
  const MARKER_SELECT_SELECTOR = ".p-meta-face-markers__rect, .p-meta-face-markers__label";
  const MARKER_INPUTS_CLASS = "qoolprism-marker-inputs";
  const MARKER_INPUT_CLASS = "qoolprism-marker-input";
  const MARKER_UNASSIGN_CLASS = "qoolprism-marker-unassign";
  const MARKER_INPUTS_ACTIVE_CLASS = "qoolprism-has-marker-inputs";
  const SUBJECT_AVATAR_CLASS = "qoolprism-subject-avatar";
  const KEY_BADGE_CLASS = "qoolprism-key-badge";
  const KEY_BADGES_ENABLED_KEY = "keyBadgesEnabled";
  const CLIPBOARD_MENU_BUTTON_SELECTOR = 'button.action-menu[aria-controls="t-clipboard"]';
  const CONTEXT_MENU_ATTRIBUTE = "data-qoolprism-context-menu";
  // Set on the page while the actions menu is opening after a right click, to keep it hidden
  // until it has been moved next to the cursor.
  const CONTEXT_MENU_PENDING_ATTRIBUTE = "data-qoolprism-context-pending";
  const CONTEXT_MENU_PROPERTIES = [
    "--qoolprism-context-left",
    "--qoolprism-context-top",
  ];
  const MENU_ANCHOR_ATTRIBUTE = "data-qoolprism-menu";
  const MENU_ANCHOR_PROPERTIES = [
    "--qoolprism-menu-left",
    "--qoolprism-menu-top",
    "--qoolprism-menu-bottom",
    "--qoolprism-menu-width",
    "--qoolprism-menu-max-height",
  ];
  const personThumbs = new Map();
  const AUTOPLAY_SETTLE_MS = 0;
  const NATIVE_AUTOPLAY_GRACE_MS = 0;
  const GALLERY_COVER_PAGE_SELECTOR = ".p-page-albums, .p-page-people, .p-page-labels, .p-page-files";
  const GALLERY_COVER_SELECTOR = [
    ".p-page-albums .result[data-uid]:not(.placeholder)",
    ".p-page-subjects .result[data-uid]:not(.placeholder)",
    ".p-page-labels .result[data-uid]:not(.placeholder)",
    ".p-page-files .result.is-folder[data-uid]:not(.placeholder)",
  ].join(", ");
  const GALLERY_ITEM_SELECTOR = [
    "main .media.result[data-uid]",
    GALLERY_COVER_SELECTOR,
  ].join(", ");
  let currentVideos = [];
  let currentVideo = null;
  let muteButton = null;
  let volumePopover = null;
  let volumeSlider = null;
  let preferredVolume = null;
  let autoplayEnabled = true;
  // When the viewer user last asked for playback (play button, controls, or Space).
  let lastPlayIntent = 0;
  const PLAY_INTENT_MS = 300;
  let lastPersistedVolume = null;
  let hidePopoverTimer = null;
  const autoplayedMedia = new WeakSet();
  // Slide container that was last autoplayed, so it can be autoplayed again after navigating back to it.
  let lastAutoplayContainer = null;
  // Slides that were autoplayed before and were left again.
  const revisitedMedia = new WeakSet();
  const autoplayPositions = new WeakMap();
  let syncScheduled = false;
  let galleryItemUids = [];
  let galleryItemUidsPromise = null;
  let galleryMediaRefreshPromise = null;
  let galleryItemDomCount = 0;
  let galleryNavigationMode = null;
  let highlightedGalleryItemUid = null;
  let highlightedGalleryElement = null;
  let highlightedFaceElement = null;
  // Marker whose input box under the face was clicked, so its suggestions open next to it.
  let mirrorFocusUid = null;
  let lastClipboardMenuClick = 0;
  // Pending right click on a gallery image: where to show the actions menu.
  let contextMenuRequest = null;
  // Right clicking while the actions menu is open makes PhotoPrism's menu (Vuetify) close itself,
  // and it keeps closing for a moment: once right away and once more after 40 ms, and it
  // ignores clicks on its button for 50 ms after closing. The menu is only opened again after this.
  const CLIPBOARD_MENU_REOPEN_DELAY_MS = 150;
  let galleryNavigationPage = null;
  let queuedGalleryDirections = [];
  // Whether the keybind bubbles are turned on in the extension's Options.
  let keyBadgesEnabled = true;

  function isDisplayed(element) {
    if (!element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Like isDisplayed, but ignores visibility/opacity so toolbar buttons that PhotoSwipe
  // has faded out after a few seconds of inactivity can still be triggered by keybinds.
  function isRendered(element) {
    if (!element.isConnected || window.getComputedStyle(element).display === "none") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // True when the element or one of its ancestors (up to the viewer) is faded out or hidden.
  function isVisuallyHidden(element, viewer) {
    for (let node = element; node; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (
        style.display === "none"
        || style.visibility === "hidden"
        || Number.parseFloat(style.opacity) < 0.5
      ) {
        return true;
      }
      if (node === viewer) {
        break;
      }
    }

    return false;
  }

  // True when the viewer's top bar (the PhotoPrism controls) has faded out.
  function areControlsHidden(viewer) {
    const topBar = viewer.querySelector(".pswp__top-bar");
    return Boolean(topBar) && isVisuallyHidden(topBar, viewer);
  }

  // PhotoPrism ignores clicks while its controls are hidden and only reveals them,
  // so a second click is needed to actually run the action.
  function clickRevealingControls(element, wasHidden) {
    element.click();
    if (wasHidden && element.isConnected) {
      element.click();
    }
  }

  function isVisibleMedia(element) {
    if (!isDisplayed(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width >= 80 && rect.height >= 80;
  }

  function getViewer() {
    const candidates = Array.from(document.querySelectorAll(VIEWER_SELECTOR))
      .filter((candidate) => {
        if (!isDisplayed(candidate)) {
          return false;
        }

        return Array.from(candidate.querySelectorAll(MEDIA_SELECTOR)).some(isVisibleMedia);
      });

    candidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    });

    return candidates[0] || null;
  }

  function getElementLabel(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-tooltip"),
      element.innerText,
      element.textContent,
    ].filter(Boolean).join(" ");
  }

  function getIconTokens(element) {
    const nodes = [element, ...element.querySelectorAll("*")];
    return nodes.map((node) => {
      const className = typeof node.className === "string"
        ? node.className
        : node.className?.baseVal;
      return [
        className,
        node.getAttribute("data-icon"),
        node.getAttribute("aria-hidden") === "true" ? node.textContent : "",
      ].filter(Boolean).join(" ");
    }).join(" ").toLowerCase();
  }

  function getMuteButton(viewer) {
    return Array.from(viewer.querySelectorAll('button, [role="button"]'))
      .find((button) => (
        isDisplayed(button)
        && isMuteControl(getElementLabel(button), getIconTokens(button))
      )) || null;
  }

  function getViewerVideos(viewer) {
    return Array.from(viewer.querySelectorAll("video, audio"))
      .filter((media) => media.tagName === "AUDIO" || isDisplayed(media));
  }

  function getActiveVideo(videos) {
    return [...videos].sort((left, right) => {
      const playingDifference = Number(!right.paused && !right.ended)
        - Number(!left.paused && !left.ended);
      if (playingDifference) {
        return playingDifference;
      }

      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    })[0] || null;
  }

  function findNavigationButton(viewer, direction) {
    // The side panel's own buttons (such as its close chevron) are never slide navigation.
    const buttons = Array.from(viewer.querySelectorAll('button, [role="button"], a'))
      .filter((button) => !button.closest(".p-lightbox-sidebar"));

    for (const button of buttons) {
      if (!isRendered(button)) {
        continue;
      }

      if (navigationDirectionFromLabel(getElementLabel(button)) === direction) {
        return button;
      }
    }

    const iconPattern = direction === "previous"
      ? /(chevron|arrow|keyboard_arrow|navigate_before)[-_ ]?left|arrow_back|chevron_left|navigate_before/
      : /(chevron|arrow|keyboard_arrow|navigate_next)[-_ ]?right|arrow_forward|chevron_right|navigate_next/;

    return buttons.find((button) => (
      isRendered(button) && iconPattern.test(getIconTokens(button))
    )) || null;
  }

  function findViewerOptionButton(viewer, key) {
    const matches = Array.from(viewer.querySelectorAll('button, [role="button"], a'))
      .filter((button) => {
        if (!button.isConnected) {
          return false;
        }

        const label = getElementLabel(button);
        const isFavoriteIcon = key === "q" && /favorite-toggle|icn-favorite/i.test(getIconTokens(button));
        return viewerOptionLabelMatches(key, label) || isFavoriteIcon;
      });

    return matches.find(isRendered) || matches[0] || null;
  }

  function findViewerDetailRow(viewer, field) {
    const sidebar = viewer.querySelector(".p-lightbox-sidebar");
    if (!sidebar || !isRendered(sidebar)) {
      return null;
    }

    const rows = Array.from(sidebar.querySelectorAll(".metadata__item"))
      .filter(isRendered);
    if (field === "title") {
      return rows.find((row) => row.querySelector(".meta-title, .meta-inline-title")
        || Array.from(row.querySelectorAll(".meta-add-prompt"))
          .some((prompt) => /\badd a title\b/i.test(prompt.textContent || ""))) || null;
    }
    if (field === "caption") {
      return rows.find((row) => row.querySelector(".meta-caption, .meta-inline-caption")
        || Array.from(row.querySelectorAll(".meta-add-prompt"))
          .some((prompt) => /\badd a caption\b/i.test(prompt.textContent || ""))) || null;
    }
    if (field === "taken" || field === "camera") {
      const iconPattern = field === "taken" ? /mdi-calendar/ : /mdi-camera/;
      return rows.find((row) => iconPattern.test(getIconTokens(row))) || null;
    }

    return rows.find((row) => row.classList.contains(`meta-${field}`)) || null;
  }

  function findViewerCollectionInput(viewer, collection) {
    const sidebar = viewer.querySelector(".p-lightbox-sidebar");
    if (!sidebar || !isDisplayed(sidebar)) {
      return null;
    }

    return Array.from(sidebar.querySelectorAll(
      `.metadata__item.meta-${collection} .meta-inline-edit input`,
    )).find(isDisplayed) || null;
  }

  function clearHighlightedFace() {
    if (highlightedFaceElement?.isConnected) {
      highlightedFaceElement.dispatchEvent(new Event("mouseleave"));
    }
    highlightedFaceElement = null;
  }

  function findNavigationSidebarToggle() {
    if (!document.querySelector("#p-navigation .nav-sidebar")) {
      return null;
    }

    const mobileToggle = Array.from(document.querySelectorAll(".nav-small .nav-logo"))
      .find(isDisplayed);
    if (mobileToggle) {
      return mobileToggle;
    }

    return Array.from(document.querySelectorAll(
      ".nav-sidebar .nav-minimize, .nav-sidebar .nav-expand",
    )).find(isDisplayed) || null;
  }

  function getNavigationSidebarItems() {
    const sidebar = document.querySelector("#p-navigation .nav-sidebar");
    if (!sidebar) {
      return [];
    }

    // A collapsed sidebar only shows icons, so its items have no title. Its expand button
    // (.nav-expand) is not a menu item.
    const collapsed = sidebar.classList.contains("v-navigation-drawer--rail")
      || Boolean(sidebar.querySelector(".nav-expand"));

    return Array.from(sidebar.querySelectorAll(".nav-menu .v-list-item"))
      .filter((item) => {
        const hasLabel = collapsed
          ? !item.matches(".nav-expand") && Boolean(item.querySelector(".v-icon"))
          : Boolean(item.querySelector(".v-list-item-title")?.textContent.trim());
        if (
          !hasLabel
          || !isDisplayed(item)
          || item.matches(
            '[aria-disabled="true"], .v-list-item--disabled, .v-list-group__header, [aria-expanded]',
          )
        ) {
          return false;
        }

        for (let ancestor = item.parentElement; ancestor && ancestor !== sidebar; ancestor = ancestor.parentElement) {
          if (ancestor.matches(".v-list-group__items")) {
            const header = ancestor.parentElement?.querySelector(".v-list-group__header");
            if (header?.getAttribute("aria-expanded") === "false") {
              return false;
            }
          }
        }

        return true;
      });
  }

  async function requestRandomPhotoFromGallery() {
    const response = await chrome.runtime.sendMessage({
      type: "open-random-photo",
    });
    if (!response?.ok) {
      throw new Error(response?.error || "The PhotoPrism gallery could not open random media.");
    }
  }

  async function openRandomPhoto() {
    await requestRandomPhotoFromGallery();
  }

  async function requestGalleryMediaUids() {
    const response = await chrome.runtime.sendMessage({
      type: "get-gallery-media",
    });
    if (!response?.ok || !Array.isArray(response.mediaUids)) {
      throw new Error(response?.error || "The PhotoPrism gallery media could not be read.");
    }
    return response.mediaUids;
  }

  function isGalleryCoverPage() {
    return Boolean(document.querySelector(GALLERY_COVER_PAGE_SELECTOR));
  }

  function getGalleryCoverElements() {
    return Array.from(document.querySelectorAll(GALLERY_COVER_SELECTOR))
      .filter(isDisplayed);
  }

  function findGalleryItemElement(uid) {
    return Array.from(document.querySelectorAll(GALLERY_ITEM_SELECTOR))
      .find((element) => element.getAttribute("data-uid") === uid) || null;
  }

  function highlightGalleryItem(uid, shouldScroll = true) {
    const itemElement = findGalleryItemElement(uid);
    if (highlightedGalleryElement && highlightedGalleryElement !== itemElement) {
      clearGalleryHighlight(highlightedGalleryElement);
    }
    highlightedGalleryItemUid = uid;
    highlightedGalleryElement = itemElement;
    if (highlightedGalleryElement) {
      highlightedGalleryElement.classList.add("qoolprism-gallery-highlighted");
      if (shouldScroll) {
        highlightedGalleryElement.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  function clearGalleryHighlight(element) {
    element.classList.remove("qoolprism-gallery-highlighted");
    element.querySelectorAll(".qoolprism-gallery-highlighted")
      .forEach((child) => child.classList.remove("qoolprism-gallery-highlighted"));
  }

  function scrollGalleryEdge(direction) {
    const items = Array.from(document.querySelectorAll("main .media.result[data-uid]"));
    const edgeItem = direction === "down" ? items[items.length - 1] : items[0];
    edgeItem?.scrollIntoView({ block: direction === "down" ? "end" : "start" });
  }

  function moveGalleryHighlight(direction) {
    if (direction === "up" || direction === "down") {
      const elementsByUid = new Map(
        Array.from(document.querySelectorAll(GALLERY_ITEM_SELECTOR))
          .map((element) => [element.getAttribute("data-uid"), element]),
      );
      const visibleItems = galleryItemUids.map((uid) => {
        const element = elementsByUid.get(uid);
        if (!element || !isDisplayed(element)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        return {
          uid,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }).filter(Boolean);
      const currentIndex = visibleItems.findIndex(({ uid }) => uid === highlightedGalleryItemUid);
      if (currentIndex >= 0) {
        const nextIndex = spatialNavigationIndex(visibleItems, currentIndex, direction);
        if (nextIndex !== currentIndex) {
          highlightGalleryItem(visibleItems[nextIndex].uid);
          return;
        }

        const currentOrderIndex = galleryItemUids.indexOf(highlightedGalleryItemUid);
        const visibleUids = new Set(visibleItems.map(({ uid }) => uid));
        const offset = direction === "down" ? 1 : -1;
        for (
          let index = currentOrderIndex + offset;
          index >= 0 && index < galleryItemUids.length;
          index += offset
        ) {
          if (!visibleUids.has(galleryItemUids[index])) {
            const nextUid = galleryItemUids[index];
            const nextElement = findGalleryItemElement(nextUid);
            highlightGalleryItem(nextUid);
            if (!nextElement || !isDisplayed(nextElement)) {
              scrollGalleryEdge(direction);
            }
            return;
          }
        }
        return;
      }
    }

    const currentIndex = galleryItemUids.indexOf(highlightedGalleryItemUid);
    if (currentIndex < 0) {
      highlightGalleryItem(galleryItemUids[0]);
      return;
    }

    const offset = direction === "right" || direction === "down" ? 1 : -1;
    const nextIndex = currentIndex + offset;
    if (
      (direction === "up" || direction === "down")
      && (nextIndex < 0 || nextIndex >= galleryItemUids.length)
    ) {
      return;
    }
    const wrappedIndex = (nextIndex + galleryItemUids.length) % galleryItemUids.length;
    highlightGalleryItem(galleryItemUids[wrappedIndex]);
  }

  function resetGalleryNavigation() {
    if (highlightedGalleryElement) {
      clearGalleryHighlight(highlightedGalleryElement);
    }
    highlightedGalleryElement = null;
    highlightedGalleryItemUid = null;
    galleryItemUids = [];
    galleryItemUidsPromise = null;
    galleryMediaRefreshPromise = null;
    galleryItemDomCount = 0;
    galleryNavigationMode = null;
    queuedGalleryDirections = [];
    galleryNavigationPage = window.location.href;
  }

  function handleGalleryNavigation(event, direction) {
    if (!galleryItemUidsPromise) {
      galleryNavigationPage = window.location.href;
      const request = requestGalleryMediaUids();
      galleryItemUidsPromise = request;
      galleryNavigationMode = "media";
      request.then((uids) => {
        if (galleryNavigationPage !== window.location.href) {
          return;
        }

        galleryItemUids = uids;
        galleryItemDomCount = document.querySelectorAll("main .media.result[data-uid]").length;
        if (!galleryItemUids.length) {
          throw new Error("No media are currently available in this PhotoPrism gallery.");
        }

        highlightGalleryItem(galleryItemUids[0]);
        for (const queuedDirection of queuedGalleryDirections) {
          moveGalleryHighlight(queuedDirection);
        }
        queuedGalleryDirections = [];
      }).catch((error) => {
        if (galleryItemUidsPromise === request) {
          galleryItemUidsPromise = null;
          queuedGalleryDirections = [];
        }
        console.error("Could not select PhotoPrism gallery media.", error);
      });
    } else if (galleryItemUids.length) {
      moveGalleryHighlight(direction);
    } else {
      queuedGalleryDirections.push(direction);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function refreshGalleryMediaUidsIfNeeded() {
    const itemDomCount = document.querySelectorAll("main .media.result[data-uid]").length;
    if (
      galleryNavigationMode !== "media"
      || !galleryItemUids.length
      || galleryMediaRefreshPromise
      || itemDomCount <= galleryItemDomCount
    ) {
      return;
    }

    galleryItemDomCount = itemDomCount;
    const page = window.location.href;
    const request = requestGalleryMediaUids();
    galleryMediaRefreshPromise = request;
    request.then((uids) => {
      if (
        galleryNavigationMode === "media"
        && page === window.location.href
        && uids.length > galleryItemUids.length
      ) {
        galleryItemUids = uids;
      }
    }).catch((error) => {
      console.error("Could not refresh PhotoPrism gallery media.", error);
    }).finally(() => {
      if (galleryMediaRefreshPromise === request) {
        galleryMediaRefreshPromise = null;
      }
    });
  }

  function handleGalleryCoverNavigation(event, direction) {
    const elements = getGalleryCoverElements();
    const uids = elements
      .map((element) => element.getAttribute("data-uid"))
      .filter((uid) => typeof uid === "string");

    if (uids.length) {
      if (galleryNavigationMode !== "cover") {
        if (galleryNavigationMode) {
          resetGalleryNavigation();
        }
        galleryItemUids = uids;
        galleryItemUidsPromise = Promise.resolve(uids);
        galleryNavigationMode = "cover";
        highlightGalleryItem(galleryItemUids[0]);
      } else {
        galleryItemUids = uids;
        if (!galleryItemUids.includes(highlightedGalleryItemUid)) {
          highlightGalleryItem(galleryItemUids[0]);
        } else {
          moveGalleryHighlight(direction);
        }
      }
    }

    event.preventDefault();
    event.stopPropagation();
  }

  async function openHighlightedGalleryMedia() {
    const response = await chrome.runtime.sendMessage({
      type: "open-gallery-media",
      mediaUid: highlightedGalleryItemUid,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "The highlighted PhotoPrism media could not be opened.");
    }
  }

  async function openHighlightedGalleryCover() {
    const response = await chrome.runtime.sendMessage({
      type: "open-gallery-cover",
      coverUid: highlightedGalleryItemUid,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "The highlighted PhotoPrism cover could not be opened.");
    }
  }

  function isLightboxOpen() {
    const lightbox = document.querySelector(".p-lightbox[aria-modal='true']");
    return Boolean(lightbox) && isDisplayed(lightbox);
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && closeSearchMenu()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      event.key === "Escape"
      && event.target instanceof HTMLInputElement
      && event.target.matches(
        ".p-lightbox-sidebar .metadata__person-row .meta-inline-marker input:not([type='hidden'])",
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.target.blur();
      return;
    }

    if (shouldHandleSidebarShortcut(event) && !isEditableTarget(event.target)) {
      const viewer = getViewer();
      const toggle = viewer
        ? viewer.querySelector(".pswp__button--info-button")
        : findNavigationSidebarToggle();
      if (toggle && isDisplayed(toggle)) {
        event.preventDefault();
        event.stopPropagation();
        toggle.click();
        return;
      }
    }

    const sidebarItemIndex = navigationSidebarItemIndex(event);
    if (sidebarItemIndex !== null && !isEditableTarget(event.target) && !getViewer()) {
      const item = getNavigationSidebarItems()[sidebarItemIndex];
      if (item) {
        event.preventDefault();
        event.stopPropagation();
        item.click();
        return;
      }
    }

    const optionKey = viewerOptionShortcut(event);
    if (optionKey && !isEditableTarget(event.target)) {
      const viewer = getViewer();
      if (viewer) {
        const button = findViewerOptionButton(viewer, optionKey);
        if (button) {
          event.preventDefault();
          event.stopPropagation();
          // PhotoPrism ignores clicks on hidden controls and only reveals them,
          // so a second click is needed to actually run the action.
          const wasHidden = isVisuallyHidden(button, viewer);
          button.click();
          if (wasHidden && button.isConnected) {
            button.click();
          }
          return;
        }
        if (optionKey === "f") {
          return;
        }
      }
    }

    if (
      !event.defaultPrevented
      && !event.repeat
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && typeof event.key === "string"
      && event.key.toLowerCase() === "u"
      && !isEditableTarget(event.target)
      && getViewer()
    ) {
      event.preventDefault();
      event.stopPropagation();
      setAutoplayEnabled(!autoplayEnabled);
      return;
    }

    const markerAction = viewerMarkerShortcut(event);
    if (markerAction && !isEditableTarget(event.target)) {
      const viewer = getViewer();
      const markerButton = viewer?.querySelector(
        markerAction === "confirm" ? MARKER_CONFIRM_SELECTOR : MARKER_REMOVE_SELECTOR,
      );
      if (markerButton && isDisplayed(markerButton)) {
        event.preventDefault();
        event.stopPropagation();
        markerButton.click();
        return;
      }
    }

    const peopleShortcut = viewerPeopleShortcut(event);
    if (peopleShortcut && !isEditableTarget(event.target)) {
      const viewer = getViewer();
      const editToggle = viewer?.querySelector(".p-lightbox-sidebar .meta-faces-edit");
      if (peopleShortcut.type === "toggle" && editToggle && isDisplayed(editToggle) && !editToggle.disabled) {
        event.preventDefault();
        event.stopPropagation();
        if (editToggle.classList.contains("is-active")) {
          clearHighlightedFace();
        }
        // PhotoPrism ignores clicks while its controls are hidden and only reveals them.
        clickRevealingControls(editToggle, isVisuallyHidden(editToggle, viewer) || areControlsHidden(viewer));
        return;
      }

      if (
        peopleShortcut.type === "face"
        && editToggle?.classList.contains("is-active")
      ) {
        event.preventDefault();
        event.stopPropagation();
        const faceRows = Array.from(viewer.querySelectorAll(
          ".p-lightbox-sidebar .metadata__person-row[data-marker-uid]",
        )).filter(isDisplayed);
        const faceRow = faceRows[peopleShortcut.index];
        if (faceRow) {
          if (highlightedFaceElement && highlightedFaceElement !== faceRow) {
            highlightedFaceElement.dispatchEvent(new Event("mouseleave"));
          }
          faceRow.scrollIntoView({ block: "nearest" });
          faceRow.dispatchEvent(new Event("mouseenter"));
          highlightedFaceElement = faceRow;
          const faceInput = Array.from(faceRow.querySelectorAll(
            ".meta-inline-marker input:not([type='hidden'])",
          )).find(isDisplayed);
          faceInput?.focus();
        }
        return;
      }
    }

    const detailField = viewerDetailShortcut(event);
    if (detailField && !isEditableTarget(event.target)) {
      const viewer = getViewer();
      const row = viewer && findViewerDetailRow(viewer, detailField);
      if (row) {
        event.preventDefault();
        event.stopPropagation();
        row.scrollIntoView({ block: "nearest" });
        clickRevealingControls(row, areControlsHidden(viewer));
        return;
      }
    }

    const collection = viewerCollectionShortcut(event);
    if (collection && !isEditableTarget(event.target)) {
      const viewer = getViewer();
      const input = viewer && findViewerCollectionInput(viewer, collection);
      if (input) {
        event.preventDefault();
        event.stopPropagation();
        input.scrollIntoView({ block: "nearest" });
        input.click();
        input.focus();
        return;
      }
    }

    if (shouldHandleRandomPhotoShortcut(event)) {
      if (!isPhotoGalleryPath(window.location.pathname) || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openRandomPhoto().catch((error) => {
        console.error("Could not open a random PhotoPrism image.", error);
      });
      return;
    }

    const viewer = getViewer();
    const coverPage = isGalleryCoverPage();
    if (
      !viewer
      && (coverPage || isPhotoGalleryPath(window.location.pathname))
      && !isEditableTarget(event.target)
    ) {
      if (galleryNavigationPage !== window.location.href) {
        resetGalleryNavigation();
      }

      const direction = galleryNavigationDirection(event.key);
      if (shouldHandleGalleryNavigation(event)) {
        if (coverPage) {
          handleGalleryCoverNavigation(event, direction);
        } else {
          handleGalleryNavigation(event, direction);
        }
        return;
      }

      if (
        highlightedGalleryItemUid
        && shouldHandleGalleryOpen(event)
      ) {
        event.preventDefault();
        event.stopPropagation();
        const openHighlighted = coverPage
          ? openHighlightedGalleryCover
          : openHighlightedGalleryMedia;
        openHighlighted().catch((error) => {
          console.error("Could not open the highlighted PhotoPrism gallery item.", error);
        });
        return;
      }
    }

    const adjustment = volumeAdjustment(event.key);
    if (adjustment) {
      if (!shouldHandleVolumeShortcut(event)) {
        return;
      }

      const sliderHasFocus = event.target === volumeSlider;
      if (isEditableTarget(event.target) && !sliderHasFocus) {
        return;
      }

      const videos = viewer ? getViewerVideos(viewer) : [];
      if (!videos.length || !viewer || !getMuteButton(viewer)) {
        return;
      }

      const video = getActiveVideo(videos);
      preferredVolume = adjustVolume(video.volume, adjustment);
      setMediaVolume(videos, preferredVolume);
      persistPreferredVolume();
      if (adjustment > 0 && preferredVolume > 0) {
        setMediaMuted(videos, false);
      }

      event.preventDefault();
      event.stopPropagation();
      updateControlValues();
      return;
    }

    if (!shouldHandleNavigation(event) || isEditableTarget(event.target)) {
      return;
    }

    if (!viewer) {
      return;
    }

    const direction = navigationDirection(event.key);
    const button = findNavigationButton(viewer, direction);
    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    clickRevealingControls(button, isVisuallyHidden(button, viewer) || areControlsHidden(viewer));
  }

  function updatePopoverPosition() {
    if (!muteButton || !volumePopover || !muteButton.isConnected) {
      return;
    }

    const rect = muteButton.getBoundingClientRect();
    const popoverWidth = volumePopover.offsetWidth || 40;
    const popoverHeight = volumePopover.offsetHeight || 136;
    const left = Math.max(8, Math.min(
      rect.left + (rect.width - popoverWidth) / 2,
      window.innerWidth - popoverWidth - 8,
    ));
    const above = rect.top - popoverHeight - 8;
    const top = above >= 8
      ? above
      : Math.min(rect.bottom + 8, window.innerHeight - popoverHeight - 8);

    volumePopover.style.left = `${left}px`;
    volumePopover.style.top = `${Math.max(8, top)}px`;
  }

  function updateControlValues() {
    if (!currentVideo || !volumeSlider) {
      return;
    }

    volumeSlider.value = String(currentVideo.volume);
    volumeSlider.setAttribute("aria-valuetext", `${Math.round(currentVideo.volume * 100)}%`);
    updatePopoverPosition();
  }

  function persistPreferredVolume() {
    if (!isValidVolume(preferredVolume) || preferredVolume === lastPersistedVolume) {
      return;
    }

    lastPersistedVolume = preferredVolume;
    chrome.storage.local.set({ videoVolume: preferredVolume }).catch((error) => {
      lastPersistedVolume = null;
      console.error("Could not save PhotoPrism video volume.", error);
    });
  }

  function handleMediaVolumeChange(event) {
    updateControlValues();
    if (event.currentTarget !== currentVideo) {
      return;
    }

    const volume = event.currentTarget.volume;
    if (volume !== preferredVolume) {
      preferredVolume = volume;
      setMediaVolume(currentVideos, volume);
      persistPreferredVolume();
    }
  }

  function schedulePopoverHide() {
    window.clearTimeout(hidePopoverTimer);
    hidePopoverTimer = window.setTimeout(() => {
      volumePopover?.removeAttribute("data-open");
    }, 140);
  }

  function showVolumePopover() {
    window.clearTimeout(hidePopoverTimer);
    if (volumePopover) {
      volumePopover.setAttribute("data-open", "true");
      updatePopoverPosition();
    }
  }

  function bindMuteButton(button) {
    if (muteButton === button) {
      return;
    }

    if (muteButton) {
      muteButton.removeEventListener("pointerenter", showVolumePopover);
      muteButton.removeEventListener("pointerleave", schedulePopoverHide);
      muteButton.removeEventListener("focusin", showVolumePopover);
      muteButton.removeEventListener("focusout", schedulePopoverHide);
    }

    muteButton = button;
    if (muteButton) {
      muteButton.addEventListener("pointerenter", showVolumePopover);
      muteButton.addEventListener("pointerleave", schedulePopoverHide);
      muteButton.addEventListener("focusin", showVolumePopover);
      muteButton.addEventListener("focusout", schedulePopoverHide);
    }
  }

  function removeVolumeControl() {
    window.clearTimeout(hidePopoverTimer);
    for (const video of currentVideos) {
      video.removeEventListener("volumechange", handleMediaVolumeChange);
      video.removeEventListener("loadedmetadata", applyPreferredVolume);
      video.removeEventListener("play", applyPreferredVolume);
    }

    bindMuteButton(null);
    volumePopover?.remove();
    currentVideos = [];
    currentVideo = null;
    volumePopover = null;
    volumeSlider = null;
  }

  function applyPreferredVolume() {
    if (preferredVolume !== null) {
      setMediaVolume(currentVideos, preferredVolume);
    }
  }

  // Returns the play button of the slide that is currently shown in the viewer.
  function findCurrentPlayButton(viewer) {
    const viewerRect = viewer.getBoundingClientRect();
    const centerX = viewerRect.left + (viewerRect.width / 2);

    return Array.from(viewer.querySelectorAll(PLAY_BUTTON_SELECTOR))
      .filter(isRendered)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return { button, rect, distance: Math.abs(rect.left + (rect.width / 2) - centerX) };
      })
      .filter(({ rect }) => rect.right > viewerRect.left && rect.left < viewerRect.right)
      .sort((left, right) => left.distance - right.distance)[0]?.button || null;
  }

  function simulateTap(element) {
    const rect = element.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2),
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
    };

    element.dispatchEvent(new PointerEvent("pointerdown", { ...init, buttons: 1 }));
    element.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
  }

  function createAutoplayButton() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const iconId = "qoolprism-icn-autoplay";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pswp__button pswp__button--mdi ${AUTOPLAY_BUTTON_CLASS}`;

    const icon = document.createElementNS(svgNamespace, "svg");
    icon.setAttribute("class", "pswp__icn");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "24");
    icon.setAttribute("height", "24");
    icon.setAttribute("aria-hidden", "true");
    const shadow = document.createElementNS(svgNamespace, "use");
    shadow.setAttribute("class", "pswp__icn-shadow");
    shadow.setAttribute("href", `#${iconId}`);
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("id", iconId);
    icon.append(shadow, path);
    button.append(icon);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setAutoplayEnabled(!autoplayEnabled);
      button.blur();
    });
    return button;
  }

  function updateAutoplayButton(button) {
    const state = String(autoplayEnabled);
    if (button.getAttribute("aria-pressed") === state) {
      return;
    }

    const label = autoplayEnabled ? "Autoplay: on" : "Autoplay: off";
    button.setAttribute("aria-pressed", state);
    button.title = label;
    button.setAttribute("aria-label", label);
    button.querySelector("path")?.setAttribute("d", autoplayEnabled ? AUTOPLAY_ICON_ON : AUTOPLAY_ICON_OFF);
  }

  // Same look as the autoplay button. Opens a random image, like the R key.
  function createRandomButton() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const iconId = "qoolprism-icn-random";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pswp__button pswp__button--mdi ${RANDOM_BUTTON_CLASS}`;
    button.title = "Random image";
    button.setAttribute("aria-label", "Random image");

    const icon = document.createElementNS(svgNamespace, "svg");
    icon.setAttribute("class", "pswp__icn");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "24");
    icon.setAttribute("height", "24");
    icon.setAttribute("aria-hidden", "true");
    const shadow = document.createElementNS(svgNamespace, "use");
    shadow.setAttribute("class", "pswp__icn-shadow");
    shadow.setAttribute("href", `#${iconId}`);
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("id", iconId);
    path.setAttribute("d", RANDOM_ICON);
    icon.append(shadow, path);
    button.append(icon);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRandomPhoto().catch((error) => {
        console.error("Could not open a random PhotoPrism image.", error);
      });
      button.blur();
    });
    return button;
  }

  // Returns the video (once it shows a frame) or the biggest image of the slide that is shown.
  function getCurrentSlideMedia(viewer) {
    const holder = viewer.querySelector('.pswp__item[aria-hidden="false"]') || viewer;

    const video = Array.from(holder.querySelectorAll("video"))
      .find((candidate) => isDisplayed(candidate) && candidate.videoWidth > 0 && candidate.readyState >= 2);
    if (video) {
      return video;
    }

    const images = Array.from(holder.querySelectorAll("img")).filter(isVisibleMedia);
    const loaded = images.filter((image) => !image.classList.contains("pswp__img--placeholder"));
    return (loaded.length ? loaded : images)
      .sort((left, right) => (right.naturalWidth * right.naturalHeight) - (left.naturalWidth * left.naturalHeight))[0]
      || null;
  }

  // Everything before sendMessage runs synchronously, so that the click still counts as a user
  // gesture when the extension asks for access to the search site.
  async function searchCurrentMedia(service) {
    const viewer = getViewer();
    const media = viewer && getCurrentSlideMedia(viewer);
    if (!media) {
      throw new Error("No image or video is shown in the viewer.");
    }

    let payload;
    if (media instanceof HTMLVideoElement) {
      const canvas = document.createElement("canvas");
      canvas.width = media.videoWidth;
      canvas.height = media.videoHeight;
      canvas.getContext("2d").drawImage(media, 0, 0);
      payload = {
        mediaType: "video",
        dataUrl: canvas.toDataURL("image/jpeg", 0.95),
        fileName: "photoprism-video-frame.jpg",
      };
    } else {
      payload = { mediaType: "image", imageUrl: media.currentSrc || media.src };
    }

    const response = await chrome.runtime.sendMessage({ type: "image-search", service, ...payload });
    if (!response?.ok) {
      throw new Error(response?.error || "The image search could not be started.");
    }
  }

  let searchMenuHideTimer = null;

  // Closes the image search dropdown. Returns true when it was open.
  function closeSearchMenu() {
    window.clearTimeout(searchMenuHideTimer);
    const menu = document.querySelector(`.${SEARCH_MENU_CLASS}`);
    menu?.remove();
    return Boolean(menu);
  }

  function cancelSearchMenuHide() {
    window.clearTimeout(searchMenuHideTimer);
  }

  // Short delay, so the pointer can cross the gap between the button and the dropdown.
  function scheduleSearchMenuHide() {
    window.clearTimeout(searchMenuHideTimer);
    searchMenuHideTimer = window.setTimeout(closeSearchMenu, 140);
  }

  function openSearchMenu(button) {
    if (document.querySelector(`.${SEARCH_MENU_CLASS}`)) {
      return;
    }

    const menu = document.createElement("div");
    menu.className = SEARCH_MENU_CLASS;
    menu.setAttribute("role", "menu");
    menu.addEventListener("pointerenter", cancelSearchMenuHide);
    menu.addEventListener("pointerleave", scheduleSearchMenuHide);

    for (const { id, label, icon } of IMAGE_SEARCH_OPTIONS) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `${SEARCH_MENU_CLASS}__item`;
      item.setAttribute("role", "menuitem");
      const logo = document.createElement("img");
      logo.className = `${SEARCH_MENU_CLASS}__icon`;
      logo.src = icon;
      logo.alt = "";
      logo.draggable = false;
      item.append(logo, document.createTextNode(label));
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSearchMenu();
        searchCurrentMedia(id).catch((error) => {
          const message = error instanceof Error ? error.message : "An unexpected error occurred.";
          console.error("Could not search this image.", error);
          window.alert(`${label} image search failed: ${message}`);
        });
      });
      menu.append(item);
    }

    document.body.append(menu);
    const rect = button.getBoundingClientRect();
    const left = Math.max(8, Math.min(
      rect.left + (rect.width - menu.offsetWidth) / 2,
      window.innerWidth - menu.offsetWidth - 8,
    ));
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  }

  // Same look as the autoplay button. Opens a dropdown with the image search services.
  function createSearchButton() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const iconId = "qoolprism-icn-search";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pswp__button pswp__button--mdi ${SEARCH_BUTTON_CLASS}`;
    button.title = "Image search";
    button.setAttribute("aria-label", "Image search");
    button.setAttribute("aria-haspopup", "menu");

    const icon = document.createElementNS(svgNamespace, "svg");
    icon.setAttribute("class", "pswp__icn");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "24");
    icon.setAttribute("height", "24");
    icon.setAttribute("aria-hidden", "true");
    const shadow = document.createElementNS(svgNamespace, "use");
    shadow.setAttribute("class", "pswp__icn-shadow");
    shadow.setAttribute("href", `#${iconId}`);
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("id", iconId);
    path.setAttribute("d", SEARCH_ICON);
    icon.append(shadow, path);
    button.append(icon);

    // The dropdown opens on hover. Clicking also opens it, for touch screens.
    button.addEventListener("pointerenter", () => {
      cancelSearchMenuHide();
      openSearchMenu(button);
    });
    button.addEventListener("pointerleave", scheduleSearchMenuHide);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelSearchMenuHide();
      openSearchMenu(button);
      button.blur();
    });
    return button;
  }

  // Adds the autoplay toggle right next to the viewer's close button,
  // the random image button right next to the autoplay toggle,
  // and the image search button right before (to the left of) the autoplay toggle.
  function syncAutoplayButton(viewer) {
    const closeButton = viewer.querySelector(CLOSE_BUTTON_SELECTOR);
    if (!closeButton) {
      return;
    }

    let button = closeButton.parentElement.querySelector(`.${AUTOPLAY_BUTTON_CLASS}`);
    if (!button) {
      button = createAutoplayButton();
      closeButton.after(button);
    }
    updateAutoplayButton(button);

    if (!closeButton.parentElement.querySelector(`.${RANDOM_BUTTON_CLASS}`)) {
      button.after(createRandomButton());
    }

    if (!closeButton.parentElement.querySelector(`.${SEARCH_BUTTON_CLASS}`)) {
      button.before(createSearchButton());
    }
  }

  function setAutoplayEnabled(enabled, persist = true) {
    autoplayEnabled = Boolean(enabled);
    for (const button of document.querySelectorAll(`.${AUTOPLAY_BUTTON_CLASS}`)) {
      updateAutoplayButton(button);
    }
    if (persist) {
      chrome.storage.local.set({ [AUTOPLAY_ENABLED_KEY]: autoplayEnabled }).catch((error) => {
        console.error("Could not save the PhotoPrism autoplay setting.", error);
      });
    }
    scheduleSynchronization();
  }

  function markPlayIntent(event) {
    const target = event.target;
    if (
      event.type === "keydown"
        ? event.key === " " && Boolean(getViewer())
        : target instanceof Element && Boolean(target.closest(".pswp__media, .p-lightbox__controls"))
    ) {
      lastPlayIntent = Date.now();
    }
  }

  // With autoplay turned off, pause playback that PhotoPrism starts on its own
  // (media opened from the gallery, GIFs, short videos, live photos). Playback the user
  // asks for, and running slideshows, are left alone.
  function suppressNativeAutoplay(event) {
    const media = event.target;
    if (
      autoplayEnabled
      || !(media instanceof HTMLMediaElement)
      || !media.closest(".pswp__media")
      || Date.now() - lastPlayIntent < PLAY_INTENT_MS
      || document.querySelector(".slideshow-active")
    ) {
      return;
    }

    media.pause();
  }

  // PhotoPrism only autoplays GIFs, short videos, and media opened from the gallery.
  // Every other video waits behind a play button, so press it once the slide has settled.
  function autoplayCurrentMedia(viewer) {
    if (!autoplayEnabled) {
      return;
    }

    // Once the autoplayed slide is no longer the one shown, forget it so that
    // navigating back to it autoplays it again.
    // PhotoSwipe marks the holder of the active slide with aria-hidden="false".
    const activeHolder = viewer.querySelector('.pswp__item[aria-hidden="false"]');
    if (
      lastAutoplayContainer
      && (
        !lastAutoplayContainer.isConnected
        || (activeHolder && !activeHolder.contains(lastAutoplayContainer))
      )
    ) {
      autoplayedMedia.delete(lastAutoplayContainer);
      revisitedMedia.add(lastAutoplayContainer);
      lastAutoplayContainer = null;
    }

    // Media that is navigated back to starts right away, as soon as its slide becomes active.
    const activeContainer = activeHolder?.querySelector(".pswp__media");
    if (
      activeContainer
      && revisitedMedia.has(activeContainer)
      && !autoplayedMedia.has(activeContainer)
    ) {
      autoplayedMedia.add(activeContainer);
      lastAutoplayContainer = activeContainer;
      const media = activeContainer.querySelector("video, audio");
      if (media && media.paused) {
        media.play().catch(() => {
          const playButton = activeContainer.querySelector(PLAY_BUTTON_SELECTOR);
          if (playButton && media.paused) {
            simulateTap(playButton);
          }
        });
      }
      return;
    }

    const button = findCurrentPlayButton(viewer);
    const container = button?.parentElement || button;
    if (!button || autoplayedMedia.has(container) || revisitedMedia.has(container)) {
      return;
    }

    const left = Math.round(button.getBoundingClientRect().left);
    if (autoplayPositions.get(button) !== left) {
      autoplayPositions.set(button, left);
      window.setTimeout(scheduleSynchronization, AUTOPLAY_SETTLE_MS);
      return;
    }

    autoplayedMedia.add(container);
    lastAutoplayContainer = container;

    // PhotoPrism starts GIFs, short videos, and media opened from the gallery on its own.
    // Wait for that first: pressing play while it is happening would toggle playback off.
    window.setTimeout(() => {
      const currentViewer = getViewer();
      if (
        !currentViewer
        || !button.isConnected
        || !isRendered(button)
        || findCurrentPlayButton(currentViewer) !== button
        || getViewerVideos(currentViewer).some((media) => !media.paused)
      ) {
        return;
      }

      simulateTap(button);
      window.setTimeout(() => {
        const started = !button.isConnected
          || Boolean(container.querySelector("video, audio"))
          || getViewerVideos(currentViewer).some((media) => !media.paused);
        if (!started) {
          button.click();
        }
      }, AUTOPLAY_SETTLE_MS);
    }, NATIVE_AUTOPLAY_GRACE_MS);
  }

  function createVolumePopover() {
    const popover = document.createElement("div");
    popover.className = CONTROL_CLASS;
    popover.setAttribute("role", "group");
    popover.setAttribute("aria-label", "Video volume");
    const slider = document.createElement("input");
    slider.className = `${CONTROL_CLASS}__slider`;
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    slider.setAttribute("aria-label", "Video volume");
    popover.append(slider);
    document.body.append(popover);
    volumePopover = popover;
    volumeSlider = slider;
    slider.addEventListener("pointerenter", showVolumePopover);
    slider.addEventListener("pointerleave", schedulePopoverHide);
    slider.addEventListener("focusin", showVolumePopover);
    slider.addEventListener("focusout", schedulePopoverHide);
    slider.addEventListener("input", (event) => {
      preferredVolume = Number(event.currentTarget.value);
      setMediaVolume(currentVideos, preferredVolume);
      persistPreferredVolume();
      if (preferredVolume > 0) {
        setMediaMuted(currentVideos, false);
      }
      updateControlValues();
    });
  }

  // Returns the existing (not draft) face boxes drawn over the image.
  function getMarkerBoxes(overlay) {
    return Array.from(overlay.querySelectorAll(MARKER_BOX_SELECTOR)).map((rect) => ({
      rect,
      named: rect.classList.contains("p-meta-face-markers__rect--named"),
      name: (rect.querySelector("title")?.textContent || "").trim(),
      removing: rect.classList.contains("p-meta-face-markers__rect--removing"),
    }));
  }

  // Returns the people rows of the right side panel together with their real inputs.
  function getPersonRows(viewer) {
    return Array.from(viewer.querySelectorAll(PERSON_ROW_SELECTOR))
      .filter(isRendered)
      .map((row) => {
        const field = row.querySelector(".meta-inline-marker");
        const input = row.querySelector(PERSON_INPUT_SELECTOR);
        const hidden = row.querySelector(".meta-inline-marker input[type='hidden']");
        return {
          uid: row.dataset.markerUid,
          named: Boolean(field?.classList.contains("meta-inline-marker--named")),
          name: (hidden?.value || input?.value || "").trim(),
          input,
        };
      })
      .filter(({ input }) => input);
  }

  // The boxes carry no marker id, so named ones are matched by name and unnamed ones by order.
  // A group whose sizes differ is skipped rather than risking a box typing into the wrong face.
  function pairMarkerBoxesWithRows(boxes, rows) {
    const pairs = [];
    const unnamedBoxes = boxes.filter(({ named }) => !named);
    const unnamedRows = rows.filter(({ named }) => !named);
    if (unnamedBoxes.length === unnamedRows.length) {
      unnamedBoxes.forEach((box, index) => pairs.push({ box, row: unnamedRows[index] }));
    }

    const namedRows = rows.filter(({ named }) => named);
    for (const box of boxes.filter(({ named }) => named)) {
      const index = namedRows.findIndex(({ name }) => name === box.name);
      if (index !== -1) {
        pairs.push({ box, row: namedRows.splice(index, 1)[0] });
      }
    }

    return pairs;
  }

  function findPersonInput(uid) {
    return document.querySelector(
      `${PERSON_ROW_SELECTOR}[data-marker-uid="${CSS.escape(uid)}"] ${PERSON_INPUT_SELECTOR}`,
    );
  }

  function createMarkerInputLayer(overlay) {
    const layer = document.createElement("div");
    layer.className = MARKER_INPUTS_CLASS;
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend"]) {
      layer.addEventListener(type, (event) => event.stopPropagation());
    }
    overlay.append(layer);
    return layer;
  }

  // The box under a marker mirrors the marker's real input in the side panel. Clicking it
  // focuses that input, so typing, suggestions and Enter work exactly like in the panel.
  function createMarkerInput(uid) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = MARKER_INPUT_CLASS;
    input.dataset.markerUid = uid;
    input.readOnly = true;
    input.tabIndex = -1;
    input.autocomplete = "off";
    input.addEventListener("pointerdown", (event) => {
      if (input.dataset.named === "true") {
        return;
      }

      event.preventDefault();
      mirrorFocusUid = uid;
      const realInput = findPersonInput(uid);
      realInput?.closest(".metadata__person-row")?.scrollIntoView({ block: "nearest" });
      realInput?.focus();
    });
    return input;
  }

  // PhotoPrism only renders the "Unassign" button of a named face while its row is hovered,
  // so hover the row first, press the real button, and then un-hover it again.
  async function unassignMarkerSubject(uid) {
    const row = document.querySelector(`${PERSON_ROW_SELECTOR}[data-marker-uid="${CSS.escape(uid)}"]`);
    if (!row) {
      return;
    }

    const findButton = () => row.querySelector(".meta-marker-clear-subject");
    const targets = [row, row.querySelector(".meta-inline-marker"), row.querySelector(".v-field")]
      .filter(Boolean);
    const dispatchAll = (types) => {
      for (const target of targets) {
        for (const type of types) {
          target.dispatchEvent(new MouseEvent(type, { bubbles: type === "mouseover" || type === "mouseout" }));
        }
      }
    };

    let button = findButton();
    const revealed = !button;
    if (revealed) {
      dispatchAll(["pointerenter", "mouseenter", "mouseover"]);
      for (let frame = 0; frame < 10 && !(button = findButton()); frame += 1) {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      }
    }

    button?.click();

    if (revealed) {
      dispatchAll(["pointerleave", "mouseleave", "mouseout"]);
    }
  }

  function createMarkerUnassignButton(uid) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = MARKER_UNASSIGN_CLASS;
    button.dataset.markerUid = uid;
    button.title = "Unassign";
    button.tabIndex = -1;

    const icon = document.createElement("i");
    icon.className = "mdi mdi-eject";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);

    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      unassignMarkerSubject(uid).catch((error) => {
        console.warn("Could not unassign the face.", error);
      });
    });
    return button;
  }

  function removeMarkerInputs() {
    for (const layer of document.querySelectorAll(`.${MARKER_INPUTS_CLASS}`)) {
      layer.parentElement?.classList.remove(MARKER_INPUTS_ACTIVE_CLASS);
      layer.remove();
    }
  }

  function syncMarkerInputs(viewer) {
    const overlay = viewer?.querySelector(MARKER_OVERLAY_SELECTOR);
    if (!overlay || !overlay.classList.contains("is-edit")) {
      removeMarkerInputs();
      return;
    }

    const pairs = pairMarkerBoxesWithRows(getMarkerBoxes(overlay), getPersonRows(viewer));
    const layer = overlay.querySelector(`:scope > .${MARKER_INPUTS_CLASS}`) || createMarkerInputLayer(overlay);
    overlay.classList.toggle(MARKER_INPUTS_ACTIVE_CLASS, pairs.length > 0);

    const overlayRect = overlay.getBoundingClientRect();
    const activeElement = document.activeElement;
    const currentUids = new Set();

    for (const { box, row } of pairs) {
      const boxRect = box.rect.getBoundingClientRect();
      if (boxRect.width === 0 || boxRect.height === 0) {
        continue;
      }

      currentUids.add(row.uid);
      let input = Array.from(layer.children).find(
        (child) => child.classList.contains(MARKER_INPUT_CLASS) && child.dataset.markerUid === row.uid,
      );
      if (!input) {
        input = createMarkerInput(row.uid);
        layer.append(input);
      }

      const value = row.input.value;
      if (input.value !== value) {
        input.value = value;
      }
      input.placeholder = row.named ? "" : "";
      input.title = row.named ? row.name : "";
      input.dataset.named = String(row.named);
      input.dataset.active = String(activeElement === row.input);
      input.hidden = box.removing;
      const centerX = Math.round(boxRect.left + (boxRect.width / 2) - overlayRect.left);
      input.style.left = `${centerX}px`;
      input.style.top = `${Math.round(boxRect.bottom - overlayRect.top) + 6}px`;

      // Named faces get the same "Unassign" button as in the side panel, next to the box.
      let unassign = Array.from(layer.children).find(
        (child) => child.classList.contains(MARKER_UNASSIGN_CLASS) && child.dataset.markerUid === row.uid,
      );
      if (row.named) {
        if (!unassign) {
          unassign = createMarkerUnassignButton(row.uid);
          layer.append(unassign);
        }
        unassign.hidden = box.removing;
        unassign.style.left = `${Math.round(centerX + (input.offsetWidth / 2) + 4)}px`;
        unassign.style.top = input.style.top;
        unassign.style.height = `${input.offsetHeight}px`;
      } else {
        unassign?.remove();
      }
    }

    for (const child of Array.from(layer.children)) {
      if (!currentUids.has(child.dataset.markerUid)) {
        child.remove();
      }
    }
  }

  function getPreviewToken() {
    for (const image of document.querySelectorAll('img[src*="/api/v1/t/"]')) {
      const match = /\/api\/v1\/t\/[0-9a-f-]+\/([A-Za-z0-9_-]+)\//i.exec(image.getAttribute("src") || "");
      if (match) {
        return match[1];
      }
    }
    return "";
  }

  // Adds each person's cover image to the left of the name in the suggestion list
  // of the face input that currently has focus.
  function syncSubjectAvatars() {
    const input = document.activeElement;
    if (
      personThumbs.size === 0
      || !(input instanceof Element)
      || !input.matches(`${PERSON_ROW_SELECTOR} ${PERSON_INPUT_SELECTOR}`)
    ) {
      return;
    }

    const menu = document.getElementById(input.getAttribute("aria-controls") || "");
    const token = getPreviewToken();
    if (!menu || !token) {
      return;
    }

    for (const item of menu.querySelectorAll('.v-list-item[role="option"]')) {
      const prepend = item.querySelector(".v-list-item__prepend");
      if (!prepend) {
        continue;
      }

      const name = (item.querySelector(".v-list-item-title")?.textContent || "").trim();
      const hash = personThumbs.get(name);
      let avatar = prepend.querySelector(`.${SUBJECT_AVATAR_CLASS}`);
      if (!hash) {
        avatar?.remove();
        continue;
      }

      if (!avatar) {
        avatar = document.createElement("img");
        avatar.className = SUBJECT_AVATAR_CLASS;
        avatar.alt = "";
        avatar.draggable = false;
        prepend.prepend(avatar);
      }

      const source = `/api/v1/t/${hash}/${token}/tile_160`;
      if (avatar.getAttribute("src") !== source) {
        avatar.setAttribute("src", source);
      }
    }
  }

  async function requestPersonThumbCapture() {
    const response = await chrome.runtime.sendMessage({ type: "capture-person-thumbs" });
    if (!response?.ok) {
      throw new Error(response?.error || "The people list could not be captured.");
    }
  }

  function clearSuggestionMenuAnchor() {
    for (const element of document.querySelectorAll(`[${MENU_ANCHOR_ATTRIBUTE}]`)) {
      element.removeAttribute(MENU_ANCHOR_ATTRIBUTE);
      for (const property of MENU_ANCHOR_PROPERTIES) {
        element.style.removeProperty(property);
      }
    }
  }

  // Moves the suggestion list of a face input to the box under the face when that box was
  // used, above it when the box is in the lower half of the screen and below it otherwise.
  function syncSuggestionMenuPosition() {
    const input = document.activeElement;
    const uid = input instanceof Element ? input.closest(".metadata__person-row")?.dataset.markerUid : null;
    const mirror = uid && uid === mirrorFocusUid && input.matches(`${PERSON_ROW_SELECTOR} ${PERSON_INPUT_SELECTOR}`)
      ? document.querySelector(`.${MARKER_INPUT_CLASS}[data-marker-uid="${CSS.escape(uid)}"]`)
      : null;
    const menu = mirror && !mirror.hidden ? document.getElementById(input.getAttribute("aria-controls") || "") : null;
    const content = menu && (
      menu.classList.contains("v-overlay__content")
        ? menu
        : menu.querySelector(".v-overlay__content") || menu.closest(".v-overlay__content")
    );
    if (!content) {
      clearSuggestionMenuAnchor();
      return;
    }

    const rect = mirror.getBoundingClientRect();
    const parentRect = content.offsetParent?.getBoundingClientRect()
      || { left: 0, top: 0, bottom: window.innerHeight };
    const above = rect.top + (rect.height / 2) > window.innerHeight / 2;
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 16);
    const left = Math.min(
      Math.max(rect.left + (rect.width / 2) - (width / 2), 8),
      window.innerWidth - width - 8,
    );
    const space = above ? rect.top : window.innerHeight - rect.bottom;
    const values = {
      "--qoolprism-menu-left": `${Math.round(left - parentRect.left)}px`,
      "--qoolprism-menu-top": above ? "auto" : `${Math.round(rect.bottom - parentRect.top + 4)}px`,
      "--qoolprism-menu-bottom": above ? `${Math.round(parentRect.bottom - rect.top + 4)}px` : "auto",
      "--qoolprism-menu-width": `${Math.round(width)}px`,
      "--qoolprism-menu-max-height": `${Math.round(Math.max(120, Math.min(360, space - 16)))}px`,
    };

    if (!content.hasAttribute(MENU_ANCHOR_ATTRIBUTE)) {
      content.setAttribute(MENU_ANCHOR_ATTRIBUTE, "");
    }
    for (const [property, value] of Object.entries(values)) {
      if (content.style.getPropertyValue(property) !== value) {
        content.style.setProperty(property, value);
      }
    }
  }

  function isSidebarOpen(sidebar) {
    if (!sidebar || !isRendered(sidebar)) {
      return false;
    }

    const rect = sidebar.getBoundingClientRect();
    return rect.right > 0 && rect.left < window.innerWidth;
  }

  // Finds the viewer buttons and side panel items that have a keybind, with the key to show.
  // Side panel items only get a bubble while the panel is open.
  function getKeyBadgeTargets(viewer) {
    const targets = new Map();
    const add = (element, label, { atIcon = false, inSidebar = false, offsetX = 0, fixed = false, centered = false } = {}) => {
      if (!element || (!inSidebar && element.closest(".p-lightbox-sidebar"))) {
        return;
      }

      const existing = targets.get(element);
      if (!existing) {
        targets.set(element, { label, atIcon, offsetX, fixed, centered });
      } else if (!existing.label.split("/").includes(label)) {
        // Two keys that trigger the same button share one bubble.
        existing.label += `/${label}`;
      }
    };

    const sidebar = viewer.querySelector(".p-lightbox-sidebar");
    const sidebarOpen = isSidebarOpen(sidebar);
    if (sidebarOpen) {
      const buttons = Array.from(sidebar.querySelectorAll('button, [role="button"]')).filter(isRendered);
      add(
        buttons.find((button) => /chevron[-_ ]?right|arrow[-_ ]?right/.test(getIconTokens(button))) || buttons[0],
        "Tab",
        { atIcon: true, inSidebar: true, fixed: true, centered: true },
      );
    } else {
      add(viewer.querySelector(".pswp__button--info-button"), "Tab");
    }

    add(
      viewer.querySelector(".pswp__button--zoom")
        || Array.from(viewer.querySelectorAll('button, [role="button"]'))
          .find((button) => /\bzoom\b/i.test(getElementLabel(button))),
      "Z",
    );
    add(viewer.querySelector(`.${AUTOPLAY_BUTTON_CLASS}`), "U");
    add(viewer.querySelector(`.${RANDOM_BUTTON_CLASS}`), "R");
    if (getViewerVideos(viewer).length) {
      add(getMuteButton(viewer), "W/S");
    }

    if (sidebarOpen) {
      const editToggle = sidebar.querySelector(".meta-faces-edit");
      const editingPeople = Boolean(editToggle?.classList.contains("is-active"));
      if (editToggle && isDisplayed(editToggle) && !editToggle.disabled) {
        add(editToggle, "T", { atIcon: true, inSidebar: true, fixed: true });
      }

      // Same fields as the 1-9 and 0 keys. While people are being edited, those keys select faces instead.
      const detailFields = [
        "title", "caption", "taken", "camera", "subject",
        "copyright", "artist", "license", "keywords", "notes",
      ];
      detailFields.forEach((field, index) => {
        if (!editingPeople) {
          add(findViewerDetailRow(viewer, field), String((index + 1) % 10), { inSidebar: true });
        }
      });

      for (const [collection, key] of [["albums", "G"], ["labels", "V"]]) {
        const input = findViewerCollectionInput(viewer, collection);
        add(input?.closest(".v-field") || input?.parentElement, key, { inSidebar: true });
      }

      if (editingPeople) {
        Array.from(viewer.querySelectorAll(PERSON_ROW_SELECTOR))
          .filter(isDisplayed)
          .slice(0, 10)
          .forEach((row, index) => add(row, String((index + 1) % 10), { inSidebar: true }));
      }
    }

    for (const key of ["f", "q", "e", "p", "x", "c"]) {
      add(findViewerOptionButton(viewer, key), key.toUpperCase(), { inSidebar: key === "p" && sidebarOpen });
    }
    add(findNavigationButton(viewer, "previous"), "A", { atIcon: true, offsetX: -20 });
    add(findNavigationButton(viewer, "next"), "D", { atIcon: true, offsetX: -10 });
    add(viewer.querySelector(MARKER_CONFIRM_SELECTOR), "↵");
    add(viewer.querySelector(MARKER_REMOVE_SELECTOR), "Del");

    return targets;
  }

  // Returns the button that opens the dropdown of a navigation item, if the item has one.
  function findNavigationDropdownToggle(item) {
    const match = Array.from(item.querySelectorAll('button, [role="button"], [aria-expanded], .v-icon'))
      .find((candidate) => isDisplayed(candidate) && (
        candidate.hasAttribute("aria-expanded")
        || /(chevron|arrow|menu|caret)[-_ ]?(down|up)|expand|dropdown/.test(getIconTokens(candidate))
      ));

    return match?.closest('button, [role="button"]') || match || null;
  }

  // Finds the navigation sidebar items that have a keybind outside of the viewer: Tab and 1-9, 0, -, =.
  function getPageKeyBadgeTargets() {
    const targets = new Map();
    const toggle = findNavigationSidebarToggle();
    if (toggle) {
      targets.set(toggle, { label: "Tab", atIcon: false, offsetX: 0, fixed: true });
    }

    // Items with a dropdown button end earlier than the others, so every bubble is lined up
    // with the right edge of the widest item and the top of its own item.
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
    const items = getNavigationSidebarItems().slice(0, keys.length);
    const rightEdge = Math.max(...items.map((item) => item.getBoundingClientRect().right));
    items.forEach((item, index) => {
      targets.set(findNavigationDropdownToggle(item) || item, {
        label: keys[index],
        atIcon: false,
        offsetX: 0,
        alignTo: item,
        rightEdge,
      });
    });

    return targets;
  }

  // Bubbles on small buttons are wider than the button and get cut off by it, so these are
  // positioned on the screen instead of inside the button.
  function placeKeyBadgeFixed(button, badge, atIcon, offsetX, centered = false) {
    const buttonRect = button.getBoundingClientRect();
    const icon = atIcon ? button.querySelector("svg, i, img") : null;
    const iconRect = icon?.getBoundingClientRect();

    if (badge.dataset.fixed !== "true") {
      badge.dataset.fixed = "true";
      badge.style.position = "fixed";
      badge.style.right = "auto";
      badge.style.left = "0px";
      badge.style.top = "0px";
    }

    // A transformed ancestor becomes the origin of fixed positions, so find where 0, 0 is
    // from the badge's current position, without moving the badge there and back.
    const badgeRect = badge.getBoundingClientRect();
    const originLeft = badgeRect.left - (Number.parseFloat(badge.style.left) || 0);
    const originTop = badgeRect.top - (Number.parseFloat(badge.style.top) || 0);

    const left = iconRect
      ? (centered
        ? iconRect.left + (iconRect.width / 2) - (badge.offsetWidth / 2)
        : iconRect.right - 6 + offsetX)
      : buttonRect.right - 2 - badge.offsetWidth;
    const top = iconRect ? iconRect.top - 4 - (centered ? 6 : 0) : buttonRect.top + 2;
    const leftValue = `${Math.round(left - originLeft)}px`;
    const topValue = `${Math.round(top - originTop)}px`;
    if (badge.style.left !== leftValue) {
      badge.style.left = leftValue;
    }
    if (badge.style.top !== topValue) {
      badge.style.top = topValue;
    }
  }

  function placeKeyBadgeAlignedToItem(element, badge, item, rightEdge) {
    const rect = element.getBoundingClientRect();
    const right = `${Math.round(rect.right - rightEdge) + 2}px`;
    const top = `${Math.round(item.getBoundingClientRect().top - rect.top) + 2}px`;

    if (badge.style.right !== right) {
      badge.style.right = right;
    }
    if (badge.style.top !== top) {
      badge.style.top = top;
    }
  }

  // Puts the bubble on the top right corner of the button's icon instead of the button's own corner.
  function placeKeyBadgeAtIcon(button, badge, offsetX = 0) {
    const icon = button.querySelector("svg, i, img");
    if (!icon) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const left = `${Math.round(Math.max(0, Math.min(
      iconRect.right - buttonRect.left - 6 + offsetX,
      button.clientWidth - badge.offsetWidth,
    )))}px`;
    const top = `${Math.round(Math.max(0, iconRect.top - buttonRect.top - 4))}px`;

    if (badge.style.left !== left) {
      badge.style.left = left;
    }
    if (badge.style.top !== top) {
      badge.style.top = top;
    }
    if (badge.style.right !== "auto") {
      badge.style.right = "auto";
    }
  }

  // Shows a small bubble with the key on every viewer button that has a keybind.
  function syncKeyBadges(viewer) {
    if (!keyBadgesEnabled) {
      document.querySelectorAll(`.${KEY_BADGE_CLASS}`).forEach((badge) => badge.remove());
      return;
    }

    // While a new slide (such as a video) is still loading, no viewer is found even though it is open.
    // That is not a new visit, so nothing is reset.
    if (!viewer && isLightboxOpen()) {
      return;
    }

    const targets = viewer ? getKeyBadgeTargets(viewer) : getPageKeyBadgeTargets();

    for (const badge of document.querySelectorAll(`.${KEY_BADGE_CLASS}`)) {
      if (targets.get(badge.parentElement)?.label !== badge.textContent) {
        badge.remove();
      }
    }

    for (const [button, { label, atIcon, offsetX, alignTo, rightEdge, fixed, centered }] of targets) {
      let badge = button.querySelector(`:scope > .${KEY_BADGE_CLASS}`);
      if (!badge) {
        if (!fixed && window.getComputedStyle(button).position === "static") {
          button.style.position = "relative";
        }

        badge = document.createElement("span");
        badge.className = KEY_BADGE_CLASS;
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = label;
        button.append(badge);
      }

      if (fixed) {
        placeKeyBadgeFixed(button, badge, atIcon, offsetX, centered);
      } else {
        if (atIcon) {
          placeKeyBadgeAtIcon(button, badge, offsetX);
        }
        if (alignTo) {
          placeKeyBadgeAlignedToItem(button, badge, alignTo, rightEdge);
        }
      }
    }
  }

  // Opens PhotoPrism's actions menu for a right click on a gallery image.
  function syncClipboardMenu(viewer) {
    const button = document.querySelector(CLIPBOARD_MENU_BUTTON_SELECTOR);
    const rightClicked = Boolean(contextMenuRequest) && !contextMenuRequest.opened;
    const now = Date.now();
    const waitingForMenuToClose = Boolean(contextMenuRequest) && now < contextMenuRequest.waitUntil;

    if (
      button
      && !viewer
      && !waitingForMenuToClose
      && rightClicked
      && button.getAttribute("aria-expanded") === "false"
      && now - lastClipboardMenuClick > 400
    ) {
      lastClipboardMenuClick = now;
      setContextMenuPending(true);
      button.click();
    }
  }

  function setContextMenuPending(pending) {
    if (pending) {
      document.documentElement.setAttribute(CONTEXT_MENU_PENDING_ATTRIBUTE, "");
    } else {
      document.documentElement.removeAttribute(CONTEXT_MENU_PENDING_ATTRIBUTE);
    }
  }

  // With onlyHidden, a menu that is still fading out stays where it is, and is let go of
  // once it is gone. Otherwise it would jump back to its original spot while closing.
  function clearContextMenuAnchor(onlyHidden = false) {
    for (const element of document.querySelectorAll(`[${CONTEXT_MENU_ATTRIBUTE}]`)) {
      if (onlyHidden && isRendered(element)) {
        continue;
      }
      element.removeAttribute(CONTEXT_MENU_ATTRIBUTE);
      for (const property of CONTEXT_MENU_PROPERTIES) {
        element.style.removeProperty(property);
      }
    }
  }

  // Keeps the actions menu next to the cursor while it is open after a right click.
  function syncContextMenuPosition(viewer) {
    const request = contextMenuRequest;
    if (!request) {
      setContextMenuPending(false);
      clearContextMenuAnchor(true);
      return;
    }

    const button = document.querySelector(CLIPBOARD_MENU_BUTTON_SELECTOR);
    const expanded = button?.getAttribute("aria-expanded") === "true";
    const now = Date.now();
    if (now - request.since > 3000) {
      setContextMenuPending(false);
    }

    // The menu that was open during the right click is still closing itself.
    if (!viewer && now < request.waitUntil) {
      return;
    }

    if (viewer || (!expanded && (request.opened || now - request.since > 1500))) {
      contextMenuRequest = null;
      setContextMenuPending(false);
      clearContextMenuAnchor(true);
      return;
    }
    if (!expanded) {
      return;
    }

    request.opened = true;
    const menu = document.getElementById(button.getAttribute("aria-controls") || "");
    const content = menu && (
      menu.classList.contains("v-overlay__content")
        ? menu
        : menu.querySelector(".v-overlay__content") || menu.closest(".v-overlay__content")
    );
    if (!content || content.offsetWidth === 0 || content.offsetHeight === 0) {
      return;
    }

    const width = content.offsetWidth;
    const height = content.offsetHeight;
    let left = request.x + 2;
    if (left + width > window.innerWidth - 8) {
      left = request.x - width - 2;
    }
    let top = request.y + 2;
    if (top + height > window.innerHeight - 8) {
      top = request.y - height - 2;
    }

    const parentRect = content.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    const values = {
      "--qoolprism-context-left": `${Math.round(Math.max(8, left) - parentRect.left)}px`,
      "--qoolprism-context-top": `${Math.round(Math.max(8, top) - parentRect.top)}px`,
    };

    if (!content.hasAttribute(CONTEXT_MENU_ATTRIBUTE)) {
      content.setAttribute(CONTEXT_MENU_ATTRIBUTE, "");
    }
    for (const [property, value] of Object.entries(values)) {
      if (content.style.getPropertyValue(property) !== value) {
        content.style.setProperty(property, value);
      }
    }
    setContextMenuPending(false);
  }

  function synchronizeFeatures() {
    syncScheduled = false;
    refreshGalleryMediaUidsIfNeeded();
    const viewer = getViewer();
    syncClipboardMenu(viewer);
    syncContextMenuPosition(viewer);
    syncKeyBadges(viewer);
    if (!viewer) {
      closeSearchMenu();
      clearHighlightedFace();
      syncMarkerInputs(null);
      clearSuggestionMenuAnchor();
    } else {
      autoplayCurrentMedia(viewer);
      syncAutoplayButton(viewer);
      syncMarkerInputs(viewer);
      syncSubjectAvatars();
      syncSuggestionMenuPosition();
    }
    if (highlightedGalleryItemUid) {
      const currentElement = findGalleryItemElement(highlightedGalleryItemUid);
      if (currentElement !== highlightedGalleryElement) {
        highlightGalleryItem(highlightedGalleryItemUid, false);
      }
    }
    const videos = viewer ? getViewerVideos(viewer) : [];
    const video = getActiveVideo(videos);
    const button = viewer && video ? getMuteButton(viewer) : null;
    const videosChanged = videos.length !== currentVideos.length
      || videos.some((candidate, index) => candidate !== currentVideos[index]);

    if (videosChanged) {
      removeVolumeControl();
      currentVideos = videos;
      currentVideo = video;
      if (currentVideos.length) {
        for (const media of currentVideos) {
          media.addEventListener("volumechange", handleMediaVolumeChange);
          media.addEventListener("loadedmetadata", applyPreferredVolume);
          media.addEventListener("play", applyPreferredVolume);
        }

        if (preferredVolume === null && currentVideo) {
          preferredVolume = currentVideo.volume;
        }
        applyPreferredVolume();
      }
    } else {
      currentVideo = video;
    }

    bindMuteButton(button);
    if (currentVideos.length && button) {
      if (!volumePopover) {
        createVolumePopover();
      }
      updateControlValues();
    } else if (volumePopover) {
      volumePopover.remove();
      volumePopover = null;
      volumeSlider = null;
      window.clearTimeout(hidePopoverTimer);
      bindMuteButton(null);
    }

    if (currentVideo && volumePopover) {
      updatePopoverPosition();
    }
  }

  function scheduleSynchronization() {
    if (syncScheduled) {
      return;
    }

    syncScheduled = true;
    window.requestAnimationFrame(synchronizeFeatures);
  }

  async function start() {
    const settings = await chrome.storage.local.get(["serverOrigin", "videoVolume", AUTOPLAY_ENABLED_KEY, KEY_BADGES_ENABLED_KEY]);
    if (settings.serverOrigin !== window.location.origin) {
      return;
    }
    if (isValidVolume(settings.videoVolume)) {
      preferredVolume = settings.videoVolume;
      lastPersistedVolume = settings.videoVolume;
    }
    if (typeof settings[AUTOPLAY_ENABLED_KEY] === "boolean") {
      autoplayEnabled = settings[AUTOPLAY_ENABLED_KEY];
    }
    if (typeof settings[KEY_BADGES_ENABLED_KEY] === "boolean") {
      keyBadgesEnabled = settings[KEY_BADGES_ENABLED_KEY];
    }

    // Registered first so that other handlers cannot stop these events before they are seen.
    for (const type of ["pointerdown", "click", "keydown"]) {
      window.addEventListener(type, markPlayIntent, true);
    }
    window.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("play", suppressNativeAutoplay, true);
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && typeof changes[AUTOPLAY_ENABLED_KEY]?.newValue === "boolean") {
        setAutoplayEnabled(changes[AUTOPLAY_ENABLED_KEY].newValue, false);
      }
      if (areaName === "local" && typeof changes[KEY_BADGES_ENABLED_KEY]?.newValue === "boolean") {
        keyBadgesEnabled = changes[KEY_BADGES_ENABLED_KEY].newValue;
        scheduleSynchronization();
      }
      if (areaName !== "local" || !changes.videoVolume) {
        return;
      }

      const savedVolume = changes.videoVolume.newValue;
      if (!isValidVolume(savedVolume)) {
        return;
      }

      preferredVolume = savedVolume;
      lastPersistedVolume = savedVolume;
      setMediaVolume(currentVideos, savedVolume);
      updateControlValues();
    });
    document.addEventListener("pointerdown", (event) => {
      if (
        event.target instanceof Element
        && !event.target.closest(`.${SEARCH_MENU_CLASS}, .${SEARCH_BUTTON_CLASS}`)
      ) {
        closeSearchMenu();
      }
    }, true);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    // Bubbles positioned on the screen have to follow their button when the page or side panel scrolls.
    window.addEventListener("scroll", () => {
      if (document.querySelector(`.${KEY_BADGE_CLASS}[data-fixed]`)) {
        scheduleSynchronization();
      }
    }, true);
    window.addEventListener("resize", scheduleSynchronization);
    // The side panel slides in and out, so its final position is only known once that ends.
    document.addEventListener("transitionend", (event) => {
      if (event.target instanceof Element && event.target.closest(".p-lightbox-sidebar, #p-navigation")) {
        scheduleSynchronization();
      }
    }, true);
    // Selecting a face box drops focus from any input, so Delete removes the box
    // instead of being treated as typing in a field.
    document.addEventListener("pointerdown", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(MARKER_SELECT_SELECTOR)) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body && isEditableTarget(activeElement)) {
        activeElement.blur();
      }
    }, true);
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (
        event.source !== window
        || event.origin !== window.location.origin
        || data?.source !== "qoolprism"
        || data.type !== "person-thumbs"
        || !data.thumbs
        || typeof data.thumbs !== "object"
      ) {
        return;
      }

      personThumbs.clear();
      for (const [name, hash] of Object.entries(data.thumbs)) {
        if (typeof hash === "string" && /^[0-9a-f]{40}(?:-[0-9a-f]+)?$/i.test(hash)) {
          personThumbs.set(name, hash);
        }
      }
      scheduleSynchronization();
    });
    // Selecting a face box takes focus away from any input field (PhotoPrism keeps it otherwise).
    document.addEventListener("pointerdown", (event) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement
        && isEditableTarget(active)
        && event.target instanceof Element
        && event.target.closest(".p-meta-face-markers__rect")
      ) {
        active.blur();
      }
    }, true);
    requestPersonThumbCapture().catch((error) => {
      console.warn("Could not capture PhotoPrism's people list.", error);
    });
    for (const type of ["input", "focusin", "focusout"]) {
      document.addEventListener(type, (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.matches(`${PERSON_ROW_SELECTOR} ${PERSON_INPUT_SELECTOR}`)) {
          return;
        }

        if (type === "focusout" && target.closest(".metadata__person-row")?.dataset.markerUid === mirrorFocusUid) {
          mirrorFocusUid = null;
        }
        scheduleSynchronization();
      }, true);
    }
    // Right clicking a gallery image selects it (if needed) and opens the actions menu there.
    document.addEventListener("contextmenu", (event) => {
      const card = event.target instanceof Element
        ? event.target.closest("main .media.result[data-uid]")
        : null;
      if (!card || getViewer()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      const menuWasOpen = document.querySelector(CLIPBOARD_MENU_BUTTON_SELECTOR)
        ?.getAttribute("aria-expanded") === "true";
      contextMenuRequest = {
        x: event.clientX,
        y: event.clientY,
        since: now,
        opened: false,
        // An open menu closes itself because of this right click, and is opened again afterwards.
        waitUntil: menuWasOpen ? now + CLIPBOARD_MENU_REOPEN_DELAY_MS : 0,
      };
      if (menuWasOpen) {
        lastClipboardMenuClick = 0;
        window.setTimeout(scheduleSynchronization, CLIPBOARD_MENU_REOPEN_DELAY_MS + 10);
      }
      if (!card.classList.contains("is-selected")) {
        card.querySelector("button.input-select")?.click();
      }
      scheduleSynchronization();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Element && event.target.closest(PERSON_ROW_SELECTOR)) {
        mirrorFocusUid = null;
      }
    }, true);

    const observer = new MutationObserver((records) => {
      const pageChanged = records.some(({ type, target, addedNodes, removedNodes }) => {
        const element = target instanceof Element ? target : target.parentElement;
        if (
          type === "childList"
          && [...addedNodes, ...removedNodes].every(
            (node) => node instanceof Element && node.classList.contains(KEY_BADGE_CLASS),
          )
        ) {
          return false;
        }
        return !element?.closest(
          `.${CONTROL_CLASS}, .${MARKER_INPUTS_CLASS}, .${AUTOPLAY_BUTTON_CLASS}, .${KEY_BADGE_CLASS}`,
        );
      });

      if (pageChanged) {
        scheduleSynchronization();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden", "aria-modal"],
    });
    synchronizeFeatures();
  }

  start().catch((error) => {
    console.error("Could not start QoolPrism.", error);
  });
})();