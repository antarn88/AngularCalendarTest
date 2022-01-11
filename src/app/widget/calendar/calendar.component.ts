import { Component, ChangeDetectionStrategy, ViewChild, TemplateRef, OnInit } from '@angular/core';
import { isSameDay, isSameMonth } from 'date-fns';
import { BehaviorSubject, Subject, take } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  CalendarDateFormatter,
  CalendarEvent,
  CalendarEventAction,
  CalendarEventTimesChangedEvent,
  CalendarEventTitleFormatter,
  CalendarView,
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
    title: [null, Validators.required]
  });

  constructor(
    private modal: NgbModal,
    private eventService: EventService,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.fetchEvents();
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
    this.closeOpenMonthViewDay();
    this.events.next(this.events.getValue().map((iEvent) => {
      if (iEvent === event) {
        return { ...event, start: newStart, end: newEnd };
      }
      return iEvent;
    }));
    this.updateEvent(event, newStart, newEnd);
  }

  dateToShortISOString(date: Date): string {
    const eventDate = date.toISOString().split('T')[0];
    const eventTime = date.toISOString().split('T')[1].split(':').slice(0, 2).join(':');
    return `${eventDate}T${eventTime}`;
  }

  handleEvent(action: string, event: CalendarEvent): void {
    this.eventForm.patchValue(
      {
        id: event.id,
        title: event.title,
        start: this.dateToShortISOString(event.start),
        end: this.dateToShortISOString(event.end!),
      }
    );
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  deleteEvent(eventToDelete: CalendarEvent) {
    this.eventService.delete(eventToDelete.id!).pipe(
      take(1),
    ).subscribe({
      next: () => {
        this.fetchEvents();
        this.resetEventForm();
        console.log('Esemény sikeresen törölve!');
      },
    });
  }

  updateEvent(eventToEdit: CalendarEvent, newStart: Date | undefined = undefined, newEnd: Date | undefined = undefined): void {
    const newEvent = { ...eventToEdit };
    delete newEvent.draggable;
    delete newEvent.resizable;
    delete newEvent.actions;

    newEvent.start = newStart || newEvent.start;
    newEvent.end = newEnd || newEvent.end;

    this.eventService.update(newEvent).pipe(
      take(1),
    ).subscribe({
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

}
