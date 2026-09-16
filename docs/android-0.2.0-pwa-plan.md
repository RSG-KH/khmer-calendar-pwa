# PWA implementation plan for Android 0.2.0 parity

Reviewed and implemented on 16 September 2026. Status: **implementation complete; automated and browser verification passed**. Physical installed-device checks remain before release. See the [verification report](android-0.2.0-verification.md) and [engine/data guide](shared-engine.md).

The plan below records the original comparison and agreed scope. The implementation adds the shared engine, precomputed event dates, appearance improvements and navigation/lifecycle changes while preserving responsive layout, saved events and offline updates.

## Comparison baseline

| Project | Reviewed revision | Version |
| --- | --- | --- |
| Android before | `33ced69e1c5dd00f6deb990ca3e18846b38212b4` (`v0.1.8-beta`) | 0.1.8, build 9 |
| Android after | `5f876f274d66b2e716cd793a1db781893ef7a853` | 0.2.0, build 10 |
| PWA | `3cd6b6d66d982ac506a451fcdb54218aa769d263` | package 0.1.8; displayed 0.1.8.1 |
| Shared engine | `dd8d402`, tag `v0.1.0` | 0.1.0 |

Android's remote `main` matched the reviewed commit. No Android 0.2.0 tag was returned by the remote tag check; this plan compares the versioned source commit, not an assumed release tag. The Android interval contains eight commits and changes 66 files. Its 8,804 added lines include the 6,240-row generated event cache, tests and documentation; they are not all application features.

The [engine v0.1.0 release](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.1.0) is published with a JavaScript/TypeScript package. Its README still says consumers have not migrated, but Android's reviewed source already consumes it. Use the source and pinned release contracts when implementing this plan.

## Pre-implementation findings and baseline verification

- `npm test` passes: production build plus **57 tests**. The current JavaScript bundle is **1,108.47 kB / 159.54 kB gzip**, with Vite's existing large-chunk warning; the service worker precaches 61 files. These are comparison baselines, not new performance budgets.
- Compared the PWA modules with the locally built engine 0.1.0 package across **146,462 dates**, **401 New Year results**, and all **100 recurrence definitions**. All lunar fields agree. New Year differs in 2012; animal-year/Sak/transition-label differences are confined to 13–15 April 2012.
- PWA recurrence produces **26,596 occurrences** against the engine's **27,040**. There are **444 missing second-Asadh occurrences**, plus three 2012 New Year occurrences whose dates move. As sets, this is 447 engine-only rows and three PWA-only rows.
- The three affected rule records store `monthPolicy: "ordinary_or_second_asadh"`, but [RecurringEvents.ts](../src/data/RecurringEvents.ts) reads `secondAsadh`. The omissions affect three events in 148 leap-month years; 411 missing occurrences fall outside the captured 2000–2030 range and reach normal event lists.
- Confirmed missing 2031 events: Buddhist Lent Candles Making Day on **27 July**, The Ordained Dragon Monk on **2 August**, and Beginning of Buddhist Lent on **4 August**.
- The PWA calculates New Year 2012 as **14–16 April**; engine 0.1.0 calculates **13–15 April**. Stored event dates already mask this calculation error in the 2012 event list.
- Compared all **3,246 captured records** with Android's current snapshot and translated titles: dates, IDs, Khmer/English titles, categories and official URLs match. Preserve this data; the upgrade does not require replacing it.
- This review did not install the engine into the PWA or execute new UI behavior in a browser. The full-range comparison used the existing local engine build; implementation must repeat it using the verified release dependency.

The engine's [legacy comparison](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.1.0/docs/source-audit.md) independently documents the recurrence defect at the same PWA revision. Agreement between implementations does not establish independent historical accuracy across 1800–2200.

## Android-to-PWA gap map

