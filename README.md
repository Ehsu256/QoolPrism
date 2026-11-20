# QoolPrism

UI enhancements for PhotoPrism.

## AI usage

Most of the code was generated using AI. Free versions of Github Copilot and Claude (Sonnet 5.5) were used.

## Features

- Keybinds for image viewer navigation and side panels.
- Thumbnails for suggestions when assigning a person to a face marker.
- Additional input box below face markers.
- Image search [Yandex](https://yandex.com/images/) and [Multi-service image search](https://iqdb.org/). Available as a context menu item when right-clicking a picture in the image viewer.
- Right click a picture in the gallery view to open the actions menu.
- Autoplay for all media.
- Volume controls.
- Open a random image using the R key.

## Install

1. Open chrome://extensions in Chrome or another Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Click the extension's toolbar icon to open its settings popup.
5. Enter the origin of your PhotoPrism server (for example, "http://123.345.78.9:2342") and save it.
6. Approve the requested site access, then reload any already-open PhotoPrism tab.

The extension accepts HTTP or HTTPS origins only, without a path, query, or fragment. Site access is optional and requested only when you save a server. The browser permission is scoped to the selected scheme and hostname; extension behavior additionally checks the exact configured origin, including its port.

Use **Remove server** in the options page to unregister the content script and remove the saved site permission.
