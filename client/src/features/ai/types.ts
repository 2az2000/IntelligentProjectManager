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
  estimateHours: number | null;
}

export interface ProjectDoc {
  markdown: string;
  model: string;
}
