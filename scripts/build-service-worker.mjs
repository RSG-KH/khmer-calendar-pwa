import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const outputDir = fileURLToPath(new URL('../dist/', import.meta.url));
const template = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listFiles(resolve(directory, entry.name), `${relativePath}/`));
    } else if (entry.isFile() && relativePath !== 'sw.js') {
      files.push(relativePath);
    }
  }
  return files;
}

// Include hashed JS/CSS and every public asset, even artwork not yet viewed.
const files = (await listFiles(outputDir)).sort();
const hash = createHash('sha256').update(template);
for (const file of files) {
  hash.update(file).update(await readFile(resolve(outputDir, file)));
}
const version = hash.digest('hex').slice(0, 16);
const worker = template
  .replace('__BUILD_VERSION__', version)
  .replace('/* __PRECACHE_ASSETS__ */ []', JSON.stringify(files));

await writeFile(resolve(outputDir, 'sw.js'), worker);
console.log(`Service worker: precached ${files.length} files (${version}).`);
