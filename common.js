(function initializeSharedUtilities(root) {
  function parseServerUrl(value) {
    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error("Enter a valid server URL, such as https://123.456.78.9");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("The server URL must use HTTP or HTTPS.");
    }

    if (url.username || url.password) {
      throw new Error("Do not include a username or password in the server URL.");
    }

    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Enter the server origin only, without a path, query, or fragment.");
    }

    return {
      serverOrigin: url.origin,
      permissionPattern: `${url.protocol}//${url.hostname}/*`,
    };
  }

  function navigationDirection(key) {
    if (typeof key !== "string") {
      return null;
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "a") {
      return "previous";
    }
    if (normalizedKey === "d") {
      return "next";
    }
    return null;
  }

  function galleryNavigationDirection(key) {
    if (typeof key !== "string") {
      return null;
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "a") {
      return "left";
    }
    if (normalizedKey === "d") {
      return "right";
    }
    if (normalizedKey === "w") {
      return "up";
    }
    if (normalizedKey === "s") {
      return "down";
    }
    return null;
  }

  function spatialNavigationIndex(positions, currentIndex, direction) {
    if (
      !Array.isArray(positions)
      || !Number.isInteger(currentIndex)
      || currentIndex < 0
      || currentIndex >= positions.length
      || !["up", "down"].includes(direction)
      || positions.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))
    ) {
      throw new RangeError("Gallery positions, current index, or direction are invalid.");
    }

    if (positions.length < 2) {
      return currentIndex;
    }

    const current = positions[currentIndex];
    const candidates = positions.map((position, index) => ({
      ...position,
      index,
      deltaY: position.y - current.y,
    })).filter(({ index, deltaY }) => (
      index !== currentIndex && (direction === "down" ? deltaY > 0 : deltaY < 0)
    ));

    if (candidates.length) {
      return candidates.sort((left, right) => {
        const leftDistance = ((left.x - current.x) ** 2) + (left.deltaY ** 2);
        const rightDistance = ((right.x - current.x) ** 2) + (right.deltaY ** 2);
        return leftDistance - rightDistance;
      })[0].index;
    }

    return currentIndex;
  }

  function shouldHandleGalleryNavigation(event) {
    return Boolean(
      event
      && !event.defaultPrevented
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && galleryNavigationDirection(event.key),
    );
  }

  function shouldHandleGalleryOpen(event) {
    return Boolean(
      event
      && !event.defaultPrevented
      && !event.repeat
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && (event.key === "Enter" || event.key === " "),
    );
  }

  function shouldHandleNavigation(event) {
    return Boolean(
      event
      && !event.defaultPrevented
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && navigationDirection(event.key),
    );
  }

  function shouldHandleSidebarShortcut(event) {
    return Boolean(
      event
      && !event.defaultPrevented
      && !event.repeat
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && event.key === "Tab",
    );
  }

  function navigationSidebarItemIndex(event) {
    if (
      !event
      || event.defaultPrevented
      || event.repeat
      || event.isComposing
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
    ) {
      return null;
    }

    const key = event.key;
    if (/^[1-9]$/.test(key)) {
      return Number(key) - 1;
    }
    if (key === "0") {
      return 9;
    }
    if (key === "-") {
      return 10;
    }
    if (key === "=") {
      return 11;
    }
    return null;
  }

  function shouldHandleRandomPhotoShortcut(event) {
    return Boolean(
      event
      && !event.defaultPrevented
      && !event.repeat
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && typeof event.key === "string"
      && event.key.toLowerCase() === "r",
    );
  }

  function viewerOptionShortcut(event) {
    if (
      !event
      || event.defaultPrevented
      || event.repeat
      || event.isComposing
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || typeof event.key !== "string"
    ) {
      return null;
    }

    const key = event.key.toLowerCase();
    return ["f", "q", "e", "p", "x", "c"].includes(key) ? key : null;
  }

  function viewerDetailShortcut(event) {
    if (
      !event
      || event.defaultPrevented
      || event.repeat
      || event.isComposing
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || !/^[0-9]$/.test(event.key)
    ) {
      return null;
    }

    return {
      "1": "title",
      "2": "caption",
      "3": "taken",
      "4": "camera",
      "5": "subject",
      "6": "copyright",
      "7": "artist",
      "8": "license",
      "9": "keywords",
      "0": "notes",
    }[event.key];
  }

  function viewerCollectionShortcut(event) {
    if (
      !event
      || event.defaultPrevented
      || event.repeat
      || event.isComposing
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || typeof event.key !== "string"
    ) {
      return null;
    }

    const key = event.key.toLowerCase();
    return key === "g" ? "albums" : key === "v" ? "labels" : null;
  }

  function viewerPeopleShortcut(event) {
    if (
      !event
      || event.defaultPrevented
      || event.repeat
      || event.isComposing
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || typeof event.key !== "string"
    ) {
      return null;
    }

    const key = event.key.toLowerCase();
    if (key === "t") {
      return { type: "toggle" };
    }
    if (/^[0-9]$/.test(key)) {
      return { type: "face", index: (Number(key) + 9) % 10 };
    }
    return null;
  }

  function viewerMarkerShortcut(event) {
    if (
      !event
      || event.defaultPrevented
      || event.repeat
      || event.isComposing
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
    ) {
      return null;
    }

    if (event.key === "Enter") {
      return "confirm";
    }
    return event.key === "Delete" ? "remove" : null;
  }

  const viewerOptionLabels = {
    f: /\b(full\s?screen)\b/i,
    q: /\b(like|unlike|fav|favorites?|favourites?|favorite|favourite)\b/i,
    e: /\bedit\b/i,
    p: /\bedit\s+(people|person)\b|\b(people|person)\s+edit\b/i,
    x: /\bslide\s?show\b/i,
    c: /\bselect\b/i,
  };

  function viewerOptionLabelMatches(key, label) {
    const matcher = viewerOptionLabels[key];
    if (!matcher) {
      return false;
    }

    const normalizedLabel = String(label || "");
    return matcher.test(normalizedLabel)
      && !(key === "e" && viewerOptionLabels.p.test(normalizedLabel));
  }

  function isPhotoGalleryPath(pathname) {
    return typeof pathname === "string"
      && (pathname === "/search" || pathname === "/library" || pathname.startsWith("/library/"));
  }

  function randomGalleryIndex(itemCount, currentIndex, randomValue = Math.random()) {
    if (
      !Number.isInteger(itemCount)
      || itemCount < 1
      || !Number.isInteger(currentIndex)
      || currentIndex < 0
      || currentIndex >= itemCount
      || !Number.isFinite(randomValue)
      || randomValue < 0
      || randomValue >= 1
    ) {
      throw new RangeError("Gallery size, current index, or random value is invalid.");
    }

    const choices = itemCount > 1 ? itemCount - 1 : 1;
    const offset = Math.floor(randomValue * choices);
    return itemCount > 1 && offset >= currentIndex ? offset + 1 : offset;
  }

  function volumeAdjustment(key) {
    if (typeof key !== "string") {
      return 0;
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "w" || normalizedKey === "arrowup") {
      return 0.05;
    }
    if (normalizedKey === "s" || normalizedKey === "arrowdown") {
      return -0.05;
    }
    return 0;
  }

  function shouldHandleVolumeShortcut(event) {
    return Boolean(
      event
      && !event.defaultPrevented
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey
      && volumeAdjustment(event.key),
    );
  }

  function adjustVolume(currentVolume, adjustment) {
    if (!Number.isFinite(currentVolume) || !Number.isFinite(adjustment)) {
      throw new TypeError("Volume and adjustment must be finite numbers.");
    }

    return Math.round(Math.max(0, Math.min(1, currentVolume + adjustment)) * 100) / 100;
  }

  function isValidVolume(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  function isEditableTarget(target) {
    if (!target || target.isContentEditable) {
      return true;
    }

    return typeof target.closest === "function"
      && Boolean(target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
      ));
  }

  function navigationDirectionFromLabel(label) {
    const normalizedLabel = String(label || "").toLowerCase();
    if (/\b(previous|prev|back)\b/.test(normalizedLabel)) {
      return "previous";
    }
    if (/\b(next|forward)\b/.test(normalizedLabel)) {
      return "next";
    }
    return null;
  }

  function isMuteControl(label, iconTokens) {
    return /\b(mute|unmute|volume)\b/i.test(String(label || ""))
      || /\b(volume[_ -]?(up|off|high|low|mute|down)|mdi-volume|fa-volume)\b/i
        .test(String(iconTokens || ""));
  }

  function setMediaVolume(mediaElements, volume) {
    if (!Number.isFinite(volume)) {
      throw new TypeError("Volume must be a finite number.");
    }

    const normalizedVolume = Math.max(0, Math.min(1, volume));
    for (const media of mediaElements) {
      media.volume = normalizedVolume;
    }
  }

  function setMediaMuted(mediaElements, muted) {
    for (const media of mediaElements) {
      media.muted = Boolean(muted);
    }
  }

  const utilities = {
    parseServerUrl,
    navigationDirection,
    galleryNavigationDirection,
    spatialNavigationIndex,
    shouldHandleGalleryNavigation,
    shouldHandleGalleryOpen,
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
    randomGalleryIndex,
    volumeAdjustment,
    shouldHandleVolumeShortcut,
    adjustVolume,
    isValidVolume,
    isEditableTarget,
    navigationDirectionFromLabel,
    isMuteControl,
    setMediaVolume,
    setMediaMuted,
  };

  root.PhotoPrismExtensionUtils = utilities;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = utilities;
  }
})(globalThis);