| Android change | Current PWA | Planned treatment |
| --- | --- | --- |
| Shared engine for lunar dates, New Year, animal year, Sak and recurrence | Duplicate TypeScript calculations | Replace calculations with thin adapters to pinned engine 0.1.0. |
| Precomputed 1980–2050 events and holy days | Captured 2000–2030; scans dates for holy days and fallback recurrence | Add deterministic generated ID/date data and preserve snapshot precedence. |
| Longer weekday headings | Short grid headings only | Add saved setting, English three-letter labels and Android's full Khmer grid labels. |
| Colored weekday headings | Sunday highlighting only | Add independent saved setting and theme-specific weekday colors. |
| Background accent, enabled by default | Accent affects controls; backgrounds stay neutral | Add background switch and tokens for pages/navigation. |
| Light/Dark chips; automatic until first manual choice | System/Light/Dark picker | Adopt chips, preserve saved preferences and automatic default. |
| Today filled; selected other date outlined | Selected date filled; Today outlined | Update all cell text, marker and background states together. |
| Closed/blossomed lotus by lunar phase day | One lotus asset everywhere | Copy both supplied Android PNGs unchanged; share selection logic. |
| Month navigation selects day one | Already implemented for arrows, swipes and month selection | Retain and verify; no new implementation needed. |
| Jump to month has This year, followed by Go | This year only exists in Events year picker; month click commits immediately | Give month mode draft state, This year, Cancel and Go. |
| Copy checkmark for two seconds | Already implemented with accessible status and failure feedback | Retain logic; align buttons with first text line/right edge. |
| Simplified engine credit and collapsible licenses | Old upstream/event-source paragraphs; per-license disclosures | Update attribution and simplify the disclosure without losing bundled license texts. |
| Today polling pauses while hidden | Refreshes on visibility return, but interval remains active | Start/stop timer with visibility; refresh immediately on return. |
| Reminder categories/time-zone fixes/selective alarm scheduling | No scheduled reminders; unused push prototype | Separate future project; do not expose inactive category switches. |
| Android system insets, monochrome launcher, Gradle/lint updates | Browser safe areas and platform-selected manifests | Keep PWA implementations; regression-check relevant layout outcomes. |
| Coverage notices removed; About links/version layout refined | No coverage banners in current screens; separate version/repository links already present | Retain; no duplicate work. |

## Implementation sequence

Use four focused implementation changes, followed by release verification. Phases 2–4 depend on the engine contract established in phase 1. Keep changes reviewable and the existing app functional between phases.

### 1. Shared engine, correctness and attribution — highest priority

**Files:** `package.json`, `package-lock.json`, `src/domain/KhmerCalendar.ts`, `src/domain/KhmerNewYear.ts`, `src/domain/KhmerDateDetails.ts`, `src/data/RecurringEvents.ts`, `src/data/EventRepository.ts`, `src/ui/Sources.ts`, `src/ui/Modals.ts`, `src/data/translations.json`, bundled notices, `tests/calendar.test.mjs`, and new focused engine/recurrence tests.

1. Add the exact runtime dependency URL:

   ```text
   https://github.com/RSG-KH/khmer-calendar-engine/releases/download/v0.1.0/khmer-calendar-engine-0.1.0.tgz
   ```

   Verify the downloaded archive against release `SHA256SUMS`; the release API reported SHA-256 `9c9000baadd2d6d1cf2ae020e98fb3daf8fc269a56020ada15a7a19a1034e2f0`. Commit the resolved URL and npm integrity in the lockfile. A normal build must need neither a sibling checkout nor Java/Kotlin tooling. Production must bundle the engine locally, with no runtime CDN dependency.

2. Reuse one engine instance. Preserve useful PWA-facing shapes and label methods while replacing lunar, New Year and traditional year calculations. Keep civil-date/epoch helpers, local/Cambodia time-zone selection, custom-event instants and Western zodiac formatting in the PWA. Preserve the adapters' existing invalid-date behavior, including `RangeError` where tests expect it.
3. Map recurrence definitions explicitly through `createRule`; do not pass the JSON object wholesale, since it includes app-owned title/comparison/anniversary fields and the factory rejects unknown properties. Preserve `monthPolicy`; map nth-weekday `offset` to `occurrence` with engine offset zero; normalize unused New Year month/day values and non-lunar waxing fields as Android does. Preserve duration and effective-year bounds. Resolve localized titles and anniversaries in the PWA.
4. Test all 100 existing rules across 1800–2200. Current definitions remain within their requested Gregorian year; assert this. Document the engine's anchor-year contract so a future cross-year rule cannot be silently dropped. General support for new cross-year definitions belongs with that future data change.
5. Preserve the entire 2000–2030 snapshot, official URLs, custom IDs and localStorage keys. No changes to user-event data are needed. Keep calculated events as observances, never infer official holiday status from engine dates.
6. Add explicit event provenance (`captured`, `calculated`, `khmer_lunar`, `custom`, or an equivalent typed representation) at repository boundaries. Keep existing IDs, including date-qualified holy-day IDs. Use provenance for the calculated-observance category in event details instead of presenting every calculated event as an undifferentiated observance.
7. Bundle the release's Apache license and upstream NOTICE, retaining the app and Kantumruy Pro licenses. Update Sources with the engine link embedded in its bilingual calculation paragraph; provide an initially collapsed, accent-colored Open-source licenses disclosure with native keyboard/expanded-state semantics. Keep full texts available offline. Move detailed snapshot provenance to developer documentation.
8. Use Android's concise engine credit for built-in event descriptions, retaining custom-event descriptions and category distinctions. Selectively merge shared translations; preserve PWA clipboard-failure and other web-specific strings. Do not overwrite the catalog wholesale or claim the engine supplies government holiday records.

