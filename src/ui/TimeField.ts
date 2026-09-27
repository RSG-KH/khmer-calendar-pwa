import { settingsPicker, setupSettingsPickers } from './SettingsPicker';

const options = (count: number): string[][] => Array.from({ length: count }, (_, value) => {
  const digits = String(value).padStart(2, '0');
  return [digits, digits];
});

let nextTimeFieldId = 0;

export function setupTimeField(container: HTMLElement, input: HTMLInputElement, khmer: boolean): () => void {
  const fieldId = `time-field-${++nextTimeFieldId}`;
  const hourId = `${fieldId}-hour`;
  const minuteId = `${fieldId}-minute`;
  let [hour, minute] = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.value) ? input.value.split(':') : ['', ''];
  let closePickers: (() => void) | undefined;
  const render = () => {
    closePickers?.();
    input.value = hour && minute ? `${hour}:${minute}` : '';
    container.innerHTML = `
      <div class="time-field-part">
        <span class="time-field-label" id="${hourId}-label">${khmer ? 'ម៉ោង' : 'Hour'}</span>
        ${settingsPicker(hourId, hour, [['', '—'], ...options(24)], false)}
      </div>
      <span class="time-field-separator" aria-hidden="true">:</span>
      <div class="time-field-part">
        <span class="time-field-label" id="${minuteId}-label">${khmer ? 'នាទី' : 'Minute'}</span>
        ${settingsPicker(minuteId, minute, [['', '—'], ...options(60)], false)}
      </div>`;
    closePickers = setupSettingsPickers(container, (id, value) => {
      if (!value) {
        hour = minute = '';
      } else if (id === hourId) {
        hour = value;
        minute ||= '00';
      } else {
        minute = value;
        hour ||= '00';
      }
      render();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { maxMenuHeight: 264, matchTriggerWidth: true });
  };
  render();
  return () => closePickers?.();
}
