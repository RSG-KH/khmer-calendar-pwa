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

// Native mobile pickers work well. Desktop time popups vary by browser/locale,
// so use the app's 24-hour controls there, including on touch-enabled Windows.
export function prefersNativeTimePicker(client: ClientPlatform = navigator): boolean {
  const agent = client.userAgent ?? '';
  const platform = client.userAgentData?.platform || client.platform || '';
  return /iPhone|iPad|iPod|Android/i.test(agent)
    || /^(iOS|Android)$/i.test(platform)
    // iPadOS in desktop mode reports a Mac platform and multiple touch points.
    || (/Mac/i.test(platform) && (client.maxTouchPoints ?? 0) > 1);
}
