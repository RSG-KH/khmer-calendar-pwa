import { appManifestFile, isApple, type ClientPlatform } from './Platform';

export function applyInstallMetadata(
  language: 'en' | 'km',
  baseUrl = import.meta.env.BASE_URL,
  client: ClientPlatform = navigator,
  doc: Document = document
): void {
  const updateLink = (rel: string, href: string, sizes?: string) => {
    const existing = doc.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    const link = existing ?? doc.createElement('link');
    link.rel = rel;
    if (sizes) link.setAttribute('sizes', sizes);
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    // Set the selected URL before discovery; never insert a fallback manifest.
    if (!existing) doc.head.appendChild(link);
  };

  if (isApple(client)) {
    updateLink('apple-touch-icon', `${baseUrl}icons/apple-touch-icon-white.png`, '180x180');
  } else {
    doc.querySelector('link[rel="apple-touch-icon"]')?.remove();
  }
  updateLink('manifest', `${baseUrl}${appManifestFile(language, client)}`);
}
