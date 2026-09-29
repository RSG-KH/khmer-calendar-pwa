# Shared engine integration

The PWA bundles `khmer-calendar-engine` **0.6.0** from its [versioned release](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.6.0). npm's lockfile records the exact release URL and integrity. Builds need Node/npm only; neither a sibling Android checkout nor Kotlin/Java is required. There are no runtime CDN requests.

## Calculation ownership

The engine's [API contract](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.6.0/docs/api.md) defines calculation behavior. Its [reference evidence](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.6.0/docs/references.md) documents calculation sources and validation. This guide covers how the PWA consumes that engine.

One `calendarEngine` instance supplies lunar dates, Buddhist Era, animal year, Sak, New Year and recurrence dates for Gregorian years 1800–2200. Engine 0.6.0 also supplies Ganzhi day and hour pillars throughout that range, solar year and month pillars for 1900–2100, and `calculateHoroscope` for the Western Big 3. The PWA retains civil-date validation, local/Cambodia time zones, Western zodiac labels, translations, event titles, anniversaries and personal event storage. The Ganzhi and Western calculations run independently when the master astrology switch and their respective display settings are enabled.

`WesternZodiac.ts` resolves the selected civil date and time in the chosen place's IANA zone and passes its coordinates to `calculateHoroscope`. The offline Big 3 picker now uses administrative points: Cambodia province/capital → district/municipality/khan → commune/sangkat from `cambodia_app_database_with_coordinates` release `2026-09-27.2`, supplemented by `missing_coordinates_filled_bundle`, and GeoNames ADM1 → ADM2 → ADM3 for other countries. The compact catalog has 1,898 Cambodian divisions (all with coordinates, including 445 supplemental points) and 201,002 GeoNames divisions in 227 other countries. Country shards plus Cambodia occupy about 4.7 MB compressed, compared with 17.8 MB for the previous populated-place catalog. Saved choices retain their source ID, coordinates, time zone and dataset hash, so existing GeoNames city selections continue to work after the catalog change. `public/birthplaces/provenance.json` records the source fingerprints and coverage; `public/birthplaces/ATTRIBUTION.txt` records the source attribution and rights notes.

The picker has a Country field, an ADM1 field, and one combined `ADM 2 · ADM 3` field. Its suggestions show each ADM3 beside its ADM2 parent and appear on focus even before typing; users can search by either name. The combined field also lists selectable ADM2 points outside Cambodia. In Cambodia, the lowest selectable level is commune/sangkat. All 1,663 communes/sangkats have a coordinate pair after the 432 missing level-three points were filled; 13 missing level-two points were filled as well. Six supplemental points have low confidence and are labeled as approximate in suggestions. Outside Cambodia, GeoNames ADM1, ADM2 and ADM3 records with valid source points can be selected at whichever level is available. In this source snapshot, 1,836 administrative records lack a time zone and cannot be selected for Big 3; the picker identifies them and prompts for a custom location. All 252 country/territory labels remain listed; 24 have no ADM1–ADM3 records in the source and prompt for a custom location. Manual latitude, longitude and IANA time zone entry remains available for precise birth locations and uncovered areas. These administrative points are approximate references, not verified birth addresses; many supplemental points are centroids of 2018 boundaries, which may not reflect later changes.

To refresh Cambodia, run `node scripts/import-cambodia-divisions.mjs <path-to-runtime/divisions.min.json> <path-to-missing_coordinates_filled.json>` with the reviewed source and fill bundles. The importer requires an exact ID and identity-field match for every missing point, then updates the Cambodia asset and provenance fingerprints. To refresh other countries, run `py -3 scripts/build-geonames-divisions.py <path-to-allCountries.zip>` with a saved official GeoNames gazetteer ZIP. That builder filters only feature codes `ADM1`, `ADM2` and `ADM3`, writes one compressed shard per country, and records the source SHA-256. Keep `scripts/geonames-country-names.json` as the stable country-name seed. Review the generated coverage and parent-link tests before distributing an updated catalog.

Without a chosen place or manual coordinates, Rising is unavailable. The PWA does not derive a birth location from the selected time zone or the device's zone name. Sun and Moon remain available because their positions do not depend on birthplace. The engine's combined horoscope API requires coordinate arguments for those positions, but its Ascendant result is discarded unless an explicit birthplace is present. A nonexistent local time during a daylight-saving transition has no Rising sign; Sun and Moon fall back to noon. A place in the catalog is a reference point, not an exact birth address; the browser's IANA rules supply historical offsets and may vary by device version.

Engine and Android updates do not replace the [maintainer-certified PWA calendar UI contract](maintainer-certified-calendar-ui.md), which records approved month-grid, summary-card, Western Big 3 and Ganzhi-table presentation choices.

The clickable tables open `AstrologyDetails.ts` popups using the parent's existing calculated columns and rendered table, so opening a popup performs no additional horoscope or pillar calculation. Big 3 sign, element and planet details come from the PWA's `Zodiac.ts` catalog. The popup watermarks use the calculated Sun sign or solar Year animal; an unavailable value produces no watermark. `AskAi.ts` opens a user-initiated Google AI-mode search; the astrology query includes the date and time with available signs/pillars and clash animals, with a static `(unspecified location)` note for Big 3 without exposing place names or coordinates.

