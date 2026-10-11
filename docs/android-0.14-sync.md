# Android 0.14 PWA sync

Source interval: Android [`4935a5f2f18638fc9a318a927e6fb43dc89687db` → `d983122d345f1204f6355140768d849889dfb6d0`](https://github.com/RSG-KH/khmer-calendar/compare/4935a5f2f18638fc9a318a927e6fb43dc89687db...d983122d345f1204f6355140768d849889dfb6d0), ten commits, checked against the current remote on 11 October 2026. Calendar Engine 0.6.0 and catalog 0.5.0 are unchanged in this interval. This implementation was prepared against PWA package/display versions 0.13.2 / 0.13.2.0; version bumps and deployment are handled separately.

The maintainer explicitly approved adopting the Android timeline, translucent Today cell and category-colored event popup titles, then requested matching Events and Settings content widths. Their implementation and the [certified PWA contract](maintainer-certified-calendar-ui.md) were updated together. Certified month widths, row heights, compact spacing, date summary, astrology tables, Settings row layout and navigation press-feedback exclusions remain in force.

| Android change | PWA outcome |
| --- | --- |
| Timeline redesign and refinements (`4433457`, `15f08e6`, `2529162`, `6f6a4e0`) | Continuous accent timeline, centered clickable date column, neutral date/weekday with holiday precedence, Today dot and bracketing gap node; shared across all event lists. Timed titles precede category/zone-only subtitles. Personal and holiday popup titles use category colors. English date-details weekday moves into the copied body. |
| Longer weekday defaults and Khmer Sunday subtitle (`fd54d7a`) | Default on only for unset preferences; saved false preserved. Subtitle copied from Android. |
| Adaptive Khmer lunar labels (`15f08e6`) | Whole-month compact phase labels when needed, remeasured after resize/fonts, without altering certified grid heights or text sizes. |
| Events swipes (`7989eeb`) | 80px horizontal year navigation; bounds 1800–2200, vertical scrolling and editable/filter controls preserved. |
| Events/Settings content width parity (maintainer follow-up) | Shared centered 720px cap with aligned card edges; Settings row padding and section spacing retained. |
| Editor navigation (`4433457`) | Save from Calendar stays there; save within Events focuses personal events in the saved year; reentering Events resets search/filter to All. |
| Localized event/repeat-end calendars (`189f3cd`, `7f3417b`) | Shared app-language calendar with distinct Khmer weekdays, Latin numeric entry, drafts, Cancel/OK, month swipe and year/month selection. Repeat-end dates respect anchor minimum. Date label includes localized year range. |
| Advance reminders and reminder storage (`189f3cd`) | Skipped as requested; scheduled reminders remain unavailable in the PWA. No lead-time field or inactive controls added. |
| Widgets, their artwork/settings/refresh/navigation | Skipped as requested; native launcher APIs have no PWA equivalent. |
| Android dependencies, notification permission fallback, manifest/backup/Gradle changes (`7f3417b`, `b80a601`, `d983122`) | Native-only; no web dependency, permission or version change required. |
| Removal of unused translations, reference import tooling and native test helpers | No live data changes to port. Keep PWA-used translation keys and existing shared-engine/data provenance. |

New calendar pickers retain the PWA's platform-specific time controls. They use accessible ordinary buttons and the existing modal/focus/viewport lifecycle, temporarily making only their parent inert. Closing or rebuilding the editor removes child pickers and gesture handlers. Observer/font listener cleanup is retained for compact lunar labels and month headings.

## Verification

- Root and `/khmer-calendar-pwa/` production builds and automated suites: 165 passed each, zero failures. The final build uses the root base path.
- `tests/android-sync-browser.html`: 5/5 real-browser checks for compact lunar labels restoring at wider widths, English/Khmer date drafts, cancellation, invalid-year/month changes, saving, typed Khmer digits refreshing repeat previews, repeat-end minimum, persisted series and parent/child cleanup. Fixture event/settings storage is restored after checks.
- `tests/safe-area-preview.html`: all 19 profiles passed, including tablet, phone portrait/landscape, cutouts, short windows and 150% text simulations.
- Visual checks covered desktop dark Khmer at 120%, English at 150%, narrow 320px phone Khmer at 150%, phone landscape, the shared timeline and the localized picker. A 1024×520 non-phone window at 80% retained 32px cells (40px × 0.8), 1.1 lunar line height and 4px marker gaps. Certified row heights and typography were retained.
- Width follow-up: real-browser measurements confirmed equal Events/Settings container and card widths, aligned left edges and no page overflow at 320×568, 844×390, 768×1024, 1024×768, 1024×520 and 1366×1024. The automated suite remained 165/165 after this CSS change.

Physical installed-device checks remain separate from browser/layout simulations.
