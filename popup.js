const PENDING_SERVER_KEY = "pendingServerUrl";
const KEY_BADGES_ENABLED_KEY = "keyBadgesEnabled";

const serverForm = document.querySelector("#server-form");
const serverInput = document.querySelector("#server-url");
const saveButton = document.querySelector("#save-button");
const clearButton = document.querySelector("#clear-button");
const serverBox = document.querySelector("#server-box");
const keyBadgesOption = document.querySelector("#key-badges-option");

function setBusy(isBusy) {
  saveButton.disabled = isBusy;
  clearButton.disabled = isBusy;
}

let serverCheckId = 0;

// Shows whether the PhotoPrism server answers on /api/v1/status.
async function updateServerStatus(serverOrigin) {
  const checkId = ++serverCheckId;

  if (!serverOrigin) {
    serverBox.textContent = "Provide the URL for your PhotoPrism server";
    return;
  }

  serverBox.textContent = "Checking PhotoPrism…";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let accessible = false;
  try {
    const response = await fetch(`${serverOrigin}/api/v1/status`, {
      cache: "no-store",
      signal: controller.signal,
    });
    accessible = response.status === 200;
  } catch {
    accessible = false;
  } finally {
    clearTimeout(timeout);
  }

  if (checkId === serverCheckId) {
    serverBox.textContent = accessible
      ? "🟢 PhotoPrism is currently accessible 🟢"
      : "🔴 Couldn't access PhotoPrism 🔴";
  }
}

async function refreshConfiguredServer() {
  const settings = await chrome.storage.local.get([
    "serverOrigin",
    "permissionPattern",
  ]);

  if (!settings.serverOrigin || !settings.permissionPattern) {
    updateServerStatus(null);
    return;
  }

  serverInput.value = settings.serverOrigin;

  updateServerStatus(settings.serverOrigin);
}

// Saves the server. The browser's permission prompt closes this popup, which would
// interrupt the rest of this function, so the entered URL is stored first and the
// saving is finished automatically the next time the popup opens (see resumePendingServer).
async function saveServer(serverOrigin, requestAccess) {
  const { permissionPattern } = PhotoPrismExtensionUtils.parseServerUrl(serverOrigin);

  setBusy(true);
  try {
    if (requestAccess) {
      await chrome.storage.local.set({ [PENDING_SERVER_KEY]: serverOrigin });

      const granted = await chrome.permissions.request({
        origins: [permissionPattern],
      });

      if (!granted) {
        return;
      }
    }

    const response = await chrome.runtime.sendMessage({
      type: "configure-server",
      serverUrl: serverOrigin,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "The server could not be configured.");
    }

    await chrome.storage.local.remove(PENDING_SERVER_KEY);
    serverInput.value = serverOrigin;
    await refreshConfiguredServer();
  } catch (error) {
    console.error("The server could not be configured.", error);
  } finally {
    setBusy(false);
  }
}

// Finishes a save that was interrupted by the permission prompt closing the popup.
// Returns true when the saving was completed.
async function resumePendingServer() {
  const settings = await chrome.storage.local.get(PENDING_SERVER_KEY);
  const pendingServer = settings[PENDING_SERVER_KEY];
  if (!pendingServer) {
    return false;
  }

  serverInput.value = pendingServer;

  let permissionPattern;
  try {
    ({ permissionPattern } = PhotoPrismExtensionUtils.parseServerUrl(pendingServer));
  } catch {
    await chrome.storage.local.remove(PENDING_SERVER_KEY);
    return false;
  }

  const granted = await chrome.permissions.contains({
    origins: [permissionPattern],
  });
  if (!granted) {
    return false;
  }

  await saveServer(pendingServer, false);
  return true;
}

serverForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  let serverOrigin;
  try {
    serverOrigin = PhotoPrismExtensionUtils.parseServerUrl(serverInput.value.trim()).serverOrigin;
  } catch (error) {
    console.error(error);
    return;
  }

  await saveServer(serverOrigin, true);
});

clearButton.addEventListener("click", async () => {
  setBusy(true);

  try {
    const response = await chrome.runtime.sendMessage({ type: "clear-server" });
    if (!response?.ok) {
      throw new Error(response?.error || "The server could not be removed.");
    }

    await chrome.storage.local.remove(PENDING_SERVER_KEY);
    serverInput.value = "";
    updateServerStatus(null);
  } catch (error) {
    console.error("The server could not be removed.", error);
  } finally {
    setBusy(false);
  }
});

(async () => {
  const resumed = await resumePendingServer();
  if (resumed) {
    return;
  }

  await refreshConfiguredServer();

  // Keep the URL that was entered before the permission prompt closed the popup.
  const settings = await chrome.storage.local.get(PENDING_SERVER_KEY);
  if (settings[PENDING_SERVER_KEY]) {
    serverInput.value = settings[PENDING_SERVER_KEY];
  }
})().catch((error) => {
  console.error("Could not load the saved server.", error);
});

keyBadgesOption.addEventListener("change", () => {
  chrome.storage.local.set({ [KEY_BADGES_ENABLED_KEY]: keyBadgesOption.checked }).catch((error) => {
    console.error("Could not save the keybind bubbles option.", error);
  });
});

chrome.storage.local.get(KEY_BADGES_ENABLED_KEY).then((settings) => {
  keyBadgesOption.checked = settings[KEY_BADGES_ENABLED_KEY] !== false;
}).catch((error) => {
  console.error("Could not load the keybind bubbles option.", error);
});
