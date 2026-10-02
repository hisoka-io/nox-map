import { useMemo } from "react";
import { useDashboardStore } from "../store/useDashboardStore";
import { placeNodes, type Placement } from "../store/placement";

export function useNodePlacement(): Placement {
  const nodes = useDashboardStore((s) => s.nodes);
  return useMemo(() => placeNodes(nodes), [nodes]);
}
