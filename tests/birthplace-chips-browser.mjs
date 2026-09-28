// Open /tests/birthplace-chips-browser.html against npm run dev.
// Exercise the real dialogs and inputs; isolate saved chips from user preferences.
import '../src/styles/index.css';
import { TimeAndLocationModal } from '../src/ui/BirthplacePicker';
import { DEFAULT_RISING_PLACE } from '../src/data/Birthplaces';
import { Storage } from '../src/data/Storage';

const assert = (value, message) => { if (!value) throw new Error(message); };
const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message);
const waitFor = async predicate => {
  const deadline = performance.now() + 5_000;
  while (!predicate()) {
    assert(performance.now() < deadline, 'Location inputs did not load');
    await new Promise(requestAnimationFrame);
  }
};

document.querySelector('#run').addEventListener('click', async () => {
  const output = document.querySelector('#results');
  const button = document.querySelector('#run');
  button.disabled = true;
  output.textContent = 'Running…';
  const original = Object.fromEntries(['getCatalogBirthplaces', 'saveCatalogBirthplaces',
    'getManualBirthplaces', 'saveManualBirthplaces'].map(key => [key, Storage[key]]));
  let catalogPlaces = [], manualPlaces = [], modal;
  Storage.getCatalogBirthplaces = () => structuredClone(catalogPlaces);
  Storage.getManualBirthplaces = () => structuredClone(manualPlaces);
  Storage.saveCatalogBirthplaces = places => { catalogPlaces = structuredClone(places); };
  Storage.saveManualBirthplaces = places => { manualPlaces = structuredClone(places); };
  const passed = [];
  try {
    for (const manual of [false, true]) for (const pickerMode of ['both', 'location']) {
      const selected = manual ? { source: 'manual', label: 'Chip location', latitude: 11.57,
        longitude: 104.92, timeZone: 'Asia/Phnom_Penh' } : structuredClone(DEFAULT_RISING_PLACE);
      const other = { ...selected, label: 'Other saved place', divisionId: '00000000-0000-0000-0000-000000000001' };
      catalogPlaces = manual ? [] : [selected, other];
      manualPlaces = manual ? [selected, other] : [];
      let result;
      modal = new TimeAndLocationModal((time, place) => { result = { time, place }; });
      await modal.open('08:35', selected, false, 'local', pickerMode);
      const overlay = document.querySelector('.modal-overlay.open');
      const fields = () => [...overlay.querySelectorAll(manual
        ? '.time-location-manual input' : '.birthplace-steps input')];
      await waitFor(() => fields().length === (manual ? 4 : 3) && fields().every(input => input.value));
      if (manual) {
        const name = overlay.querySelector('[name="label"]');
        name.value = 'Edited location';
        name.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const inputs = () => fields().map(input => input.value);
      const before = inputs();
      const chipGroup = manual ? '.birthplace-manual-chips' : '.birthplace-catalog-chips';
      for (const index of [1, 0]) {
        overlay.querySelector(`${chipGroup} .birthplace-chip-delete[data-index="${index}"]`).click();
        equal(inputs(), before, 'Deleting a chip changed the active location inputs');
        equal((manual ? manualPlaces : catalogPlaces).length, index, 'Chip deletion was not saved');
        equal(overlay.querySelectorAll(`${chipGroup} .birthplace-chip-delete`).length, index, 'Deleted chip stayed visible');
      }
      if (pickerMode === 'both') {
        equal(overlay.querySelector('#pick-time').value, '08:35', 'Deletion changed the time');
        overlay.querySelector('.birthplace-save').click();
        equal(result, { time: '08:35', place: manual ? { ...selected, label: 'Edited location' } : selected },
          'Save lost the retained location draft');
      } else {
        overlay.querySelector('.birthplace-cancel').click();
        assert(result === undefined, 'Cancel applied the draft');
        equal(manual ? manualPlaces : catalogPlaces, [], 'Cancel restored the deleted chips');
      }
      modal.dispose(); modal = undefined;
      passed.push(`${manual ? 'Custom edited fields' : 'Catalog hierarchy'} · ${pickerMode}: PASS`);
    }
    output.textContent = `${passed.join('\n')}\nAll 4 checks passed.`;
  } catch (error) {
    output.textContent = `${passed.join('\n')}\nFAIL: ${error.message}`;
    console.error(error);
  } finally {
    modal?.dispose();
    Object.assign(Storage, original);
    button.disabled = false;
  }
});
