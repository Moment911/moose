# GitHub Actions Workflows

## Desktop Build (`desktop-build.yml`)

Cross-platform build pipeline for the Koto Tauri desktop app at `/desktop-app`. Produces signed installers for macOS (Intel, ARM, Universal), Windows, and Linux, then attaches them to a GitHub Release.

### Trigger a Build

Tag a version and push it:

```bash
git tag v1.0.0-desktop
git push origin v1.0.0-desktop
```

The workflow fires on any tag matching `v*.*.*-desktop`. It can also be triggered manually from the Actions tab (workflow_dispatch).

### Build Matrix

| OS Runner      | Target                     | Output                                |
| -------------- | -------------------------- | ------------------------------------- |
| macos-latest   | aarch64-apple-darwin       | Apple Silicon `.dmg` + `.app.tar.gz`  |
| macos-13       | x86_64-apple-darwin        | Intel `.dmg` + `.app.tar.gz`          |
| macos-latest   | universal-apple-darwin     | Universal `.dmg` + `.app.tar.gz`      |
| windows-latest | x86_64-pc-windows-msvc     | `.msi` + `.exe` installers            |
| ubuntu-22.04   | x86_64-unknown-linux-gnu   | `.deb` + `.AppImage`                  |

Every artifact is uploaded to a draft GitHub Release named `Koto Desktop v<version>`. After all matrix jobs finish, the final `publish-release` job flips the release out of draft state.

### Tauri Auto-Updater

The workflow passes `includeUpdaterJson: true` to `tauri-action`, which generates a `latest.json` alongside the binaries. Configure the updater endpoint in `desktop-app/src-tauri/tauri.conf.json` to point to the release asset URL.

---

## Required Repo Secrets

Configure these under **Settings → Secrets and variables → Actions**. Everything is optional — unsigned local builds will still succeed — but production distribution requires signing.

### Tauri Auto-Updater Signing (recommended)

These keys sign the `latest.json` update manifest so installed apps can verify updates.

| Secret                                  | How to generate                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`             | Run `npx tauri signer generate -w ~/.tauri/koto.key`, then paste the **private** key contents.           |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`    | Password used when generating the key.                                                                   |

Commit the matching **public** key to `desktop-app/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

### macOS Code Signing + Notarization

Required to run the app on modern macOS without Gatekeeper warnings.

| Secret                          | How to generate                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`             | Export the **Developer ID Application** certificate from Keychain as a `.p12`, then base64-encode it: `base64 -i cert.p12 \| pbcopy`.                               |
| `APPLE_CERTIFICATE_PASSWORD`    | Password used to protect the `.p12` on export.                                                                                                                      |
| `APPLE_SIGNING_IDENTITY`        | The full identity string, e.g. `"Developer ID Application: Your Name (TEAMID)"`. List with `security find-identity -v -p codesigning`.                              |
| `APPLE_ID`                      | Your Apple ID email (used by notarization).                                                                                                                         |
| `APPLE_PASSWORD`                | An **app-specific password** from appleid.apple.com (not your normal Apple password).                                                                               |
| `APPLE_TEAM_ID`                 | 10-character Team ID from your Apple Developer membership page.                                                                                                     |

### Windows Code Signing

Optional but strongly recommended — unsigned Windows binaries trigger SmartScreen warnings.

| Secret                             | How to generate                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `WINDOWS_CERTIFICATE_THUMBPRINT`   | The thumbprint of an EV or standard Authenticode code signing certificate installed on the Windows runner / HSM service. |

For EV certificates hosted in HSM services (SSL.com, DigiCert, etc.), additional env vars for the signing tool may be needed — check the tauri-action docs for the exact variable names.

### `GITHUB_TOKEN`

Automatically provided by GitHub Actions — no setup needed. Used to create and upload to the release.

---

## Local Verification Before Tagging

Smoke test the Tauri build locally before pushing a tag:

```bash
cd desktop-app
npm install
npm run tauri build
```

If that produces a bundle without errors, the CI build will almost certainly succeed too.

---

## Troubleshooting

- **Release stays in draft:** The final `publish-release` job only runs if every matrix build succeeds. Check failed jobs and re-run the workflow after the tag is already published via `gh run rerun <run-id>`.
- **macOS notarization timeout:** Notarization can take 15–30 minutes on Apple's side. `tauri-action` retries automatically; if it still fails, verify `APPLE_ID`, `APPLE_PASSWORD` (app-specific), and `APPLE_TEAM_ID` are correct.
- **Linux `libwebkit2gtk` mismatch:** If you change Ubuntu runner versions, update the `libwebkit2gtk-4.1-dev` package name — some older distros still ship 4.0.
- **Updater signature mismatch:** After rotating `TAURI_SIGNING_PRIVATE_KEY`, also update the public key in `tauri.conf.json`, otherwise existing installs will reject updates.
