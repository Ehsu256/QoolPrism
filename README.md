# QoolPrism

UI additions for PhotoPrism.

## AI usage

Most of the code was generated with AI. Github Copilot and Claude (Sonnet 5.5) were used in their free versions.

## Features

- New keybinds for UI navigation and interaction.
- Extra buttons for the image viewer: Autoplay, open random image and image search.
- Thumbnails for face marker suggestions.
- Additional input box below face markers.
- Image search using [Yandex](https://yandex.com/images/) and [Multi-service image search](https://iqdb.org/).
- Right click a picture in the gallery view to open the actions menu.

## Install

1. Open chrome://extensions in Chrome or another Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Click the extension's toolbar icon to open its settings popup.
5. Enter the origin of your PhotoPrism server (for example, http://123.345.78.9:2342) and save it.
6. Approve the requested site access, then reload any already-open PhotoPrism tab.

The extension accepts HTTP or HTTPS origins only, without a path, query, or fragment. Site access is optional and requested only when you save a server. The browser permission is scoped to the selected scheme and hostname; extension behavior additionally checks the exact configured origin, including its port.

Use **Remove server** in the options page to unregister the content script and remove the saved site permission.
