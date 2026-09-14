# Development and deployment

This TypeScript/Vite project is the web port of [Khmer Calendar for Android](https://github.com/RSG-KH/khmer-calendar). See the [README](README.md) for installation, and the [Android documentation](https://github.com/RSG-KH/khmer-calendar/tree/main/docs) for calendar rules, event data, source research and shared behavior.

The app increments the Buddhist Era year on 1 Roach of Pisakh (១រោច ខែពិសាខ), as implemented in [KhmerCalendar.ts](src/domain/KhmerCalendar.ts).

## Local development

Use Node.js 24, matching the deployment workflow.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173/). The development server stays on port 5173 and stops if it is occupied. It also listens on the local network for device testing.

Open `/tests/device-preview.html` on that server to check phone/tablet layouts and simulate keyboard space. This is a layout aid, not a real keyboard or device emulator.

Use `/tests/safe-area-preview.html` to check cutout and Home indicator spacing in portrait and landscape. **Run all checks** includes desktop/tablet baselines, large text, navigation clearance, installed apps with short dynamic viewport units, and browser tabs with expanded toolbars. It also checks that landscape calendar scrollers reach the top safe edge. Confirm the result in installed apps on physical devices; this page simulates CSS metrics and display mode, not OS-owned status/gesture bars or WebKit rendering.

## UI code and styles

The PWA shares one visual design across platforms. `main.ts` imports [src/styles/index.css](src/styles/index.css), which defines the stylesheet order:

- [theme.css](src/styles/theme.css): base colors, sizing tokens and resets.
- [components.css](src/styles/components.css): base component structure.
- [responsive.css](src/styles/responsive.css): layout changes for viewport size and orientation.
- [appearance.css](src/styles/appearance.css): shared fonts, surface colors, controls and visual refinements on every platform.
- [scrollbars.css](src/styles/scrollbars.css): custom scrollbar appearance, centering and column spacing, scoped to `[data-auto-hide-scrollbars]`.

[Platform.ts](src/ui/Platform.ts) owns device-specific choices for native time pickers, native scrollbars and phone font-size limits. [Scrollbars.ts](src/ui/Scrollbars.ts) enables the scrollbar attribute and manages the idle fade on selected desktop platforms; Android and Apple devices keep native scrollbars. Keep platform exceptions explicit instead of naming shared controls after an OS.

The app root stays in normal flow. Browser tabs use `100dvh` (with a `100%` fallback) to follow browser toolbars; installed apps use `100vh` on `html`, `body` and `#app`. With the `black-translucent` status bar, WebKit can undercount `dvh` by the status bar height while still starting the page behind that bar. Fixed bottom anchoring also left a blank strip on installed iPads. Do not add a hardcoded screen height or add safe-area insets to the viewport height.

Safe-area insets protect content and navigation controls; navigation backgrounds extend to the available screen edges. The bottom bar sizes itself from the controls, with a 60 px minimum, and uses the Home indicator inset as bottom padding instead of adding it to a fixed-height row. Keep these insets out of font scaling and leave OS-reserved screen regions to the browser. Landscape calendar top padding belongs inside the two scrolling columns so it scrolls away with their content, instead of creating a fixed empty gutter.

`Platform.ts` selects installation icons through the manifest: Android keeps the original `manifest.webmanifest` / `manifest.km.webmanifest` URLs and transparent artwork; Apple uses `manifest.white.webmanifest` / `manifest.white.km.webmanifest`; Windows and Linux use `manifest.desktop.webmanifest` / `manifest.desktop.km.webmanifest`. Other platforms keep the white fallback. All six manifests share the same app ID, scope and start URL.

`InstallMetadata.ts` inserts the selected manifest URL before exposing the link to the browser, and only adds the white Apple touch icon on Apple devices. Do not put a platform-specific fallback manifest or Apple touch icon in `index.html`: desktop installers must never discover Apple's icon before platform selection finishes. Language changes update the existing manifest link.

The white variants in `public/icons/` are `apple-touch-icon-white.png` (180 px) for Apple's touch icon and `app-icon-white-192.png` / `app-icon-white-512.png` for the white manifests. Center the visible artwork at 88% of the tile height, preserving its proportions and opaque white padding. Keep the original transparent artwork for Android, the README and favicon.

Windows/Linux use `app-icon-desktop-512.png`, an unchanged copy of the supplied `khmer_calendar_app_transparent_ios_pwa_512.png`, with its transparent background preserved.

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

After deployment, check installed launch, offline reopening, **Check for update**, and event persistence on physical target devices. Follow the README's installation steps for [iPhone/iPad](README.md#install-on-iphone-or-ipad), [Mac](README.md#install-on-mac), [Android](README.md#install-on-android), [Windows](README.md#install-on-windows) and [Linux](README.md#install-on-linux).
