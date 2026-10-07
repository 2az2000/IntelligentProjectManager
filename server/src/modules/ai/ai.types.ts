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
  estimateHours: number | null;
}

export interface ProjectDocResult {
  markdown: string;
  model: string;
}

/** §2 smart estimate — honest about the sample size behind the number. */
export interface EstimateSuggestion {
  estimateHours: number | null;
  points: number | null;
  /** How many similar closed tasks the suggestion was based on (0 = generic). */
  basedOn: number;
  rationale: string;
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
