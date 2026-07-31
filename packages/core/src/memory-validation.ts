import type {
  MemoryFrontmatter,
  MemoryType,
  MemoryValidationIssue,
  MemoryValidationResult,
} from "./memory.js";

const MEMORY_TYPES = [
  "bug",
  "decision",
  "pattern",
  "incident",
  "lesson",
  "prompt",
  "benchmark",
  "research",
  "postmortem",
] as const satisfies readonly MemoryType[];

const SECRET_LIKE_KEYS = new Set([
  "secret",
  "password",
  "token",
  "apikey",
  "privatekey",
]);

type UnknownRecord = Record<string, unknown>;

export function isMemoryType(value: unknown): value is MemoryType {
  return (
    typeof value === "string" &&
    (MEMORY_TYPES as readonly string[]).includes(value)
  );
}

export function isMemoryFrontmatter(
  value: unknown,
): value is MemoryFrontmatter {
  return findMemoryFrontmatterIssues(value).length === 0;
}

export function validateMemoryFrontmatter(
  value: unknown,
): MemoryValidationResult {
  const issues = findMemoryFrontmatterIssues(value);

  return {
    status: issues.length === 0 ? "pass" : "fail",
    valid: issues.length === 0,
    issues,
  };
}

export function findMemoryFrontmatterIssues(
  value: unknown,
): readonly MemoryValidationIssue[] {
  if (!isRecord(value)) {
    return [
      createIssue(
        "memory_frontmatter_not_object",
        "Memory frontmatter must be an object.",
      ),
    ];
  }

  const issues: MemoryValidationIssue[] = [];

  if (!isMemoryType(value.type)) {
    issues.push(
      createIssue(
        "memory_frontmatter_invalid_type",
        "Memory frontmatter type must be a supported memory type.",
        "type",
      ),
    );
  }

  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    issues.push(
      createIssue(
        "memory_frontmatter_missing_title",
        "Memory frontmatter title is required.",
        "title",
      ),
    );
  }

  if (
    value.tags !== undefined &&
    !isReadonlyStringArray(value.tags)
  ) {
    issues.push(
      createIssue(
        "memory_frontmatter_invalid_tags",
        "Memory frontmatter tags must be an array of strings when present.",
        "tags",
      ),
    );
  }

  addOptionalStringIssue(issues, value, "createdAt");
  addOptionalStringIssue(issues, value, "updatedAt");
  addOptionalStringIssue(issues, value, "source");
  addOptionalStringIssue(issues, value, "sourceTask");

  for (const key of Object.keys(value)) {
    if (SECRET_LIKE_KEYS.has(normalizeKey(key))) {
      issues.push({
        code: "memory_frontmatter_secret_like_key",
        message: "Memory frontmatter must not include obvious secret-like keys.",
        severity: "error",
        path: key,
        field: key,
        riskClass: "secret_access",
      });
    }
  }

  return issues;
}

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isReadonlyStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function addOptionalStringIssue(
  issues: MemoryValidationIssue[],
  value: UnknownRecord,
  field: string,
): void {
  if (value[field] === undefined || typeof value[field] === "string") {
    return;
  }

  issues.push(
    createIssue(
      `memory_frontmatter_invalid_${field}`,
      `Memory frontmatter ${field} must be a string when present.`,
      field,
    ),
  );
}

function createIssue(
  code: string,
  message: string,
  field?: string,
): MemoryValidationIssue {
  const issue: MemoryValidationIssue = {
    code,
    message,
    severity: "error",
  };

  if (field === undefined) {
    return issue;
  }

  return {
    ...issue,
    path: field,
    field,
  };
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll("_", "").replaceAll("-", "");
}
