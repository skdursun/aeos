import type { TemplateVariableMap } from "./variable-resolver.js";
import { resolveTemplateVariables } from "./variable-resolver.js";

export interface TemplateRenderInput {
  readonly content: string;
  readonly variables: TemplateVariableMap;
}

export type TemplateRenderResult =
  | {
      readonly ok: true;
      readonly content: string;
      readonly missingVariables: readonly [];
    }
  | {
      readonly ok: false;
      readonly content: string;
      readonly missingVariables: readonly string[];
    };

export interface TemplateRenderValidationResult {
  readonly ok: boolean;
  readonly issues: readonly TemplateRenderValidationIssue[];
}

export type TemplateRenderValidationIssueCode =
  | "template_render_success_has_missing_variables"
  | "template_render_failure_has_no_missing_variables"
  | "template_render_missing_variable_is_empty";

export interface TemplateRenderValidationIssue {
  readonly code: TemplateRenderValidationIssueCode;
  readonly message: string;
  readonly variableName?: string;
}

export function renderTemplate(
  content: string,
  variables: TemplateVariableMap,
): TemplateRenderResult {
  const resolvedVariables = resolveTemplateVariables(content, variables);

  if (resolvedVariables.ok) {
    return {
      ok: true,
      content: resolvedVariables.content,
      missingVariables: [],
    };
  }

  return {
    ok: false,
    content: resolvedVariables.content,
    missingVariables: resolvedVariables.missingVariables,
  };
}

export function validateRenderResult(
  result: TemplateRenderResult,
): TemplateRenderValidationResult {
  const issues: TemplateRenderValidationIssue[] = [];

  if (result.ok && result.missingVariables.length > 0) {
    issues.push({
      code: "template_render_success_has_missing_variables",
      message: "Successful template render must not include missing variables.",
    });
  }

  if (!result.ok && result.missingVariables.length === 0) {
    issues.push({
      code: "template_render_failure_has_no_missing_variables",
      message: "Failed template render must include at least one missing variable.",
    });
  }

  for (const variableName of result.missingVariables) {
    if (variableName.length === 0) {
      issues.push({
        code: "template_render_missing_variable_is_empty",
        message: "Missing template variable name must not be empty.",
        variableName,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
