interface ClientPlatform {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; mobile?: boolean };
}

export function isApple(client: ClientPlatform = navigator): boolean {
  const platform = client.userAgentData?.platform || client.platform || '';
  return /Mac|iPhone|iPad|iPod|iOS/i.test(platform)
    || /Macintosh|iPhone|iPad|iPod/i.test(client.userAgent ?? '');
}

// Android and Apple already hide overlay scrollbars without taking layout space.
export function prefersNativeScrollbars(client: ClientPlatform = navigator): boolean {
  return isApple(client)
    || /Android/i.test(client.userAgentData?.platform ?? '')
    || /Android/i.test(client.userAgent ?? '');
}

// Keep device-specific choices stable when rotating or resizing the app.
export function isPhone(client: ClientPlatform = navigator): boolean {
  const agent = client.userAgent ?? '';
  const platform = client.userAgentData?.platform || client.platform || '';
  if (/iPhone|iPod|Windows Phone/i.test(agent)) return true;
  if (/iPad/i.test(agent) || (/Mac/i.test(platform) && (client.maxTouchPoints ?? 0) > 1)) return false;
  return client.userAgentData?.mobile ?? /Android.*Mobile/i.test(agent);
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
