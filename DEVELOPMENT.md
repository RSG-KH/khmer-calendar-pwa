# Development and deployment

This TypeScript/Vite project is the web port of [Khmer Calendar for Android](https://github.com/RSG-KH/khmer-calendar). See the [README](README.md) for installation, and the [Android documentation](https://github.com/RSG-KH/khmer-calendar/tree/main/docs) for calendar rules, event data, source research and shared behavior.

## Local development

Use Node.js 24, matching the deployment workflow.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173/). The development server stays on port 5173 and stops if it is occupied. It also listens on the local network for device testing.

Open `/tests/device-preview.html` on that server to check phone/tablet layouts and simulate keyboard space. This is a layout aid, not a real keyboard or device emulator.

## Build and test

```sh
npm test          # Build and run regression tests
npm run preview   # Serve the production build locally
```

For a build without tests, run `npm run build`. Output is in `dist/`. The production preview serves that build on a separate port (normally 4173); use the address printed in the terminal. Source edits require a new build.

The tests cover calendar continuity and boundaries, time zones, saved events, input escaping, modal viewport behavior, month swipes, platform controls and offline caching.

The four-part version shown in Settings comes from `appVersion` in `package.json`. Update it for each release; if its first three parts change, also update npm's three-part `version` and the lockfile with `npm version X.Y.Z --no-git-tag-version`. The service worker cache hash is generated automatically for every build.

## GitHub Pages

The included [workflow](.github/workflows/deploy-pages.yml) builds, tests and publishes the site:

1. In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
2. Commit and push the source changes to `main`. Later pushes deploy automatically; **Actions → Deploy to GitHub Pages → Run workflow** can also deploy `main`.
3. Open [Khmer Calendar](https://rsg-kh.github.io/khmer-calendar-pwa/) after the deployment succeeds.

The workflow uses Node.js 24 and tests both the site root and GitHub's Pages base path. Assets, installation and offline caching support the repository URL or a configured custom domain. Keep `dist/` and `node_modules/` out of Git. See the [GitHub Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To check the repository path locally in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/khmer-calendar-pwa/'
npm test
npm run preview
```

Open `/khmer-calendar-pwa/` at the preview address printed in the terminal. After stopping the preview with **Ctrl+C**, remove the override:

```powershell
Remove-Item Env:VITE_BASE_PATH
```

Rebuild without the override before previewing the site root again.

## Other HTTPS hosts

Hosts such as [Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/) can use `npm run build` and output directory `dist`. Without `VITE_BASE_PATH`, the app builds for the site root.

If hosting at another address, update `installUrl` in [Settings.ts](src/ui/Settings.ts) so the in-app installation link opens your deployment.

## PWA behavior

- Calendar data, fonts, artwork and licenses are bundled for offline use after the first full online load in that browser or installed app. The service worker runs only in production; the development server and a plain HTTP LAN address do not provide offline installation on iPad.
- Events and settings stay in local storage for that site and browser/app profile. There is no account or sync; changing the site address does not migrate data, and clearing site data removes it.
- Deploy the complete build together. **Settings → Check for update** checks the deployed worker with HTTP caching disabled, downloads all assets, then activates and reloads in one click. Settings shows **Updated** or **No update available** for three seconds before restoring the button. A short-lived session receipt restores Settings after the reload; saved events and settings are never cleared. Background updates wait for old windows to close; first installation and updates in other windows never force this window to reload.
- Time entry uses native pickers on iOS/iPadOS, and themed 24-hour hour/minute menus on Android and desktop browsers. The menus support touch and keyboard navigation and follow the app theme.
- Month navigation supports swipes, mouse dragging and arrow buttons while preserving vertical scrolling and date taps.
- Production builds include a Content Security Policy allowing local scripts/assets and the UI's inline styles. GitHub Actions are pinned to verified commits.
- Scheduled reminders are not available in PWA mode. The unused [push prototype](worker/push-scheduler.js) is not part of the Pages deployment and does not send reminders.

After deployment, check installed launch, offline reopening and event persistence on physical target devices. Use the [README's Apple installation steps](README.md#install-on-iphone-or-ipad) for Home Screen and Dock testing.
