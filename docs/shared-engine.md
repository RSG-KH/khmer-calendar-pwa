# Shared engine integration

The PWA bundles `khmer-calendar-engine` **0.2.0** from its [versioned release](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.2.0). npm's lockfile records the exact release URL and integrity. Builds need Node/npm only; neither a sibling Android checkout nor Kotlin/Java is required. There are no runtime CDN requests.

## Calculation ownership

The engine's [API contract](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.2.0/docs/api.md) defines calculation behavior. Its [reference evidence](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.2.0/docs/references.md) documents calculation sources and validation. This guide covers how the PWA consumes that engine.

One `calendarEngine` instance supplies lunar dates, Buddhist Era, animal year, Sak, New Year and recurrence dates for Gregorian years 1800–2200. The PWA retains civil-date validation, local/Cambodia time zones, Western zodiac labels, translations, event titles, anniversaries and custom-event storage.

Built-in events come from the Schema v2 catalog `src/data/khmer-calendar-data-0.3.1.json` (file name carries its `dataVersion`). The repository evaluates that catalog live through the engine — there is no generated date cache to keep fresh. Calendar cells and date details call the engine for lunar dates throughout **1800–2200**. Personal repeats use the app's `EventRepeat.ts` and their saved end date, independently of the catalog.

`RecurringEvents.ts` compiles each catalog `rule` (engine-native `RuleInput`, including `monthPolicy: ordinary_or_second_asadh` and `cn-reference-utc8`) through `createRule` once, then evaluates per year. Engine recurrence evaluation uses an **anchor year**, which is not necessarily the year of every returned occurrence. The adapter throws if a rule produces dates outside its anchor year, and the repository skips occurrences from other anchor years; current catalog rules all stay inside the anchor year. A future cross-year rule needs an explicit repository design change.

## Event precedence and provenance

`EventRepository.getYearEvents` builds a year in four passes, then custom events are merged per displayed range:

| Pass | Data | Coverage | Behavior |
| --- | --- | --- | --- |
| 1 | Recorded catalog dates (`dates[]`) | Historical milestones | 15 static date-backed events (UNESCO milestones); basis `recorded`. |
| 2 | Engine-evaluated recurrences (109 rules) | 1800–2200, per-rule `fromYear`/`throughYear` | basis `calculated`; historical events are not back-projected before `originalDate`. Catalog `overrides[]` (e.g. King Sihamoni's 3-day birthday 2005–2019, Qingming 2009/2029, Zongzi 2013) are passed to the engine as `EventDateOverride`; overridden occurrences get basis `corrected` and the override's source citation. |
| 3 | Official holiday calendars (`holidayCalendars`) | 2020–2027 | Matched by holiday `id`/`eventId`; a match upgrades the event to kind `HOLIDAY`, basis `official`, applying day-specific names and Sub-Decree citations. Unmatched holiday dates are added directly; `cancelled` entries are skipped. |
| 4 | Buddhist holy days | 1800–2200 | Scanned day-by-day from lunar data; IDs `sil:YYYY-MM-DD`; basis `khmer_lunar`. |
| 5 | Custom events | User-selected dates | Merged afterward; preserve existing IDs, storage keys and instants; basis `custom`. |

Repository events carry `basis: recorded | calculated | corrected | official | khmer_lunar | custom`. Details distinguish calculated observances with the calculated-observance label; official holidays link their government source. The catalog's `sources[]` (government, calendar, historical) drive those citations, and the Sources dialog credits the official government websites (library.ncdd.gov.kh, ocm.gov.kh, nbc.gov.kh) and the shared Khmer Calendar Engine.

The catalog is app-owned data distilled from the reviewed reference-event database, exported via Calendar Data Catalog v0.3.0 and evaluated dynamically by Khmer Calendar Engine. Engine adoption does not certify official holiday coverage beyond the catalog's holiday calendars; calculations do not confirm official leave outside them.

## Updating the event catalog

There is no generator script. To adopt a new dataset release:

1. Replace `src/data/khmer-calendar-data-<version>.json` with the new release (keep the versioned file name) and update the import in `RecurringEvents.ts`.
2. Extend the pinned expectations in `tests/engine-integration.test.mjs` (recorded dates, rule evaluation, overrides, official holiday matching) and the Sources-dialog assertions in `tests/sources.test.mjs`.
3. Run `npm test` for root and GitHub Pages paths. Review calendar corrections against explicit date anchors before changing any expectation.

## Upgrading the dependency

1. Download the intended release archive and `SHA256SUMS` from the engine's release page. Verify the archive before installing. The 0.2.0 archive SHA-256 is `585b5130ac620a549b67e2b997db27e7be00da536e1ac85e287f3fde43c4a022`.
2. Install the exact versioned GitHub release URL with `npm install --save-exact <url>`. Review both package files and the release's API changes.
3. Copy that release's `LICENSE` and `NOTICE` into `public/engine-LICENSE.txt` and `public/engine-NOTICE.txt` without removing upstream credits. Update the app notice/version references where needed.
4. Re-run the full test suite: recurrences are evaluated live, so engine changes surface directly as date differences against the catalog expectations. Review any diff against explicit date anchors.
5. Verify production update, offline reopening and saved events. A dependency update alone does not authorize publishing or a PWA version bump.

The app, engine (including MIT upstream notices) and font license texts are bundled and readable offline in the Sources disclosure. Calculation evidence is maintained in the engine's [references](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.2.0/docs/references.md); its legacy implementation comparison is a historical migration report. The PWA tests its adapters and data use. Scheduled reminders remain unavailable in this PWA.
