import { Component, ChangeDetectionStrategy, ViewChild, TemplateRef, OnInit } from '@angular/core';
import { isSameDay, isSameMonth } from 'date-fns';
import { BehaviorSubject, Subject } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  CalendarDateFormatter,
  CalendarDayViewBeforeRenderEvent,
  CalendarEvent,
  CalendarEventAction,
  CalendarEventTimesChangedEvent,
  CalendarEventTitleFormatter,
  CalendarMonthViewBeforeRenderEvent,
  CalendarView,
  CalendarWeekViewBeforeRenderEvent,
  DAYS_OF_WEEK
} from 'angular-calendar';
import { CustomDateFormatter } from './custom-date-formatter.provider';
import { EventService } from 'src/app/service/event.service';
import { CustomEventTitleFormatter } from './custom-event-title-formatter.provider';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

const colors: any = {
  red: {
    primary: '#ad2121',
    secondary: '#FAE3E3',
  },
  blue: {
    primary: '#1e90ff',
    secondary: '#D1E8FF',
  },
  yellow: {
    primary: '#e3bc08',
    secondary: '#FDF1BA',
  },
  gray: {
    primary: '#C5C3C3',
    secondary: '#C5C3C3',
  },
};

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./calendar.component.scss'],
  providers: [
    {
      provide: CalendarDateFormatter,
      useClass: CustomDateFormatter,
    },
    {
      provide: CalendarEventTitleFormatter,
      useClass: CustomEventTitleFormatter,
    },
  ],
})
export class CalendarComponent implements OnInit {

  @ViewChild('modalContent', { static: true }) modalContent!: TemplateRef<any>;

  view: CalendarView = CalendarView.Week;

  CalendarView = CalendarView;

  viewDate: Date = new Date();

  modalData!: {
    action: string;
    event: CalendarEvent;
  };

  actions: CalendarEventAction[] = [
    {
      label: '<i class="bi bi-pencil-fill"></i>',
      a11yLabel: 'Edit',
      onClick: ({ event }: { event: CalendarEvent; }): void => {
        this.handleEvent('Edited', event);
      },
    },
    {
      label: '<i class="bi bi-trash-fill"></i>',
      a11yLabel: 'Delete',
      onClick: ({ event }: { event: CalendarEvent; }): void => {
        this.deleteEvent(event);
        this.events.next(this.events.getValue().filter((iEvent) => iEvent !== event));
      },
    },
  ];

  resizable = {
    beforeStart: true,
    afterEnd: true,
  };

  draggable: boolean = true;

  refresh = new Subject<void>();

  events: BehaviorSubject<CalendarEvent[]> = new BehaviorSubject<CalendarEvent[]>([]);

  activeDayIsOpen: boolean = false;

  locale: string = 'hu-HU';

  weekStartsOn: number = DAYS_OF_WEEK.MONDAY;

  weekendDays: number[] = [DAYS_OF_WEEK.SATURDAY, DAYS_OF_WEEK.SUNDAY];

  clickedDate!: Date;

  clickedColumn!: number;

  eventForm: FormGroup = this.formBuilder.group({
    id: [null],
    start: [null, Validators.required],
    end: [null, Validators.required],
    title: [null, Validators.required],
    color: [{ primary: colors.blue.primary, secondary: colors.blue.secondary }],
    meta: [{ eventType: 'Event' }]
  });

  currentEvent!: CalendarEvent;


  constructor(
    private modal: NgbModal,
    private eventService: EventService,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.fetchEvents();
    // this.currentEvent.meta.eventType = 'Event';
  }