Built-in events come from the Schema v3 catalog `src/data/khmer-calendar-data-0.5.0.json` (file name carries its `dataVersion`). The repository evaluates that catalog live through the engine — there is no generated date cache to keep fresh. Calendar cells and date details call the engine for lunar dates throughout **1800–2200**. Personal repeats use the app's `EventRepeat.ts` and their saved end date, independently of the catalog. The first day of Khmer New Year (Moha Sangkran) formats its arrival time directly in the event title and header using evidenced times from `newYearArrivals` or the engine's `arrivalEstimate`.

`RecurringEvents.ts` compiles each catalog `rule` (engine-native `RuleInput`, including `monthPolicy: ordinary_or_second_asadh` and `cn-reference-utc8`) through `createRule` once, then evaluates per year. Engine recurrence evaluation uses an **anchor year**, which is not necessarily the year of every returned occurrence. The adapter throws if a rule produces dates outside its anchor year, and the repository skips occurrences from other anchor years; current catalog rules all stay inside the anchor year. A future cross-year rule needs an explicit repository design change.

## Event precedence and provenance

`EventRepository.getYearEvents` builds a year in four passes; personal events form a fifth pass when the displayed range is assembled:

| Pass | Data | Coverage | Behavior |
| --- | --- | --- | --- |
| 1 | Recorded catalog dates (`dates[]`) | Historical milestones | 26 static date-backed events (historical milestones); basis `recorded`. |
| 2 | Engine-evaluated recurrences (113 rules) | 1800–2200, per-rule `fromYear`/`throughYear` | basis `calculated`; historical events are not back-projected before `originalDate`. Catalog `overrides[]` (e.g. King Sihamoni's 3-day birthday 2005–2019, Qingming 2009/2029, Zongzi 2013) are passed to the engine as `EventDateOverride`; overridden occurrences get basis `corrected` and the override's source citation. |
| 3 | Official holiday calendars (`holidayCalendars`) | 2016–2027 | Matched by holiday `id`/`eventId`; a match upgrades the event to kind `HOLIDAY`, basis `official`, applying day-specific names and Sub-Decree citations. Unmatched holiday dates are added directly; `cancelled` entries are skipped. |
| 4 | Buddhist holy days | 1800–2200 | Scanned day-by-day from lunar data; IDs `sil:YYYY-MM-DD`; basis `khmer_lunar`. |
| 5 | Personal events | User-selected dates | Merged afterward; preserve existing IDs, storage keys and instants; basis `custom`. |

Anniversary counts resolve from catalog `{anniversary}` placeholders (English ordinals, Khmer numerals) and events keep their `anniversaryBase` origin year for event details and Ask AI search anchoring. The bundled bilingual knowledge companion `src/data/event-knowledge.json` (one entry per catalog event) powers the Learn more dialog, whose Ask AI action shares the astrology popups' search/external-browser button styling.

Repository events carry `basis: recorded | calculated | corrected | official | khmer_lunar | custom`. Details distinguish calculated observances with the calculated-observance label; official holidays link their government source. The catalog's `sources[]` (government, calendar, historical) drive those citations, and the Sources dialog credits the official government websites (library.ncdd.gov.kh, ocm.gov.kh, nbc.gov.kh) and the shared Khmer Calendar Engine.

The catalog is app-owned data distilled from the reviewed reference-event database, exported via Calendar Data Catalog v0.5.0 and evaluated dynamically by Khmer Calendar Engine. Engine adoption does not certify official holiday coverage beyond the catalog's holiday calendars; calculations do not confirm official leave outside them.

## Updating the event catalog

There is no generator script. To adopt a new dataset release:

1. Replace `src/data/khmer-calendar-data-<version>.json` with the new release (keep the versioned file name) and update the import in `RecurringEvents.ts`.
2. Replace `src/data/event-knowledge.json` in the same change: the knowledge companion must carry exactly one bilingual entry per catalog event, and a unit test enforces that one-to-one coverage.
3. Extend the pinned expectations in `tests/engine-integration.test.mjs` (recorded dates, rule evaluation, overrides, official holiday matching) and the Sources-dialog assertions in `tests/sources.test.mjs`.
4. Run `npm test` for root and GitHub Pages paths. Review calendar corrections against explicit date anchors before changing any expectation.

## Upgrading the dependency

1. Download the intended release archive and `SHA256SUMS` from the engine's release page. Verify the archive before installing. The 0.6.0 archive SHA-256 is `137cc96f96c7511dacbda089da0f53921d689167870712c438095139ab8e7fe8`.
2. Install the exact versioned GitHub release URL with `npm install --save-exact <url>`. Review both package files and the release's API changes.
3. Copy that release's `LICENSE` and `NOTICE` into `public/engine-LICENSE.txt` and `public/engine-NOTICE.txt` **and into `src/legal/`** without removing upstream credits; a test keeps the bundled and served copies byte-identical. Update the app notice/version references where needed.
4. Re-run the full test suite: recurrences are evaluated live, so engine changes surface directly as date differences against the catalog expectations. Review any diff against explicit date anchors.
5. Verify production update, offline reopening and saved events. A dependency update alone does not authorize publishing or a PWA version bump.

The app, engine (including MIT upstream notices) and font license texts are bundled and readable offline in the Sources disclosure. Calculation evidence is maintained in the engine's [references](https://github.com/RSG-KH/khmer-calendar-engine/blob/v0.6.0/docs/references.md); its legacy implementation comparison is a historical migration report. The PWA tests its adapters and data use. Scheduled reminders remain unavailable in this PWA.
