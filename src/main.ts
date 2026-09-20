// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import './styles/index.css';

import { KhmerCalendar, toEpochDay, khmerNumber } from './domain/KhmerCalendar';
import { KhmerDateDetails } from './domain/KhmerDateDetails';
import { Zodiac } from './domain/Zodiac';
import { CalendarWords, L } from './data/i18n';
import { EventRepository, CalendarEvent } from './data/EventRepository';
import { Storage, AppSettings } from './data/Storage';
import { Icons } from './ui/Icons';
import { MonthPickerModal, CustomEventModal, DateDetailsDialogModal, EventDetailsDialogModal } from './ui/Modals';
import { dateTimeInZone, todayInZone } from './domain/DateTime';
import { escapeHtml } from './ui/html';
import { renderSettings } from './ui/Settings';
import { isAndroid, prefersNativeScrollbars } from './ui/Platform';
import { applyInstallMetadata } from './ui/InstallMetadata';
import { bindAutoHideScrollbars } from './ui/Scrollbars';
import { adjacentMonth, bindMonthSwipe, MonthDirection } from './ui/MonthSwipe';
import { AppUpdater } from './ui/AppUpdater';
import { appearanceBackground, effectiveTheme } from './ui/Appearance';
import { holyDayLotus } from './ui/HolyDayLotus';
import { fitWeekdayHeadings } from './ui/WeekdayHeadings';
import { startTodayRefresh } from './ui/TodayRefresh';

const updateReceiptKey = `khmer-calendar:update:${import.meta.env.BASE_URL}`;
function consumeUpdateReceipt(): number | undefined {
  try {
    const raw = sessionStorage.getItem(updateReceiptKey);
    sessionStorage.removeItem(updateReceiptKey);
    if (!raw) return;
    const { at, scrollTop } = JSON.parse(raw);
    if (Number.isFinite(at) && Date.now() - at >= 0 && Date.now() - at < 60_000
      && Number.isFinite(scrollTop) && scrollTop >= 0) return scrollTop;
  } catch { /* Session storage may be unavailable; updating still works. */ }
}

class KhmerCalendarApp {
  private settings: AppSettings;
  private currentYear: number;
  private currentMonth: number;
  private selectedDateStr: string;
  private activePage: number = 0; // 0 = Calendar, 1 = Events, 2 = Settings
  private eventsYear: number;
  private eventsFilter: number = 0; // 0 = All, 1 = Holidays, 2 = Observances, 3 = Holy Days, 4 = Custom
  private eventsSearchQuery: string = '';
  private cleanupSettings?: () => void;
  private cleanupWeekdays?: () => void;
  private todayRefresh?: ReturnType<typeof startTodayRefresh>;
  private updateScrollTop = consumeUpdateReceipt();
  private updater = new AppUpdater(
    import.meta.env.PROD && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    `${import.meta.env.BASE_URL}sw.js`, () => {
      try {
        sessionStorage.setItem(updateReceiptKey, JSON.stringify({
          at: Date.now(), scrollTop: document.getElementById('screen-container')?.scrollTop ?? 0
        }));
      } catch { /* Do not block the update if session storage is unavailable. */ }
      window.location.reload();
    }, () => navigator.onLine, this.updateScrollTop !== undefined
  );

  private monthPicker: MonthPickerModal;
  private eventsYearPicker: MonthPickerModal;
  private dateDetailsModal: DateDetailsDialogModal;
  private eventDetailsModal: EventDetailsDialogModal;
  private customEventModal: CustomEventModal;

