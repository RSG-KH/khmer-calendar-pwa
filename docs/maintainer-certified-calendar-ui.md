# Maintainer-certified PWA calendar UI

**Status: MAINTAINER PREFERRED AND CERTIFIED — 23 September 2026.** The maintainer approved the PWA layout choices below. This certification is the UI contract for later Android-to-PWA syncs; it does not certify calendar calculations or substitute for physical-device testing.

Android remains a reference for applicable behavior and shared calculations. Its native layout is not authority to replace these PWA choices. Preserve the values, breakpoint conditions, ordering and toggle behavior below during a sync. Change this contract only when the maintainer explicitly requests a new PWA UI decision, and update the implementation and this document together.

## Month grid row heights

`src/main.ts` sets `data-phone` on the root from `isPhone()` in `src/ui/Platform.ts`. Heights below are the CSS values **before** multiplication by `--font-scale` (the app supports 80%–150%). Orientation and viewport breakpoints are CSS media queries. The 2px gap between grid cells is separate from row height.

| Device class | Orientation and viewport | `.cal-cell` height | Source |
| --- | --- | ---: | --- |
| Phone (`data-phone`) | Portrait | **52px × font scale** | `responsive.css` phone portrait rule |
| Phone (`data-phone`) | Landscape, viewport height 600px or more | **62px × font scale** | `responsive.css` landscape rule |
| Phone (`data-phone`) | Landscape, viewport height 599px or less | **47px × font scale** | `responsive.css` short landscape rule |
| Non-phone | Portrait | **56px × font scale** | `components.css` base rule |
| Non-phone | Landscape, viewport width 740px or more and height 600px or more | **50px × font scale** | `responsive.css` tablet/desktop rule |
| Non-phone | Landscape, viewport width 740px or more and height 599px or less | **40px × font scale** | `responsive.css` compact tablet/desktop rule |
| Non-phone | Landscape, viewport width below 740px and height 600px or more | **62px × font scale** | Landscape fallback rule |
| Non-phone | Landscape, viewport width below 740px and height 599px or less | **47px × font scale** | Short landscape fallback rule |

The 50px and 40px overrides deliberately exclude `data-phone`, even when a phone's landscape viewport is 740px wide or wider. In the compact non-phone layout (width at least 740px, landscape, height at most 599px), `appearance.css` also uses 1.1 line height for the day and lunar labels, zero extra top margin on the lunar label, and a 5px event-mark row with zero top margin. Holiday, observance and personal markers are 5px; the holy-day triangle has 3px sides and a 5px bottom; the personal star uses 1.2 scale. These compact-only adjustments keep content inside the 40px row, including at 80% text size. Do not carry them into phone layouts.

## Date summary card

The summary card appears only in landscape at viewport width **960px or more** and height **600px or more**. Its right side presents the Gregorian date, optional Western zodiac, then optional Ganzhi line in that order.

| Element | Certified behavior |
| --- | --- |
| Western zodiac | Controlled by `showWesternZodiac`; English sign, element and planet; 11px × font scale, one line. |
| Ganzhi | Controlled independently by `showGanzhi`; always emoji regardless of `useEmojiForGanzhiAnimals`; year, month and day sign animals followed by their three clash animals. Exact format: `☯️ 干支 (🐴🐔🐭 x 🐭🐰🐴)` for 11 September 2026. Omit the line when year/month pillars are unavailable outside 1900–2100. |
| Right column | Sizes to its content instead of a fixed 40% width; zodiac and Ganzhi stay on one line. |
| Narrow landscape card | At 960–1159px viewport width, stack the date/zodiac/Ganzhi side below the full Khmer date and align it left. At 1160px and above, keep the two sides beside one another. |

The Gregorian date is 13px × font scale; zodiac and Ganzhi use 11px × font scale. These are summary-card choices, not instructions to alter the date-details dialog. `src/domain/Ganzhi.ts` supplies the compact emoji sequence from the same pillars used by the dialog. The Ganzhi animal setting subtitle matches Android: **“Choose between Emoji and name”** / **“ជ្រើសរើសរវាង Emoji និងឈ្មោះ”**. That choice applies only to the date-details table; the summary always uses emoji.

## Date-details Ganzhi and Western Big 3 tables

When `showGanzhi` is on, the dialog table has columns **year, month, day**, plus **hour only for Today** in the selected Today time zone. The first column header is **`☯️ 干支`**, above the sign and clash row labels. It is not a separate caption. The first header cell has zero left padding so its 24px symbol slot and label align with the lotus and Western Big 3 rows. The table has `aria-label="干支"` and can scroll horizontally in a narrow dialog.

When `showWesternZodiac` is on, the dialog renders the Western Zodiac Big 3 table replacing the former single text line. The table has columns **Sun, Moon**, plus **Rising sign only for Today** in the selected Today time zone. The first column header is **`☸️ Big 3`**, above the single body row **`Sign`**. `useEmojiForWesternZodiac` toggles between localized sign names (`false`) and standard emoji symbols (`true`). The first header cell has zero left padding so its 24px symbol slot aligns with the lotus and Ganzhi headings.

| Element | Certified behavior |
| --- | --- |
| Symbol rows | Lotus, Western Big 3 (☸️) and Ganzhi (☯️) use a shared 24px-wide symbol slot and a 6px text gap. The lotus image is 20px; symbol emoji are 15px × font scale. |
| Table text | Base table text is 12px × font scale. Named signs/animals follow `false`; emoji signs/animals follow `true`. Emoji cells are 19px × font scale. |
| Ganzhi columns | Year/month/day (and conditional Today hour) use the same engine pillars for the sign and opposing clash rows. Header/data cells have a 52px minimum width; the first header column has a 65px minimum. |
| Western Big 3 columns | Sun/Moon (and conditional Today Rising sign) computed via `calculateHoroscope`. First header is `☸️ Big 3`; body row is `Sign`. |
| Unsupported solar years | Outside 1900–2100, Ganzhi year and month cells display em dashes and the range note appears; the day pillar remains available. The summary line is omitted because it requires all three animals. |

The Earthly Branch emoji sequence, indexed from Rat through Pig, is **`🐭 🐮 🐯 🐰 🐲 🐍 🐴 🐐 🐵 🐔 🐶 🐷`**. The Western Zodiac emoji sequence, indexed from Aries through Pisces, is **`♈️ ♉️ ♊️ ♋️ ♌️ ♍️ ♎️ ♏️ ♐️ ♑️ ♒️ ♓️`**. Use each engine pillar's `branch` for the sign row and `clashBranch` for the clash row. The summary concatenates the three emojis in year–month–day order without spaces inside either group and uses the literal separator ` x `.

## Sync and review rule

During an Android release sync, compare new calculations, data, settings and user-visible behavior for applicability, but **do not replace these certified PWA dimensions or table/summary presentation simply to match Android Compose sizing or placement**. If an Android change conflicts with this contract, record the difference and preserve the PWA behavior until the maintainer requests a revision.

Before accepting a UI change here, review phone portrait and landscape, tablet/desktop landscape including a short window, 80% and 150% text size, both Ganzhi and Western emoji settings, the `showGanzhi` and `showWesternZodiac` switches, and an out-of-range solar year. Run `npm test` for calculation/settings regressions and inspect the affected layouts in a browser or device preview.

Implementation anchors: `src/styles/responsive.css`, `src/styles/appearance.css`, `src/styles/components.css`, `src/main.ts`, `src/ui/Modals.ts`, `src/domain/Ganzhi.ts`, `src/domain/WesternZodiac.ts`, and `src/ui/Platform.ts`.
