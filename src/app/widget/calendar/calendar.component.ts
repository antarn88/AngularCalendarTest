import { Component, ChangeDetectionStrategy, ViewChild, TemplateRef, OnInit } from '@angular/core';
import { startOfDay, endOfDay, isSameDay, isSameMonth } from 'date-fns';
import { BehaviorSubject, Subject, take } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CalendarEvent, CalendarEventAction, CalendarEventTimesChangedEvent, CalendarView } from 'angular-calendar';
import { EventService } from 'src/app/service/event.service';

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
  styleUrls: ['./calendar.component.scss']
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
        // this.updateEvent(event);
        this.handleEvent('Edited', event);
      },
    },
    {
      label: '<i class="bi bi-trash-fill"></i>',
      a11yLabel: 'Delete',
      onClick: ({ event }: { event: CalendarEvent; }): void => {
        this.deleteEvent(event);
        this.events.next(this.events.getValue().filter((iEvent) => iEvent !== event));
        // this.handleEvent('Deleted', event);
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

  activeDayIsOpen: boolean = true;

  // locale: string = 'hu';

  clickedDate!: Date;

  clickedColumn!: number;

  constructor(
    private modal: NgbModal,
    private eventService: EventService,
  ) { }

  ngOnInit(): void {
    this.fetchEvents();
  }

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[]; }): void {
    this.clickedDate = date;
    if (isSameMonth(date, this.viewDate)) {
      if (
        (isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) ||
        events.length === 0
      ) {
        this.handleEvent('Created', { start: this.clickedDate, end: this.clickedDate, title: '' });
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
        // this.handleEvent('Created', { start: this.clickedDate, end: this.clickedDate, title: '' });
      }
      this.viewDate = date;
      // this.handleEvent('Created', { start: this.clickedDate, end: this.clickedDate, title: '' });
    }

  }

  hourSegmentClicked(event: any): void {
    this.handleEvent('Created', event);
    this.clickedDate = event.date;
  }

  eventTimesChanged({
    event,
    newStart,
    newEnd,
  }: CalendarEventTimesChangedEvent): void {

    this.events.next(this.events.getValue().map((iEvent) => {
      if (iEvent === event) {
        return {
          ...event,
          start: newStart,
          end: newEnd,
        };
      }
      return iEvent;
    }));
    this.updateEvent(event, newStart, newEnd);
    // this.handleEvent('Dropped or resized', event);
  }

  handleEvent(action: string, event: CalendarEvent): void {
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  addEvent(): void {
    const newEventList = this.events.getValue();
    newEventList.push({
      title: 'New event',
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
      color: colors.red,
      draggable: true,
      resizable: {
        beforeStart: true,
        afterEnd: true,
      },
    });
    this.events.next(newEventList);
  }

  deleteEvent(eventToDelete: CalendarEvent) {
    this.eventService.delete(eventToDelete.id!).pipe(
      take(1),
    ).subscribe({
      next: () => {
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

    // console.log('új esemény start:', newStart);
    // console.log('új esemény end:', newEnd);

    this.eventService.update(newEvent).pipe(
      take(1),
    ).subscribe({
      next: () => {
        this.fetchEvents();
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
    this.eventService.getAll().pipe(
      take(1),
    ).subscribe({
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

}
