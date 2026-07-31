import {
  allowAction,
  createPolicyDecision,
  denyAction,
  isApprovalRequired,
  isDestructiveRiskClass,
  isPolicyAllowed,
  isPolicyDenied,
  requireApproval,
  requiresHumanApproval,
} from "./policy-decision.js";
import type { PolicyDecision } from "./policy.js";

const baseDecision = {
  id: "policy-decision-example",
  actionId: "policy-action-example",
  riskClass: "safe_read",
  permissionLevel: "read_only",
  reason: "Example policy decision.",
  matchedRuleIds: ["policy-rule-example"],
  auditRequired: false,
  decidedAt: "2026-07-31T00:00:00.000Z",
} satisfies Omit<PolicyDecision, "status">;

export const createdDecision: PolicyDecision = createPolicyDecision({
  ...baseDecision,
  status: "allow",
});

export const allowedDecision: PolicyDecision = allowAction(baseDecision);

export const deniedDecision: PolicyDecision = denyAction({
  ...baseDecision,
  id: "policy-decision-denied-example",
  reason: "Example denied policy decision.",
});

export const approvalRequiredDecision: PolicyDecision = requireApproval({
  ...baseDecision,
  id: "policy-decision-approval-example",
  riskClass: "deployment",
  permissionLevel: "deployment_requires_approval",
  reason: "Example approval-required policy decision.",
});

export const policyDecisionChecks = {
  createdIsAllowed: isPolicyAllowed(createdDecision),
  allowedIsAllowed: isPolicyAllowed(allowedDecision),
  deniedIsDenied: isPolicyDenied(deniedDecision),
  approvalIsRequired: isApprovalRequired(approvalRequiredDecision),
  deploymentIsDestructive: isDestructiveRiskClass("deployment"),
  safeReadIsDestructive: isDestructiveRiskClass("safe_read"),
  deploymentNeedsApproval: requiresHumanApproval(
    "deployment",
    "deployment_requires_approval",
  ),
  destructiveNeedsApproval: requiresHumanApproval(
    "destructive",
    "destructive_requires_approval",
  ),
  safeReadNeedsApproval: requiresHumanApproval("safe_read", "read_only"),
} as const;
