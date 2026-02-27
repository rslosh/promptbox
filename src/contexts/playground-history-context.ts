import { createContext, useContext } from "react";

/**
 * Provides a stable callback that nodes can call to open the lineage modal.
 * Using context avoids putting callbacks in node data (which causes unnecessary
 * re-renders every time the parent re-renders).
 */
export const PlaygroundHistoryContext = createContext<
  ((nodeId: string) => void) | null
>(null);

export function useHistoryHandler() {
  return useContext(PlaygroundHistoryContext);
}
