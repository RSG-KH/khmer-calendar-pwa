<div align="center">

<img src="public/icons/app-logo.png" alt="Khmer Calendar app icon" width="160" />

# Khmer Calendar (PWA)

[![Deploy to GitHub Pages](https://github.com/RSG-KH/khmer-calendar-pwa/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/RSG-KH/khmer-calendar-pwa/actions/workflows/deploy-pages.yml)
[![License: Apache-2.0](https://img.shields.io/github/license/RSG-KH/khmer-calendar-pwa?color=blue)](LICENSE)
[![PWA · offline-first](https://img.shields.io/badge/PWA-offline--first-5a0fc8)](https://rsg-kh.github.io/khmer-calendar-pwa/)
[![Engine 0.3.0](https://img.shields.io/badge/engine-khmer--calendar--engine%200.3.0-2b8a3e)](https://github.com/RSG-KH/khmer-calendar-engine)
[![Catalog 0.4.4](https://img.shields.io/badge/catalog-khmer--calendar--manager%200.4.4-0366d6)](https://github.com/RSG-KH/khmer-calendar-manager)

Khmer lunar dates, Buddhist holy days, Cambodian holidays and your personal events, in Khmer and English. Made for phones, tablets and desktops, with an interface inspired by iOS.

**Free · Ad-free · Zero tracking**

<a href="https://rsg-kh.github.io/khmer-calendar-pwa/">
  <img src=".github/assets/open-calendar.svg" alt="Open Khmer Calendar" width="292" height="56" />
</a>

<br>

Installation: [iPhone / iPad](#install-on-iphone-or-ipad) · [Mac](#install-on-mac) · [Android](#install-on-android) · [Windows](#install-on-windows) · [Linux](#install-on-linux)

</div>

---

## Install on iPhone or iPad

1. Open [Khmer Calendar](https://rsg-kh.github.io/khmer-calendar-pwa/) in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Enable **Open as Web App** if shown, then tap **Add**.
4. Open **Khmer Calendar** from your Home Screen.

## Install on Mac

Requires **macOS 14 or later**.

1. Open [Khmer Calendar](https://rsg-kh.github.io/khmer-calendar-pwa/) in **Safari**.
2. Choose **File → Add to Dock**, then click **Add**.
3. Open **Khmer Calendar** from your Dock.

Need help? See Apple's guides for [iPhone](https://support.apple.com/en-mide/guide/iphone/iphea86e5236/ios), [iPad](https://support.apple.com/en-euro/guide/ipad/ipad8f1f7a29/ipados) and [Mac](https://support.apple.com/en-us/104996).

## Install on Android

For Android phones and tablets:

1. Open [Khmer Calendar](https://rsg-kh.github.io/khmer-calendar-pwa/) in **Chrome**.
2. Tap **⋮ → Install and create shortcut → Install**, then confirm the installation.
3. Open **Khmer Calendar** from your Home Screen or app drawer.

See [Chrome's Android installation guide](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DAndroid) for help with the browser's install menu.

## Install on Windows

1. Open [Khmer Calendar](https://rsg-kh.github.io/khmer-calendar-pwa/) in **Microsoft Edge** or **Chrome**.
2. If the **Install app** icon appears in the address bar, click it and confirm **Install**. Otherwise, use the menu steps below.
3. Open **Khmer Calendar** from the Start menu or its app shortcut. You can pin it to your taskbar.

**If the install icon doesn't appear**, install through your browser's menu:

- [Microsoft Edge](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge): **⋯ → More tools → Apps → Install this site as an app**.
- [Chrome](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop): **⋮ → Cast, save, and share → Install page as app**.

## Install on Linux

1. Open [Khmer Calendar](https://rsg-kh.github.io/khmer-calendar-pwa/) in **Chrome**.
2. Choose **⋮ → Cast, save, and share → Install page as app**, then confirm **Install**. You can also use the install icon in the address bar when shown.
3. Open **Khmer Calendar** from your applications menu or Chrome's app list at `chrome://apps`.

See [Chrome's desktop installation guide](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop) for help managing the app and its shortcuts.

## Good to know

- Works offline after the first full online load in your browser or installed app.
- Browse years **1800–2200**. Recurring observances and holy days are calculated on-device; official public-holiday calendars cover **2016–2027**, and date-backed historical milestones appear at their recorded dates (**1886–2025** in catalog 0.4.4).
- Commemorations show their anniversary count in both languages — ខួបលើកទី៤៧ in Khmer and **· 47th** with English ordinal suffixes.
- Every built-in event carries a curated bilingual knowledge summary: tap an event, then **Learn more**. **Search online** opens your browser on an AI-mode search for that event; it only ever runs when you tap it — the app itself makes no network requests.
- Your events and settings stay on your device. No account or sync; clearing app/site data removes them.
- Personal events can repeat every X days, weekly, monthly or yearly, with a required end date and a preview. Choose how to handle missing month-end or leap-day dates; editing or deleting applies to the whole series.
- To update, tap **Check for update** in Settings. Available updates download and reload automatically; saved events and settings are kept.
- Swipe left or right on the calendar to change months.
- Tap the month to choose a month and year, then **Go**. **This year** changes the draft year and keeps your chosen month.
- In the calendar header, **Today** returns to today's date and reflects selection status dynamically (neutral text when today is selected, and accent highlight when viewing other dates). In the calendar grid, Today stays filled; another selected date has an outline.
- The calendar month card includes an adaptive legend for holidays, Buddhist holy days, observances, and personal events.
- Settings includes background tint, Light/Dark choices, longer weekday names, weekday colors and Western zodiac signs.
- Scheduled reminders are not available in PWA mode.

You can also use the calendar directly in your browser without installing it.

## About the project

This is the web version of [Khmer Calendar for Android](https://github.com/RSG-KH/khmer-calendar). Both apps use [Khmer Calendar Engine](https://github.com/RSG-KH/khmer-calendar-engine) for calendar calculations. Calendar algorithms, source references and validation are documented in the [engine project](https://github.com/RSG-KH/khmer-calendar-engine#verification-and-accuracy).

For setup, testing and hosting, see [DEVELOPMENT.md](DEVELOPMENT.md). Dependency updates and cache generation are covered in the [engine integration guide](docs/shared-engine.md).

## License

[Apache-2.0](LICENSE), with [calendar attribution](public/NOTICE.txt), the engine's [license](public/engine-LICENSE.txt) and [upstream notices](public/engine-NOTICE.txt), and the font's [SIL Open Font License](public/fonts/OFL.txt). Also available offline in **Settings → Calendar sources & licenses**.
