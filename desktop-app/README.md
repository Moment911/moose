# KotoIQ Desktop (Tauri)

Native desktop app for KotoIQ — wraps the web app at `hellokoto.com/kotoiq` in a native shell with system tray, keyboard shortcuts, and native notifications.

## Why Tauri?
- **~5-10 MB** final bundle (vs 100+ MB Electron)
- Native system webview (fast, low RAM)
- Native menu bar, system tray, notifications
- Multi-window support, keyboard shortcuts
- Works on macOS (Intel + Apple Silicon), Windows, and Linux

## Prerequisites
- **Node.js 20+**
- **Rust** — install via [rustup](https://rustup.rs/):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Platform-specific deps:**
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Windows:** Microsoft C++ Build Tools + WebView2
  - **Linux:** `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

## Install
```bash
cd desktop-app
npm install
```

## Development
Run in dev mode (hot reloads when you touch Rust code):
```bash
npm run dev
```
This opens a native window pointing at the dev URL in `tauri.conf.json` (default: `https://hellokoto.com/kotoiq`). To point it at localhost for local testing, edit `devUrl` in `tauri.conf.json` to `http://localhost:3000/kotoiq`.

## Build Production App

**All platforms (from their respective OS):**
```bash
npm run build
```
Output: `src-tauri/target/release/bundle/`

**Platform-specific:**
```bash
npm run build:mac-arm      # macOS Apple Silicon (.dmg, .app)
npm run build:mac-intel    # macOS Intel (.dmg, .app)
npm run build:mac          # Universal binary (both archs)
npm run build:win          # Windows (.msi, .exe installer)
npm run build:linux        # Linux (.deb, .AppImage)
```

## Features

### Native Menu Bar
- **File** → New Window (⌘N), Close
- **Edit** → Standard Undo/Redo/Cut/Copy/Paste
- **View** → Jump to tabs (⌘1-⌘4), Fullscreen
- **Window** → Minimize, Maximize
- **Help** → Documentation, Support

### Keyboard Shortcuts
- `⌘1` Dashboard
- `⌘2` Keywords
- `⌘3` PageIQ Writer
- `⌘4` Rankings
- `⌘/` Ask KotoIQ (AI chat)
- `⌘N` New Window
- `⌘Q` Quit

### System Tray
Right-click the KotoIQ icon in menu bar / system tray to:
- Jump straight to Dashboard / Keywords / PageIQ / Rankings
- Open Ask KotoIQ chat
- Show/Hide main window
- Quit

### Single Instance
Launching KotoIQ twice just brings the existing window to focus. No duplicate windows.

### Native Notifications
Supports macOS Notification Center / Windows Action Center via `tauri-plugin-notification`. (Wire-up from web app uses `window.__TAURI__` detection — see docs.)

## Code Signing (for distribution)

### macOS
1. Get an Apple Developer ID ($99/year)
2. Add signing identity to `tauri.conf.json` under `bundle.macOS.signingIdentity`
3. Notarize with Apple — see [Tauri macOS signing guide](https://tauri.app/distribute/sign/macos/)

### Windows
1. Get a code-signing certificate (Sectigo, DigiCert, etc. — $100-400/year)
2. Set `bundle.windows.certificateThumbprint` in `tauri.conf.json`
3. Optional: EV cert for instant SmartScreen trust

### Linux
- `.deb` is plain — no signing needed for Debian/Ubuntu
- `.AppImage` can optionally be GPG-signed for integrity

## Auto-Updates
The updater plugin is pre-configured but disabled. To enable:
1. Generate a keypair: `npx tauri signer generate -w ~/.tauri/kotoiq.key`
2. Put public key in `tauri.conf.json` under `plugins.updater.pubkey`
3. Build with `TAURI_SIGNING_PRIVATE_KEY` env var set
4. Host update manifest at `hellokoto.com/api/desktop/update/...` (stub endpoint already in the URL)

## File Structure
```
desktop-app/
├── package.json              # Tauri CLI + API deps
├── src/
│   └── index.html            # Fallback loader (redirects to web app)
└── src-tauri/
    ├── Cargo.toml            # Rust deps
    ├── build.rs              # Tauri build hook
    ├── tauri.conf.json       # App config (title, URL, bundle settings)
    ├── capabilities/
    │   └── default.json      # Security permissions for the main window
    ├── src/
    │   ├── main.rs           # Entry point
    │   └── lib.rs            # Tray, menu, commands
    └── icons/                # Generated from /public/koto_icon.svg
        ├── 32x32.png
        ├── 128x128.png
        ├── 128x128@2x.png
        └── tray-icon.png
```

## Notes
- The app loads `hellokoto.com/kotoiq` directly — all auth, data, and features come from the existing web app
- No code duplication — the desktop app is purely a native shell
- `UserAgent` is set to `KotoIQ-Desktop/1.0 (Tauri)` so backend analytics can distinguish desktop users
- macOS uses `Overlay` title bar style for a modern chrome-less look; toggle `hiddenTitle: false` in `tauri.conf.json` if you want a traditional title bar
