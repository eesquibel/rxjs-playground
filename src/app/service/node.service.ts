import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface NodeBase {
  id: number;
  title: string;
}

@Injectable({
  providedIn: 'root'
})
export class NodeService {

  private state$: BehaviorSubject<NodeBase[]>;

  constructor(private http: HttpClient) {
    this.state$ = new BehaviorSubject<NodeBase[]>(null);

    this.Get().subscribe(nodes => this.state$.next(nodes));
  }

  private Get(): Observable<NodeBase[]> {
    return this.http.get<NodeBase[]>('http://localhost:3000/node');
  }

  public get State$(): Observable<NodeBase[]> {
    return this.state$.pipe(filter(nodes => nodes !== null));
  }
}
