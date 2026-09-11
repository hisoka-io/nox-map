import { mapJsonToNodeMetrics } from "./useMetrics";

const fixture = {
  cumulativeAuthorizedRevenueUsd: 2.5,
  cumulativeCostUsd: 1,
  cumulativeMaximumCostUsd: 1.2,
  profitableCount: 7,
  unprofitableCount: 3,
};

const metrics = mapJsonToNodeMetrics(fixture);
const maximumAuthorizedCost: number = metrics.cumulativeMaximumCostUsd;
void maximumAuthorizedCost;
