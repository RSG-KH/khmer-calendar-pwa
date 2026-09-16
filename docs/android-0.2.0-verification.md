# Android 0.2.0 parity verification

Verified 16 September 2026 against the [implementation plan](android-0.2.0-pwa-plan.md). Application implementation is complete. The user approved committing and pushing after reviewing the preview. Physical installed-device checks remain outstanding. Package version remains **0.1.8**, with **0.1.8.1** displayed in Settings.

## Automated results

- `npm test`: **71 passed**, zero failed, for both `/` and `VITE_BASE_PATH=/khmer-calendar-pwa/`. Restored a root production build afterward. Final TypeScript/build and `git diff --check` also pass.
- Engine 0.1.0 archive matched the published SHA-256; the exact release URL and npm integrity are locked.
- All **146,462 supported civil dates** pass lunar continuity/boundary checks. Tests cover Buddhist Era anchors, New Year 2012 (13–15 April), animal/Sak transitions, invalid dates and four-day New Year behavior.
- All **100 app recurrence definitions** produce **27,040 occurrences** across 1800–2200. Tests cover six rule families, effective years, nth weekdays, offsets, durations and translated anniversary titles. Explicit 2031 second-Asadh anchors pass.
- All **6,240 cached pairs** equal Android's reviewed cache. Every one of the **71 cached years** also matches fresh calculations. Cached-year assembly requires no engine day scan. Boundary years and malformed cache data are covered.
- All **3,246 captured records** are unchanged, including IDs, titles, categories and official URLs. Stored custom-event instants remain stable across time-zone changes.
- New settings defaults/round trips, picker drafts and local/Cambodia year boundaries pass. Lifecycle tests cover hidden startup, midnight, clock reversal, DST/zone changes, page cache restoration, single polling timer, modal deferral and cleanup.
- Existing updater, offline caching, retry, multi-window activation, platform manifests, modal viewport, swipe and scrollbar tests pass. Both lotus variants and engine license files are precached.

## Browser verification

Used the Codex in-app browser with the production build on a local origin, plus the existing development safe-area harness.

- Served the saved 0.1.8.1 baseline, created a timed custom event with notes, switched that same origin to the new build, and invoked **Check for update**. The app reloaded into Settings with its updated controls; language/preferences and the event's date, time and notes survived.
- Verified all five accents in both themes: page and navigation backgrounds matched, and browser `theme-color` matched the resolved color. Disabling tint restored the neutral light/dark backgrounds.
- Appearance subtitles match Android's English and Khmer translations exactly. Start week on Monday is the last row in the Calendar section, matching Android's order. Both languages were checked in the updated preview.
- Reviewed English and Khmer on desktop, narrow portrait (**320×640**, 120% Khmer text), tablet (**834×1194**, 150% Khmer text), and short landscape (**844×390**). Long headings fit at a uniform measured font size without horizontal overflow; Monday-first colors follow weekday identity independently of Sunday date highlighting.
- Verified Today remains filled after selecting another date, which gets an outline; both lotus variants load, including a short-month waning day 14.
- Verified month draft selection, This year preserving the month, Cancel and Escape leaving navigation unchanged, invalid 2201 input disabling Go, and Go/Enter selecting day one. The landscape picker kept its actions visible.
- A wrapped Khmer event title kept its copy button aligned to the first line, with a measured **44×44 px** target. Copy success feedback appeared. Existing failure feedback logic was retained.
- Sources showed the embedded engine link in both languages. Its license disclosure was initially collapsed and opened with Enter; all three full license sections were readable.
- Stopped the production HTTP server and reloaded the app. Saved preferences/custom event, both lotus assets, Sources/license texts and August 2031 calculated events remained available. This checks offline app resources at the origin; external source links naturally still require a connection.
- **19/19 safe-area simulation profiles passed**, including large text, landscape cutouts, browser toolbars and installed-mode viewport metrics. No application console errors were observed during the online UI checks.

These checks do not emulate native Safari/Chrome installation, operating-system bars or physical keyboards. Before publishing, check installed launch/update, keyboard and safe areas on physical iPhone/iPad, Android Chrome and target desktop installations. Live OS theme/clock changes also merit device smoke tests; controller state transitions are covered automatically.

## Size and timing observations

Vite's existing large-chunk warning remains visible. Values below compare the original baseline build with the implementation, without changing artwork formats or removing offline license texts.

| Metric | Baseline | Implementation |
| --- | ---: | ---: |
| JavaScript | 1,108.47 kB | 1,326.41 kB |
| JavaScript gzip | 159.54 kB | 192.93 kB |
| CSS gzip | 7.71 kB | 8.12 kB |
| Total `dist/` bytes, uncompressed | 11,169,804 | 11,522,517 |
| Precached files | 61 | 64 |
| Cold event assembly, 2026 | 1.90 ms | 5.92 ms |
| Cold event assembly, 2031 | 1.20 ms | 0.61 ms |
| Remaining 1980–2050 years | 23.92 ms | 13.08 ms |
| Mean cached month lookup | 0.00271 ms | 0.00307 ms |

Timing observations are single-process Node/Vite SSR samples after module loading, with 10,000 cached month lookups and no custom events. They exclude JavaScript download, parse/startup and DOM rendering, and vary with initialization/JIT. They are not a guaranteed user-visible speedup: initial 2026 assembly was slower in this sample, while loading the remaining cached years was faster. The upgrade adds **33.39 kB gzip JavaScript** and about **353 kB** uncompressed install content. Runtime integrity validation is retained.

## Scope retained

Scheduled reminders remain unavailable. Platform installation identity, localStorage keys, captured official-event coverage and the existing update workflow remain intact. A version bump was not requested. Pushing `main` runs the existing GitHub Pages deployment workflow.
