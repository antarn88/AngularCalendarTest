import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { CalendarEvent } from 'angular-calendar';

@Injectable({
  providedIn: 'root'
})
export class EventService {

  serverUrl = 'http://localhost:3000/events';

  constructor(
    private http: HttpClient,
  ) { }

  getAll(): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(this.serverUrl).pipe(
      map(item => {
        const originalArray = item;
        originalArray.map(item => item.start = new Date(item.start));
        originalArray.map(item => item.end = new Date(item.end!));
        return originalArray;
      })
    );
  };

  getOne(id: string | number): Observable<CalendarEvent> {
    return this.http.get<CalendarEvent>(`${this.serverUrl}/${id}`);
  }

  create(event: CalendarEvent): Observable<CalendarEvent> {
    return this.http.post<CalendarEvent>(this.serverUrl, event);
  }

  update(event: CalendarEvent): Observable<CalendarEvent> {
    return this.http.put<CalendarEvent>(`${this.serverUrl}/${event.id}`, event);
  }

  delete(id: string | number): Observable<{}> {
    return this.http.delete<{}>(`${this.serverUrl}/${id}`);
  }
}