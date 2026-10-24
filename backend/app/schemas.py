"""Pydantic contracts. `DevStoryOutput` is passed to Gemini as `response_schema`."""

from enum import Enum

from pydantic import BaseModel, Field


class JiraPriority(str, Enum):
    highest = "Highest"
    high = "High"
    medium = "Medium"
    low = "Low"
    lowest = "Lowest"


class JiraIssueType(str, Enum):
    story = "Story"
    task = "Task"
    bug = "Bug"
    epic = "Epic"


class JiraStory(BaseModel):
    summary: str = Field(..., description="Short title: 'Como <rol>, quiero <acción> para <beneficio>'.")
    description: str = Field(..., description="Detailed description of the user story.")
    # No defaults: Gemini response_schema does not accept JSON Schema `default`.
    acceptance_criteria: list[str] = Field(..., description="Gherkin-style criteria.")
    story_points: int = Field(..., description="Fibonacci estimate (1,2,3,5,8,13).")
    priority: JiraPriority = Field(..., description="Jira priority.")
    issue_type: JiraIssueType = Field(..., description="Jira issue type.")


class DevStoryOutput(BaseModel):
    title: str = Field(..., description="Concise product/feature name.")
    prd_markdown: str = Field(
        ...,
        description="Formal PRD in Markdown: Objetivo, Historias de Usuario, Criterios de Aceptación, Flujos de Pantalla.",
    )
    jira_json: list[JiraStory] = Field(..., description="User stories ready for Jira/Trello import.")
    mermaid_diagram: str = Field(..., description="Valid Mermaid.js syntax (flowchart/sequence), no code fences.")
    react_code: str = Field(
        ...,
        description="Single self-contained React functional component (default export `App`) using Tailwind classes, no imports.",
    )
