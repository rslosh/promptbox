import type { PromptTreeNode } from "./playground-types";

const IMAGE_NODE_Y = -200;
const IMAGE_NODE_X_STEP = 220;
const ROOT_NODE_Y = 0;
const ROOT_NODE_X_STEP = 380;
// Large enough to clear an expanded node (340px wide, can be 400–600px tall)
const CHILD_Y_STEP = 520;
const SIBLING_X_STEP = 380;

/**
 * Layout the prompt tree.
 *
 * When `newNodeIds` is provided (incremental mode):
 *   - Existing nodes keep their current positions unchanged
 *   - Only the new nodes are positioned relative to their already-placed parent
 *
 * When `newNodeIds` is omitted (full re-layout, e.g. initial hydration from DB):
 *   - All nodes are repositioned from scratch with BFS
 */
export function layoutTree(
  nodes: PromptTreeNode[],
  newNodeIds?: Set<string>
): PromptTreeNode[] {
  if (nodes.length === 0) return nodes;

  const updatedNodes = nodes.map((n) => ({ ...n }));
  const nodeMap = new Map(updatedNodes.map((n) => [n.id, n]));
  const needsPosition = (n: PromptTreeNode) => !newNodeIds || newNodeIds.has(n.id);

  const rootNodes = updatedNodes.filter((n) => n.parentId === null);

  // Full layout: position root nodes
  if (!newNodeIds) {
    rootNodes.forEach((node, i) => {
      node.position = { x: i * ROOT_NODE_X_STEP, y: ROOT_NODE_Y };
    });
    if (rootNodes.length > 1) {
      const totalWidth = (rootNodes.length - 1) * ROOT_NODE_X_STEP;
      rootNodes.forEach((node, i) => {
        node.position.x = i * ROOT_NODE_X_STEP - totalWidth / 2;
      });
    }
  }

  // BFS: walk the tree and position children that need placement
  const queue: PromptTreeNode[] = [...rootNodes];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    const children = updatedNodes.filter((n) => n.parentId === parent.id);
    if (children.length === 0) continue;

    const childrenToPlace = children.filter(needsPosition);

    if (childrenToPlace.length > 0) {
      const parentX = parent.position.x;
      const parentY = parent.position.y;
      const childY = parentY + CHILD_Y_STEP;
      const totalWidth = (children.length - 1) * SIBLING_X_STEP;
      const startX = parentX - totalWidth / 2;

      // Position all children (including already-placed siblings) so X stays
      // correct even when a new sibling is added alongside existing ones.
      children.forEach((child, i) => {
        if (needsPosition(child)) {
          child.position = { x: startX + i * SIBLING_X_STEP, y: childY };
        }
      });
    }

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
