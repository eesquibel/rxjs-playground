import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, merge, Observable, Subject } from 'rxjs';
import { bufferTime, filter, map, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';
import { SubSink } from 'subsink';

interface Data {
  data: Favorite[];
}

export interface Favorite {
  id: number;
  status: boolean;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FavoriteService implements OnDestroy {

  /**
   * Stream of user-triggered state changes
   */
  private user$: Subject<Favorite[]>;

  /**
   * Stream for server-triggered state changes
   */
  private server$: BehaviorSubject<Favorite[]>;

  /**
   * Combined stream of user and server trigger changes,
   * used by the ui to show immediate reactions to user interaction
   * while the changes are buffered before sent to the server
   */
  private state$: Observable<Favorite[]>;

  /**
   * Stream of individual ui changes for queuing
   */
  private changes$: Subject<Favorite>;

  /**
   * Sink for unsubscribing to subscripions
   */
  private subs = new SubSink();

  constructor(private http: HttpClient) {
    console.log('FavoriteService', 'constructor');

    // Initialize standard streams
    this.user$ = new Subject();
    this.changes$ = new Subject();

    // Get cached copy of data
    let state = [];
    const storage = localStorage.getItem('Favorite');
    if (storage) {
      try {
        state = JSON.parse(storage);
      } catch {
      }
    }

    // Server stream has a default state based from localStorage cache
    this.server$ = new BehaviorSubject(state);

    // Merge the user and server triggered state change stream
    this.state$ = merge(this.user$, this.server$);

    // Refresh the data from the server on first time
    this.http.get<Data>('http://localhost:3000/favorites').subscribe(favorites => this.server$.next(favorites.data));

    // Add the subscription to the sink for eventual subscribing
    this.subs.sink =

    // The magic happens here
    this.changes$.pipe(

      /**
       * First we need to merge the current single update with the most
       * recent state so the ui can be updated immediately
       */
      withLatestFrom(this.state$),
      map(([favorite, favorites]) => {
        favorite.timestamp = (new Date()).getTime();

        let update: Favorite[];
        const index = favorites.findIndex(f => f.id === favorite.id);
        if (index !== -1) {
          update = [...favorites];
          update[index] = Object.assign(update[index], favorite);
        } else {
          update = [favorite, ...favorites];
        }

        // Push the state change to the user stream
        this.user$.next(update);

        return favorite;
      }),

      /**
       * Buffer individual events to an array,
       * returning the list every 5000ms
       */
      bufferTime(5000),

      /**
       * Avoid continuing if there aren't any events in the queue
       */
      filter(updates => updates.length > 0),
      tap(favorites => console.log(favorites)),

      /**
       * Get the latest state (in case it changed since we started) and
       * merge the array of changes into it
       */
      withLatestFrom(this.state$),
      map(([updates, favorites]) => {
        // This creates duplicates, but the changes should be at the end of list
        const combined = [...favorites, ...updates];

        // Reduce the array of duplicates down to an array w/o
        return combined.reduce((dedup, item, i) => {

          // See if the item is already in the list
          const index = dedup.findIndex(f => f.id === item.id);

          // If it is already in the list
          if (index !== -1) {
            /**
             * Assume the current item (which is later in the list) is record to keep,
             * and merge it into the first instance of the same record.
             *
             * We should probably compare timestamps instead of trusting the array order
             */
            dedup[index] = Object.assign(dedup[index], item);

            // Return the reduced array
            return dedup;
          } else {
            /**
             * Current item isn't already in the reduce array,
             * so just return it w/ the new item at the end
             */
            return [...dedup, item];
          }
        }, []);
      }),
      tap(favorites => console.log(favorites)),

      /**
       * Now that we have a merged array of the old state with the new state,
       * send it to the server to update the database
       */
      switchMap(favorites => this.http.patch<Data>('http://localhost:3000/favorites', { data: favorites })),

      /**
       * Ignore this...
       *
       * JSON Server does't let you update an entire collection at once,
       * so I had to do something hacky to make it work.
       */
      map((response: Data): Favorite[] => response.data),
    ) // of the .pipe()

    /**
     * Finally, we have the true state back after all of that.
     * Time to subscribe!
     */
    .subscribe((favorites: Favorite[]) => {
      console.log(favorites);

      /**
       * Update the localStorage cache with the response from the server
       */
      localStorage.setItem('Favorite', JSON.stringify(favorites));

      /**
       * Finally, push the new state to the appropriate stream
       */
      this.server$.next(favorites);
    });
  }

  /**
   * Fired when the service is destroyed...
   */
  public ngOnDestroy(): void {
    console.log('FavoriteService', 'ngOnDestroy');
    // Unsubscribe from any subscriptions in the sink
    this.subs.unsubscribe();
  }

  /**
   * Return the merged stream of user and server-triggered state cahnges
   */
  public get State$(): Observable<Favorite[]> {
    return this.state$;
  }

  /**
   * Add an update to the stream of changes
   */
  public Update(favorite: Favorite): void {
    this.changes$.next(favorite);
  }

}
