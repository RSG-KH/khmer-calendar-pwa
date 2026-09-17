import type { AppSettings, ThemeMode, AccentColor } from '../data/Storage';

export function effectiveTheme(theme: ThemeMode, systemDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

const darkBackgrounds: Record<AccentColor, string> = {
  blue: '#0A0F18', lavender: '#0D0D18', rose: '#110D14', amber: '#110F0F', lime: '#0A120D'
};

export function appearanceBackground(settings: Pick<AppSettings, 'accent' | 'backgroundAccent'>, dark: boolean, lightAccent: string): string {
  if (!settings.backgroundAccent) return dark ? '#000000' : '#F2F2F7';
  if (dark) return darkBackgrounds[settings.accent];
  // The light accent comes from the stylesheet, keeping control/background colors in sync.
  const base = [242, 242, 247];
  const rgb = lightAccent.trim().match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!rgb) return '#F2F2F7';
  return '#' + base.map((channel, i) => Math.round(channel * .9 + parseInt(rgb[i + 1], 16) * .1)
    .toString(16).padStart(2, '0')).join('');
}
