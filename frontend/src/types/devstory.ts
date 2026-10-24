// Mirrors backend/app/schemas.py (DevStoryOutput)

export type JiraPriority = "Highest" | "High" | "Medium" | "Low" | "Lowest";
export type JiraIssueType = "Story" | "Task" | "Bug" | "Epic";

export interface JiraStory {
  summary: string;
  description: string;
  acceptance_criteria: string[];
  story_points: number;
  priority: JiraPriority;
  issue_type: JiraIssueType;
}

export interface DevStoryOutput {
  title: string;
  prd_markdown: string;
  jira_json: JiraStory[];
  mermaid_diagram: string;
  react_code: string;
}

export type InputType = "text" | "audio" | "image" | "mixed";

export interface MultimodalPayload {
  text?: string;
  image?: File;
  audio?: Blob;
  projectId?: string;
}
