# Enabling Microphone Access for Speech Recognition

This guide explains how to enable microphone access for speech recognition in various browsers and mobile devices.
Ensuring microphone access is essential for using voice features in applications like big-AGI.

## Desktop Browsers

### Google Chrome (All Platforms, recommended)

1. Open the website (e.g., big-AGI) in Chrome.
2. Click the **lock icon** in the address bar.
3. In the dropdown, find **"Microphone"**.
   - Set it to **"Allow"**.
4. If "Microphone" isn't listed:
   - Click on **"Site settings"**.
   - Find **"Microphone"** in the permissions list.
   - Change the setting to **"Allow"**.
5. **Refresh** the page.

### Safari (macOS)

**[Watch the video tutorial: How to enable Speech Recognition in Safari](https://vimeo.com/1010342201)**

If you're seeing a "Speech Recognition permission denied" error, follow these steps:

1. Open **System Settings**.
   - Go to **Privacy & Security** > **Speech Recognition**.
   - Enable Safari in the list of allowed applications.
   - Quit & Open Safari.
2. Click **Safari** in the top menu bar.
   - Select **Settings**.
   - Go to the **Websites** tab.
   - Select **Microphone** from the sidebar.
   - Find big-AGI (or localhost for developers) in the list and set it to **Allow**.
   - Close the Settings window.
3. **Refresh** the page.

This quick and simple fix should get essential voice input working in big-AGI on your Mac.

### Microsoft Edge (Windows)

1. Open the website in Edge.
2. Click the **lock icon** in the address bar.
3. Click **"Permissions for this site"**.
4. Find **"Microphone"**.
   - Set it to **"Allow"**.
5. **Refresh** the page.

### Firefox (All Platforms)

> **Note:** The Speech Recognition API is **not supported** in Firefox. If you're using Firefox, please switch to a supported browser to use speech recognition
> features.

## Mobile Devices

### Android (Chrome)

1. Open the website in Chrome.
2. Tap the **lock icon** in the address bar.
3. Tap **"Permissions"**.
4. Find **"Microphone"**.
   - Set it to **"Allow"**.
5. **Refresh** the page.

### iOS (Safari)

1. Open the **Settings** app on your device.
2. Scroll down and tap **"Safari"**.
3. Tap **"Microphone"**.
4. Ensure **"Ask"** or **"Allow"** is selected.
5. Return to Safari and open the website.
6. If prompted, allow microphone access.
7. **Refresh** the page.

### iOS (Chrome)

> **Note:** Chrome on iOS uses Safari's engine due to system limitations. Microphone permissions are managed through iOS settings.

1. Open the **Settings** app.
2. Scroll down and tap **"Chrome"**.
3. Ensure **"Microphone"** is toggled **on**.
4. Open Chrome and navigate to the website.
5. If prompted, allow microphone access.
6. **Refresh** the page.

## Troubleshooting

If you're still experiencing issues after enabling microphone access:

**Check System Permissions (macOS):**

- Open **System Settings**.
- Go to **"Privacy & Security"**.
- Select the **"Privacy"** tab.
- Click **"Microphone"** in the sidebar.
- Ensure your browser (e.g., Chrome, Safari) is checked.
- You may need to unlock the settings by clicking the lock icon at the bottom.

**Check Microphone Access (Windows):**

- Open **Settings**.
- Go to **"Privacy"** > **"Microphone"**.
- Ensure **"Allow apps to access your microphone"** is **on**.
- Scroll down and make sure your browser is allowed.

**Close Other Applications:**

- Close any applications that might be using the microphone.

**Restart the Browser:**

- Close all browser windows and reopen.

**Update Your Browser:**

- Ensure you're using the latest version.

**Check for Browser Extensions:**

- Disable extensions that might block access to the microphone.

For persistent issues, consult your browser's official support resources or contact big-AGI support.

## Technical Details

Big-AGI uses the [Web Speech API (SpeechRecognition)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
to transcribe spoken words into text. This API provides real-time transcription with live previews and works on most
modern mobile and desktop browsers.

**Note on Browser Support:**

| Browser        | Support Level   | Notes                                                                  |
|----------------|-----------------|------------------------------------------------------------------------|
| Google Chrome  | ✅ Recommended   | Fully supported on desktop and Android. Preferred for best experience. |
| Safari         | ✅ Supported     | Requires macOS/iOS 14 or later.                                        |
| Microsoft Edge | ✅ Supported     | Fully supported on desktop.                                            |
| Firefox        | ❌ Not Supported | SpeechRecognition API not available.                                   |

**Recommendation:**
For the best experience with speech recognition features, we strongly recommend using Google Chrome. 
Ensure your browser is up to date to benefit from the latest features and security updates.
