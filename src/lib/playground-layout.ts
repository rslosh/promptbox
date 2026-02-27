import type { PromptTreeNode } from "./playground-types";

const IMAGE_NODE_Y = -160;
const IMAGE_NODE_X_STEP = 220;
const ROOT_NODE_Y = 0;
const ROOT_NODE_X_STEP = 300;
const CHILD_Y_STEP = 220;
const SIBLING_X_STEP = 300;

export function layoutTree(nodes: PromptTreeNode[]): PromptTreeNode[] {
  if (nodes.length === 0) return nodes;

  const updatedNodes = nodes.map((n) => ({ ...n }));
  const nodeMap = new Map(updatedNodes.map((n) => [n.id, n]));

  // Separate image-reference nodes (no parentId, mode=generate, no content = placeholder)
  // from real prompt nodes. We identify image nodes by a special marker if needed,
  // but image nodes are kept in the React Flow state separately. Here we only layout
  // PromptTreeNodes.

  // Root nodes: parentId === null
  const rootNodes = updatedNodes.filter((n) => n.parentId === null);

  // Layout root nodes
  rootNodes.forEach((node, i) => {
    node.position = {
      x: i * ROOT_NODE_X_STEP,
      y: ROOT_NODE_Y,
    };
  });

  // Center root nodes
  if (rootNodes.length > 1) {
    const totalWidth = (rootNodes.length - 1) * ROOT_NODE_X_STEP;
    rootNodes.forEach((node, i) => {
      node.position.x = i * ROOT_NODE_X_STEP - totalWidth / 2;
    });
  }

  // BFS to layout children
  const queue: PromptTreeNode[] = [...rootNodes];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    const children = updatedNodes.filter((n) => n.parentId === parent.id);

    if (children.length === 0) continue;

    const parentX = parent.position.x;
    const parentY = parent.position.y;
    const childY = parentY + CHILD_Y_STEP;

    // Center siblings on parent's X
    const totalWidth = (children.length - 1) * SIBLING_X_STEP;
    const startX = parentX - totalWidth / 2;

    children.forEach((child, i) => {
      child.position = {
        x: startX + i * SIBLING_X_STEP,
        y: childY,
      };
    });

    queue.push(...children);
  }

  return updatedNodes;
}

export function getImageNodePositions(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const totalWidth = (count - 1) * IMAGE_NODE_X_STEP;
  for (let i = 0; i < count; i++) {
    positions.push({
      x: i * IMAGE_NODE_X_STEP - totalWidth / 2,
      y: IMAGE_NODE_Y,
    });
  }
  return positions;
}
