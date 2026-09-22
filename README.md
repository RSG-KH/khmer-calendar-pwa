# `win7-portable` tooling branch

This branch is intentionally an **orphan tooling branch**. It does not contain
the PWA source tree.

The release workflow on `main` checks out:

1. the exact GitHub Release tag into `app/`;
2. this branch into `win7-kit/`.

It then runs `scripts/apply-win7.ps1`, which overlays the Electron compatibility
files onto the tagged PWA source and makes one small service-worker guard patch.

## Files

- `electron/main.cjs` — offline Electron shell and permission policy.
- `electron/desktop-overrides.css` — Chromium 108 visual compatibility fixes.
- `electron/legacy-watermark.js` — SVG fallback for masked zodiac watermarks.
- `electron-builder.win7.cjs` — pinned Electron 22 packaging config.
- `scripts/apply-win7.ps1` — overlays this kit onto a clean tagged PWA checkout.
- `scripts/build-win7-release.ps1` — builds x64 and ia32 portable ZIPs.
- `scripts/make-win-icon.ps1` — creates a multi-resolution `.ico`.
- `scripts/patch-win-exe.mjs` — applies desktop icon/Windows EXE metadata.

## Important pins

- Electron `22.3.27`
- electron-builder `24.13.3`
- rcedit `5.0.2`

Electron 22 is intentionally pinned because Electron 23+ dropped Windows 7
support.

Do not run `npm audit fix --force` as part of this tooling branch. The desktop
runtime is intentionally legacy and compatibility-pinned.

## When this branch changes

Normal PWA releases do **not** require a merge into this branch.

Change this branch only when:

- a new Windows 7 / Chromium 108 compatibility fix is needed;
- packaging logic changes;
- the tiny `src/main.ts` patch no longer matches upstream;
- the desktop wrapper itself changes.
