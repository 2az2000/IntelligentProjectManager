/** Directed graph backed by adjacency lists. Edges point from predecessor to successor. */
export class Graph<T> {
  private readonly outgoing = new Map<T, T[]>();
  private readonly incoming = new Map<T, T[]>();

  addNode(node: T): void {
    if (!this.outgoing.has(node)) {
      this.outgoing.set(node, []);
      this.incoming.set(node, []);
    }
  }

  addEdge(from: T, to: T): void {
    this.addNode(from);
    this.addNode(to);
    this.outgoing.get(from)!.push(to);
    this.incoming.get(to)!.push(from);
  }

  successors(node: T): readonly T[] {
    return this.outgoing.get(node) ?? [];
  }

  predecessors(node: T): readonly T[] {
    return this.incoming.get(node) ?? [];
  }

  nodes(): T[] {
    return [...this.outgoing.keys()];
  }

  hasNode(node: T): boolean {
    return this.outgoing.has(node);
  }
}
