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
