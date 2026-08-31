import { normalizeArkCodingPlanUsage } from "../normalize.js";
import { createArkPlanUsageAdapter } from "./ark-plan.js";

export const ARK_CODING_PLAN_PRODUCT = "coding-plan";

export function createArkCodingPlanUsageAdapter() {
	return createArkPlanUsageAdapter({
		id: "volcengine-coding-plan",
		displayName: "Volcano Engine Coding Plan",
		product: ARK_CODING_PLAN_PRODUCT,
		normalize: normalizeArkCodingPlanUsage,
	});
}
