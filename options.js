const PENDING_SERVER_KEY = "pendingServerUrl";

const serverForm = document.querySelector("#server-form");
const serverInput = document.querySelector("#server-url");
const saveButton = document.querySelector("#save-button");
const clearButton = document.querySelector("#clear-button");
const configuredServer = document.querySelector("#configured-server");
const serverStatus = document.querySelector("#server-status");
const statusMessage = document.querySelector("#status");

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.dataset.error = String(isError);
}

function setBusy(isBusy) {
  saveButton.disabled = isBusy;
  clearButton.disabled = isBusy;
}

async function refreshConfiguredServer() {
  const settings = await chrome.storage.local.get([
    "serverOrigin",
    "permissionPattern",
  ]);

  if (!settings.serverOrigin || !settings.permissionPattern) {
    configuredServer.hidden = true;
    return;
  }

  configuredServer.hidden = false;
  serverStatus.textContent = settings.serverOrigin;
  serverInput.value = settings.serverOrigin;

  const granted = await chrome.permissions.contains({
    origins: [settings.permissionPattern],
  });
  showStatus(
    granted
      ? "Server access is active. Reload an open PhotoPrism tab to apply the extension."
      : "Site access is missing. Save the server again to grant access.",
  );
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
        showStatus("Site access was not granted. The extension has not been configured.", true);
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
    if (response.warning) {
      showStatus(response.warning, true);
    }
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "The server could not be configured.", true);
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
  showStatus("");

  let serverOrigin;
  try {
    serverOrigin = PhotoPrismExtensionUtils.parseServerUrl(serverInput.value.trim()).serverOrigin;
  } catch (error) {
    showStatus(error.message, true);
    return;
  }

  await saveServer(serverOrigin, true);
});

clearButton.addEventListener("click", async () => {
  setBusy(true);
  showStatus("");

  try {
    const response = await chrome.runtime.sendMessage({ type: "clear-server" });
    if (!response?.ok) {
      throw new Error(response?.error || "The server could not be removed.");
    }

    await chrome.storage.local.remove(PENDING_SERVER_KEY);
    serverInput.value = "";
    configuredServer.hidden = true;
    showStatus(response.warning || "The server configuration was removed.");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "The server could not be removed.", true);
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
  showStatus(error instanceof Error ? error.message : "Could not load the saved server.", true);
});
