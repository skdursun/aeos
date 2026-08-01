import type { DiscoveredTemplate } from "./discovery.js";
import type { TemplateMetadata } from "./metadata-reader.js";

export interface TemplateSelectionRequest {
  readonly templateId: string;
}

export type TemplateSelectionIssueCode =
  | "template_selection_invalid_request"
  | "template_not_found"
  | "ambiguous_template_selection";

export interface TemplateSelectionIssue {
  readonly code: TemplateSelectionIssueCode;
  readonly message: string;
  readonly templateId?: string;
}

export type TemplateSelectionResult =
  | {
      readonly ok: true;
      readonly request: TemplateSelectionRequest;
      readonly templateId: string;
      readonly template: DiscoveredTemplate;
      readonly metadata: TemplateMetadata;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly request: TemplateSelectionRequest;
      readonly templateId?: string;
      readonly template: undefined;
      readonly metadata: undefined;
      readonly issues: readonly TemplateSelectionIssue[];
    };

export interface TemplateSelectionValidationResult {
  readonly ok: boolean;
  readonly issues: readonly TemplateSelectionIssue[];
}

export function selectTemplate(
  templates: readonly DiscoveredTemplate[],
  request: TemplateSelectionRequest,
): TemplateSelectionResult {
  const templateId = request.templateId;

  if (templateId.length === 0) {
    return {
      ok: false,
      request,
      template: undefined,
      metadata: undefined,
      issues: [
        {
          code: "template_selection_invalid_request",
          message: "Template selection requires a template id.",
        },
      ],
    };
  }

  const matchingTemplates = templates.filter(
    (template) => template.id === templateId,
  );

  if (matchingTemplates.length === 1) {
    const template = matchingTemplates[0];

    return {
      ok: true,
      request,
      templateId,
      template,
      metadata: template.metadata,
      issues: [],
    };
  }

  if (matchingTemplates.length > 1) {
    return {
      ok: false,
      request,
      templateId,
      template: undefined,
      metadata: undefined,
      issues: [
        {
          code: "ambiguous_template_selection",
          message: `Multiple templates match id: ${templateId}`,
          templateId,
        },
      ],
    };
  }

  return {
    ok: false,
    request,
    templateId,
    template: undefined,
    metadata: undefined,
    issues: [
      {
        code: "template_not_found",
        message: `Template was not found: ${templateId}`,
        templateId,
      },
    ],
  };
}

export function validateTemplateSelection(
  result: TemplateSelectionResult,
): TemplateSelectionValidationResult {
  if (!result.ok) {
    return {
      ok: result.issues.length > 0,
      issues: result.issues.length > 0
        ? []
        : [
            {
              code: "template_selection_invalid_request",
              message: "Template selection failure must include an issue.",
              templateId: result.templateId,
            },
          ],
    };
  }

  const issues: TemplateSelectionIssue[] = [];

  if (result.templateId.length === 0) {
    issues.push({
      code: "template_selection_invalid_request",
      message: "Selected template id must not be empty.",
    });
  }

  if (result.template.id !== result.templateId) {
    issues.push({
      code: "template_selection_invalid_request",
      message: "Selected template id does not match the requested id.",
      templateId: result.templateId,
    });
  }

  if (result.metadata.id !== result.template.id) {
    issues.push({
      code: "template_selection_invalid_request",
      message: "Selected template metadata id does not match the template id.",
      templateId: result.templateId,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
