import '../src/styles/index.css';
import { CustomEventModal } from '../src/ui/Modals.ts';
import { Storage, DEFAULT_SETTINGS } from '../src/data/Storage.ts';
import { fitLunarLabels } from '../src/ui/LunarLabels.ts';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const setInput = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
document.querySelector('#run').addEventListener('click', async () => {
  const result = document.querySelector('#results');
  const keys = ['khmer_calendar_settings', 'khmer_calendar_custom_events'];
  const saved = keys.map(key => localStorage.getItem(key));
  const lines = [];
  let modal;
  const check = async (name, run) => {
    try { await run(); lines.push(`PASS ${name}`); }
    catch (error) { lines.push(`FAIL ${name}: ${error.message}`); }
    result.textContent = lines.join('\n');
  };
  try {
    await check('Khmer lunar labels compact uniformly and restore after width changes', async () => {
      const grid = document.createElement('div');
      grid.className = 'month-grid-cells';
      grid.style.width = '175px';
      grid.innerHTML = Array.from({ length: 7 }, () => '<button class="cal-cell"><span class="cell-lunar-label" data-full-lunar="១៥កើត" data-lunar-day="15" data-waxing="true">១៥កើត</span></button>').join('');
      document.querySelector('#app').append(grid);
      const dispose = fitLunarLabels(grid, true);
      try {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        assert([...grid.querySelectorAll('.cell-lunar-label')].every(label => label.textContent === '១៥ ក'), 'Every label compacts together');
        grid.style.width = '700px';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        assert([...grid.querySelectorAll('.cell-lunar-label')].every(label => label.textContent === '១៥កើត'), 'Full labels return when wide');
      } finally { dispose(); grid.remove(); }
    });
    localStorage.setItem(keys[1], '[]');
    for (const khmer of [false, true]) {
      Storage.saveSettings({ ...DEFAULT_SETTINGS, language: khmer ? 'km' : 'en', mondayFirst: true });
      let lastSaved;
      modal = new CustomEventModal(event => { lastSaved = event; });
      await check(`${khmer ? 'Khmer' : 'English'} date picker: draft, Cancel, invalid year, Save`, () => {
        modal.open('2026-10-11', khmer);
        const parent = document.querySelector('.event-editor-dialog').closest('.modal-overlay');
        const date = parent.querySelector('#ev-date');
        setInput(parent.querySelector('#ev-title'), 'Browser sync fixture');
        parent.querySelector('#ev-date').parentElement.querySelector('button').click();
        const picker = document.querySelector('.event-date-overlay');
        assert(parent.inert, 'Parent is inert while the child picker is open');
        assert(new Set([...picker.querySelectorAll('.event-date-weekdays span')].map(item => item.textContent)).size === 7, 'Distinct weekday headings');
        picker.querySelector('[data-pick-date="2026-10-15"]').click();
        assert(date.value === '2026-10-11', 'Tapping a date changes only the draft');
        picker.querySelector('.event-date-cancel').click();
        assert(date.value === '2026-10-11' && !parent.inert, 'Cancel restores the editor unchanged');
        date.parentElement.querySelector('button').click();
        const second = document.querySelector('.event-date-overlay');
        setInput(second.querySelector('.event-date-year'), '2201');
        assert(second.querySelector('.event-date-save').disabled, 'Unsupported year disables OK');
        second.querySelector('.event-date-month').value = '11';
        second.querySelector('.event-date-month').dispatchEvent(new Event('change'));
        assert(second.querySelector('.event-date-save').disabled, 'Changing month cannot bypass invalid year');
        setInput(second.querySelector('.event-date-year'), '2026');
        second.querySelector('[data-pick-date="2026-11-15"]').click();
        second.querySelector('.event-date-save').click();
        assert(date.value === '2026-11-15', 'OK commits the draft');
        parent.querySelector('#custom-event-form').requestSubmit();
        assert(lastSaved?.date === '2026-11-15', 'Saved event receives chosen date');
        assert(!document.querySelector('.event-date-overlay'), 'Child picker is removed after save');
      });
      await check(`${khmer ? 'Khmer' : 'English'} repeat end: minimum date, persisted series, parent cleanup`, () => {
        modal.open('2026-10-11', khmer);
        const parent = document.querySelector('.event-editor-dialog').closest('.modal-overlay');
        setInput(parent.querySelector('#ev-title'), 'Series fixture');
        parent.querySelector('[data-repeat="weekly"]').click();
        const end = parent.querySelector('#ev-repeat-end');
        setInput(parent.querySelector('#ev-date'), khmer ? '២០២៦-១០-១១' : '2026-10-11');
        assert(parent.querySelector('#ev-date').value === '2026-10-11' && end.min === '2026-10-11', 'Numeric normalization precedes repeat validation');
        end.parentElement.querySelector('button').click();
        const picker = document.querySelector('.event-date-overlay');
        assert(picker.querySelector('[data-pick-date="2026-10-10"]').disabled, 'End date cannot precede anchor');
        picker.querySelector('[data-pick-date="2026-10-25"]').click();
        picker.querySelector('.event-date-save').click();
        setInput(end, khmer ? '២០២៦-១០-២៥' : '2026-10-25');
        assert(end.value === '2026-10-25' && !parent.querySelector('.event-repeat-preview').hidden, 'Typed repeat end refreshes its preview');
        parent.querySelector('#custom-event-form').requestSubmit();
        assert(lastSaved?.repeat?.until === '2026-10-25', 'Series retains its end date');
        modal.open('2026-10-11', khmer);
        document.querySelector('#ev-date').parentElement.querySelector('button').click();
        modal.close();
        assert(!document.querySelector('.event-date-overlay'), 'Closing parent disposes child');
        assert(!document.querySelector('#app').inert, 'Application focus restored');
      });
      modal.close();
      modal.overlay.remove();
      modal = undefined;
    }
  } finally {
    modal?.close();
    modal?.overlay.remove();
    keys.forEach((key, index) => saved[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, saved[index]));
    result.textContent = lines.join('\n') + `\n${lines.filter(line => line.startsWith('PASS')).length}/${lines.length} passed`;
  }
});
