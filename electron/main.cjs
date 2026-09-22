'use strict';

const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_PROTOCOL = 'khmer-calendar';
const APP_ID = 'kh.rsg.khmercalendar.win7';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

app.setAppUserModelId(APP_ID);

// Keep settings and personal events beside the executable for true portability.
// electron-builder's single-file portable target provides PORTABLE_EXECUTABLE_DIR.
// For the recommended zipped "dir" build, process.execPath points into the
// unzipped application folder.
if (app.isPackaged) {
  const portableRoot =
    process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);

  app.setPath('userData', path.join(portableRoot, 'KhmerCalendarData'));
}

function isTrustedAppUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === `${APP_PROTOCOL}:` && url.hostname === 'app';
  } catch {
    return false;
  }
}

function registerLocalProtocol() {
  const distRoot = path.join(app.getAppPath(), 'dist');

  protocol.registerFileProtocol(APP_PROTOCOL, (request, callback) => {
    try {
      const url = new URL(request.url);
      let relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');

      if (!relativePath || relativePath.endsWith('/')) {
        relativePath += 'index.html';
      }

      const requestedPath = path.resolve(distRoot, relativePath);
      const allowedPrefix = distRoot.endsWith(path.sep)
        ? distRoot
        : distRoot + path.sep;

      if (
        requestedPath !== distRoot &&
        !requestedPath.startsWith(allowedPrefix)
      ) {
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      callback({ path: requestedPath });
    } catch {
      callback({ error: -6 });
    }
  });
}

function configurePermissions() {
  const ses = session.defaultSession;

  // The PWA uses navigator.clipboard.writeText(). Chromium asks Electron for
  // "clipboard-sanitized-write". Allow that one permission only for our local
  // application origin; keep camera, microphone, geolocation, etc. denied.
  ses.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl =
        (details && details.requestingUrl) ||
        (webContents && !webContents.isDestroyed()
          ? webContents.getURL()
          : '');

      callback(
        permission === 'clipboard-sanitized-write' &&
        isTrustedAppUrl(requestingUrl)
      );
    }
  );

  // Electron recommends implementing both the check and request handlers for
  // complete permission handling.
  ses.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      const requestingUrl =
        (details && details.requestingUrl) ||
        (webContents && !webContents.isDestroyed()
          ? webContents.getURL()
          : '') ||
        requestingOrigin ||
        '';

      return (
        permission === 'clipboard-sanitized-write' &&
        isTrustedAppUrl(requestingUrl)
      );
    }
  );
}

function installDesktopCss(win) {
  const cssFile = path.join(
    app.getAppPath(),
    'electron',
    'desktop-overrides.css'
  );

  let css;

  try {
    css = fs.readFileSync(cssFile, 'utf8');
  } catch (error) {
    console.error('Could not load desktop-overrides.css:', error);
    return;
  }

  win.webContents.on('dom-ready', () => {
    Promise.resolve(win.webContents.insertCSS(css)).catch((error) => {
      console.error('Could not apply desktop CSS overrides:', error);
    });
  });
}

function createWindow() {
  const windowIcon = path.join(
    app.getAppPath(),
    'dist',
    'icons',
    'app-icon-desktop-512.png'
  );

  const win = new BrowserWindow({
    title: 'Khmer Calendar',
    icon: windowIcon,
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 520,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  // This old Chromium runtime is only a shell for the local calendar.
  // Never let calendar content turn it into a general-purpose web browser.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isTrustedAppUrl(targetUrl)) {
      event.preventDefault();
    }
  });

  installDesktopCss(win);

  // Run the legacy zodiac compatibility layer in the page's main world.
  // This is intentionally separate from preload/context isolation so it sees
  // the same DOM, CSS variables and custom-protocol image origin as the app.
  const legacyWatermarkScript = fs.readFileSync(
    path.join(app.getAppPath(), 'electron', 'legacy-watermark.js'),
    'utf8'
  );

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(
      legacyWatermarkScript,
      true
    ).catch((error) => {
      console.error('Could not install zodiac watermark fallback:', error);
    });
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(`${APP_PROTOCOL}://app/index.html`);
}

app.whenReady().then(() => {
  registerLocalProtocol();
  configurePermissions();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
