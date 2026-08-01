import type {
  TemplateMetadata,
  TemplateMetadataReadErrorCode,
} from "./metadata-reader.js";
import { readTemplateMetadata } from "./metadata-reader.js";

export const templateMetadataFileName = "template.json";

export interface TemplateDiscoveryOptions {
  readonly metadataFileName?: string;
}

export interface DiscoveredTemplate {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly metadataPath: string;
  readonly metadata: TemplateMetadata;
}

export type TemplateDiscoveryIssueCode =
  | "templates_root_missing"
  | "templates_root_not_directory"
  | "templates_root_read_failed"
  | TemplateMetadataReadErrorCode
  | "duplicate_template_id"
  | "template_not_found";

export interface TemplateDiscoveryIssue {
  readonly code: TemplateDiscoveryIssueCode;
  readonly message: string;
  readonly path?: string;
  readonly templateId?: string;
}

export type TemplateDiscoveryResult =
  | {
      readonly ok: true;
      readonly root: string;
      readonly templates: readonly DiscoveredTemplate[];
      readonly issues: readonly TemplateDiscoveryIssue[];
    }
  | {
      readonly ok: false;
      readonly root: string;
      readonly templates: readonly DiscoveredTemplate[];
      readonly issues: readonly TemplateDiscoveryIssue[];
    };

export type TemplateLookupResult =
  | {
      readonly ok: true;
      readonly template: DiscoveredTemplate;
      readonly issue?: undefined;
    }
  | {
      readonly ok: false;
      readonly template: undefined;
      readonly issue: TemplateDiscoveryIssue;
    };

interface DirectoryEntry {
  readonly name: string;
  isDirectory(): boolean;
}

interface FileStats {
  isDirectory(): boolean;
}

type ReaddirSync = (
  path: string,
  options: { readonly withFileTypes: true },
) => readonly DirectoryEntry[];
type LstatSync = (path: string) => FileStats;
type Resolve = (...paths: readonly string[]) => string;

interface FilesystemApi {
  readonly readdirSync: ReaddirSync;
  readonly lstatSync: LstatSync;
}

interface PathApi {
  readonly resolve: Resolve;
}

export function discoverTemplates(
  rootPath: string,
  options: TemplateDiscoveryOptions = {},
): TemplateDiscoveryResult {
  const root = getPathApi().resolve(rootPath);
  const metadataFileName = options.metadataFileName ?? templateMetadataFileName;
  const fs = getFilesystemApi();

  let rootStats: FileStats;

  try {
    rootStats = fs.lstatSync(root);
  } catch (error) {
    return {
      ok: false,
      root,
      templates: [],
      issues: [
        {
          code: errorHasCode(error, "ENOENT")
            ? "templates_root_missing"
            : "templates_root_read_failed",
          message: errorHasCode(error, "ENOENT")
            ? `Templates root was not found: ${root}`
            : `Templates root could not be read: ${root}`,
          path: root,
        },
      ],
    };
  }

  if (!rootStats.isDirectory()) {
    return {
      ok: false,
      root,
      templates: [],
      issues: [
        {
          code: "templates_root_not_directory",
          message: `Templates root is not a directory: ${root}`,
          path: root,
        },
      ],
    };
  }

  let entries: readonly DirectoryEntry[];

  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return {
      ok: false,
      root,
      templates: [],
      issues: [
        {
          code: "templates_root_read_failed",
          message: `Templates root could not be read: ${root}`,
          path: root,
        },
      ],
    };
  }

  const path = getPathApi();
  const templates: DiscoveredTemplate[] = [];
  const issues: TemplateDiscoveryIssue[] = [];
  const candidateEntries = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of candidateEntries) {
    const templatePath = path.resolve(root, entry.name);
    const metadataPath = path.resolve(templatePath, metadataFileName);
    const metadataResult = readTemplateMetadata(metadataPath);

    if (!metadataResult.ok) {
      issues.push({
        code: metadataResult.error.code,
        message: metadataResult.error.message,
        path: metadataResult.error.path,
      });
      continue;
    }

    templates.push({
      id: metadataResult.metadata.id,
      name: metadataResult.metadata.name,
      path: templatePath,
      metadataPath,
      metadata: metadataResult.metadata,
    });
  }

  issues.push(...getDuplicateTemplateIssues(templates));

  return {
    ok: true,
    root,
    templates: templates.sort(compareTemplates),
    issues: issues.sort(compareIssues),
  };
}