**Acceptance:** 2012 New Year returns 13–15 April and transition labels agree; all three 2031 events appear; lunar compatibility, date bounds, all recurrence families, effective years and anniversary titles pass; the 3,246 captured records remain identical; saved events retain their instants across zone changes; production loads offline with readable licenses. Full-range engine comparisons test adapter mapping, while explicit date anchors prevent two implementations from simply agreeing on the same mistake.

### 2. Precomputed event dates — performance and data integrity

**Files:** `src/data/EventRepository.ts`, `src/data/RecurringEvents.ts`, proposed `src/data/engine-event-dates.json`, proposed `scripts/generate-engine-event-dates.mjs`, package scripts, and repository/cache tests.

1. Separate **captured years (2000–2030)** from **precomputed years (1980–2050)**. Do not merely widen `hasBundledYear`: doing so in the current implementation would return no ordinary events for the newly included years.
2. Generate compact ID/date data with the installed, pinned engine and app recurrence definitions. The Android baseline is **6,240 pairs**: holy days for all 71 years plus recurrences only outside 2000–2030. Keep generation independent of the existing cache. Record engine version, rule digest and ranges in metadata; make regeneration deterministic and explicitly invoked when inputs change.
3. Repository precedence: captured records for 2000–2030; precomputed recurrences for 1980–1999 and 2031–2050; engine recurrence elsewhere in 1800–2200. Use precomputed holy days for all 1980–2050 years and live engine holy days outside that range. Merge custom events afterward as today.
4. Store no translated titles or official holiday claims in the cache. Resolve titles/anniversaries from current app data, preserve provenance and validate unknown IDs, dates, duplicate ID/date pairs and year completeness.
5. Compare generated pairs with Android's committed cache and with fresh engine output for every cached year. Check boundary years 1979/1980, 1999/2000, 2030/2031 and 2050/2051. Cached years must not rescan all dates through the engine to build their event list.
6. Measure cold year loading, month navigation, compressed bundle size and offline-install size before/after. The Kotlin/JS runtime and new cache may increase download size; choose a compact representation based on measurements. Do not claim a speed improvement solely from adding a cache or suppress the existing bundle warning as a substitute for measuring.

**Acceptance:** all 71 cached years match fresh calculations and the Android baseline; captured years keep their source data; out-of-range cache years fall back correctly; localized titles stay current; no duplicate events or false public holidays; all added data is included in the generated service-worker precache. The extended cache does not add Chinese festival rules or expand verified official-holiday coverage.

### 3. Appearance and calendar presentation

**Files:** `src/data/Storage.ts`, `src/ui/Settings.ts`, `src/data/i18n.ts`, `src/data/translations.json`, `src/main.ts`, `src/ui/Modals.ts`, `src/styles/{theme,components,appearance,responsive}.css`, both lotus assets, and focused settings/presentation tests.

