interface ClientPlatform {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string };
}

export function isWindows(client: ClientPlatform = navigator): boolean {
  const platform = client.userAgentData?.platform || client.platform || '';
  return /^Win/i.test(platform) || /Windows/i.test(client.userAgent ?? '');
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
