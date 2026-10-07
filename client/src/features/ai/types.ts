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

/** §2 smart estimate anchored on the team's own closed tasks. */
export interface EstimateSuggestion {
  estimateHours: number | null;
  points: number | null;
  /** Similar closed tasks the suggestion drew from (0 = generic). */
  basedOn: number;
  rationale: string;
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
