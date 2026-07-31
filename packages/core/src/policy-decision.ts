import type { PolicyDecision } from "./policy.js";
import type { PermissionLevel, RiskClass } from "./types.js";

export type CreatePolicyDecisionInput = PolicyDecision;

export type PolicyDecisionActionInput = Omit<PolicyDecision, "status">;

const destructiveRiskClasses: readonly RiskClass[] = [
  "file_delete",
  "migration",
  "deployment",
  "destructive",
];

export function createPolicyDecision(
  input: CreatePolicyDecisionInput,
): PolicyDecision {
  return {
    ...input,
  };
}

export function allowAction(input: PolicyDecisionActionInput): PolicyDecision {
  return createPolicyDecision({
    ...input,
    status: "allow",
  });
}

export function denyAction(input: PolicyDecisionActionInput): PolicyDecision {
  return createPolicyDecision({
    ...input,
    status: "deny",
  });
}

export function requireApproval(
  input: PolicyDecisionActionInput,
): PolicyDecision {
  return createPolicyDecision({
    ...input,
    status: "requires_approval",
  });
}

export function isPolicyAllowed(decision: PolicyDecision): boolean {
  return decision.status === "allow";
}

export function isPolicyDenied(decision: PolicyDecision): boolean {
  return decision.status === "deny";
}

export function isApprovalRequired(decision: PolicyDecision): boolean {
  return decision.status === "requires_approval";
}

export function isDestructiveRiskClass(riskClass: RiskClass): boolean {
  return destructiveRiskClasses.includes(riskClass);
}

export function requiresHumanApproval(
  riskClass: RiskClass,
  permissionLevel: PermissionLevel,
): boolean {
  if (permissionLevel === "deployment_requires_approval") {
    return riskClass === "deployment";
  }

  if (permissionLevel === "destructive_requires_approval") {
    return isDestructiveRiskClass(riskClass);
  }

  return false;
}
