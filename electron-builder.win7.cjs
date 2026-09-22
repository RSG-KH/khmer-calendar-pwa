'use strict';

module.exports = {
  appId: 'kh.rsg.khmercalendar.win7',
  productName: 'Khmer Calendar',

  // Keep this pinned. Electron 23+ does not support Windows 7.
  electronVersion: '22.3.27',

  asar: true,
  compression: 'normal',

  directories: {
    output: 'release-win7'
  },

  files: [
    'dist/**/*',
    'electron/**/*',
    'package.json'
  ],

  // Avoid changing the web project's package.json just to add an Electron entry.
  extraMetadata: {
    main: 'electron/main.cjs'
  },

  win: {
    target: 'dir',

    // This build is intentionally unsigned and offline-only.
    // electron-builder 24.13.3 otherwise downloads/extracts winCodeSign
    // to edit/sign the EXE. On Windows systems without symlink privileges,
    // that helper can fail while extracting macOS dylib symlinks.
    // Disabling EXE resource editing avoids winCodeSign entirely.
    signAndEditExecutable: false
  }
};
