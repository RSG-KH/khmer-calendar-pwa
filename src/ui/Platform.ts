export interface ClientPlatform {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; mobile?: boolean };
}

export function isAndroid(client: ClientPlatform = navigator): boolean {
  return /Android/i.test(client.userAgentData?.platform ?? '')
    || /Android/i.test(client.userAgent ?? '');
}

export function appManifestFile(language: 'en' | 'km', client: ClientPlatform = navigator): string {
  // Preserve Android's original manifest URLs and artwork for existing installs.
  // Check Android first: its platform/user agent can also contain Linux.
  const platform = client.userAgentData?.platform || client.platform || client.userAgent || '';
  const iconVariant = isAndroid(client) ? ''
    : !isApple(client) && /Win|Linux/i.test(platform) ? '.desktop' : '.white';
  return `manifest${iconVariant}${language === 'km' ? '.km' : ''}.webmanifest`;
}

export function isApple(client: ClientPlatform = navigator): boolean {
  const platform = client.userAgentData?.platform || client.platform || '';
  return /Mac|iPhone|iPad|iPod|iOS/i.test(platform)
    || /Macintosh|iPhone|iPad|iPod/i.test(client.userAgent ?? '');
}

// Android and Apple already hide overlay scrollbars without taking layout space.
export function prefersNativeScrollbars(client: ClientPlatform = navigator): boolean {
  return isApple(client) || isAndroid(client);
}

// Keep device-specific choices stable when rotating or resizing the app.
export type FontScale = 0.8 | 0.9 | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5;

export function isPhone(client: ClientPlatform = navigator): boolean {
  const agent = client.userAgent ?? '';
  const platform = client.userAgentData?.platform || client.platform || '';
  if (/iPhone|iPod|Windows Phone/i.test(agent)) return true;
  if (/iPad/i.test(agent) || (/Mac/i.test(platform) && (client.maxTouchPoints ?? 0) > 1)) return false;
  return client.userAgentData?.mobile ?? /Android.*Mobile/i.test(agent);
}

// Tablets and big screens default to 120% font size; phones stay at 100%.
export function defaultFontScale(client: ClientPlatform = navigator): FontScale {
  return isPhone(client) ? 1.0 : 1.2;
}

// Every device offers the full picker range, matching the Android app's
// in-app font sizes; only the default differs by device.
export function fontScaleOptions(): FontScale[] {
  return [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
}

// Keep the native iOS/iPadOS picker. Android and desktop popups can use AM/PM
// despite the app's 24-hour label, so use our explicit hour/minute controls there.
export function prefersNativeTimePicker(client: ClientPlatform = navigator): boolean {
  const agent = client.userAgent ?? '';
  const platform = client.userAgentData?.platform || client.platform || '';
  return /iPhone|iPad|iPod/i.test(agent)
    || /^iOS$/i.test(platform)
    // iPadOS in desktop mode reports a Mac platform and multiple touch points.
    || (/Mac/i.test(platform) && (client.maxTouchPoints ?? 0) > 1);
}
