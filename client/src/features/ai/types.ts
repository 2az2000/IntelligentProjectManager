export interface AiAssigneeSuggestion {
  userId: number;
  name: string;
  reason: string;
}

/** AI preview for a rough task — the user reviews it, then the normal create flow applies it. */
export interface TaskEnrichment {
  description: string;
  subtasks: string[];
  suggestedAssignees: AiAssigneeSuggestion[];
}

export interface ProjectDoc {
  markdown: string;
  model: string;
}

/** §2 stand-up / thread summaries come back as Markdown. */
export interface AiMarkdown {
  markdown: string;
  model: string;
}

/** §2 tag suggestions restricted to the project's own vocabulary. */
export interface TagSuggestions {
  tags: string[];
}

/** §AI PRD breakdown draft — preview only until the user applies it. */
export interface BreakdownTask {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimateHours: number | null;
  tags: string[];
  /** Indexes into the same array; always earlier tasks. */
  dependsOn: number[];
  assigneeId: number | null;
}

export interface BreakdownResult {
  tasks: BreakdownTask[];
  model: string;
}

/** §AI project chat — read-only answer about the current project. */
export interface ProjectChatResult {
  answer: string;
  model: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** §AI weekly report; `stats` are the same numbers the Monday email is built from. */
export interface WeeklySummary {
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