1. Add defaults: `backgroundAccent: true`, `showLongerWeekdayNames: false`, `highlightWeekdayNames: false`. Existing stored preferences merge with defaults; preserve all existing settings and custom events. Keep Show copy buttons off by default.
2. Replace the theme picker with accessible Light/Dark chips. With stored `system`, highlight the effective theme and react to system changes without persisting an override. Tapping either chip, even the already-highlighted one, saves that explicit choice. Existing light/dark choices remain intact. Refresh chip state when the system theme changes while Settings is open.
3. Add background tint to all pages, navigation and their safe-area backgrounds. Recommended PWA adaptation: keep the current neutral web palette when disabled, use a 10% accent blend over its light base when enabled, and the Android muted dark shades (`#0A0E16`, `#0D0D16`, `#100C12`, `#0F0E0E`, `#0A100C`) by accent. Keep existing card surfaces and layout. Update the final tokens in `appearance.css`, which currently overrides `theme.css`, and derive browser `theme-color` from the effective background instead of hardcoded black/light values. Use an opaque matching navigation background when tint is enabled.
4. Add longer grid labels using `calendar.weekday.grid_long.*`. Extend the typed label API. Fit all seven headings at one consistent size after fonts load and on container/font-scale changes; avoid clipping Khmer or shrinking each heading differently. Support both Sunday-first and Monday-first order.
5. Port Android's light/dark weekday colors by weekday identity, not column index. Weekday-color mode controls heading colors; Sunday-column highlighting still independently controls date numbers. When weekday colors are disabled, preserve the existing Sunday-heading behavior.
6. Make Today the filled accent cell with contrasting day/lunar text and markers. A selected non-Today date gets an accent outline while keeping normal holiday/custom-marker colors. Audit both stylesheets, including the triangle marker override and the later `.cal-cell { border: 0 }` rule, so cascade order does not hide the new outline. Use a non-layout-shifting outline/inset treatment. Keep accessibility selection distinct from the current date.
7. Replace `holy_day_lotus.png` and add `holy_day_lotus_blossom.png` from Android's supplied artwork, unchanged. Use one helper in the grid and date details: closed for phase day 8 and its shaving eve, blossom for phase-end holy days and their shaving eves. Gate display with engine flags; cover the final waning day 14 in short months. Preserve grid opacity and existing web icon sizes.

**Acceptance:** persisted settings survive reload/update; all five accents work in both themes; system-following behavior remains correct until a chip is tapped; long Khmer headings fit narrow screens and large fonts; Today remains distinct after another date is selected; holiday/custom/holy-day markers remain legible; both lotus variants work offline. Review English and Khmer on phone portrait/landscape, tablet and desktop.

### 4. Jump picker, copy alignment and foreground refresh

**Files:** `src/ui/Modals.ts`, `src/ui/CopyButton.ts` only if necessary, `src/main.ts`, proposed `src/ui/TodayRefresh.ts`, relevant styles, and picker/lifecycle tests.

1. Give the month picker draft year/month state. This year replaces only the draft year using **Today follows** and preserves the draft month. Month taps select a draft; Go commits and selects day one, while Cancel/Escape/outside dismissal leave the calendar unchanged. Add the localized title/action and visible 1800–2200 range; invalid input disables Go. Retain keyboard and compact-landscape behavior. Keep the separate Events year picker behavior unless its own parity review shows a required change.
2. Preserve current day-one navigation and the Today action selecting the actual date. The PWA already implements them in both `changeMonth` and the month-picker callback.
3. Keep existing clipboard logic, two-second checkmark, retry timer, Safari user-gesture write, accessible status and visible failure feedback. Align date/event copy controls to the first text line at the right edge instead of letting the event button follow the title's last line. Retain at least the existing 44 px web touch target; test wrapped Khmer titles and hidden-copy mode.
4. Extract a small foreground date-refresh controller with injectable clock/timers for testing. Run a 30-second check while visible, stop on hide/page exit, and check immediately on return/pageshow. Avoid duplicate timers/listeners. Re-evaluate local date, local time-zone/offset and relevant displayed custom-event times after clock/DST/time-zone changes, including changes that leave the date unchanged.
5. Reset the refresh baseline when Today follows changes. Preserve the PWA's existing behavior of following Today only when the previous Today was selected; browsing other dates must not jump unexpectedly. If a modal is open, preserve its draft/focus and apply a pending refresh when it closes rather than rebuilding it or leaving the calendar stale until another timer fires.

**Acceptance:** This year preserves month and requires Go; Cancel commits nothing; local/Cambodia New Year boundaries choose the correct year; midnight and resume refresh Today without disrupting historical browsing or editors; hidden pages have no app-owned polling timer; repeated resume creates only one timer; copy behavior and failure feedback remain intact.

### 5. Integration, documentation and release verification

**Files:** existing tests, `tests/device-preview.html`, `tests/safe-area-preview.html`, `README.md`, `DEVELOPMENT.md`, relevant new data/engine documentation, and release metadata only when a release is requested.

