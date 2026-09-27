// Copyright (c) 2026 RSG-KH | Apache-2.0 License

// Latitude and longitude can be entered as decimal degrees, DMS, or decimal minutes.
const decimal = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const decimalToken = new RegExp('^' + decimal + '$');
const positiveToken = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
const decimalPair = new RegExp('^\\s*(' + decimal + ')\\s+(' + decimal + ')\\s*$');

export function parseCoordinate(raw: string, axis: 'latitude' | 'longitude'): number | null {
  let text = raw.trim().replace(/\u2212/g, '-').toUpperCase();
  if (!text) return null;
  const prefix = /^([NSEW])\s*/.exec(text);
  if (prefix) text = text.slice(prefix[0].length);
  const suffix = /\s*([NSEW])$/.exec(text);
  if (suffix) text = text.slice(0, -suffix[0].length);
  if (prefix && suffix) return null;
  const direction = prefix?.[1] ?? suffix?.[1];
  if (direction && /^[+-]/.test(text.trim())) return null;
  if (direction && (axis === 'latitude' ? !/[NS]/.test(direction) : !/[EW]/.test(direction))) return null;

  const parts = text.replace(/[°º˚'′’‘"″“”:]/g, ' ').trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 3 || !decimalToken.test(parts[0]) ||
      (parts.length > 1 && (!/^[+-]?\d+$/.test(parts[0]) || !positiveToken.test(parts[1]))) ||
      (parts.length > 2 && (!/^\d+$/.test(parts[1]) || !positiveToken.test(parts[2])))) return null;
  const degrees = Number(parts[0]);
  const minutes = parts.length > 1 ? Number(parts[1]) : 0;
  const seconds = parts.length > 2 ? Number(parts[2]) : 0;
  if (minutes >= 60 || seconds >= 60) return null;
  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  if (!Number.isFinite(magnitude) || magnitude > (axis === 'latitude' ? 90 : 180)) return null;
  const negative = direction ? /[SW]/.test(direction) : parts[0].startsWith('-');
  const value = (negative ? -1 : 1) * magnitude;
  return parts.length === 1 ? value : Number(value.toFixed(9));
}

function parseParts(first: string, second: string): { latitude: number; longitude: number } | null {
  const latitude = parseCoordinate(first, 'latitude');
  const longitude = parseCoordinate(second, 'longitude');
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  if (!/(?:^[EW]\s*|\s*[EW]$)/i.test(first) ||
      !/(?:^[NS]\s*|\s*[NS]$)/i.test(second)) return null;
  const reversedLatitude = parseCoordinate(second, 'latitude');
  const reversedLongitude = parseCoordinate(first, 'longitude');
  return reversedLatitude !== null && reversedLongitude !== null
    ? { latitude: reversedLatitude, longitude: reversedLongitude } : null;
}

export function parseCoordinatePair(raw: string): { latitude: number; longitude: number } | null {
  const text = raw.trim();
  const separated = text.split(/\s*[,/]\s*/);
  if (separated.length === 2) return parseParts(separated[0], separated[1]);
  if (separated.length > 2) return null;
  const withDirections = /^(.+?[NS])\s+(.+?[EW])$/i.exec(text) ??
    /^(.+?[EW])\s+(.+?[NS])$/i.exec(text) ??
    /^([NS]\s*.+?)\s+([EW]\s*.+)$/i.exec(text) ??
    /^([EW]\s*.+?)\s+([NS]\s*.+)$/i.exec(text);
  if (withDirections) return parseParts(withDirections[1], withDirections[2]);
  const plain = decimalPair.exec(text);
  return plain ? parseParts(plain[1], plain[2]) : null;
}
