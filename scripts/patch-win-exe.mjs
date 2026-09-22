import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { rcedit } from 'rcedit';

const [exeArg, iconArg] = process.argv.slice(2);

if (!exeArg || !iconArg) {
  console.error('Usage: node scripts/patch-win-exe.mjs <exe> <icon.ico>');
  process.exit(2);
}

const exePath = path.resolve(exeArg);
const iconPath = path.resolve(iconArg);

// Release tags and the Settings version both come from appVersion in the
// tagged checkout's package.json; fall back to the npm version if absent.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const appVersion = pkg.appVersion || pkg.version;

await rcedit(exePath, {
  icon: iconPath,
  'file-version': appVersion,
  'product-version': appVersion,
  'version-string': {
    FileDescription: 'Khmer Calendar',
    ProductName: 'Khmer Calendar',
    CompanyName: 'RSG-KH',
    InternalName: 'Khmer Calendar',
    OriginalFilename: 'Khmer Calendar.exe',
    FileVersion: appVersion,
    ProductVersion: appVersion
  }
});

console.log(`Applied Khmer Calendar icon and version ${appVersion} to: ${exePath}`);
