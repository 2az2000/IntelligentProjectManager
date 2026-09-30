import { Graph } from './graph';

export class DependencyCycleError extends Error {
  constructor(public readonly nodes: unknown[]) {
    super('Cycle detected in dependencies');
    this.name = 'DependencyCycleError';
  }
}

/**
 * Topological sort with Kahn's algorithm — O(V + E).
 * Throws DependencyCycleError listing the nodes that are part of (or blocked by) a cycle.
 */
export function topologicalSort<T>(graph: Graph<T>): T[] {
  const inDegree = new Map<T, number>();
  for (const node of graph.nodes()) inDegree.set(node, graph.predecessors(node).length);

  const queue: T[] = graph.nodes().filter((n) => inDegree.get(n) === 0);
  const order: T[] = [];

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    order.push(current);
    for (const next of graph.successors(current)) {
      const remaining = inDegree.get(next)! - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length !== inDegree.size) {
    throw new DependencyCycleError(graph.nodes().filter((n) => inDegree.get(n)! > 0));
  }
  return order;
}

export function hasCycle<T>(graph: Graph<T>): boolean {
  try {
    topologicalSort(graph);
    return false;
  } catch (err) {
    if (err instanceof DependencyCycleError) return true;
    throw err;
  }
}

/**
 * Would adding the edge `from -> to` create a cycle? True when `from` is reachable from `to`
 * (or both are the same node). Iterative DFS — O(V + E), does not mutate the graph.
 */
export function wouldCreateCycle<T>(graph: Graph<T>, from: T, to: T): boolean {
  if (from === to) return true;
  const stack: T[] = [to];
  const seen = new Set<T>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...graph.successors(node));
  }
  return false;
}
