import { settingsPicker, setupSettingsPickers } from './SettingsPicker';

const options = (count: number): string[][] => Array.from({ length: count }, (_, value) => {
  const digits = String(value).padStart(2, '0');
  return [digits, digits];
});

export function setupDesktopTimeField(container: HTMLElement, input: HTMLInputElement, khmer: boolean): () => void {
  let [hour, minute] = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.value) ? input.value.split(':') : ['', ''];
  let closePickers: (() => void) | undefined;
  const render = () => {
    closePickers?.();
    input.value = hour && minute ? `${hour}:${minute}` : '';
    container.innerHTML = `
      <div class="time-field-part">
        <span class="time-field-label" id="ev-hour-label">${khmer ? 'ម៉ោង' : 'Hour'}</span>
        ${settingsPicker('ev-hour', hour, [['', '—'], ...options(24)])}
      </div>
      <span class="time-field-separator" aria-hidden="true">:</span>
      <div class="time-field-part">
        <span class="time-field-label" id="ev-minute-label">${khmer ? 'នាទី' : 'Minute'}</span>
        ${settingsPicker('ev-minute', minute, [['', '—'], ...options(60)])}
      </div>`;
    closePickers = setupSettingsPickers(container, (id, value) => {
      if (!value) {
        hour = minute = '';
      } else if (id === 'ev-hour') {
        hour = value;
        minute ||= '00';
      } else {
        minute = value;
        hour ||= '00';
      }
      render();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 264);
  };
  render();
  return () => closePickers?.();
}
