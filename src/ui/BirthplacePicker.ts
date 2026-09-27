// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { validBirthplace, type BirthplaceSelection } from '../data/Birthplaces';
import { birthplaceStepLabel, countryChoices, type BirthplaceChoice } from '../data/BirthplaceHierarchy';
import { cambodiaDivisions, selectionFromDivision,
  type CambodiaDivision, type CambodiaDocument } from '../data/CambodiaDivisions';
import { divisionCountries, geonamesDivisions, selectionFromGeoNamesDivision,
  type GeoNamesDivision, type GeoNamesDivisionDocument } from '../data/GeoNamesDivisions';
import { Storage } from '../data/Storage';
import { dateTimeInZone, type TodayTimeZone } from '../domain/DateTime';
import { parseCoordinate, parseCoordinatePair } from '../domain/Coordinates';
import { L } from '../data/i18n';
import { prefersNativeTimePicker } from './Platform';
import { setupTimeField } from './TimeField';
import { BirthplaceSearch } from './BirthplaceSearch';
import { timeZoneChoices } from '../data/TimeZones';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';

interface SearchStep {
  element: HTMLElement;
  hide(): void;
  containsTarget(target: Node): boolean;
  dispose(): void;
}

const chipDeleteIcon = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" /></svg>';

export function timeAndLocationTitle(khmer: boolean): string {
  return khmer ? 'ម៉ោង និងទីកន្លែងសម្រាប់ Big 3 និង 干支' : 'Time and location for Big 3 & Ganzhi';
}

export class TimeAndLocationModal {
  private overlay: HTMLElement;
  private request = 0;
  private openSearch?: SearchStep;
  private cleanupTimeField?: () => void;

