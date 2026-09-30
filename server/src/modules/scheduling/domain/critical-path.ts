import { Graph } from './graph';
import { topologicalSort } from './dependency-resolver';

export interface ScheduleNode<Id> {
  id: Id;
  /** Duration in working units (hours or days — the caller decides). Must be >= 0. */
  duration: number;
}

export interface NodeTiming {
  es: number; // earliest start
  ef: number; // earliest finish
  ls: number; // latest start
  lf: number; // latest finish
  slack: number; // total float
}

export interface CriticalPathResult<Id> {
  projectDuration: number;
  /** Critical nodes (slack = 0) in topological order. */
  criticalPath: Id[];
  timings: Map<Id, NodeTiming>;
}

const EPSILON = 1e-9;

/**
 * Critical Path Method: forward pass (ES/EF) then backward pass (LS/LF) in topological order.
 * O(V + E). Dependencies are [predecessor, successor] pairs (finish-to-start).
 */
export function calculateCriticalPath<Id>(
  nodes: ScheduleNode<Id>[],
  dependencies: [Id, Id][],
): CriticalPathResult<Id> {
  const graph = new Graph<Id>();
  const duration = new Map<Id, number>();
  for (const node of nodes) {
    if (node.duration < 0) throw new RangeError(`Negative duration for node ${String(node.id)}`);
    graph.addNode(node.id);
    duration.set(node.id, node.duration);
  }
  for (const [from, to] of dependencies) {
    if (!duration.has(from) || !duration.has(to)) {
      throw new RangeError(`Dependency references unknown node: ${String(from)} -> ${String(to)}`);
    }
    graph.addEdge(from, to);
  }

  const order = topologicalSort(graph);
  const timings = new Map<Id, NodeTiming>();

  let projectDuration = 0;
  for (const id of order) {
    const es = Math.max(0, ...graph.predecessors(id).map((p) => timings.get(p)!.ef));
    const ef = es + duration.get(id)!;
    timings.set(id, { es, ef, ls: 0, lf: 0, slack: 0 });
    projectDuration = Math.max(projectDuration, ef);
  }

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const timing = timings.get(id)!;
    const successors = graph.successors(id);
    timing.lf =
      successors.length === 0
        ? projectDuration
        : Math.min(...successors.map((s) => timings.get(s)!.ls));
    timing.ls = timing.lf - duration.get(id)!;
    timing.slack = timing.ls - timing.es;
  }

  const criticalPath = order.filter((id) => Math.abs(timings.get(id)!.slack) < EPSILON);
  return { projectDuration, criticalPath, timings };
}
