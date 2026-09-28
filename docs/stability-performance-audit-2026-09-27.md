# Stability and performance audit — 27 September 2026

**Historical audit.** Test counts, bundle sizes and measurements below belong to the audited revision and its nested-event-popup follow-up. Later astrology detail popups are documented in the [current UI contract](maintainer-certified-calendar-ui.md#astrology-table-detail-popups); their focused regression coverage is listed in the [development guide](../DEVELOPMENT.md#build-and-test). The measurements below do not include those later popups.

Audited app version **0.12.0.1**, starting from commit `30790dd` plus the pending Sources and licenses translation corrections. This audit does not change the release version or the maintainer-certified calendar layout.

## Findings and fixes

- **Startup resilience:** an invalid saved Today time zone or recurring-event time zone could leave the calendar blank. Settings now accept supported values and fall back per preference. Event reads validate individual records so one malformed record cannot hide valid neighbors or interrupt recurrence expansion.
- **Saved-data preservation:** unrelated invalid event records remain on disk when a valid event is edited or deleted. Saving into an unreadable collection fails instead of replacing it with a new empty collection. Invalid new events are rejected before storage is modified.
- **Popup lifetime and keyboard focus:** closing a nested popup previously left focus on the document body while the parent remained open. Focus now returns to the parent control, viewport listeners are removed, and saved focus references are deleted. Date, event, Learn more, editor, and time/location popups release their rendered contents on close. Date details also dispose their child picker and clear session callbacks.
- **Bounded caches:** built-in event results retain the 12 most recently used years, and date/time formatters retain 32 zones. Evicted entries are recomputed without changing results. The existing two-country data cache now refreshes recency and prevents an older failed request from removing a newer replacement request.
- **Event-search work:** typing in search now reuses the current screen's event snapshot instead of regenerating timed recurring occurrences on every input. Navigation, settings changes, saved-event edits, and Today refresh still rebuild the snapshot. Search also trims surrounding whitespace.
- **Code checks:** removed an unused import and parameter; enabled TypeScript `noUnusedLocals` and `noUnusedParameters` so future builds reject these cases.

## Measurements

Measured using headless Microsoft Edge/Chromium on Windows against a local production preview at 1280 × 850. Timing figures describe this test machine, not mobile-device guarantees. Memory samples used two explicit garbage collections after allowing short-lived UI timers to finish.

| Check | Before | After |
| --- | ---: | ---: |
| Average synchronous search update, 15 nonmatching queries over three daily timed series spanning 2026 | 52.09 ms | 0.45 ms |
| Retained DOM nodes after 120 complete UI cycles | 2,740 | 910 |
| Retained event listeners after those cycles | 350 | 109 |
| JavaScript heap after those cycles followed by visiting 120 additional years | 7.70 MiB | 5.43 MiB |

A cycle covered next/previous month, date details, time/location and suggestions, event editor cancellation, event details and Learn more, Sources and its URL popup, Settings time picker, and returning to the calendar.

An additional **600-cycle** run held the retained DOM count at **910** and listener count at **109** at every sampled checkpoint. Heap use was approximately 5.02 MiB after 10 cycles and 5.49 MiB after 600; the small variation was not accompanied by accumulating DOM or listeners. The subsequent year sweep stayed around 5.67–5.73 MiB. Idle sampling showed no continuing layout or style-recalculation loop. No uncaught page errors were recorded in these runs.

These results support the specific cleanup and cache fixes. They do not prove that every possible memory leak or slow path is absent.

## Verification

- `npm test`: **128 tests pass**, including production build and new modal-lifecycle, cache-lifecycle, and storage-resilience regressions.
- The same suite passes with `VITE_BASE_PATH=/khmer-calendar-pwa/`; the final local build uses the normal root path.
- **76 browser layout checks** pass across English/Khmer, 80%, 100%, and 150% text sizes, phone/tablet/desktop sizes, portrait/landscape, short windows, and 4/5/6-row months. The calendar width remains at most 1.25 times its height and certified row heights remain intact.
- Astrology master/individual switches, both emoji modes, and out-of-range date details pass browser checks.
- A real production service worker installs successfully. Offline reload, previously unopened Belgian location data, and recurring-event creation, editing, deletion, and persistence pass browser checks.
- Closing a location picker during a delayed country download, then opening a time-only picker, does not allow the old response to populate the new dialog.
- Malformed preferences, mixed valid/invalid saved events, and invalid recurring-event zones no longer produce the reproduced startup failures.
- `git diff --check` passes. Prior translation edits are preserved.

## Nested date/event popup follow-up

Opening an event from date details now keeps the date dialog underneath and puts the event dialog on top. Closing the event returns to the same date content and event button. Editing or deleting a custom event keeps the existing transition back to the editor/calendar, avoiding stale date content after a mutation.

The production build and all **129 tests** pass, including a regression for the actual date-to-event handler. Browser checks pass at 1280 px and 390 px in English and Khmer for Close, Escape, backdrop dismissal, restored focus, three-level Date → Event → Learn more navigation, and custom-event editing/cancellation/deletion. A 100-cycle nested-popup run showed no accumulating DOM nodes or listeners after garbage collection (10 cycles: 1,641 nodes / 140 listeners; 100 cycles: 1,192 / 128).

## Remaining limits

Physical iPhone/iPad Safari, Android devices, installed-app keyboard behavior, and prolonged background/foreground use still need device testing. Browser layout simulation does not substitute for those checks. The production bundle still triggers Vite's existing large-chunk advisory at approximately 741 kB minified / 157 kB gzip; this audit leaves the shared calculation engine and offline asset packaging intact.
