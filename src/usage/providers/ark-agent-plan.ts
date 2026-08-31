import { normalizeArkAgentPlanUsage } from "../normalize.js";
import { createArkPlanUsageAdapter } from "./ark-plan.js";

export const ARK_AGENT_PLAN_PRODUCT = "agent-plan";

export function createArkAgentPlanUsageAdapter() {
	return createArkPlanUsageAdapter({
		id: "volcengine-agent-plan",
		displayName: "Volcano Engine Agent Plan",
		product: ARK_AGENT_PLAN_PRODUCT,
		normalize: normalizeArkAgentPlanUsage,
	});
}
