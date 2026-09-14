import { AppSettings, FontScale } from '../data/Storage';
import { L } from '../data/i18n';
import { TodayTimeZone, localOffsetLabel } from '../domain/DateTime';
import { settingsPicker, setupSettingsPickers } from './SettingsPicker';
import { showCalendarSources } from './Sources';
import { appVersion as version } from '../../package.json';
import { AppUpdater, AppUpdateState } from './AppUpdater';
import { isPhone } from './Platform';

export function renderSettings(container: HTMLElement, settings: AppSettings, onChange: (settings: AppSettings) => void, updater: AppUpdater) {
  const k = settings.language === 'km';
  const text = (key: string) => L.text(key, k);
  const fontScales: FontScale[] = isPhone() ? [0.8, 0.9, 1, 1.1, 1.2] : [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
  // Preserve a saved larger selection if the browser switches out of desktop mode.
  if (!fontScales.includes(settings.fontScale)) fontScales.push(settings.fontScale);
  const installUrl = 'https://rsg-kh.github.io/khmer-calendar-pwa/';
  const installLink = `<a class="about-install-link" href="${installUrl}" target="_blank" rel="noopener noreferrer">${text('app.name')}</a>`;
  const toggle = (key: 'mondayFirst' | 'highlightSunday' | 'showLunar' | 'holyDayMarkers' | 'showHolyDaysInEvents', title: string, subtitle: string) => `
    <label class="settings-row" for="setting-${key}">
      <span class="settings-text-col"><span class="settings-title">${text(title)}</span><span class="settings-subtitle">${text(subtitle)}</span></span>
      <input class="settings-switch" type="checkbox" role="switch" id="setting-${key}" data-setting="${key}" ${settings[key] ? 'checked' : ''} />
    </label>`;

  container.innerHTML = `
    <div class="settings-container">
      <h2 class="section-label">${text('ui.appearance.23e609')}</h2>
      <section class="settings-card">
        <div class="settings-row">
          <span class="settings-title">${text('ui.language.b03320')}</span>
          <div class="choice-pill-group" role="group" aria-label="${text('ui.language.b03320')}">
            <button class="choice-pill ${k ? 'active' : ''}" data-lang="km" aria-pressed="${k}">${text('language.khmer')}</button>
            <button class="choice-pill ${!k ? 'active' : ''}" data-lang="en" aria-pressed="${!k}">${text('language.english')}</button>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-title" id="font-scale-label" for="font-scale">${k ? 'ទំហំអក្សរ' : 'Font size'}</label>
          ${settingsPicker('font-scale', String(settings.fontScale), fontScales.map(scale => [String(scale), `${Math.round(scale * 100)}%`]))}
        </div>
        <div class="settings-row">
          <label class="settings-title" id="theme-mode-label" for="theme-mode">${text('ui.theme.99ca72')}</label>
          ${settingsPicker('theme-mode', settings.theme, [['system', 'ui.system.8f97a4'], ['light', 'ui.light.aa790e'], ['dark', 'ui.dark.4ae267']].map(([value, label]) => [value, text(label)]))}
        </div>
        <div class="settings-row">
          <span class="settings-title">${k ? 'ពណ៌លម្អ' : 'Accent color'}</span>
          <div class="accent-circles-row" role="group" aria-label="${k ? 'ពណ៌លម្អ' : 'Accent color'}">
            ${[['blue', 'ui.blue.cf6f1f'], ['lavender', 'ui.lavender.b7c95a'], ['rose', 'ui.rose.ea1e14'], ['amber', 'ui.amber.195385'], ['lime', 'ui.lime.46ea65']].map(([accent, key]) => `<button class="accent-btn ${settings.accent === accent ? 'active' : ''}" data-accent="${accent}" style="--swatch: var(--accent-${accent}-light)" aria-label="${text(key)}" aria-pressed="${settings.accent === accent}"></button>`).join('')}
          </div>
        </div>
      </section>
      <h2 class="section-label">${k ? 'តំបន់ម៉ោង' : 'Time zone'}</h2>
      <section class="settings-card">
        <div class="settings-row">
          <span class="settings-text-col"><label class="settings-title" id="today-zone-label" for="today-zone">${text('ui.today_follows.b52168')}</label><span class="settings-subtitle">${k ? 'កាលបរិច្ឆេទ និងពេលវេលាព្រឹត្តិការណ៍' : 'Dates and event times'}</span></span>
          ${settingsPicker('today-zone', settings.todayTimeZone, [['local', `${text('ui.local_time.541b44')} (${localOffsetLabel()})`], ['cambodia', text('ui.cambodia_utc_7.458037')]])}
        </div>
      </section>
      <h2 class="section-label">${text('ui.calendar.beb873')}</h2>
      <section class="settings-card">
        ${toggle('mondayFirst', 'ui.start_week_on_monday.5578c3', 'ui.sunday_when_turned_off.e40816')}
        ${toggle('highlightSunday', 'ui.highlight_sunday_column.549462', 'ui.show_sundays_in_red_like_holidays.245681')}
        ${toggle('showLunar', 'ui.lunar_dates_in_calendar.4dffed', 'ui.koeut_and_roach_under_each_date.f23bd7')}
        ${toggle('holyDayMarkers', 'ui.buddhist_holy_days_in_calendar.d1e9b6', 'ui.show_lotus_markers_and_holy_days.c9d0bc')}
        ${toggle('showHolyDaysInEvents', 'ui.buddhist_holy_days_in_events.53e502', 'ui.show_in_the_events_list_and_filters.425758')}
      </section>
      <h2 class="section-label">${k ? 'ការជូនដំណឹង' : 'Notifications'}</h2>
      <section class="settings-card"><div class="settings-row">
        <span class="settings-text-col"><span class="settings-title">${k ? 'ការរំលឹកព្រឹត្តិការណ៍' : 'Event reminders'}</span><span class="settings-subtitle">${k ? 'ការរំលឹកតាមកាលវិភាគមិនដំណើរការលើ PWA ទេ។' : 'Scheduled reminders are not available in PWA mode.'}</span></span>
      </div></section>
      <h2 class="section-label">${text('ui.for_everyone.b68901')}</h2>
      <section class="settings-card about-card">
        <h3 class="settings-title">${text('ui.free_ad_free_yours.885c91')}</h3>
        <p class="settings-subtitle">${k ? 'មិនត្រូវការគណនី មិនប្រមូលទិន្នន័យ។ មានតែប្រតិទិនរបស់អ្នក និងថ្ងៃសំខាន់ៗ។ អាចប្រើក្រៅបណ្ដាញបាន បន្ទាប់ពីបើកប្រើលើកដំបូងជាមួយអ៊ីនធឺណិត និងរង់ចាំឱ្យផ្ទុកពេញលេញ។' : 'No account, no data collection. Just your calendar and the dates that matter. Works offline after the first full online load.'}</p>
        <p class="settings-subtitle">${k ? `ដើម្បីដំឡើង សូមបើក ${installLink} ក្នុង Safari រួចជ្រើសរើស “Add to Home Screen” (iOS/iPadOS) ឬ “Add to Dock” (macOS 14+) ហើយជាចុងក្រោយ បើកកម្មវិធី ${text('app.name')} ពី Home Screen ឬ Dock។` : `To install, open ${installLink} in Safari and choose “Add to Home Screen” (iOS/iPadOS) or “Add to Dock” (macOS 14+), and finally, open ${text('app.name')} from the Home Screen or Dock.`}</p>
        <button class="about-sources">${text('ui.calendar_sources_licenses.c2bdb3')}</button>
        <div class="about-credits settings-subtitle">
          <p>RSG-KH · ${text('app.name')} (PWA)<br>${L.text('about.version', k, { version })}</p>
          <div class="about-repo-links">
            <a href="https://github.com/RSG-KH/khmer-calendar-pwa" target="_blank" rel="noopener noreferrer">PWA · RSG-KH/khmer-calendar-pwa</a>
            <a href="https://github.com/RSG-KH/khmer-calendar" target="_blank" rel="noopener noreferrer">Android · RSG-KH/khmer-calendar</a>
          </div>
        </div>
        <div class="app-update-controls">
          <button type="button" class="about-update" aria-live="polite"></button>
          <p class="app-update-status settings-subtitle" role="status"></p>
        </div>
      </section>
    </div>`;

  const update = (patch: Partial<AppSettings>) => onChange({ ...settings, ...patch });
  const updateButton = container.querySelector<HTMLButtonElement>('.about-update')!;
  const updateStatus = container.querySelector<HTMLElement>('.app-update-status')!;
  const messages: Record<AppUpdateState, string> = {
    idle: '',
    checking: k ? 'កំពុងពិនិត្យរកកំណែថ្មី…' : 'Checking for updates…',
    downloading: k ? 'កំពុងទាញយកកំណែថ្មី…' : 'Downloading the latest version…',
    current: '',
    updated: '',
    offline: k ? 'សូមភ្ជាប់អ៊ីនធឺណិតដើម្បីពិនិត្យរកកំណែថ្មី។' : 'Connect to the internet to check for updates.',
    error: k ? 'មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ។ សូមព្យាយាមម្ដងទៀត។' : 'Could not update the app. Please try again.',
    updating: k ? 'កំពុងធ្វើបច្ចុប្បន្នភាព និងបើកកម្មវិធីឡើងវិញ…' : 'Updating and reloading…',
    unavailable: k ? 'មិនអាចពិនិត្យរកកំណែថ្មីក្នុងការមើលសាកល្បង ឬកម្មវិធីរុករកនេះបានទេ។' : 'Update checks are unavailable in this preview or browser.'
  };
  const unsubscribeUpdate = updater.subscribe(state => {
    updateButton.textContent = state === 'updated' ? (k ? 'បានដំឡើងកំណែថ្មីហើយ' : 'Updated')
      : state === 'current' ? (k ? 'គ្មានកំណែថ្មីទេ' : 'No update available')
      : k ? 'ពិនិត្យរកកំណែថ្មី' : 'Check for update';
    updateButton.disabled = ['checking', 'downloading', 'updating', 'updated', 'current', 'unavailable'].includes(state);
    updateButton.setAttribute('aria-busy', String(['checking', 'downloading', 'updating'].includes(state)));
    updateStatus.textContent = messages[state];
    updateStatus.hidden = !messages[state];
  });
  updateButton.addEventListener('click', () => { void updater.check(); });
  container.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach(button => button.addEventListener('click', () => update({ language: button.dataset.lang as AppSettings['language'] })));
  container.querySelectorAll<HTMLButtonElement>('[data-accent]').forEach(button => button.addEventListener('click', () => update({ accent: button.dataset.accent as AppSettings['accent'] })));
  container.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => input.addEventListener('change', () => update({ [input.dataset.setting!]: input.checked })));
  let closeSources: (() => void) | undefined;
  container.querySelector('.about-sources')!.addEventListener('click', () => {
    closeSources?.();
    closeSources = showCalendarSources(k);
  });
  const cleanupPickers = setupSettingsPickers(container, (id, value) => {
    if (id === 'font-scale') update({ fontScale: Number(value) as FontScale });
    if (id === 'theme-mode') update({ theme: value as AppSettings['theme'] });
    if (id === 'today-zone') update({ todayTimeZone: value as TodayTimeZone });
  });
  return () => { unsubscribeUpdate(); cleanupPickers(); closeSources?.(); };
}
