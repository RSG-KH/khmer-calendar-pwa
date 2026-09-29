# Development and deployment

This TypeScript/Vite project is the web port of [Khmer Calendar for Android](https://github.com/RSG-KH/khmer-calendar). See the [README](README.md) for installation and features.

The [engine integration guide](docs/shared-engine.md) covers the pinned dependency, PWA adapters and the event catalog. Calendar algorithms, calculation sources and reference evidence are maintained in [Khmer Calendar Engine](https://github.com/RSG-KH/khmer-calendar-engine).

The [maintainer-certified calendar UI contract](docs/maintainer-certified-calendar-ui.md) records the PWA month-grid row heights, summary card, Western Big 3 and Ganzhi tables and their detail popups, and [intentional press-feedback differences](docs/maintainer-certified-calendar-ui.md#button-press-feedback). Preserve these PWA-specific choices during UI reviews and when reviewing later Android releases.

[KhmerCalendar.ts](src/domain/KhmerCalendar.ts) validates civil dates and adapts the engine result. Personal event repeats are implemented separately in [EventRepeat.ts](src/domain/EventRepeat.ts). The app's built-in observance definitions are passed to the engine through [RecurringEvents.ts](src/data/RecurringEvents.ts).

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
- [event-repeat.css](src/styles/event-repeat.css): repeat controls inside the existing event editor.
- [scrollbars.css](src/styles/scrollbars.css): custom scrollbar appearance, centering and column spacing, scoped to `[data-auto-hide-scrollbars]`.

[Platform.ts](src/ui/Platform.ts) owns device-specific choices for native time pickers, native scrollbars and per-device font-size defaults; the font-size picker itself offers the same 80-150% range on every device. [Scrollbars.ts](src/ui/Scrollbars.ts) enables the scrollbar attribute and manages the idle fade on selected desktop platforms; Android and Apple devices keep native scrollbars. Keep platform exceptions explicit instead of naming shared controls after an OS.

Press feedback is shared in `appearance.css`: native action buttons use a foreground-colored inset layer, event rows override its color with the selected accent, and only the bottom navigation tabs and side rail are excluded. Navigation selection indicators and keyboard focus remain. Whole-table astrology feedback is handled locally in `AstrologyDetails.ts` so dragging can clear the highlight and suppress activation. Follow the contract before treating any of these differences as bugs.

[CalendarWidth.ts](src/ui/CalendarWidth.ts) derives the month width cap from a fixed five-row reference using the certified PWA row heights and standard legend. Four-, five- and six-row months retain their actual heights at the same width. One viewport observer and font-completion listener update the cap before paint; they never observe the resized card or remove its cap to measure it. The calendar render cleanup disposes the hidden reference and listeners. In tablet/desktop landscape, CSS gives remaining space to monthly events up to twice the visible calendar width, accounting for scrollbar gutters and retaining outer padding. Phone landscape keeps equal columns.

[Modals.ts](src/ui/Modals.ts) calculates and renders the date-details astrology tables. The whole-table controls open [AstrologyDetails.ts](src/ui/AstrologyDetails.ts), which reuses those rendered tables and calculation results, adds Big 3 catalog details, and chooses the Sun-sign or Year-animal watermark. Pointer scrolling stays separate from activation; Enter and Space also open the popup. The parent owns and disposes its child modal, and closing the child restores focus without changing the parent's time or place. [AskAi.ts](src/ui/AskAi.ts) supplies the shared Ask AI button and browser launch for these popups and event Learn more. Astrology queries contain sign/pillar names and clash animals, excluding date, time, place and coordinates; event queries retain their catalog title and anniversary anchoring.

[EventTime.ts](src/ui/EventTime.ts) formats event times and list subtitles. When the device's local time zone differs from Cambodia time (UTC+7), event details display dual rows for local and Cambodia times (with localized non-calendar date suffixes if crossing midnight), and event list subtitles clarify the active calendar time zone.

In the two astrology child popups, `appearance.css` bounds the decorative mask by both the popup width and height, with a 12px edge inset and bottom-right `contain` alignment. It overrides the shared square aspect ratio so short popups show all the artwork. The decoration stays outside normal layout; no script measures or resizes it, and it cannot change the content/footer spacing. Keep this scoped rule when syncing dialog styles.

The app root stays in normal flow. Browser tabs use `100dvh` (with a `100%` fallback) to follow browser toolbars; installed apps use `100vh` on `html`, `body` and `#app`. With the `black-translucent` status bar, WebKit can undercount `dvh` by the status bar height while still starting the page behind that bar. Fixed bottom anchoring also left a blank strip on installed iPads. Do not add a hardcoded screen height or add safe-area insets to the viewport height.

Safe-area insets protect content and navigation controls; navigation backgrounds extend to the available screen edges. The bottom bar sizes itself from the controls, with a 60 px minimum, and uses the Home indicator inset as bottom padding instead of adding it to a fixed-height row. Keep these insets out of font scaling and leave OS-reserved screen regions to the browser. Landscape calendar top padding belongs inside the two scrolling columns so it scrolls away with their content, instead of creating a fixed empty gutter.

`main.ts` marks Android with `data-android` and phones with `data-phone`, using the shared platform detection. `data-phone` keeps the certified phone calendar-row heights separate from tablet/desktop landscape heights. Android portrait screens omit the extra 8 px content gutter above the header; scaffold safe-area handling remains separate. A camera strip outside the web viewport is controlled by Chrome/Android's window layout and cannot be reclaimed by subtracting CSS padding.

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

For a release, run `npm test` with both `VITE_BASE_PATH=/` and `VITE_BASE_PATH=/khmer-calendar-pwa/`; the latter matches GitHub Pages. Tests that mock asset requests must use Vite's configured base path.

When changing press feedback, check actual pointer presses and release in the browser, not only clicks after release. Verify filled/outlined/text actions, disabled buttons and keyboard focus; event-row accents in both themes while preserving today's tint and event-type colors; astrology table tap versus drag/cancel; and both navigation layouts. Navigation must have no pressed layer while its selected indicator still changes. `tests/astrology-details.test.mjs` covers table gesture cleanup and activation; the CSS states and color appearance require a browser check.

With `npm run dev` running in another terminal, check calendar sizing in a real Chromium layout engine:

```sh
node tests/calendar-width-browser.mjs
# Optional URL, including a production preview:
node tests/calendar-width-browser.mjs http://localhost:4173/
```

The runner locates Edge/Chrome on Windows or Chromium/Chrome on Linux; set `BROWSER_PATH` for another installation. It uses and removes its own temporary browser profile, leaving personal events and settings in your regular browser untouched. Its 42 profiles cover phone/tablet/desktop and short windows, English/Khmer, 80%/100%/150% text, both emoji preferences, month transitions across four/five/six rows and the optional personal-event legend. It checks first-frame width stability, row heights, the 2× event cap, side gaps and sizing-observer/reference cleanup. Android/Apple overlay scrollbars are simulated; physical-device and Safari checks remain separate. Set `CALENDAR_SCREENSHOT` to a PNG path to save the Khmer tablet portrait result.

The tests cover full-range calendar continuity and recurrence mapping, event catalog expectations (recorded dates, overrides, official holiday calendars, anniversary ordinals), the bundled event knowledge companion, license-text parity, time zones, saved events, appearance defaults, picker drafts, date-details time selection and astrology switches, foreground refresh, input escaping, modal viewport behavior, month swipes, platform controls and offline caching. [astrology-details.test.mjs](tests/astrology-details.test.mjs) covers whole-table pointer/keyboard activation, unchanged popup table values, English/Khmer and emoji choices, background selection, Ask AI query contents, focus restoration, and child-overlay/viewport-listener cleanup across repeated open/close cycles.

Run `node tests/astrology-watermark-browser.mjs` for the actual popup layout regression. It starts and closes its own Vite server and isolated headless Chromium profile (set `BROWSER_PATH` if needed). The 144 cases cover both child popups, English/light and Khmer/dark, named and emoji tables, 80%/100%/150% text, phone/tablet portrait and landscape, desktop, and a 640×240 short window. It checks the complete watermark viewport, successful artwork loading, aspect-preserving containment, visible actions, normal footer padding and unchanged popup size when decoration is removed. Six additional cases check unsupported solar years. Set `ASTROLOGY_SCREENSHOT_DIR` to save English/Khmer short-landscape, phone-portrait and tablet-landscape screenshots for visual review. It also supports `VITE_BASE_PATH` for deployment-path verification; Safari and physical-device checks remain separate.

The four-part version shown in Settings comes from `appVersion` in `package.json`. Change it only when a version bump is explicitly requested; committing or pushing changes does not finalize a release. The last component is for bug fixes only (for example, `0.1.8.1`). Feature releases advance the feature version and reset the last component to zero (for example, `0.1.7.5` → `0.1.8.0`). If the first three parts change, also update npm's three-part `version` and the lockfile with `npm version X.Y.Z --no-git-tag-version`. The service worker cache hash is generated automatically for every build.

Releases are tagged with the **app version** (for example `v0.9.1.1`) on the app-version bump commit, never with npm's three-part `version`. Publishing a GitHub Release from that tag automatically builds and attaches the Windows 7 portable ZIPs through [build-win7-release.yml](.github/workflows/build-win7-release.yml); the workflow overlays the [`win7-portable`](https://github.com/RSG-KH/khmer-calendar-pwa/tree/win7-portable) tooling branch onto the tagged source and stamps the EXE with the same app version. A tag push alone does not run the workflow — publishing the release does. Its manual workflow action can rebuild an existing release by tag. This separate compatibility workflow uses Node.js 20 and action version tags; the Pages workflow uses Node.js 24 and pinned action commits.

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
- Personal event repeats store one event with a rule, an inclusive end date and its original IANA time zone. `EventRepeat.ts` generates civil dates from the original anchor; `CustomEventOccurrences.ts` expands only the requested display range. Monthly dates default to skipping missing days, with independent 30-day-month and February fallbacks. Yearly February 29 can fall back to February 28. Timed repeats preserve wall time in the saved zone; a future DST gap moves that occurrence forward by the clock change, and an ambiguous time uses the earlier instant. All-day repeats keep their civil date. Editing and deleting apply to the entire series; individual exceptions are not supported.
- Month navigation supports swipes, mouse dragging and arrow buttons while preserving vertical scrolling and date taps.
- Month selection uses a draft: **This year** follows the selected Today time zone and preserves the month; **Go** selects day one; Cancel/Escape commits nothing.
- The initial theme follows the system. Tapping Light or Dark saves an explicit choice, including when that chip is already highlighted. Background tint and colored weekday headings default on; longer weekday headings default off. Existing saved choices are preserved. Colors follow weekday identity when Monday-first is enabled.
- Today checks run every 30 seconds while visible and immediately on return. Hidden pages stop this polling. A time-zone/offset change also refreshes displayed event times. Open modals defer refresh until closing; historical date selection remains in place. When an astrology table is visible, the date-details popup captures Today's time when it opens and does not update that time while it stays open. In the calendar header, Today highlights in the accent color when viewing another date and switches to default text color when today is selected.
- Production builds include a Content Security Policy allowing local scripts/assets and the UI's inline styles. The GitHub Pages workflow's actions are pinned to commits.
- Scheduled reminders are not available in PWA mode. The unused [push prototype](worker/push-scheduler.js) is not part of the Pages deployment and does not send reminders.

After deployment, check installed launch, offline reopening, **Check for update**, and event persistence on physical target devices. Follow the README's installation steps for [iPhone/iPad](README.md#install-on-iphone-or-ipad), [Mac](README.md#install-on-mac), [Android](README.md#install-on-android), [Windows](README.md#install-on-windows) and [Linux](README.md#install-on-linux).

## Previous implementation and verification reports

These reports record the revisions and checks at the time of each change:

- [Android 0.2.0 parity plan](docs/android-0.2.0-pwa-plan.md)
- [Android 0.2.0 parity verification](docs/android-0.2.0-verification.md)
- [Recurring events verification](docs/repeat-verification.md)
- [Stability and performance audit, 27 September 2026](docs/stability-performance-audit-2026-09-27.md)
