import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, merge, Observable, Subject } from 'rxjs';
import { delay, map, switchMap, take, tap } from 'rxjs/operators';

export interface Favorite {
  id: number;
  status: boolean;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {

  private client$: Subject<Favorite[]>;
  private server$: BehaviorSubject<Favorite[]>;
  private state$: Observable<Favorite[]>;

  constructor(private http: HttpClient) {
    this.client$ = new Subject();

    let state = [];
    const storage = localStorage.getItem('Favorite');
    if (storage) {
      try {
        state = JSON.parse(storage);
      } catch {
      }
    }

    this.server$ = new BehaviorSubject(state);

    this.state$ = merge(this.client$, this.server$);

    this.http.get<Favorite[]>('http://localhost:3000/favorite?_sort=id').subscribe(favorites => this.server$.next(favorites));
  }

  public get State$(): Observable<Favorite[]> {
    return this.state$;
  }

  public Update(favorite: Favorite): Observable<Favorite[]> {

    if (!('timestamp' in favorite) || !favorite.timestamp) {
      favorite.timestamp = (new Date()).getTime();
    }

    return this.server$.pipe(
      take(1),
      map(favorites => {
        let update: Favorite[];
        const index = favorites.findIndex(f => f.id === favorite.id);
        if (index !== -1) {
          update = [...favorites];
          update[index] = Object.assign(update[index], favorite);
        } else {
          update = [favorite, ...favorites];
        }

        this.client$.next(update);

        return index !== -1;
      }),
      switchMap(existing => {
        let next: Observable<Favorite>;
        favorite.timestamp = (new Date()).getTime();

        if (existing) {
          next = this.http.patch<Favorite>('http://localhost:3000/favorite/' + favorite.id, favorite);
        } else {
          next = this.http.post<Favorite>('http://localhost:3000/favorite', favorite);
        }

        return next;
      }),
      switchMap(() => this.http.get<Favorite[]>('http://localhost:3000/favorite?_sort=id')),
      tap(favorites => localStorage.setItem('Favorite', JSON.stringify(favorites))),
      tap(favorites => this.server$.next(favorites))
    );
  }
}
