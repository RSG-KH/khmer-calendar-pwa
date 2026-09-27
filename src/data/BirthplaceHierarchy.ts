// Copyright (c) 2026 RSG-KH | Apache-2.0 License

export interface BirthplaceChoice<T> {
  key: string;
  label: string;
  displayPath?: string;
  detail?: string;
  aliases: string[];
  value: T;
}

export function countryChoices<T extends { code: string; name: string }>(countries: T[], khmer: boolean): BirthplaceChoice<T>[] {
  let localized: Intl.DisplayNames | undefined;
  try { localized = new Intl.DisplayNames([khmer ? 'km' : 'en'], { type: 'region' }); }
  catch { /* Retain bundled country names when locale display names are unavailable. */ }
  return countries.map(country => {
    const display = localized?.of(country.code);
    const label = display && display !== country.code ? display : country.name;
    return { key: country.code, label, detail: label === country.name ? undefined : country.name,
      aliases: [country.name, country.code], value: country };
  }).sort((a, b) => a.label.localeCompare(b.label, khmer ? 'km' : 'en'));
}

export function birthplaceStepLabel(countryCode: string, khmer: boolean): string {
  if (countryCode === 'KH') return khmer ? 'រាជធានី / ខេត្ត' : 'Capital / province';
  return khmer ? 'តំបន់រដ្ឋបាល' : 'Administrative area';
}
