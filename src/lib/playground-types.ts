export interface PromptTreeNode {
  id: string;
  content: string;
  mode: "generate" | "edit" | "duplicate";
  instruction: string;
  imageIds: string[];
  parentId: string | null;
  position: { x: number; y: number };
  createdAt: string;
  model?: string;
}

export type PromptTree = PromptTreeNode[];
