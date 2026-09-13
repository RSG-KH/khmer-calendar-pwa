// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import './styles/theme.css';
import './styles/components.css';
import './styles/responsive.css';

import { KhmerCalendar, toEpochDay, khmerNumber } from './domain/KhmerCalendar';
import { KhmerDateDetails } from './domain/KhmerDateDetails';
import { Zodiac } from './domain/Zodiac';
import { CalendarWords, L } from './data/i18n';
import { EventRepository, CalendarEvent } from './data/EventRepository';
import { Storage, AppSettings, AccentColor, ThemeMode, FontScale } from './data/Storage';
import { Icons } from './ui/Icons';
import { MonthPickerModal, CustomEventModal, DateDetailsDialogModal, EventDetailsDialogModal } from './ui/Modals';
import { WebPushManager } from './push/PushManager';

class KhmerCalendarApp {
  private settings: AppSettings;
  private currentYear: number;
  private currentMonth: number;
  private selectedDateStr: string;
  private activePage: number = 0; // 0 = Calendar, 1 = Events, 2 = Settings
  private eventsYear: number;
  private eventsFilter: number = 0; // 0 = All, 1 = Holidays, 2 = Observances, 3 = Holy Days, 4 = Custom
  private eventsSearchQuery: string = '';

  private monthPicker: MonthPickerModal;
  private dateDetailsModal: DateDetailsDialogModal;
  private eventDetailsModal: EventDetailsDialogModal;
  private customEventModal: CustomEventModal;

  constructor() {
    this.settings = Storage.getSettings();
    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth() + 1;
    this.selectedDateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.eventsYear = this.currentYear;

    this.monthPicker = new MonthPickerModal((year, month) => {
      this.currentYear = year;
      this.currentMonth = month;
      this.selectedDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      this.render();
    });

    this.customEventModal = new CustomEventModal(() => {
      this.render();
    });

    this.eventDetailsModal = new EventDetailsDialogModal(
      (event) => {
        this.customEventModal.open(event.date, this.settings.language === 'km', {
          id: event.id,
          title: event.titleKm || event.titleEn,
          date: event.date,
          time: event.time,
          notes: event.notes
        });
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
    this.render();
    this.initServiceWorker();
  }

  private applySettings() {
    const root = document.documentElement;
    root.setAttribute('data-accent', this.settings.accent);
    root.style.setProperty('--font-scale', String(this.settings.fontScale));

    if (this.settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', this.settings.theme);
    }
  }

  private initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(err => {
        console.log('SW registration skipped:', err);
      });
    }
  }

  private render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const k = this.settings.language === 'km';

