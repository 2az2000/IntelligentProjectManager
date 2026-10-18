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
