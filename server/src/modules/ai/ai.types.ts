export interface AiAssigneeSuggestion {
  userId: number;
  name: string;
  reason: string;
}

/** AI suggestions for a rough task — a preview only; nothing is written to the DB. */
export interface EnrichedTask {
  description: string;
  subtasks: string[];
  suggestedAssignees: AiAssigneeSuggestion[];
}

export interface ProjectDocResult {
  markdown: string;
  model: string;
}

/** §2 stand-up assistant — yesterday/today/blockers from real activity. */
export interface StandupResult {
  markdown: string;
  model: string;
}

/** §2 comment-thread summary. */
export interface ThreadSummaryResult {
  markdown: string;
  model: string;
}

/** §2 suggested tags drawn from the project's existing tag pool. */
export interface TagSuggestions {
  tags: string[];
}

/** §AI PRD → tasks: one previewed task, applied by the client through the normal endpoints. */
export interface BreakdownDraft {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimateHours: number | null;
  /** Only tags from the project's existing vocabulary (or new ones when it has none). */
  tags: string[];
  /** Indexes into this same array — always smaller than the task's own index. */
  dependsOn: number[];
  assigneeId: number | null;
}

export interface BreakdownResult {
  tasks: BreakdownDraft[];
  model: string;
}

/** §AI chat with a project: read-only, scoped by the asking user's role. */
export interface ProjectChatResult {
  answer: string;
  model: string;
}

/** §AI weekly summary — the same report the Monday job mails. */
export interface WeeklySummaryResult {
  markdown: string;
  model: string;
  range: { from: string; to: string };
  stats: {
    completed: number;
    created: number;
    open: number;
    overdue: number;
    blocked: number;
    activity: number;
    activeMembers: number;
  };
}