export function findTemplateById(
  templates: readonly DiscoveredTemplate[],
  id: string,
): TemplateLookupResult {
  const matchingTemplates = templates.filter((template) => template.id === id);

  if (matchingTemplates.length === 1) {
    return {
      ok: true,
      template: matchingTemplates[0],
    };
  }

  if (matchingTemplates.length > 1) {
    return {
      ok: false,
      template: undefined,
      issue: {
        code: "duplicate_template_id",
        message: `Multiple templates use the same id: ${id}`,
        templateId: id,
      },
    };
  }

  return {
    ok: false,
    template: undefined,
    issue: {
      code: "template_not_found",
      message: `Template was not found: ${id}`,
      templateId: id,
    },
  };
}

export function listTemplateIds(
  templates: readonly DiscoveredTemplate[],
): readonly string[] {
  return templates
    .map((template) => template.id)
    .sort((left, right) => left.localeCompare(right));
}

function getDuplicateTemplateIssues(
  templates: readonly DiscoveredTemplate[],
): readonly TemplateDiscoveryIssue[] {
  const templatesById = new Map<string, DiscoveredTemplate[]>();

  for (const template of templates) {
    const matchingTemplates = templatesById.get(template.id) ?? [];
    matchingTemplates.push(template);
    templatesById.set(template.id, matchingTemplates);
  }

  const issues: TemplateDiscoveryIssue[] = [];

  for (const [id, matchingTemplates] of templatesById) {
    if (matchingTemplates.length <= 1) {
      continue;
    }

    for (const template of matchingTemplates) {
      issues.push({
        code: "duplicate_template_id",
        message: `Multiple templates use the same id: ${id}`,
        path: template.path,
        templateId: id,
      });
    }
  }

  return issues;
}

function compareTemplates(
  left: DiscoveredTemplate,
  right: DiscoveredTemplate,
): number {
  const idOrder = left.id.localeCompare(right.id);

  if (idOrder !== 0) {
    return idOrder;
  }

  return left.path.localeCompare(right.path);
}

function compareIssues(
  left: TemplateDiscoveryIssue,
  right: TemplateDiscoveryIssue,
): number {
  const leftPath = left.path ?? "";
  const rightPath = right.path ?? "";
  const pathOrder = leftPath.localeCompare(rightPath);

  if (pathOrder !== 0) {
    return pathOrder;
  }

  return left.code.localeCompare(right.code);
}

function getFilesystemApi(): FilesystemApi {
  const fsModule = getBuiltinModule("node:fs");

  if (
    !isRecord(fsModule) ||
    typeof fsModule.readdirSync !== "function" ||
    typeof fsModule.lstatSync !== "function"
  ) {
    throw new Error("Node filesystem API is unavailable.");
  }

  return {
    readdirSync: fsModule.readdirSync as ReaddirSync,
    lstatSync: fsModule.lstatSync as LstatSync,
  };
}

function getPathApi(): PathApi {
  const pathModule = getBuiltinModule("node:path");

  if (!isRecord(pathModule) || typeof pathModule.resolve !== "function") {
    throw new Error("Node path API is unavailable.");
  }

  return {
    resolve: pathModule.resolve as Resolve,
  };
}

function getBuiltinModule(moduleName: string): unknown {
  const processValue = (globalThis as Record<string, unknown>).process;

  if (!isRecord(processValue)) {
    throw new Error("Node process API is unavailable.");
  }

  const getBuiltinModuleValue = processValue.getBuiltinModule;

  if (typeof getBuiltinModuleValue !== "function") {
    throw new Error("Node builtin module loader is unavailable.");
  }

  return getBuiltinModuleValue(moduleName);
}

function errorHasCode(error: unknown, code: string): boolean {
  return (
    isRecord(error) &&
    typeof error.code === "string" &&
    error.code === code
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
