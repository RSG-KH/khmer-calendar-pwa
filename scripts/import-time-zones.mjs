import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The versioned text files are also included in IANA's tzdb-2026d archive.
// zone.tab retains a familiar zone name for each country, including aliases
// such as Asia/Phnom_Penh that zone1970.tab groups under Asia/Bangkok.
const version = '2026d';
const base = `https://data.iana.org/time-zones/tzdb-${version}/`;
const expectedHashes = {
  'iso3166.tab': '837c80785080c8433fd9d4ea87e78f161ac7a40389301c5153d4f90198baeb2a',
  'zone.tab': '0718261beed45895d9a215d979febfb35c14fdcaa4fa7eec644401e5471d7b65'
};

async function source(name) {
  const response = await fetch(`${base}${name}`);
  if (!response.ok) throw new Error(`IANA source unavailable: ${name} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== expectedHashes[name]) throw new Error(`Unexpected IANA source checksum: ${name}`);
  return bytes.toString('utf8');
}

const [countriesText, zonesText] = await Promise.all([source('iso3166.tab'), source('zone.tab')]);
const rows = text => text.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
const countries = Object.fromEntries(rows(countriesText).map(line => {
  const [code, name] = line.split('\t');
  return [code, name];
}));
const zones = rows(zonesText).map(line => {
  const [countryCode, , id, comment = ''] = line.split('\t');
  if (!countries[countryCode] || !id) throw new Error(`Invalid IANA zone row: ${line}`);
  return { id, countryCode, ...(comment ? { comment } : {}) };
});
if (zones.length !== 418 || new Set(zones.map(zone => zone.id)).size !== zones.length) {
  throw new Error('Unexpected IANA zone count or duplicate ID');
}
const output = fileURLToPath(new URL('../src/data/time-zones.json', import.meta.url));
await writeFile(output, JSON.stringify({ version, source: base, countries, zones }) + '\n');
console.log(`Imported ${zones.length} IANA time zone choices from tzdb-${version}.`);
