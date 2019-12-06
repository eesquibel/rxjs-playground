import { Component, OnInit, OnDestroy } from '@angular/core';
import { withLatestFrom, map, debounceTime, take } from 'rxjs/operators';
import { SubSink } from 'subsink';

import { FavoriteService } from '../service/favorite.service';
import { NodeService, NodeBase } from '../service/node.service';
import { MatSelectionListChange } from '@angular/material/list';
import { Observable, Subject } from 'rxjs';

interface NodeFavorite extends NodeBase {
  favorite: boolean;
}

@Component({
  selector: 'app-favorite',
  templateUrl: './favorite.component.html',
  styleUrls: ['./favorite.component.scss']
})
export class FavoriteComponent implements OnInit, OnDestroy {

  public nodes$ = this.node.State$.pipe(withLatestFrom(this.favorite.State$), map(([nodes, favorites]) => {
    return nodes.map(node =>
      Object.assign(node, { favorite: favorites.find(favorite => favorite.status && favorite.id === node.id) !== undefined })
    ) as NodeFavorite[];
  }));

  public favorites$ = this.favorite.State$;

  private changes$: Map<number, Subject<boolean>> = new Map();

  private subs = new SubSink();

  constructor(
    private favorite: FavoriteService,
    private node: NodeService
  ) {
  }

  public ngOnInit(): void {
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private change(id: number, status: boolean): void {
    this.favorite.Update({
      id,
      status
    }).pipe(take(1)).subscribe();
  }

  public selectionChange(event: MatSelectionListChange): void {

    let changes$: Subject<boolean>;
    const node: NodeFavorite = event.option.value;

    if (!this.changes$.has(node.id)) {
      changes$ = new Subject();
      this.changes$.set(node.id, changes$);

      this.subs.sink = changes$.pipe(debounceTime(750)).subscribe(status => {
        console.log(node.id, status);
        this.change(node.id, status);
      });
    } else {
      changes$ = this.changes$.get(node.id);
    }

    changes$.next(event.option.selected);
  }

}
