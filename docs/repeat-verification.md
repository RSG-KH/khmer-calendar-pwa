# Recurring events verification

Verified on 2026-09-17 with the additional regression tests in
`tests/repeat-crosscheck.test.mjs`. These changes will be released as app version
**0.3.0.0**.

## Automated checks

- `npm test`: **90 passed, 0 failed**. Includes TypeScript, production build,
  generated event cache validation, recurrence/storage/repository tests, platform
  handling, service worker caching and update behavior.
- `$env:VITE_BASE_PATH = '/khmer-calendar-pwa/'; npm test`: **90 passed, 0 failed**
  for the GitHub Pages deployment path. Restored the root-path build afterward.
- Added an independent day-by-day oracle: **1,628 full and clipped schedules**
  agree with the recurrence generator, including skipped dates and fallback flags.
  Covers 29/30/31-day anchors, daily intervals, weekly/monthly/yearly rules,
  independent monthly fallbacks, and leap-century boundaries (1900, 2000, 2100).
- Added checks that monthly queries partition a year without losing or duplicating
  occurrences across DST and the international date line.
- Added a regression check preserving the exact saved instant for an anchor in
  the second occurrence of an ambiguous DST time.

## Browser checks

Used a separate local origin (`127.0.0.1:4190`) with disposable test events.
The user's existing preview and data were not changed; test events were removed.

| Check | Result |
| --- | --- |
| End date required for Days, Weekly, Monthly and Yearly | Save blocked when missing |
| Invalid interval: zero, fractional or blank | Save blocked with validation |
| Default Days interval and inclusive end | Jan 1 every 3 days through Jan 10 previews/saves 4 dates |
| Monthly Jan 31 through Dec 31, 2026 | Strict: 7; include 30th: 11; both fallbacks: 12 |
| Conditional February option | Hidden for Mar 29–Dec 31; shown when extended through Feb 28 |
| Yearly Feb 29, 2028–2032 | Strict: 2; February 28 fallback: 5 |
| Persistence and editing a later occurrence | Reload preserves all dates; editor restores original anchor; title edit updates all |
| Display timezone change | Brussels 09:00 displays as Cambodia 15:00 in winter and 14:00 in summer; editing retains Brussels |
| Invalid end before start, then switching to None | Invalid repeat is blocked; None saves as one event and removes later occurrences |
| Delete series | Confirmation removes all visible occurrences; repository tests verify the stored series is deleted |
| Time picker | Dropdown matches trigger width; keyboard Down/Enter selects next hour |
| Khmer at 150% text | No horizontal popup overflow at 320×568, 390×844, 844×390, 768×1024 or 1024×768 |
| Simulated keyboard covering 60% of a 320×568 screen | Popup resizes/scrolls; saving succeeds |

## Findings and remaining coverage

No functional defects were found in these checks. No production code changes were
needed. Vite still reports its existing large-bundle warning; both builds succeed.
The dev server also emits warnings about importing license/notice text from the
public directory. These are outside the repeat feature and were not changed.

Browser interaction checks ran in the Windows in-app browser, with responsive
sizes and a simulated keyboard. They do not replace testing Safari on physical
iPhone/iPad hardware. Before release, smoke-test native date/time pickers, keyboard
scrolling, and an installed Home Screen app offline on those devices. Automated
platform checks confirm the Apple native-picker path remains selected; service
worker tests cover offline caching, but physical Apple device behavior was not
verified here.
