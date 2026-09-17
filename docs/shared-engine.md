# Shared engine integration

The PWA bundles `khmer-calendar-engine` **0.1.0** from its [versioned release](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.1.0). npm's lockfile records the exact release URL and integrity. Builds need Node/npm only; neither a sibling Android checkout nor Kotlin/Java is required. There are no runtime CDN requests.

## Calculation ownership

The engine's [API contract](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.1.0/docs/api.md) defines calculation behavior. Its [reference evidence](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.1.0/docs/references.md) documents calculation sources and validation. This guide covers how the PWA consumes that engine.

One `calendarEngine` instance supplies lunar dates, Buddhist Era, animal year, Sak, New Year and recurrence dates for Gregorian years 1800–2200. The PWA retains civil-date validation, local/Cambodia time zones, Western zodiac labels, translations, event titles, anniversaries and custom-event storage.

The app's **1980–2050** bundle is an event-list optimization. Calendar cells and date details still call the engine for lunar dates throughout **1800–2200**. Personal repeats use the app's `EventRepeat.ts` and their saved end date, independently of that bundle.

`RecurringEvents.ts` maps only engine input fields through `createRule`. In particular, it preserves `monthPolicy: ordinary_or_second_asadh` and maps the app's nth-weekday `offset` to engine `occurrence`. Modern event definitions retain their effective-year limits. Engine recurrence evaluation uses an **anchor year**, which is not necessarily the year of every returned occurrence. Current app rules all stay inside the anchor year; the adapter and tests assert this. A future cross-year rule needs an explicit repository/cache design change.

## Event precedence and provenance

| Data | Coverage | Behavior |
| --- | --- | --- |
| Captured `events.json` | 2000–2030 | Preserve all 3,246 records, IDs, Khmer/English titles, categories and official-source URLs. |
| Generated recurrence dates | 1980–1999, 2031–2050 | Cache dates only; resolve titles and anniversary text from current app definitions. |
| Generated holy days | 1980–2050 | Cache engine holy-day dates, including captured years. |
| Live engine dates | Remaining years in 1800–2200 | Evaluate app recurrence definitions and holy days on demand. |
| Custom events | User-selected dates | Merge stored events afterward; preserve existing IDs, storage keys and instants. |

The captured snapshot and recurrence definitions remain app-owned data inherited from Android. The implementation comparison checked them against Android revision `5f876f274d66b2e716cd793a1db781893ef7a853`. See Android's [reference-event database documentation](https://github.com/RSG-KH/khmer-calendar/blob/5f876f274d66b2e716cd793a1db781893ef7a853/docs/reference-event-database.md) for source handling. Engine adoption does not replace this snapshot or certify official holiday coverage outside it.

Repository events carry `basis: captured | calculated | khmer_lunar | custom`. Calculated recurrences are observances with no official URL. Details distinguish them with the calculated-observance label. Holy-day IDs retain `sil:YYYY-MM-DD`; recurrence IDs retain `calculated:<rule-id>`.

## Regenerating the date cache

```sh
npm run generate:events
npm run check:events
npm test
```

The generator loads the installed engine and the same app adapters used at runtime, without reading the old cache. Its deterministic JSON contains **6,240 ID/date pairs** across 71 years, compact month/day strings, schema version, engine version, coverage ranges and a SHA-256 digest of parsed-and-serialized recurrence JSON. Formatting and checkout line endings do not change that digest.

Review `src/data/engine-event-dates.json` whenever engine or rule inputs change. `check:events`, included in `npm test`, fails if committed data is stale. Runtime validation checks engine metadata, complete coverage, active IDs, nonempty dates, valid dates and duplicate pairs. Full-year tests compare the cache with fresh calculations and the reviewed Android cache; captured records keep precedence. The service-worker build discovers the resulting bundled files automatically.

## Upgrading the dependency

1. Download the intended release archive and `SHA256SUMS` from the engine's release page. Verify the archive before installing. The 0.1.0 archive SHA-256 is `9c9000baadd2d6d1cf2ae020e98fb3daf8fc269a56020ada15a7a19a1034e2f0`.
2. Install the exact versioned GitHub release URL with `npm install --save-exact <url>`. Review both package files and the release's API changes.
3. Copy that release's `LICENSE` and `NOTICE` into `public/engine-LICENSE.txt` and `public/engine-NOTICE.txt` without removing upstream credits. Update the app notice/version references where needed.
4. Regenerate event dates, review calendar corrections against explicit date anchors, and run tests for root and GitHub Pages paths. Change baseline hashes/counts only after understanding the data changes.
5. Verify production update, offline reopening and saved events. A dependency update alone does not authorize publishing or a PWA version bump.

The app, engine (including MIT upstream notices) and font license texts are bundled and readable offline in the Sources disclosure. Calculation evidence is maintained in the engine's [references](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.1.0/docs/references.md); its legacy implementation comparison is a historical migration report. The PWA tests its adapters and data use. Scheduled reminders remain unavailable in this PWA.
