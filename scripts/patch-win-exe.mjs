import path from 'node:path';
import process from 'node:process';
import { rcedit } from 'rcedit';

const [exeArg, iconArg] = process.argv.slice(2);

if (!exeArg || !iconArg) {
  console.error('Usage: node scripts/patch-win-exe.mjs <exe> <icon.ico>');
  process.exit(2);
}

const exePath = path.resolve(exeArg);
const iconPath = path.resolve(iconArg);

await rcedit(exePath, {
  icon: iconPath,
  'version-string': {
    FileDescription: 'Khmer Calendar',
    ProductName: 'Khmer Calendar',
    CompanyName: 'RSG-KH',
    InternalName: 'Khmer Calendar',
    OriginalFilename: 'Khmer Calendar.exe'
  }
});

console.log(`Applied Khmer Calendar icon to: ${exePath}`);