    // Exact Material 3 Scaffold matching Android CalendarApp.kt lines 190-240
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
  private renderCalendarScreen(container: HTMLElement, k: boolean) {
    const monthEvents = EventRepository.forMonth(this.currentYear, this.currentMonth);
    const selectedParts = this.selectedDateStr.split('-').map(Number);
    const selectedDetails = KhmerDateDetails.fromGregorian(selectedParts[0], selectedParts[1], selectedParts[2]);
    const selectedDayEvents = EventRepository.forDate(this.selectedDateStr);

    const midMonthDetails = KhmerDateDetails.fromGregorian(this.currentYear, this.currentMonth, 15);
    const watermarkAnimal = Zodiac.getAnimalDrawable(midMonthDetails.animalYear, false);

    const isWideScreen = window.innerWidth >= 960;

    // 1. Calendar Header
    const calendarHeaderHtml = `
      <div class="calendar-header">
        <button class="header-year-btn btn-jump-year">
          <span class="year-num">${CalendarWords.number(this.currentYear, k)}</span>
          <span class="be-num">${L.text('ui.be.623a78', k)} ${CalendarWords.number(selectedDetails.lunar.buddhistYear, k)}</span>
        </button>

        <div class="header-month-nav">
          <button class="arrow-btn btn-prev-month" aria-label="${L.text('ui.previous_month.c03e1f', k)}">
            ${Icons.chevronLeft}
          </button>
          <button class="month-name-btn btn-jump-month">
            ${CalendarWords.month(this.currentMonth, k)}
          </button>
          <button class="arrow-btn btn-next-month" aria-label="${L.text('ui.next_month.d2d40f', k)}">
            ${Icons.chevronRight}
          </button>
        </div>

        <button class="btn-today-pill btn-go-today">
          ${L.text('ui.today.d71ac6', k)}
        </button>
      </div>
    `;

    // 2. Calendar Month Card
    const calendarCardHtml = `
      <div class="calendar-month-card">
        <!-- Native Animal Zodiac Background Watermark -->
        <img src="${watermarkAnimal}" class="card-watermark-zodiac" alt="" />

        <div class="weekdays-row" style="position: relative; z-index: 1;">
          <span class="sunday-header">${CalendarWords.weekday(0, k, 'short')}</span>
          <span>${CalendarWords.weekday(1, k, 'short')}</span>
          <span>${CalendarWords.weekday(2, k, 'short')}</span>
          <span>${CalendarWords.weekday(3, k, 'short')}</span>
          <span>${CalendarWords.weekday(4, k, 'short')}</span>
          <span>${CalendarWords.weekday(5, k, 'short')}</span>
          <span>${CalendarWords.weekday(6, k, 'short')}</span>
        </div>
        <div class="month-grid-cells" style="position: relative; z-index: 1;"></div>
        <div class="card-divider" style="position: relative; z-index: 1;"></div>
        <div class="card-legend-row" style="position: relative; z-index: 1;">
          <div class="legend-item"><span class="mark-shape holiday"></span>${L.text('ui.holiday.253332', k)}</div>
          ${this.settings.holyDayMarkers ? `<div class="legend-item"><span class="mark-shape holy_day"></span>${L.text('ui.holy_day.28786d', k)}</div>` : ''}
          <div class="legend-item"><span class="mark-shape observance"></span>${L.text('ui.observance.5b9a87', k)}</div>
          ${monthEvents.some(e => e.kind === 'CUSTOM') ? `<div class="legend-item"><span class="mark-shape custom"></span>${L.text('ui.custom.917053', k)}</div>` : ''}
        </div>
      </div>
    `;

    // 3. Consolidated Date Card (Clicking opens DateDetailsDialog)
    const dateSummaryHtml = `
      <div class="date-summary-card" style="cursor: pointer;" title="${L.text('ui.date_details.e26d78', k)}">
        <div class="date-summary-left">
          <div style="font-size: calc(13px * var(--font-scale)); font-weight: 500; color: var(--text-primary); line-height: 1.3;">
            ${CalendarWords.lunarFull(selectedDetails.lunar.day, selectedDetails.lunar.waxing, selectedDetails.lunar.month, k)}
          </div>
          <div style="font-size: calc(12px * var(--font-scale)); color: var(--on-surface-variant); margin-top: 2px;">
            ${CalendarWords.animal(selectedDetails.animalYear, k)} · ${CalendarWords.sak(selectedDetails.sak, k)} · ${k ? 'ព.ស.' : 'B.E.'} ${CalendarWords.number(selectedDetails.lunar.buddhistYear, k)}
          </div>
        </div>
        <div class="date-summary-right">
          <div style="font-size: calc(12px * var(--font-scale)); color: var(--on-surface-variant);">
            ${CalendarWords.month(selectedDetails.month, k)} ${CalendarWords.number(selectedDetails.day, k)}, ${CalendarWords.number(selectedDetails.year, k)}
          </div>
          <div style="font-size: calc(12px * var(--font-scale)); font-weight: 500; color: var(--accent); margin-top: 2px;">
            ${Zodiac.label(selectedDetails.zodiac, k)}
          </div>
        </div>
      </div>
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
          <div class="event-row-card" data-event-id="${e.id}">
            <div class="event-row-date">
              <span class="event-row-daynum ${isHol ? 'holiday' : ''}">${CalendarWords.number(d, k)}</span>
              <span class="event-row-weekday">${CalendarWords.weekday(dayOfWeek, k, 'short')}</span>
            </div>
            <div class="event-row-bar ${e.kind.toLowerCase()}"></div>
            <div class="event-row-content">
              <span class="event-row-title">${k ? e.titleKm : e.titleEn}</span>
              <span class="event-row-kind ${e.kind.toLowerCase()}">
                ${e.kind === 'HOLIDAY' ? L.text('ui.holiday.253332', k) :
                  e.kind === 'HOLY_DAY' ? L.text('ui.holy_day.28786d', k) :
                  e.kind === 'OBSERVANCE' ? L.text('ui.observance.5b9a87', k) : L.text('ui.custom.917053', k)}
                ${e.time ? ' · ' + e.time : ''}
              </span>
            </div>
            <span class="event-row-chevron">›</span>
          </div>
        `;
      }).join('');
    };

    if (isWideScreen) {
      container.innerHTML = `
        <div class="calendar-two-columns">
          <div class="calendar-col-left">
            ${calendarHeaderHtml}
            ${calendarCardHtml}
            ${dateSummaryHtml}
            ${selectedDayEvents.length > 0 ? `
              <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin: 10px 0 4px 6px;">
                ${L.text('ui.events_on_the_day.a174fc', k)}
              </div>
              <div class="events-list-container">${renderEventRows(selectedDayEvents)}</div>
            ` : ''}
          </div>

          <div class="calendar-col-right">
            <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin: 6px 0 10px 4px;">
              ${L.text('ui.all_events_in_month.ab923a', k, { month: CalendarWords.month(this.currentMonth, k) })} (${CalendarWords.number(monthEvents.length, k)})
            </div>
            <div class="events-list-container">${renderEventRows(monthEvents)}</div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="screen-inner">
          ${calendarHeaderHtml}
          ${calendarCardHtml}
          ${dateSummaryHtml}
          ${selectedDayEvents.length > 0 ? `
            <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin: 10px 0 4px 6px;">
              ${L.text('ui.events_on_the_day.a174fc', k)}
            </div>
            <div class="events-list-container">${renderEventRows(selectedDayEvents)}</div>
          ` : ''}
          <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin: 16px 0 8px 6px;">
            ${L.text('ui.all_events_in_month.ab923a', k, { month: CalendarWords.month(this.currentMonth, k) })} (${CalendarWords.number(monthEvents.length, k)})
          </div>
          <div class="events-list-container">${renderEventRows(monthEvents)}</div>
        </div>
      `;
    }

    // Populate calendar grid cells
    const firstEpoch = toEpochDay(this.currentYear, this.currentMonth, 1);
    const startOffset = new Date(firstEpoch * 86400000).getUTCDay(); // 0 = Sun
    const daysInMonth = new Date(Date.UTC(this.currentYear, this.currentMonth, 0)).getUTCDate();
    const totalSlots = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
      const dayOfWeek = (startOffset + dayNum - 1) % 7;
      const dayEvents = monthEvents.filter(e => e.date === dateStr);
      const isHoliday = dayEvents.some(e => e.kind === 'HOLIDAY') || dayOfWeek === 0;

      const cell = document.createElement('div');
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
        ${lunar.isHolyDay && this.settings.holyDayMarkers ? `<img src="/assets/drawables/holy_day_lotus.png" class="cell-lotus-img" alt="" />` : ''}
        <span class="cell-day-num">${CalendarWords.number(dayNum, k)}</span>
        <span class="cell-lunar-label">${CalendarWords.lunarShort(lunar.day, lunar.waxing, k)}</span>
        ${marksHtml}
      `;

      cell.addEventListener('click', () => {
        if (this.selectedDateStr === dateStr) {
          // Second tap / click opens Date Details dialog
          this.dateDetailsModal.open(dateStr, dayEvents, k);
        } else {
          this.selectedDateStr = dateStr;
          this.render();
        }
      });

      gridCellsContainer.appendChild(cell);
    }

    // Attach Header navigation events
    container.querySelector('.btn-prev-month')?.addEventListener('click', () => {
      this.currentMonth--;
      if (this.currentMonth < 1) {
        this.currentMonth = 12;
        this.currentYear--;
      }
      this.selectedDateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-01`;
      this.render();
    });

    container.querySelector('.btn-next-month')?.addEventListener('click', () => {
      this.currentMonth++;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      }
      this.selectedDateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-01`;
      this.render();
    });

    container.querySelector('.btn-jump-month')?.addEventListener('click', () => {
      this.monthPicker.open(this.currentYear, this.currentMonth, k);
    });

    container.querySelector('.btn-jump-year')?.addEventListener('click', () => {
      this.monthPicker.open(this.currentYear, this.currentMonth, k);
    });

    container.querySelector('.btn-go-today')?.addEventListener('click', () => {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth() + 1;
      this.selectedDateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
        const event = allEvents.find(e => e.id === evId);
        if (event) {
          this.eventDetailsModal.open(event, k);
        }
      });
    });
  }

  /* ==========================================================================
     PAGE 1: EVENTS SCREEN
     ========================================================================== */
  private renderEventsScreen(container: HTMLElement, k: boolean) {
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
                <div class="event-row-card" data-event-id="${e.id}">
                  <div class="event-row-date">
                    <span class="event-row-daynum ${isHol ? 'holiday' : ''}">${CalendarWords.number(d, k)}</span>
                    <span class="event-row-weekday">${CalendarWords.weekday(dayOfWeek, k, 'short')}</span>
                  </div>
                  <div class="event-row-bar ${e.kind.toLowerCase()}"></div>
                  <div class="event-row-content">
                    <span class="event-row-title">${k ? e.titleKm : e.titleEn}</span>
                    <span class="event-row-kind ${e.kind.toLowerCase()}">
                      ${e.kind === 'HOLIDAY' ? L.text('ui.holiday.253332', k) :
                        e.kind === 'HOLY_DAY' ? L.text('ui.holy_day.28786d', k) :
                        e.kind === 'OBSERVANCE' ? L.text('ui.observance.5b9a87', k) : L.text('ui.custom.917053', k)}
                      ${e.time ? ' · ' + e.time : ''}
                    </span>
                  </div>
                  <span class="event-row-chevron">›</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="events-screen-container">
        <!-- Events Header -->
        <div class="events-header">
          <span style="font-size: 22px; font-weight: 700; color: var(--text-primary);">${L.text('ui.events.11d867', k)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="arrow-btn btn-prev-events-year">${Icons.chevronLeft}</button>
            <span style="font-size: 20px; font-weight: 700; color: var(--text-primary); min-width: 60px; text-align: center;">
              ${CalendarWords.number(this.eventsYear, k)}
            </span>
            <button class="arrow-btn btn-next-events-year">${Icons.chevronRight}</button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="events-search-bar">
          <input type="text" id="events-search-input" placeholder="${L.text('ui.search_events.08c608', k)}" value="${this.eventsSearchQuery}" />
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
        ${monthsListHtml || `<div style="text-align: center; color: var(--on-surface-variant); padding: 40px 0;">${k ? 'គ្មានព្រឹត្តិការណ៍ទេ' : 'No events found'}</div>`}

        <!-- Floating Action Button to Add Event -->
        <button class="fab-btn btn-fab-add" title="${L.text('ui.add_event.bf2f10', k)}">+</button>
      </div>
    `;

    // Navigation
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
      this.render();
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
    container.querySelectorAll('.event-row-card').forEach(card => {
      card.addEventListener('click', () => {
        const evId = (card as HTMLElement).dataset.eventId;
        const event = rawEvents.find(e => e.id === evId);
        if (event) {
          this.eventDetailsModal.open(event, k);
        }
      });
    });
  }

  /* ==========================================================================
     PAGE 2: SETTINGS SCREEN
     ========================================================================== */
  private renderSettingsScreen(container: HTMLElement, k: boolean) {
    container.innerHTML = `
      <div class="settings-container" style="width: 100%; max-width: 640px;">
        <div class="settings-card">
          <div class="settings-card-title">${L.text('ui.appearance.23e609', k)}</div>

          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">${L.text('ui.language.b03320', k)}</span>
            </div>
            <div class="choice-pill-group">
              <button class="choice-pill ${this.settings.language === 'km' ? 'active' : ''}" data-lang="km">${L.text('language.khmer', k)}</button>
              <button class="choice-pill ${this.settings.language === 'en' ? 'active' : ''}" data-lang="en">${L.text('language.english', k)}</button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">${k ? 'ទំហំអក្សរ' : 'Font size'}</span>
            </div>
            <div class="choice-pill-group">
              <button class="choice-pill ${this.settings.fontScale === 0.9 ? 'active' : ''}" data-scale="0.9">90%</button>
              <button class="choice-pill ${this.settings.fontScale === 1.0 ? 'active' : ''}" data-scale="1.0">100%</button>
              <button class="choice-pill ${this.settings.fontScale === 1.1 ? 'active' : ''}" data-scale="1.1">110%</button>
              <button class="choice-pill ${this.settings.fontScale === 1.2 ? 'active' : ''}" data-scale="1.2">120%</button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">${L.text('ui.theme.99ca72', k)}</span>
            </div>
            <div class="choice-pill-group">
              <button class="choice-pill ${this.settings.theme === 'system' ? 'active' : ''}" data-theme="system">${L.text('ui.system.8f97a4', k)}</button>
              <button class="choice-pill ${this.settings.theme === 'light' ? 'active' : ''}" data-theme="light">${L.text('ui.light.aa790e', k)}</button>
              <button class="choice-pill ${this.settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">${L.text('ui.dark.4ae267', k)}</button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">${k ? 'ពណ៌ចម្បង' : 'Accent color'}</span>
            </div>
            <div class="accent-circles-row">
              <button class="accent-btn ${this.settings.accent === 'blue' ? 'active' : ''}" data-accent="blue" style="background: var(--accent-blue-light);" title="Blue"></button>
              <button class="accent-btn ${this.settings.accent === 'lavender' ? 'active' : ''}" data-accent="lavender" style="background: var(--accent-lavender-light);" title="Lavender"></button>
              <button class="accent-btn ${this.settings.accent === 'rose' ? 'active' : ''}" data-accent="rose" style="background: var(--accent-rose-light);" title="Rose"></button>
              <button class="accent-btn ${this.settings.accent === 'amber' ? 'active' : ''}" data-accent="amber" style="background: var(--accent-amber-light);" title="Amber"></button>
              <button class="accent-btn ${this.settings.accent === 'lime' ? 'active' : ''}" data-accent="lime" style="background: var(--accent-lime-light);" title="Lime"></button>
            </div>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-title">${L.text('ui.calendar.beb873', k)}</div>
          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">${k ? 'បង្ហាញផ្កាឈូកថ្ងៃសីល' : 'Holy day lotus marker'}</span>
            </div>
            <input type="checkbox" id="check-lotus" ${this.settings.holyDayMarkers ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent);" />
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-title">${k ? 'ការជូនដំណឹង' : 'NOTIFICATIONS'}</div>
          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">${k ? 'បើកការជូនដំណឹង' : 'Enable notifications'}</span>
              <span class="settings-subtitle">${k ? 'ថ្ងៃសីល និងថ្ងៃឈប់សម្រាក (iOS 16.4+)' : 'Holy days & Holidays (iOS 16.4+)'}</span>
            </div>
            <button class="btn-today-pill btn-push-toggle">${this.settings.notificationsEnabled ? (k ? 'បានបើក' : 'Enabled') : (k ? 'បើកដំណើរការ' : 'Enable')}</button>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-title">${k ? 'អំពីកម្មវិធី' : 'ABOUT'}</div>
          <div class="settings-row">
            <div class="settings-text-col">
              <span class="settings-title">Khmer Calendar PWA</span>
              <span class="settings-subtitle">Version 1.0.0 · 100% Offline · No Ads · Apache 2.0</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-lang]').forEach(el => {
      el.addEventListener('click', () => {
        this.settings.language = (el as HTMLElement).dataset.lang as any;
        Storage.saveSettings(this.settings);
        this.applySettings();
        this.render();
      });
    });

    container.querySelectorAll('[data-scale]').forEach(el => {
      el.addEventListener('click', () => {
        this.settings.fontScale = parseFloat((el as HTMLElement).dataset.scale!) as FontScale;
        Storage.saveSettings(this.settings);
        this.applySettings();
        this.render();
      });
    });

    container.querySelectorAll('[data-theme]').forEach(el => {
      el.addEventListener('click', () => {
        this.settings.theme = (el as HTMLElement).dataset.theme as ThemeMode;
        Storage.saveSettings(this.settings);
        this.applySettings();
        this.render();
      });
    });

    container.querySelectorAll('[data-accent]').forEach(el => {
      el.addEventListener('click', () => {
        this.settings.accent = (el as HTMLElement).dataset.accent as AccentColor;
        Storage.saveSettings(this.settings);
        this.applySettings();
        this.render();
      });
    });

    const checkLotus = container.querySelector('#check-lotus') as HTMLInputElement;
    checkLotus?.addEventListener('change', () => {
      this.settings.holyDayMarkers = checkLotus.checked;
      Storage.saveSettings(this.settings);
      this.render();
    });

    container.querySelector('.btn-push-toggle')?.addEventListener('click', async () => {
      const ok = await WebPushManager.requestPermission();
      if (ok) {
        this.settings.notificationsEnabled = true;
        Storage.saveSettings(this.settings);
        WebPushManager.showLocalNotification(
          k ? 'ប្រតិទិនចន្ទគតិ' : 'Khmer Calendar',
          k ? 'ការជូនដំណឹងត្រូវបានបើកដំណើរការ' : 'Notifications enabled'
        );
        this.render();
      } else {
        alert(k ? 'សូមអនុញ្ញាតការជូនដំណឹងនៅក្នុងការកំណត់កម្មវិធីរុករករបស់អ្នក' : 'Please allow notifications in your browser settings.');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new KhmerCalendarApp();
});