  sortEventsByDate(events: CalendarEvent[]): CalendarEvent[] {
    return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[]; }): void {
    events = this.sortEventsByDate(events);
    this.clickedDate = date;
    if (isSameMonth(date, this.viewDate)) {
      if ((isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) || events.length === 0) {
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
      }
      this.viewDate = date;
    }
    if (!events.length) {
      this.handleEvent('Created', { start: this.clickedDate, end: this.clickedDate, title: '' });
    }
  }

  hourSegmentClicked(event: any): void {
    this.handleEvent('Created', event);
    this.clickedDate = event.date;
  }

  eventTimesChanged({ event, newStart, newEnd }: CalendarEventTimesChangedEvent): void {
    this.currentEvent = event;

    this.currentEvent.meta.eventType = event.meta.eventType;


    this.closeOpenMonthViewDay();
    this.events.next(this.events.getValue().map((iEvent) => {
      if (iEvent === event) {
        return { ...event, start: newStart, end: newEnd, meta: { eventType: event.meta.eventType } };
      }
      return iEvent;
    }));
    this.updateEvent(event, newStart, newEnd);
  }

  dateToShortISOString(date: Date): string {
    let eventDate;
    let eventTime;
    if (date) {
      eventDate = date.toISOString().split('T')[0];
      eventTime = date.toISOString().split('T')[1].split(':').slice(0, 2).join(':');
      return `${eventDate}T${eventTime}`;
    } else {
      eventDate = new Date().toISOString().split('T')[0];
      eventTime = new Date().toISOString().split('T')[1].split(':').slice(0, 2).join(':');
    }
    return `${eventDate}T${eventTime}`;

  }

  handleEvent(action: string, event: any): void {
    if (event.hasOwnProperty('date')) {
      this.currentEvent.meta.eventType = 'Event';
      this.eventForm.patchValue(
        {
          id: event.id,
          title: event.title,
          start: this.dateToShortISOString(event.date),
          end: this.dateToShortISOString(event.date),
        }
      );
    } else {
      this.currentEvent = event;
      this.currentEvent.meta.eventType = event.meta.eventType;
      this.eventForm.patchValue(
        {
          id: event.id,
          title: event.title,
          start: this.dateToShortISOString(this.currentEvent.start),
          end: this.dateToShortISOString(this.currentEvent.end!),
          meta: { eventType: event.meta.eventType },
        }
      );
    }
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  deleteEvent(eventToDelete: CalendarEvent) {
    this.eventService.delete(eventToDelete.id!).subscribe({
      next: () => {
        this.fetchEvents();
        this.resetEventForm();
        console.log('Esemény sikeresen törölve!');
      },
    });
  }

  updateEvent(eventToEdit: any, newStart: Date | undefined = undefined, newEnd: Date | undefined = undefined): void {
    const newEvent = { ...eventToEdit };
    delete newEvent.draggable;
    delete newEvent.resizable;
    delete newEvent.actions;

    newEvent.start = newStart || newEvent.start;
    newEvent.end = newEnd || newEvent.end;
    newEvent.meta.eventType = this.currentEvent.meta.eventType;

    newEvent.start = this.dateToShortISOString(newEvent.start);
    newEvent.end = this.dateToShortISOString(newEvent.end);

    if (this.currentEvent.meta.eventType === 'Event') {
      newEvent.color.primary = colors.blue.primary;
      newEvent.color.secondary = colors.blue.secondary;
    } else {
      newEvent.color.primary = colors.gray.primary;
      newEvent.color.secondary = colors.gray.secondary;
    }

    this.eventService.update(newEvent).subscribe({
      next: () => {
        this.fetchEvents();
        this.resetEventForm();
        console.log('Esemény sikeresen frissítve!');
      },
    });
  }

  setView(view: CalendarView) {
    this.view = view;
  }

  closeOpenMonthViewDay() {
    this.activeDayIsOpen = false;
  }

  fetchEvents(): void {
    this.eventService.getAll().subscribe({
      next: (eventList: CalendarEvent[]) => {
        const newEventList = eventList.map(event => {
          event.actions = this.actions;
          event.resizable = new Object();
          event.resizable.beforeStart = this.resizable.beforeStart;
          event.resizable.afterEnd = this.resizable.afterEnd;
          event.draggable = this.draggable;
          return event;
        });
        this.events.next(newEventList);
      }
    });
  }

  onSubmit(): void {
    this.modal.dismissAll();

    if (this.currentEvent.meta.eventType === 'Break') {
      this.eventForm.patchValue({ color: { primary: colors.gray.primary, secondary: colors.gray.secondary }, meta: { eventType: 'Break' } });
    } else {
      this.eventForm.patchValue({ color: { primary: colors.blue.primary, secondary: colors.blue.secondary }, meta: { eventType: 'Event' } });
    }

    if (this.eventForm.value.id) {
      this.eventService.update(this.eventForm.value).subscribe({
        next: () => {
          this.fetchEvents();
          this.resetEventForm();
          console.log('Esemény sikeresen frissítve!');
        },
      });
    } else {

      this.eventService.create(this.eventForm.value).subscribe({
        next: () => {
          this.fetchEvents();
          this.resetEventForm();
          console.log('Esemény sikeresen létrehozva!');
        },
      });
    }
  }

  handleNewEvent(): void {
    this.resetEventForm();
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  resetEventForm(): void {
    this.eventForm.patchValue({ id: null, start: null, end: null, title: null });
  }

  changeEventType(eventType: string): void {
    this.currentEvent.meta.eventType = eventType;
  }

  beforeMonthViewRender(renderEvent: CalendarMonthViewBeforeRenderEvent): void {
    renderEvent.body.forEach((day) => {
      const dayOfMonth = day.date.getDate();
      if (dayOfMonth > 5 && dayOfMonth < 10 && day.inMonth) {
        day.cssClass = 'bg-pink';
      }
    });
  }

  beforeWeekViewRender(renderEvent: CalendarWeekViewBeforeRenderEvent) {
    renderEvent.hourColumns.forEach((hourColumn) => {
      hourColumn.hours.forEach((hour) => {
        hour.segments.forEach((segment) => {
          if (
            segment.date.getHours() >= 2 &&
            segment.date.getHours() <= 5 &&
            segment.date.getDay() === 2
          ) {
            segment.cssClass = 'bg-pink';
          }
        });
      });
    });
  }

  beforeDayViewRender(renderEvent: CalendarDayViewBeforeRenderEvent) {
    renderEvent.hourColumns.forEach((hourColumn) => {
      hourColumn.hours.forEach((hour) => {
        hour.segments.forEach((segment) => {
          if (segment.date.getHours() >= 2 && segment.date.getHours() <= 5) {
            segment.cssClass = 'bg-pink';
          }
        });
      });
    });
  }

}
