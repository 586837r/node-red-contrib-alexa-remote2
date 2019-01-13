## Chrome

1. Go to `alexa.amazon.com`.
2. Open Developer Tools by pressing `F12`, `Ctrl+Shift+I` or `Cmd+Opt+I` (or from the menu).
3. In the Developer Tools switch to the **Network** tab.
4. Select a radio station to play.
5. Now you should see a request with the **Name** `queue-and-play` in the Developer Tools. Click on it.
6. Now in the newly appeared panel go to **Headers** > **Request Headers** and there you will find **Cookie**.
   - If you see "⚠️ Provisional headers are shown" disable all extensions / use incognito mode
7. Copy this whole cookie.
8. Paste it into the alexa remote account nodes cookie field.

## Firefox

1. Go to `alexa.amazon.com`.
2. Open Web Developer Tools by pressing `F12`, `Ctrl+Shift+I` or `Cmd+Opt+I` (or from the menu).
3. In the Web Developer Tools switch to the **Network** tab.
4. Select a radio station to play.
5. Now you should see a request with the **File** `queue-and-play` in the Web Developer Tools. Click on it.
6. Now in the newly appeared panel go to **Headers** > **Request Headers** and there you will find **Cookie**.
7. Copy this whole cookie by clicking into the field after *Cookie:*, Select All(right click or ctrl+A) and then Copy.
8. Paste it into the alexa remote account nodes cookie field.