  constructor(private onSelect: (time: string | null, place: BirthplaceSelection | null) => void) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.addEventListener('click', event => { if (event.target === this.overlay) this.close(); });
    this.overlay.addEventListener('pointerdown', event => {
      if (this.openSearch && !this.openSearch.containsTarget(event.target as Node)) {
        this.openSearch.hide();
        this.openSearch = undefined;
      }
    });
    document.body.appendChild(this.overlay);
  }

  setOnSelect(onSelect: (time: string | null, place: BirthplaceSelection | null) => void): void {
    this.onSelect = onSelect;
  }

  async open(initialTime: string | null, current: BirthplaceSelection | null,
             khmer: boolean, todayTimeZone: TodayTimeZone,
             pickerMode: 'both' | 'time' | 'location' = 'both'): Promise<void> {
    const request = ++this.request;
    this.openSearch?.hide();
    this.openSearch = undefined;
    this.cleanupTimeField?.();
    this.cleanupTimeField = undefined;
    const t = (en: string, km: string) => khmer ? km : en;
    const withLocation = pickerMode !== 'time';
    const withTime = pickerMode !== 'location';
    const title = pickerMode === 'location' ? t('Location', 'ទីកន្លែង')
      : pickerMode === 'time' ? L.text('ui.select_time.eacac3', khmer) : timeAndLocationTitle(khmer);
    const nativeTimePicker = prefersNativeTimePicker();
    /** Keep the picker's clock in the calendar's Today zone for both modes.
     * Selecting a Rising place must never auto-shift the visible HH:mm. */
    const timeValue = withTime
      ? initialTime || dateTimeInZone(new Date(), todayTimeZone).time.slice(0, 5) || '12:00'
      : '';
    const timeControl = nativeTimePicker
      ? `<div class="event-native-field"><input type="time" id="pick-time" step="60" aria-label="${t('Time', 'ម៉ោង')}" value="${escapeHtml(timeValue)}" /></div>`
      : `<input type="hidden" id="pick-time" value="${escapeHtml(timeValue)}" />
         <div class="custom-time-field" role="group" aria-label="${L.text('ui.time_hh_mm.8cf351', khmer)}"></div>`;
    if (!withLocation) {
      this.overlay.innerHTML = `
        <div class="modal-dialog-surface birthplace-dialog time-location-dialog time-only-dialog ${nativeTimePicker ? '' : 'custom-time-editor'}">
          <h2>${escapeHtml(title)}</h2>
          <div class="card-divider birthplace-divider"></div>
          <form class="time-location-form">
            <div class="time-location-content"><div class="time-location-time">${timeControl}</div></div>
            <div class="birthplace-actions"><div class="time-location-primary-actions">
              <button type="button" class="btn-today-pill birthplace-cancel">${L.text('ui.cancel.5bf834', khmer)}</button>
              <button type="submit" class="btn-today-pill birthplace-save">${L.text('ui.save.1b0623', khmer)}</button>
            </div></div>
          </form>
        </div>`;
      showModal(this.overlay, title);
      const form = this.overlay.querySelector<HTMLFormElement>('.time-location-form')!;
      const timeInput = form.querySelector<HTMLInputElement>('#pick-time')!;
      if (!nativeTimePicker) {
        this.cleanupTimeField = setupTimeField(form.querySelector('.custom-time-field')!, timeInput, khmer);
      }
      form.querySelector('.birthplace-cancel')!.addEventListener('click', () => this.close());
      form.addEventListener('submit', event => {
        event.preventDefault();
        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput.value) ? timeInput.value : null;
        this.close();
        this.onSelect(time, current);
      });
      return;
    }
    let mode: 'catalog' | 'manual' = current?.source === 'manual' ? 'manual' : 'catalog';
    let catalogPlace: BirthplaceSelection | null = current?.source !== 'manual' ? current : null;
    let catalogPlaces = Storage.getCatalogBirthplaces();
    let catalogRemoved = false;
    let manualPlaces = Storage.getManualBirthplaces();
    let editingManualLabel: string | null = current?.source === 'manual' ? current.label : null;
    let manualRemoved = false;

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface birthplace-dialog time-location-dialog ${nativeTimePicker ? '' : 'custom-time-editor'}">
        <h2>${escapeHtml(title)}</h2>
        <div class="card-divider birthplace-divider"></div>
        <form class="time-location-form">
          <div class="time-location-content">
            ${withTime ? `<div class="time-location-time">${timeControl}</div>` : ''}
            <div class="time-location-catalog" ${mode === 'manual' ? 'hidden' : ''}>
              <div class="birthplace-catalog-chips" aria-label="${t('Saved places', 'ទីកន្លែងដែលបានរក្សាទុក')}"></div>
              <div class="birthplace-steps"></div>
              <div class="birthplace-status" role="status">${t('Loading countries…', 'កំពុងផ្ទុកប្រទេស…')}</div>
            </div>
            <div class="time-location-manual" ${mode === 'catalog' ? 'hidden' : ''}>
              <div class="birthplace-manual-chips" aria-label="${t('Saved custom locations', 'ទីកន្លែងផ្ទាល់ខ្លួនដែលបានរក្សាទុក')}"></div>
              <div class="birthplace-manual-field">
                <input name="label" aria-label="${t('Location name', 'ឈ្មោះទីកន្លែង')}" placeholder="${t('Location name', 'ឈ្មោះទីកន្លែង')}" maxlength="160" value="${escapeHtml(current?.source === 'manual' ? current.label : '')}" />
                <button type="button" class="birthplace-search-clear" aria-label="${L.text('ui.clear.7d76fd', khmer)} ${t('Location name', 'ឈ្មោះទីកន្លែង')}" hidden>×</button>
              </div>
              <div class="birthplace-coordinates">
                <div class="birthplace-manual-field">
                  <input name="latitude" aria-label="${t('Latitude', 'រយៈទទឹង')}" placeholder="${t('Latitude', 'រយៈទទឹង')}" type="text" inputmode="decimal" value="${current?.source === 'manual' ? current.latitude : ''}" />
                  <button type="button" class="birthplace-search-clear" aria-label="${L.text('ui.clear.7d76fd', khmer)} ${t('Latitude', 'រយៈទទឹង')}" hidden>×</button>
                </div>
                <div class="birthplace-manual-field">
                  <input name="longitude" aria-label="${t('Longitude', 'រយៈបណ្តោយ')}" placeholder="${t('Longitude', 'រយៈបណ្តោយ')}" type="text" inputmode="decimal" value="${current?.source === 'manual' ? current.longitude : ''}" />
                  <button type="button" class="birthplace-search-clear" aria-label="${L.text('ui.clear.7d76fd', khmer)} ${t('Longitude', 'រយៈបណ្តោយ')}" hidden>×</button>
                </div>
              </div>
              <div class="birthplace-time-zone"></div>
            </div>
            <p class="time-location-error" role="alert" hidden></p>
          </div>
          <div class="birthplace-actions">
            <button type="button" class="btn-today-pill birthplace-manual-toggle">${mode === 'manual' ? t('Pick location', 'ជ្រើសរើសទីកន្លែង') : t('Custom location', 'ទីកន្លែងផ្ទាល់ខ្លួន')}</button>
            <div class="time-location-primary-actions">
              <button type="button" class="btn-today-pill birthplace-cancel">${L.text('ui.cancel.5bf834', khmer)}</button>
              <button type="submit" class="btn-today-pill birthplace-save">${L.text('ui.save.1b0623', khmer)}</button>
            </div>
          </div>
        </form>
      </div>`;
    showModal(this.overlay, title);
    const form = this.overlay.querySelector<HTMLFormElement>('.time-location-form')!;
    const timeInput = form.querySelector<HTMLInputElement>('#pick-time');
    const error = form.querySelector<HTMLElement>('.time-location-error')!;
    const manual = form.querySelector<HTMLElement>('.time-location-manual')!;
    const catalog = form.querySelector<HTMLElement>('.time-location-catalog')!;
    const catalogChips = catalog.querySelector<HTMLElement>('.birthplace-catalog-chips')!;
    const sameCatalogPlace = (a: BirthplaceSelection | null, b: BirthplaceSelection) =>
      a?.source === b.source && a.datasetVersion === b.datasetVersion &&
      (a?.source === 'CambodiaDivisions' ? a.divisionId === b.divisionId : a?.geonameId === b.geonameId);
    const renderCatalogChips = () => {
      catalogChips.innerHTML = catalogPlaces.map((place, index) => {
        const label = [place.label, place.countryCode].filter(Boolean).join(' · ');
        return `<span class="birthplace-manual-chip">
          <button type="button" class="birthplace-chip-select" data-index="${index}">${escapeHtml(label)}</button>
          <button type="button" class="birthplace-chip-delete" data-index="${index}" aria-label="${escapeHtml(t('Delete', 'លុប'))} ${escapeHtml(label)}">${chipDeleteIcon}</button>
        </span>`;
      }).join('');
    };
    renderCatalogChips();
    let restoreCatalog = (_place: BirthplaceSelection | null, _removed = false): void => {};
    catalogChips.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
      if (!button) return;
      const place = catalogPlaces[Number(button.dataset.index)];
      if (!place) return;
      if (button.classList.contains('birthplace-chip-delete')) {
        catalogPlaces = catalogPlaces.filter(saved => !sameCatalogPlace(saved, place));
        Storage.saveCatalogBirthplaces(catalogPlaces);
        if (sameCatalogPlace(catalogPlace, place)) {
          catalogPlace = null;
          catalogRemoved = true;
          restoreCatalog(null, true);
        }
        renderCatalogChips();
      } else {
        catalogPlace = place;
        catalogRemoved = false;
        restoreCatalog(place);
        error.hidden = true;
      }
    });
    const manualInput = (name: string) => manual.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    const manualFields = Array.from(manual.querySelectorAll<HTMLElement>('.birthplace-manual-field'));
    const syncManualClearButtons = () => {
      for (const field of manualFields) {
        const input = field.querySelector<HTMLInputElement>('input')!;
        field.querySelector<HTMLButtonElement>('.birthplace-search-clear')!.hidden = !input.value;
      }
    };
    for (const field of manualFields) {
      const input = field.querySelector<HTMLInputElement>('input')!;
      const clear = field.querySelector<HTMLButtonElement>('.birthplace-search-clear')!;
      input.addEventListener('input', () => { syncManualClearButtons(); error.hidden = true; });
      clear.addEventListener('click', () => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      });
    }
    syncManualClearButtons();
    const latitudeInput = manualInput('latitude');
    const longitudeInput = manualInput('longitude');
    for (const input of [latitudeInput, longitudeInput]) {
      input.addEventListener('paste', event => {
        const coordinates = parseCoordinatePair(event.clipboardData?.getData('text/plain') ?? '');
        if (!coordinates) return;
        event.preventDefault();
        latitudeInput.value = String(coordinates.latitude);
        longitudeInput.value = String(coordinates.longitude);
        syncManualClearButtons();
        error.hidden = true;
      });
    }
    const onSearchOpen = (step: SearchStep) => {
      if (this.openSearch && this.openSearch !== step) this.openSearch.hide();
      this.openSearch = step;
    };
    const timeZoneSearch = new BirthplaceSearch(t('Time zone (city or country)', 'តំបន់ម៉ោង (ទីក្រុង ឬប្រទេស)'),
      timeZoneChoices(khmer), () => { error.hidden = true; }, () => { error.hidden = true; },
      onSearchOpen, t('No matching time zones', 'គ្មានតំបន់ម៉ោងត្រូវគ្នា'), L.text('ui.clear.7d76fd', khmer));
    manual.querySelector('.birthplace-time-zone')!.appendChild(timeZoneSearch.element);
    if (current?.source === 'manual') timeZoneSearch.setValue(current.timeZone);
    if (withTime && !nativeTimePicker) {
      this.cleanupTimeField = setupTimeField(form.querySelector('.custom-time-field')!, timeInput!, khmer);
    }

    const fillManual = (place: BirthplaceSelection | null) => {
      manualInput('label').value = place?.label ?? '';
      manualInput('latitude').value = place ? String(place.latitude) : '';
      manualInput('longitude').value = place ? String(place.longitude) : '';
      syncManualClearButtons();
      timeZoneSearch.setValue(place?.timeZone ?? '');
      editingManualLabel = place?.label ?? null;
      manualRemoved = !place;
    };
    const chips = manual.querySelector<HTMLElement>('.birthplace-manual-chips')!;
    const renderChips = () => {
      chips.innerHTML = manualPlaces.map((place, index) => `<span class="birthplace-manual-chip">
        <button type="button" class="birthplace-chip-select" data-index="${index}">${escapeHtml(place.label)}</button>
        <button type="button" class="birthplace-chip-delete" data-index="${index}" aria-label="${escapeHtml(t('Delete', 'លុប'))} ${escapeHtml(place.label)}">${chipDeleteIcon}</button>
      </span>`).join('');
    };
    renderChips();
    chips.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
      if (!button) return;
      const index = Number(button.dataset.index);
      const place = manualPlaces[index];
      if (!place) return;
      if (button.classList.contains('birthplace-chip-delete')) {
        manualPlaces = manualPlaces.filter((_, item) => item !== index);
        Storage.saveManualBirthplaces(manualPlaces);
        if (editingManualLabel === place.label) fillManual(null);
        renderChips();
      } else {
        fillManual(place);
        manualInput('label').focus();
      }
    });
    form.querySelector('.birthplace-manual-toggle')!.addEventListener('click', () => {
      mode = mode === 'catalog' ? 'manual' : 'catalog';
      manual.hidden = mode !== 'manual';
      catalog.hidden = mode !== 'catalog';
      form.querySelector('.birthplace-manual-toggle')!.textContent = mode === 'manual'
        ? t('Pick location', 'ជ្រើសរើសទីកន្លែង') : t('Custom location', 'ទីកន្លែងផ្ទាល់ខ្លួន');
      error.hidden = true;
      timeZoneSearch.hide();
      if (mode === 'manual') manualInput('label').focus();
    });
    form.querySelector('.birthplace-cancel')!.addEventListener('click', () => this.close());
    form.addEventListener('submit', event => {
      event.preventDefault();
      let place: BirthplaceSelection | null = catalogPlace;
      if (mode === 'catalog' && !place && current && !catalogRemoved) {
        error.textContent = t('Choose a place before saving.', 'សូមជ្រើសរើសទីកន្លែងមុនរក្សាទុក។');
        error.hidden = false;
        return;
      }
      if (mode === 'catalog' && place && place.source !== 'manual') {
        catalogPlaces = catalogPlaces.filter(saved => !sameCatalogPlace(saved, place!));
        catalogPlaces.push(place);
        Storage.saveCatalogBirthplaces(catalogPlaces);
      }
      if (mode === 'manual') {
        const label = manualInput('label').value.trim();
        const latitude = manualInput('latitude').value.trim();
        const longitude = manualInput('longitude').value.trim();
        const timeZone = timeZoneSearch.value.trim();
        if (label || latitude || longitude || timeZone) {
          const parsedLatitude = parseCoordinate(latitude, 'latitude');
          const parsedLongitude = parseCoordinate(longitude, 'longitude');
          const candidate: BirthplaceSelection | null = parsedLatitude === null || parsedLongitude === null
            ? null : { source: 'manual', label, latitude: parsedLatitude, longitude: parsedLongitude, timeZone };
          if (!candidate || !validBirthplace(candidate)) {
            error.textContent = t('Check the location name, coordinates and IANA time zone.',
              'សូមពិនិត្យឈ្មោះទីកន្លែង កូអរដោនេ និងតំបន់ម៉ោង IANA។');
            error.hidden = false;
            return;
          }
          place = candidate;
          manualPlaces = manualPlaces.filter(saved => saved.label !== editingManualLabel &&
            saved.label.toLocaleLowerCase() !== label.toLocaleLowerCase());
          manualPlaces.push(candidate);
          Storage.saveManualBirthplaces(manualPlaces);
        } else if (manualRemoved) place = null;
        else {
          error.textContent = t('Enter a custom location or choose Pick location.',
            'សូមបញ្ចូលទីកន្លែងផ្ទាល់ខ្លួន ឬជ្រើសរើសទីកន្លែង។');
          error.hidden = false;
          return;
        }
      }
      if (pickerMode === 'location' && !place) {
        error.textContent = t('Choose a place before saving.', 'សូមជ្រើសរើសទីកន្លែងមុនរក្សាទុក។');
        error.hidden = false;
        return;
      }
      const time = withTime && timeInput && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput.value)
        ? timeInput.value : initialTime;
      this.close();
      this.onSelect(time, place);
    });

    const host = catalog.querySelector<HTMLElement>('.birthplace-steps')!;
    const status = catalog.querySelector<HTMLElement>('.birthplace-status')!;
    const steps: SearchStep[] = [];
    const removeAfter = (count: number) => {
      while (steps.length > count) {
        const step = steps.pop()!;
        step.dispose();
        step.element.remove();
        if (this.openSearch === step) this.openSearch = undefined;
      }
    };
    const addStep = <T>(labelText: string, choices: BirthplaceChoice<T>[],
                         onChoose: (choice: BirthplaceChoice<T>) => void,
                         selected?: BirthplaceChoice<T>, onEditStep?: () => void,
                         showAllOnFocus = false): void => {
      const index = steps.length;
      const step = new BirthplaceSearch(labelText, choices,
        choice => { removeAfter(index + 1); onChoose(choice); },
        () => {
          removeAfter(index + 1);
          if (index === 0) ++this.request;
          catalogPlace = null;
          catalogRemoved = false;
          status.textContent = '';
          onEditStep?.();
        },
        onSearchOpen, t('No matches', 'គ្មានលទ្ធផលត្រូវគ្នា'),
        L.text('ui.clear.7d76fd', khmer), showAllOnFocus);
      steps.push(step);
      host.appendChild(step.element);
      if (selected) step.setSelected(selected);
    };
    const showGeoNames = (document: GeoNamesDivisionDocument, selectedPlace?: BirthplaceSelection) => {
      if (!document.divisions.length) {
        status.textContent = t('No administrative points are available here. Enter a custom location.',
          'គ្មានកូអរដោនេតំបន់រដ្ឋបាលនៅទីនេះ។ សូមបញ្ចូលទីកន្លែងផ្ទាល់ខ្លួន។');
        return;
      }
      const byId = new Map(document.divisions.map(division => [division.id, division]));
      const selected = selectedPlace?.source === 'GeoNamesAdmin'
        ? byId.get(selectedPlace.geonameId ?? 0) : undefined;
      let selectedAdm1 = selected;
      while (selectedAdm1?.parentId) selectedAdm1 = byId.get(selectedAdm1.parentId);
      const chooseDivision = (division: GeoNamesDivision) => {
        catalogPlace = null;
        catalogRemoved = false;
        if (!division.timeZone) {
          status.textContent = t('Time zone unavailable. Enter a custom location for this division.',
            'គ្មានតំបន់ម៉ោង។ សូមបញ្ចូលទីកន្លែងផ្ទាល់ខ្លួន។');
          return;
        }
        try { new Intl.DateTimeFormat('en', { timeZone: division.timeZone }); }
        catch {
          status.textContent = t('This device does not know that time zone. Enter a supported zone manually.',
            'ឧបករណ៍នេះមិនស្គាល់តំបន់ម៉ោងនោះទេ។ សូមបញ្ចូលតំបន់ម៉ោងដោយដៃ។');
          return;
        }
        catalogPlace = selectionFromGeoNamesDivision(division, document);
        catalogRemoved = false;
        status.textContent = '';
      };
      const showLowerDivisions = (adm1: GeoNamesDivision) => {
        const adm2 = document.divisions.filter(division =>
          division.level === 2 && division.parentId === adm1.id);
        const adm2ById = new Map(adm2.map(division => [division.id, division]));
        const lower = document.divisions.filter(division =>
          division.level === 3 && division.parentId !== null && adm2ById.has(division.parentId));
        const choices: BirthplaceChoice<GeoNamesDivision>[] = [...lower, ...adm2].map(division => {
          const parent = division.parentId ? adm2ById.get(division.parentId) : undefined;
          return { key: String(division.id), label: parent
            ? `${parent.name} · ${division.name}` : division.name,
            aliases: [division.name, division.code, ...(parent ? [parent.name, parent.code] : [])],
            detail: division.timeZone ? undefined : t('Time zone unavailable; use Custom location',
              'គ្មានតំបន់ម៉ោង; សូមប្រើទីកន្លែងផ្ទាល់ខ្លួន'),
            value: division };
        });
        if (!choices.length) return;
        addStep(t('ADM 2 · ADM 3', 'ស្រុក / ខណ្ឌ · ឃុំ / សង្កាត់'), choices,
          choice => chooseDivision(choice.value),
          choices.find(choice => choice.value.id === selected?.id), undefined, true);
      };
      const adm1Choices: BirthplaceChoice<GeoNamesDivision>[] = document.divisions
        .filter(division => division.level === 1)
        .map(division => ({ key: String(division.id), label: division.name,
          aliases: [division.code],
          detail: division.timeZone ? undefined : t('Time zone unavailable; use Custom location',
            'គ្មានតំបន់ម៉ោង; សូមប្រើទីកន្លែងផ្ទាល់ខ្លួន'),
          value: division }));
      addStep(t('Province / state', 'ខេត្ត / រដ្ឋ'), adm1Choices, choice => {
        chooseDivision(choice.value);
        showLowerDivisions(choice.value);
      }, adm1Choices.find(choice => choice.value.id === selectedAdm1?.id));
      if (selectedAdm1) showLowerDivisions(selectedAdm1);
    };
    const showCambodia = (document: CambodiaDocument, selectedPlace?: BirthplaceSelection) => {
      const byId = new Map(document.divisions.map(division => [division.id, division]));
      const selectedCommune = selectedPlace?.source === 'CambodiaDivisions'
        ? byId.get(selectedPlace.divisionId ?? '') : undefined;
      const selectedDistrict = selectedCommune ? byId.get(selectedCommune.parentId ?? '') : undefined;
      const selectedProvince = selectedDistrict ? byId.get(selectedDistrict.parentId ?? '') : undefined;
      const choicesFor = (level: 1 | 2 | 3, parentId: string | null): BirthplaceChoice<CambodiaDivision>[] =>
        document.divisions.filter(division => division.level === level && division.parentId === parentId)
          .map(division => ({ key: division.id,
            label: khmer ? division.nameKm : division.nameEn,
            aliases: [division.nameEn, division.nameKm,
              division.nameKm.replace(/^(រាជធានី|ខេត្ត|ស្រុក|ក្រុង|ខណ្ឌ|ឃុំ|សង្កាត់)\s*/, ''),
              division.nameEn.replace(/^(Province|District|Municipality|Khan|Commune|Sangkat)\s+/i, '')
                .replace(/\s+(Province|Capital)$/i, '')],
            detail: level === 3 && division.latitude === null
              ? t('Coordinates unavailable; use Custom location', 'គ្មានកូអរដោនេ; សូមប្រើទីកន្លែងផ្ទាល់ខ្លួន')
              : division.coordinateConfidence === 'low'
                ? t('Approximate point; use Custom location for precision',
                    'ទីតាំងប្រហាក់ប្រហែល; សូមប្រើទីកន្លែងផ្ទាល់ខ្លួនសម្រាប់ភាពច្បាស់លាស់')
                : undefined,
            value: division }));
      const showLowerDivisions = (province: CambodiaDivision) => {
        const choices = choicesFor(2, province.id).flatMap(district =>
          choicesFor(3, district.key).map(commune => ({ ...commune,
            label: `${district.label} · ${commune.label}`,
            aliases: [...commune.aliases, ...district.aliases] })));
        addStep(t('ADM 2 · ADM 3', 'ស្រុក / ខណ្ឌ · ឃុំ / សង្កាត់'), choices, choice => {
          catalogPlace = null;
          catalogRemoved = false;
          if (choice.value.latitude === null || choice.value.longitude === null) {
            status.textContent = t('Coordinates unavailable. Enter a custom location for this commune.',
              'គ្មានកូអរដោនេ។ សូមបញ្ចូលទីកន្លែងផ្ទាល់ខ្លួន។');
            return;
          }
          catalogPlace = selectionFromDivision(choice.value, document, khmer);
          catalogRemoved = false;
          status.textContent = '';
        }, choices.find(choice => choice.key === selectedCommune?.id), undefined, true);
      };
      const provinces = choicesFor(1, null);
      addStep(birthplaceStepLabel('KH', khmer), provinces,
        choice => showLowerDivisions(choice.value), provinces.find(choice => choice.key === selectedProvince?.id));
      if (selectedProvince) showLowerDivisions(selectedProvince);
    };
    try {
      const countries = await divisionCountries();
      if (request !== this.request) return;
      status.textContent = '';
      const choices = countryChoices(countries, khmer);
      const loadCountry = async (choice: BirthplaceChoice<(typeof countries)[number]>,
                                 selectedPlace?: BirthplaceSelection) => {
        const load = ++this.request;
        status.textContent = t('Loading places…', 'កំពុងផ្ទុកទីកន្លែង…');
        try {
          const document = choice.value.code === 'KH'
            ? await cambodiaDivisions() : await geonamesDivisions(choice.value.code);
          if (load !== this.request) return;
          status.textContent = '';
          if (document.schemaVersion === 1) {
            if (selectedPlace?.source === 'GeoNames') {
              status.textContent = t('Your saved place still works. Choose a commune to use the new Cambodia catalog.',
                'ទីកន្លែងដែលបានរក្សាទុកនៅតែអាចប្រើបាន។ សូមជ្រើសរើសឃុំ ឬសង្កាត់ពីបញ្ជីថ្មី។');
            }
            showCambodia(document, selectedPlace);
            return;
          }
          if (selectedPlace?.source === 'GeoNames') {
            status.textContent = t('This saved place is not in the current catalog; its saved coordinates can still be used.',
              'ទីកន្លែងដែលបានរក្សាទុកនេះមិនមានក្នុងបញ្ជីបច្ចុប្បន្នទេ ប៉ុន្តែអាចប្រើកូអរដោនេដែលបានរក្សាទុក។');
          }
          showGeoNames(document, selectedPlace);
        } catch {
          if (load === this.request) status.textContent = t('Place data unavailable. Please try again.',
            'មិនអាចផ្ទុកទិន្នន័យទីកន្លែងបាន។ សូមព្យាយាមម្ដងទៀត។');
        }
      };
      restoreCatalog = (place, removed = false) => {
        ++this.request;
        removeAfter(0);
        catalogPlace = place;
        catalogRemoved = removed;
        status.textContent = '';
        const selected = place?.countryCode
          ? choices.find(choice => choice.key === place.countryCode) : undefined;
        addStep(t('Country / territory', 'ប្រទេស / ដែនដី'), choices,
          choice => { catalogPlace = null; catalogRemoved = false; void loadCountry(choice); }, selected);
        if (selected) void loadCountry(selected, place ?? undefined);
      };
      restoreCatalog(catalogPlace, catalogRemoved);
    } catch {
      if (request === this.request) status.textContent = t('Place data unavailable. Please try again.',
        'មិនអាចផ្ទុកទិន្នន័យទីកន្លែងបាន។ សូមព្យាយាមម្ដងទៀត។');
    }
  }

  close(): void {
    this.request++;
    this.openSearch?.hide();
    this.openSearch = undefined;
    this.cleanupTimeField?.();
    this.cleanupTimeField = undefined;
    hideModal(this.overlay);
  }

  dispose(): void {
    if (this.overlay.classList.contains('open')) this.close();
    else {
      this.request++;
      this.openSearch?.hide();
      this.cleanupTimeField?.();
    }
    this.overlay.remove();
  }
}
