# Privacy Destroying Extension - Quick Start

## 1. Start the Server
```bash
cd server
npm install
node server.js
```

## 2. Load the Extension
- Open Chrome and go to: `chrome://extensions`
- Enable "Developer mode" (top right)
- Click "Load unpacked" and select the `PrivacyDestroyingExtension` folder

## 3. View Dashboard
- Open browser and go to: `http://localhost:3000`

The extension will harvest URLs, OS info, keystrokes, and auth cookies.

Should look like this:

