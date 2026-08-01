import {
  discoverTemplates,
  findTemplateById,
  listTemplateIds,
} from "./discovery.js";
import type {
  DiscoveredTemplate,
  TemplateDiscoveryIssue,
  TemplateDiscoveryResult,
  TemplateLookupResult,
} from "./discovery.js";

interface DiscoverySummary {
  readonly templateIds: readonly string[];
  readonly issueCodes: readonly string[];
}

export function summarizeDiscoveredTemplates(
  templatesRootPath: string,
): DiscoverySummary {
  const discovery = discoverTemplates(templatesRootPath);

  if (!discovery.ok) {
    return {
      templateIds: [],
      issueCodes: discovery.issues.map((issue) => issue.code),
    };
  }

  return summarizeDiscovery(discovery);
}

export function summarizeEmptyDiscovery(): DiscoverySummary {
  return summarizeDiscovery({
    ok: true,
    root: "/example/templates",
    templates: [],
    issues: [],
  });
}

export function lookupTemplateId(
  templates: readonly DiscoveredTemplate[],
  templateId: string,
): TemplateLookupResult {
  return findTemplateById(templates, templateId);
}

export function listDiscoveredTemplateIds(
  templates: readonly DiscoveredTemplate[],
): readonly string[] {
  return listTemplateIds(templates);
}

function summarizeDiscovery(discovery: TemplateDiscoveryResult): DiscoverySummary {
  return {
    templateIds: listTemplateIds(discovery.templates),
    issueCodes: discovery.issues.map(toIssueCode),
  };
}

function toIssueCode(issue: TemplateDiscoveryIssue): string {
  return issue.code;
}