  constructor() {
    document.documentElement.toggleAttribute('data-android', isAndroid());
    if (!prefersNativeScrollbars()) bindAutoHideScrollbars();
    this.settings = Storage.getSettings();
    this.selectedDateStr = todayInZone(this.settings.todayTimeZone);
    const [year, month] = this.selectedDateStr.split('-').map(Number);
    this.currentYear = year;
    this.currentMonth = month;
    this.eventsYear = this.currentYear;

    this.monthPicker = new MonthPickerModal((year, month) => {
      this.currentYear = year;
      this.currentMonth = month;
      this.selectedDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      this.render();
    });

    this.eventsYearPicker = new MonthPickerModal(year => {
      this.eventsYear = year;
      this.render();
    }, 'year');

    this.customEventModal = new CustomEventModal(event => {
      const displayedDate = event.instant ? dateTimeInZone(new Date(event.instant), this.settings.todayTimeZone).date : event.date;
      this.eventsYear = Number(displayedDate.slice(0, 4));
      this.activePage = 1;
      this.eventsFilter = 4;
      this.eventsSearchQuery = '';
      this.render();
    });

    this.eventDetailsModal = new EventDetailsDialogModal(
      (event) => {
        const source = Storage.getCustomEvents().find(item => item.id === (event.seriesId || event.id));
        if (source) this.customEventModal.open(source.date, this.settings.language === 'km', source);
      },
      (id) => {
        Storage.deleteCustomEventSync(id);
        this.render();
      }
    );

    this.dateDetailsModal = new DateDetailsDialogModal(
      (event) => {
        this.eventDetailsModal.open(event, this.settings.language === 'km');
      },
      (dateStr) => {
        this.customEventModal.open(dateStr, this.settings.language === 'km');
      }
    );

    this.applySettings();
    if (this.updateScrollTop !== undefined) this.activePage = 2;
    this.render();
    if (this.updateScrollTop !== undefined) {
      document.getElementById('screen-container')!.scrollTop = this.updateScrollTop;
    }
    bindMonthSwipe(document.getElementById('app')!, direction => this.changeMonth(direction));
    this.updater.start();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applySettings());
    this.todayRefresh = startTodayRefresh(() => {
      const now = new Date();
      return {
        date: todayInZone(this.settings.todayTimeZone, now),
        zoneKey: `${this.settings.todayTimeZone}:${Intl.DateTimeFormat().resolvedOptions().timeZone}:${now.getTimezoneOffset()}`
      };
    }, (current, previous) => {
      const scrollTop = document.getElementById('screen-container')?.scrollTop ?? 0;
      if (this.selectedDateStr === previous.date) {
        this.selectedDateStr = current.date;
        [this.currentYear, this.currentMonth] = current.date.split('-').map(Number);
      }
      this.render();
      document.getElementById('screen-container')!.scrollTop = scrollTop;
    }, () => Boolean(document.querySelector('.modal-overlay.open')));
  }

  private applySettings() {
    const root = document.documentElement;
    root.lang = this.settings.language;
    const appName = L.text('app.name', this.settings.language === 'km');
    document.title = appName;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', appName);
    applyInstallMetadata(this.settings.language);
    root.setAttribute('data-accent', this.settings.accent);
    root.style.setProperty('--font-scale', String(this.settings.fontScale));
    root.toggleAttribute('data-hide-copy-buttons', !this.settings.showCopyButtons);

    const theme = effectiveTheme(this.settings.theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    root.toggleAttribute('data-background-accent', this.settings.backgroundAccent);
    root.toggleAttribute('data-colored-weekdays', this.settings.highlightWeekdayNames);
    const background = appearanceBackground(this.settings, theme === 'dark',
      getComputedStyle(root).getPropertyValue('--accent-' + this.settings.accent + '-light'));
    root.style.setProperty('--bg-color', background);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }

  private render() {
    this.cleanupWeekdays?.();
    this.cleanupWeekdays = undefined;
    this.cleanupSettings?.();
    this.cleanupSettings = undefined;
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const k = this.settings.language === 'km';

    // Shared app shell; responsive styles choose bottom tabs or a navigation rail.
    appEl.innerHTML = `
      <div class="scaffold">
        <div class="scaffold-body">
          <!-- Desktop/Tablet Left Navigation Rail -->
          <nav class="left-nav-rail">
            <button class="rail-item ${this.activePage === 0 ? 'active' : ''}" data-page="0">
              <div class="nav-tab-pill">${Icons.calendar}</div>
              <span class="rail-label">${L.text('ui.calendar.ee8bd9', k)}</span>
            </button>
            <button class="rail-item ${this.activePage === 1 ? 'active' : ''}" data-page="1">
              <div class="nav-tab-pill">${Icons.events}</div>
              <span class="rail-label">${L.text('ui.events.11d867', k)}</span>
            </button>
            <button class="rail-item ${this.activePage === 2 ? 'active' : ''}" data-page="2">
              <div class="nav-tab-pill">${Icons.settings}</div>
              <span class="rail-label">${L.text('ui.settings.0e0a4f', k)}</span>
            </button>
          </nav>

          <!-- Main Content Area -->
          <div class="screen-container" id="screen-container"></div>
        </div>

        <!-- Bottom Navigation Bar (Phone Portrait) -->
        <nav class="bottom-bar">
          <button class="nav-tab ${this.activePage === 0 ? 'active' : ''}" data-page="0">
            <div class="nav-tab-pill">${Icons.calendar}</div>
            <span class="nav-tab-label">${L.text('ui.calendar.ee8bd9', k)}</span>
          </button>
          <button class="nav-tab ${this.activePage === 1 ? 'active' : ''}" data-page="1">
            <div class="nav-tab-pill">${Icons.events}</div>
            <span class="nav-tab-label">${L.text('ui.events.11d867', k)}</span>
          </button>
          <button class="nav-tab ${this.activePage === 2 ? 'active' : ''}" data-page="2">
            <div class="nav-tab-pill">${Icons.settings}</div>
            <span class="nav-tab-label">${L.text('ui.settings.0e0a4f', k)}</span>
          </button>
        </nav>
      </div>
    `;

    appEl.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        this.activePage = parseInt((el as HTMLElement).dataset.page!, 10);
        this.render();
      });
    });

    const screenContainer = document.getElementById('screen-container')!;
    if (this.activePage === 0) {
      this.renderCalendarScreen(screenContainer, k);
    } else if (this.activePage === 1) {
      this.renderEventsScreen(screenContainer, k);
    } else {
      this.renderSettingsScreen(screenContainer, k);
    }
  }

  /* ==========================================================================
     PAGE 0: CALENDAR SCREEN
     ========================================================================== */
  private changeMonth(direction: MonthDirection) {
    const next = adjacentMonth(this.currentYear, this.currentMonth, direction);
    if (!next) return;
    this.currentYear = next.year;
    this.currentMonth = next.month;
    this.selectedDateStr = `${next.year}-${String(next.month).padStart(2, '0')}-01`;
    this.render();
  }

  private renderCalendarScreen(container: HTMLElement, k: boolean) {
    const allMonthEvents = EventRepository.forMonth(this.currentYear, this.currentMonth);
    const monthEvents = allMonthEvents.filter(event => this.settings.showHolyDaysInEvents || event.kind !== 'HOLY_DAY');
    const selectedParts = this.selectedDateStr.split('-').map(Number);
    const selectedDetails = KhmerDateDetails.fromGregorian(selectedParts[0], selectedParts[1], selectedParts[2]);
    const selectedDayEvents = monthEvents.filter(event => event.date === this.selectedDateStr);

    const midMonthDetails = KhmerDateDetails.fromGregorian(this.currentYear, this.currentMonth, 15);
    const watermarkAnimal = Zodiac.getAnimalDrawable(midMonthDetails.animalYear, false);

    const weekdays = Array.from({ length: 7 }, (_, day) => (day + (this.settings.mondayFirst ? 1 : 0)) % 7);
    const todayStr = todayInZone(this.settings.todayTimeZone);
    const isTodaySelected = this.selectedDateStr === todayStr;
    const hasCustom = monthEvents.some(e => e.kind === 'CUSTOM');
    const tightLegend = hasCustom && this.settings.holyDayMarkers;

    // 1. Calendar Header
    const calendarHeaderHtml = `
      <div class="calendar-header">
        <button class="header-year-btn btn-jump-year">
          <span class="year-num">${CalendarWords.number(this.currentYear, k)}</span>
          <span class="be-num">${L.text('ui.be.623a78', k)} ${CalendarWords.number(selectedDetails.lunar.buddhistYear, k)}</span>
        </button>

        <div class="header-month-nav">
          <button class="arrow-btn btn-prev-month" ${this.currentYear === 1800 && this.currentMonth === 1 ? 'disabled' : ''} aria-label="${L.text('ui.previous_month.c03e1f', k)}">
            ${Icons.chevronLeft}
          </button>
          <button class="month-name-btn btn-jump-month" aria-label="${CalendarWords.month(this.currentMonth, k)}">
            ${k ? CalendarWords.month(this.currentMonth, k) : `
              <span class="header-month-full" aria-hidden="true">${CalendarWords.month(this.currentMonth, false)}</span>
              <span class="header-month-short" aria-hidden="true">${CalendarWords.month(this.currentMonth, false, true)}</span>
            `}
          </button>
          <button class="arrow-btn btn-next-month" ${this.currentYear === 2200 && this.currentMonth === 12 ? 'disabled' : ''} aria-label="${L.text('ui.next_month.d2d40f', k)}">
            ${Icons.chevronRight}
          </button>
        </div>

        <button class="btn-today-pill btn-go-today${isTodaySelected ? ' is-today-selected' : ''}">
          ${L.text('ui.today.d71ac6', k)}
        </button>
      </div>
    `;

    // 2. Calendar Month Card
    const calendarCardHtml = `
      <div class="calendar-month-card">
        <!-- Native Animal Zodiac Background Watermark -->
        <span class="card-watermark-zodiac tinted-watermark" style="--watermark-image: url('${watermarkAnimal}')" aria-hidden="true"></span>

        <div class="weekdays-row" style="position: relative; z-index: 1;">
          ${weekdays.map(day => `<span data-weekday="${day}" class="${day === 0 && this.settings.highlightSunday ? 'sunday-header' : ''}">${CalendarWords.weekday(day, k, this.settings.showLongerWeekdayNames ? 'grid_long' : 'narrow')}</span>`).join('')}
        </div>
        <div class="month-grid-cells" style="position: relative; z-index: 1;"></div>
        <div class="card-divider" style="position: relative; z-index: 1;"></div>
        <div class="card-legend-row${tightLegend ? ' tight-legend' : ''}" style="position: relative; z-index: 1;">
          <div class="legend-item"><span class="mark-shape holiday"></span>${L.text('ui.holiday.253332', k)}</div>
          ${this.settings.holyDayMarkers ? `<div class="legend-item"><span class="mark-shape holy_day"></span>${L.text('ui.holy_day.28786d', k)}</div>` : ''}
          <div class="legend-item"><span class="mark-shape observance"></span>${L.text('ui.observance.5b9a87', k)}</div>
          ${hasCustom ? `<div class="legend-item"><span class="mark-shape custom"></span>${L.text('ui.custom.917053', k)}</div>` : ''}
        </div>
      </div>
    `;

    // 3. Consolidated Date Card (Clicking opens DateDetailsDialog)
    const dateSummaryHtml = `
      <button class="date-summary-card" title="${L.text('ui.date_details.e26d78', k)}">
        <div class="date-summary-left">
          <div class="date-summary-lunar">${k ? CalendarWords.fullKhmerDate(selectedDetails) : CalendarWords.fullEnglishDate(selectedDetails)}</div>
        </div>
        <div class="date-summary-right">
          <div class="date-summary-gregorian">
            ${CalendarWords.month(selectedDetails.month, false)} ${selectedDetails.day}, ${selectedDetails.year}
          </div>
          ${this.settings.showWesternZodiac ? `
            <div class="date-summary-zodiac">
              ${Zodiac.label(selectedDetails.zodiac, false)}
            </div>
          ` : ''}
        </div>
      </button>
    `;

    // 4. Events Rows
    const renderEventRows = (events: CalendarEvent[]) => {
      if (events.length === 0) return '';
      return events.map(e => {
        const d = parseInt(e.date.slice(8, 10), 10);
        const dateObj = new Date(e.date);
        const dayOfWeek = (dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay()) % 7;
        const isHol = e.kind === 'HOLIDAY';
        return `
          <button class="event-row-card ${e.kind === 'CUSTOM' ? 'custom-event-row' : ''}" data-event-id="${escapeHtml(e.id)}" data-event-date="${escapeHtml(e.date)}">
            <div class="event-row-date">
              <span class="event-row-daynum ${isHol ? 'holiday' : ''}">${CalendarWords.number(d, k)}</span>
              <span class="event-row-weekday">${CalendarWords.weekday(dayOfWeek, k, 'short')}</span>
            </div>
            <div class="event-row-bar ${e.kind.toLowerCase()}"></div>
            <div class="event-row-content">
              <span class="event-row-title">${escapeHtml(k ? e.titleKm : e.titleEn)}</span>
              <span class="event-row-kind ${e.kind.toLowerCase()}">
                ${e.kind === 'HOLIDAY' ? L.text('ui.holiday.253332', k) :
                  e.kind === 'HOLY_DAY' ? L.text('ui.holy_day.28786d', k) :
                  e.kind === 'OBSERVANCE' ? L.text('ui.observance.5b9a87', k) : L.text('ui.custom.917053', k)}
                ${e.time ? ' · ' + escapeHtml(e.time) : ''}
              </span>
            </div>
            <span class="event-row-chevron">›</span>
          </button>
        `;
      }).join('');
    };

      container.innerHTML = `
        <div class="calendar-two-columns">
          <div class="calendar-col-left">
            ${calendarHeaderHtml}
            ${calendarCardHtml}
            ${dateSummaryHtml}
            ${selectedDayEvents.length > 0 ? `<div class="selected-day-events">
              <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin: 10px 0 4px 6px;">
                ${L.text('ui.events_on_the_day.a174fc', k)}
              </div>
              <div class="events-list-container">${renderEventRows(selectedDayEvents)}</div>
            </div>` : ''}
          </div>

          <div class="calendar-col-right">
            <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin: 6px 0 10px 4px;">
              ${L.text('ui.all_events_in_month.ab923a', k, { month: CalendarWords.month(this.currentMonth, k) })} (${CalendarWords.number(monthEvents.length, k)})
            </div>
            <div class="events-list-container">${renderEventRows(monthEvents)}</div>
          </div>
        </div>
      `;

    if (this.settings.showLongerWeekdayNames) {
      this.cleanupWeekdays = fitWeekdayHeadings(container.querySelector<HTMLElement>('.weekdays-row')!);
    }

    // Populate calendar grid cells
    const firstEpoch = toEpochDay(this.currentYear, this.currentMonth, 1);
    const firstWeekday = new Date(firstEpoch * 86400000).getUTCDay();
    const startOffset = (firstWeekday + (this.settings.mondayFirst ? 6 : 0)) % 7;
    const daysInMonth = new Date(Date.UTC(this.currentYear, this.currentMonth, 0)).getUTCDate();
    const totalSlots = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const gridCellsContainer = container.querySelector('.month-grid-cells')!;
    for (let slot = 0; slot < totalSlots; slot++) {
      const dayNum = slot - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        gridCellsContainer.appendChild(emptyCell);
        continue;
      }

      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const lunar = KhmerCalendar.fromGregorian(this.currentYear, this.currentMonth, dayNum);
      const isActive = dateStr === this.selectedDateStr;
      const isToday = dateStr === todayStr;
      const dayOfWeek = (firstWeekday + dayNum - 1) % 7;
      const dayEvents = allMonthEvents.filter(e => e.date === dateStr && (this.settings.holyDayMarkers || e.kind !== 'HOLY_DAY'));
      const isHoliday = dayEvents.some(e => e.kind === 'HOLIDAY') || (this.settings.highlightSunday && dayOfWeek === 0);

      const cell = document.createElement('button');
      cell.setAttribute('aria-label', `${CalendarWords.month(this.currentMonth, k)} ${CalendarWords.number(dayNum, k)}, ${CalendarWords.lunarFull(lunar.day, lunar.waxing, lunar.month, k)}`);
      cell.setAttribute('aria-pressed', String(isActive));
      cell.dataset.date = dateStr;
      if (isToday) cell.setAttribute('aria-current', 'date');
      cell.className = 'cal-cell' +
        (isActive ? ' active-day' : '') +
        (isToday ? ' today' : '') +
        (isHoliday ? ' is-holiday' : '');

      let marksHtml = '';
      if (dayEvents.length > 0) {
        const kinds = Array.from(new Set(dayEvents.map(e => e.kind))).slice(0, 4);
        marksHtml = '<div class="cell-event-marks">' +
          kinds.map(kind => `<span class="mark-shape ${kind.toLowerCase()}"></span>`).join('') +
          '</div>';
      }

      cell.innerHTML = `
        ${lunar.isHolyDay && this.settings.holyDayMarkers ? `<img src="${holyDayLotus(lunar)}" class="cell-lotus-img" alt="" />` : ''}
        <span class="cell-day-num">${CalendarWords.number(dayNum, k)}</span>
        ${this.settings.showLunar ? `<span class="cell-lunar-label">${CalendarWords.lunarShort(lunar.day, lunar.waxing, k)}</span>` : ''}
        ${marksHtml}
      `;

      cell.addEventListener('click', () => {
        const repeated = this.selectedDateStr === dateStr;
        this.selectedDateStr = dateStr;
        this.render();
        if (repeated || !window.matchMedia('(min-width: 960px) and (min-height: 600px) and (orientation: landscape)').matches) {
          this.dateDetailsModal.open(dateStr, monthEvents.filter(e => e.date === dateStr), k);
        }
      });

      gridCellsContainer.appendChild(cell);
    }

    // Attach Header navigation events
    container.querySelector('.btn-prev-month')?.addEventListener('click', () => this.changeMonth(-1));
    container.querySelector('.btn-next-month')?.addEventListener('click', () => this.changeMonth(1));

    container.querySelector('.btn-jump-month')?.addEventListener('click', () => {
      this.monthPicker.open(this.currentYear, this.currentMonth, k);
    });

    container.querySelector('.btn-jump-year')?.addEventListener('click', () => {
      this.monthPicker.open(this.currentYear, this.currentMonth, k);
    });

    container.querySelector('.btn-go-today')?.addEventListener('click', () => {
      this.selectedDateStr = todayInZone(this.settings.todayTimeZone);
      [this.currentYear, this.currentMonth] = this.selectedDateStr.split('-').map(Number);
      this.render();
    });

    // Clicking date summary card opens date details dialog
    container.querySelector('.date-summary-card')?.addEventListener('click', () => {
      this.dateDetailsModal.open(this.selectedDateStr, selectedDayEvents, k);
    });

    // Clicking any event row opens event details dialog
    container.querySelectorAll('.event-row-card').forEach(card => {
      card.addEventListener('click', () => {
        const evId = (card as HTMLElement).dataset.eventId;
        const allEvents = [...monthEvents, ...selectedDayEvents];
        const event = allEvents.find(e => e.id === evId && e.date === (card as HTMLElement).dataset.eventDate);
        if (event) {
          this.eventDetailsModal.open(event, k);
        }
      });
    });
  }

  /* ==========================================================================
     PAGE 1: EVENTS SCREEN
     ========================================================================== */
  private renderEventsScreen(container: HTMLElement, k: boolean, resultsOnly = false) {
    const rawEvents = EventRepository.forYearWithCustom(this.eventsYear);

    // Apply Filter & Search Query
    const filteredEvents = rawEvents.filter(e => {
      if (!this.settings.showHolyDaysInEvents && e.kind === 'HOLY_DAY') return false;
      if (this.eventsFilter === 1 && e.kind !== 'HOLIDAY') return false;
      if (this.eventsFilter === 2 && e.kind !== 'OBSERVANCE') return false;
      if (this.eventsFilter === 3 && e.kind !== 'HOLY_DAY') return false;
      if (this.eventsFilter === 4 && e.kind !== 'CUSTOM') return false;

      if (this.eventsSearchQuery.trim()) {
        const q = this.eventsSearchQuery.toLowerCase();
        const searchStr = `${e.titleKm} ${e.titleEn} ${e.date} ${e.notes || ''}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }
      return true;
    });

    // Group events by month
    const groupedByMonth = new Map<number, CalendarEvent[]>();
    for (let m = 1; m <= 12; m++) {
      groupedByMonth.set(m, []);
    }
    for (const e of filteredEvents) {
      const m = parseInt(e.date.slice(5, 7), 10);
      groupedByMonth.get(m)?.push(e);
    }

    let monthsListHtml = '';
    for (let m = 1; m <= 12; m++) {
      const evs = groupedByMonth.get(m) || [];
      if (evs.length === 0) continue;

      monthsListHtml += `
        <div class="events-month-group">
          <div class="events-month-title">
            <span>${CalendarWords.month(m, k)}</span>
            <span class="events-month-count">${CalendarWords.number(evs.length, k)}</span>
          </div>
          <div class="events-list-container">
            ${evs.map(e => {
              const d = parseInt(e.date.slice(8, 10), 10);
              const dateObj = new Date(e.date);
              const dayOfWeek = (dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay()) % 7;
              const isHol = e.kind === 'HOLIDAY';
              return `
                <button class="event-row-card ${e.kind === 'CUSTOM' ? 'custom-event-row' : ''}" data-event-id="${escapeHtml(e.id)}" data-event-date="${escapeHtml(e.date)}">
                  <div class="event-row-date">
                    <span class="event-row-daynum ${isHol ? 'holiday' : ''}">${CalendarWords.number(d, k)}</span>
                    <span class="event-row-weekday">${CalendarWords.weekday(dayOfWeek, k, 'short')}</span>
                  </div>
                  <div class="event-row-bar ${e.kind.toLowerCase()}"></div>
                  <div class="event-row-content">
                    <span class="event-row-title">${escapeHtml(k ? e.titleKm : e.titleEn)}</span>
                    <span class="event-row-kind ${e.kind.toLowerCase()}">
                      ${e.kind === 'HOLIDAY' ? L.text('ui.holiday.253332', k) :
                        e.kind === 'HOLY_DAY' ? L.text('ui.holy_day.28786d', k) :
                        e.kind === 'OBSERVANCE' ? L.text('ui.observance.5b9a87', k) : L.text('ui.custom.917053', k)}
                      ${e.time ? ' · ' + escapeHtml(e.time) : ''}
                    </span>
                  </div>
                  <span class="event-row-chevron">›</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    const resultsHtml = monthsListHtml || `<div class="empty-events">${k ? 'គ្មានព្រឹត្តិការណ៍ទេ' : 'No events found'}</div>`;
    const bindEventRows = () => container.querySelectorAll('.event-row-card').forEach(card => {
      card.addEventListener('click', () => {
        const { eventId, eventDate } = (card as HTMLElement).dataset;
        const event = rawEvents.find(event => event.id === eventId && event.date === eventDate);
        if (event) this.eventDetailsModal.open(event, k);
      });
    });
    if (resultsOnly) {
      container.querySelector('.events-results')!.innerHTML = resultsHtml;
      bindEventRows();
      return;
    }

    container.innerHTML = `
      <div class="events-screen-container">
        <!-- Events Header -->
        <div class="events-header">
          <span class="events-title">${L.text('ui.events.11d867', k)}</span>
          <div class="events-year-nav">
            <button class="arrow-btn btn-prev-events-year" ${this.eventsYear === 1800 ? 'disabled' : ''} aria-label="${k ? 'ឆ្នាំមុន' : 'Previous year'}">${Icons.chevronLeft}</button>
            <button class="btn-events-year" aria-haspopup="dialog" aria-label="${L.text('ui.choose_year.0853a0', k)}: ${CalendarWords.number(this.eventsYear, k)}">
              ${CalendarWords.number(this.eventsYear, k)}
            </button>
            <button class="arrow-btn btn-next-events-year" ${this.eventsYear === 2200 ? 'disabled' : ''} aria-label="${k ? 'ឆ្នាំបន្ទាប់' : 'Next year'}">${Icons.chevronRight}</button>
          </div>
          <button class="add-event-button btn-fab-add" aria-label="${L.text('ui.add_event.bf2f10', k)}">${Icons.add}</button>
        </div>

        <!-- Search Bar -->
        <div class="events-search-bar">
          <input type="search" id="events-search-input" aria-label="${L.text('ui.search_events.08c608', k)}" placeholder="${L.text('ui.search_events.08c608', k)}" value="${escapeHtml(this.eventsSearchQuery)}" />
        </div>

        <!-- Filter Chips -->
        <div class="events-filter-chips">
          <button class="filter-chip ${this.eventsFilter === 0 ? 'active' : ''}" data-filter="0">${L.text('ui.all.c10205', k)}</button>
          <button class="filter-chip ${this.eventsFilter === 4 ? 'active' : ''}" data-filter="4">${L.text('ui.custom.917053', k)}</button>
          <button class="filter-chip ${this.eventsFilter === 1 ? 'active' : ''}" data-filter="1">${L.text('ui.holidays.8a894c', k)}</button>
          <button class="filter-chip ${this.eventsFilter === 2 ? 'active' : ''}" data-filter="2">${L.text('ui.observances.e4454c', k)}</button>
          ${this.settings.showHolyDaysInEvents ? `<button class="filter-chip ${this.eventsFilter === 3 ? 'active' : ''}" data-filter="3">${L.text('ui.holy_days.9569a6', k)}</button>` : ''}
        </div>

        <!-- Grouped List -->
        <div class="events-results" aria-live="polite">${resultsHtml}</div>

      </div>
    `;

    // Navigation
    container.querySelector('.btn-events-year')?.addEventListener('click', () => {
      this.eventsYearPicker.open(this.eventsYear, 1, k);
    });
    container.querySelector('.btn-prev-events-year')?.addEventListener('click', () => {
      this.eventsYear--;
      this.render();
    });

    container.querySelector('.btn-next-events-year')?.addEventListener('click', () => {
      this.eventsYear++;
      this.render();
    });

    // Search input
    const searchInput = container.querySelector('#events-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.eventsSearchQuery = searchInput.value;
      this.renderEventsScreen(container, k, true);
    });

    // Filter chips
    container.querySelectorAll('[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.eventsFilter = parseInt((chip as HTMLElement).dataset.filter!, 10);
        this.render();
      });
    });

    // FAB Click: Add event
    container.querySelector('.btn-fab-add')?.addEventListener('click', () => {
      this.customEventModal.open(this.selectedDateStr, k);
    });

    // Event Row Click: Open EventDetailsDialog
    bindEventRows();
  }

  /* ==========================================================================
     PAGE 2: SETTINGS SCREEN
     ========================================================================== */
  private renderSettingsScreen(container: HTMLElement, k: boolean) {
    this.cleanupSettings = renderSettings(container, this.settings, settings => {
      const scrollTop = container.scrollTop;
      const previousToday = todayInZone(this.settings.todayTimeZone);
      if (settings.todayTimeZone !== this.settings.todayTimeZone && this.selectedDateStr === previousToday) {
        this.selectedDateStr = todayInZone(settings.todayTimeZone);
        [this.currentYear, this.currentMonth] = this.selectedDateStr.split('-').map(Number);
      }
      this.settings = settings;
      this.todayRefresh?.reset();
      if (!settings.showHolyDaysInEvents && this.eventsFilter === 3) this.eventsFilter = 0;
      Storage.saveSettings(settings);
      this.applySettings();
      this.render();
      document.getElementById('screen-container')!.scrollTop = scrollTop;
    }, this.updater);
  }

}

document.addEventListener('DOMContentLoaded', () => {
  new KhmerCalendarApp();
});