- Run `npm test` for both `/` and `/khmer-calendar-pwa/`, matching existing CI. Extend the current suite with the targeted checks above; keep engine-owned calculation validation in the engine project and test the consumer's adapters, settings, data precedence and UI behavior here.
- Test the production build through a real browser: first online installation, complete offline reopening, both lotus assets, licenses, future-year events, and a 0.1.8.1-to-new-build update with saved settings/custom events. Cover failed asset download, retry and multiple open windows with the existing updater/service-worker tests.
- Verify current safe-area and keyboard behavior on installed iPhone/iPad, Android Chrome and desktop targets. Existing preview pages simulate layout; they do not replace physical-device checks. Preserve platform manifest identity/scope/start URL so an update remains the same installation.
- Document engine ownership, pinned dependency/checksum upgrades, cache regeneration, captured-versus-calculated data, new settings and unchanged reminder availability. Link engine calculation evidence directly instead of describing the PWA as maintaining a separate calendar algorithm.
- Record measured bundle/install-size and rendering changes. Validate browser CSP and offline loading for every new engine chunk or data asset. The existing service-worker builder automatically discovers built files; explicit tests should prove the new assets are actually included.
- Keep package/display versions unchanged during implementation. If a feature release is explicitly requested after validation, the repository's convention makes the proposed target **package 0.2.0 / appVersion 0.2.0.0**; update the lockfile together. Pushing `main` deploys automatically, so publishing is a separate release action.

## Deliberately separate work

**Scheduled reminders:** Android 0.2.0 adds category controls, local/Cambodia reminder zones, preserved holy-day choices and selective alarm rescheduling. This PWA has no active reminder service: `src/push/PushManager.ts` is unconnected and `worker/push-scheduler.js` explicitly lacks event selection, signing and delivery. Keep the existing availability message. A future reminder project needs a delivery architecture, hosting and subscription lifecycle, data/privacy decisions for custom events, permission UX, time-zone/DST handling and device testing before category controls become useful. Native AlarmManager behavior is not part of this parity release.

**Manager exports:** Android still uses app-owned snapshots and rules. Engine adoption does not require integrating `khmer-calendar-manager`, replacing event IDs, changing holiday provenance or reimporting captured titles. Treat that as a separate migration with its own data contract.

**Native Android maintenance:** Gradle/Kotlin/AndroidX upgrades, Play deprecation cleanup, native themed launcher artwork and Android window APIs have no direct PWA port. Preserve browser-managed cutout regions and the current installation artwork; test the corresponding layouts rather than translating Android inset arithmetic into CSS.

## Completion checklist

- [x] Verified engine release installed; duplicate calendar algorithms removed.
- [x] Second-Asadh recurrence and 2012 regression cases pass.
- [x] Captured records and user data preserved; provenance stays explicit.
- [x] 1980–2050 cache reproducible and equivalent to fresh engine results.
- [x] New settings, Today/selection states and both lotus variants implemented.
- [x] Month This year/Go behavior, copy alignment and foreground refresh verified.
- [x] Bilingual sources, offline licenses and developer documentation updated.
- [x] Root/subpath builds, browser checks, offline reopening and update completed; 19 simulated device profiles pass.
- [ ] Physical installed-device matrix completed (requires target devices).
- [x] Package/display versions left unchanged, as agreed. User approved committing and pushing after preview review; pushing `main` triggers the existing deployment workflow.

## Source references

- [Android change interval](https://github.com/RSG-KH/khmer-calendar/compare/33ced69e1c5dd00f6deb990ca3e18846b38212b4...5f876f274d66b2e716cd793a1db781893ef7a853)
- [Android engine integration](https://github.com/RSG-KH/khmer-calendar/blob/5f876f274d66b2e716cd793a1db781893ef7a853/docs/shared-engine.md)
- [Android event data/cache contract](https://github.com/RSG-KH/khmer-calendar/blob/5f876f274d66b2e716cd793a1db781893ef7a853/docs/reference-event-database.md)
- [Android UI behavior](https://github.com/RSG-KH/khmer-calendar/blob/5f876f274d66b2e716cd793a1db781893ef7a853/docs/ui-and-responsive-design.md)
- [Engine API contract](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.1.0/docs/api.md)
- [Engine release/install procedure](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.1.0/docs/releasing.md)
- [PWA development and release conventions](../DEVELOPMENT.md)
