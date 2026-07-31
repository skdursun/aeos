import { validateMemoryFrontmatter } from "@aeos/core";
import type {
  MemoryEntry,
  MemoryEntryStatus,
  MemoryRedactionStatus,
  MemoryValidationIssue,
  MemoryValidationResult,
} from "@aeos/core";

const MEMORY_ENTRY_STATUSES = [
  "draft",
  "verified",
  "superseded",
  "archived",
] as const satisfies readonly MemoryEntryStatus[];

const MEMORY_REDACTION_STATUSES = [
  "not_required",
  "pending",
  "redacted",
  "blocked",
] as const satisfies readonly MemoryRedactionStatus[];

export function validateMemoryEntry(
  entry: MemoryEntry,
): MemoryValidationResult {
  if (!isRecord(entry)) {
    return {
      status: "fail",
      valid: false,
      issues: [
        createMemoryEntryIssue(
          "memory_entry_not_object",
          "Memory entry must be an object.",
        ),
      ],
    };
  }

  const frontmatterValidation = validateMemoryFrontmatter(entry.frontmatter);
  const issues = [
    ...frontmatterValidation.issues,
    ...findMemoryEntryFrontmatterIssues(entry.frontmatter),
    ...findMemoryEntryIssues(entry),
  ];

  return {
    status: issues.length === 0 ? "pass" : "fail",
    valid: issues.length === 0,
    issues,
  };
}

export function canBuildMarkdownEntry(entry: MemoryEntry): boolean {
  return validateMemoryEntry(entry).valid;
}

export function canIndexMemoryEntry(entry: MemoryEntry): boolean {
  return validateMemoryEntry(entry).valid;
}

function findMemoryEntryIssues(
  entry: Readonly<Record<string, unknown>>,
): readonly MemoryValidationIssue[] {
  const issues: MemoryValidationIssue[] = [];

  if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
    issues.push(
      createMemoryEntryIssue(
        "memory_entry_missing_id",
        "Memory entry id is required.",
        "id",
      ),
    );
  }

  if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) {
    issues.push(
      createMemoryEntryIssue(
        "memory_entry_missing_summary",
        "Memory entry summary is required.",
        "summary",
      ),
    );
  }

  if (!Array.isArray(entry.sections)) {
    issues.push(
      createMemoryEntryIssue(
        "memory_entry_invalid_sections",
        "Memory entry sections must be an array.",
        "sections",
      ),
    );
  } else {
    for (const [index, section] of entry.sections.entries()) {
      if (!isRecord(section)) {
        issues.push(
          createMemoryEntryIssue(
            "memory_entry_invalid_section",
            "Memory entry section must be an object.",
            `sections.${index}`,
          ),
        );
        continue;
      }

      if (
        typeof section.heading !== "string" ||
        section.heading.trim().length === 0
      ) {
        issues.push(
          createMemoryEntryIssue(
            "memory_entry_section_missing_heading",
            "Memory entry section heading is required.",
            `sections.${index}.heading`,
          ),
        );
      }

      if (
        typeof section.content !== "string" ||
        section.content.trim().length === 0
      ) {
        issues.push(
          createMemoryEntryIssue(
            "memory_entry_section_missing_content",
            "Memory entry section content is required.",
            `sections.${index}.content`,
          ),
        );
      }

      if (!Number.isFinite(section.order)) {
        issues.push(
          createMemoryEntryIssue(
            "memory_entry_section_invalid_order",
            "Memory entry section order must be a finite number.",
            `sections.${index}.order`,
          ),
        );
      }
    }
  }

  if (!isMemoryRedactionStatus(entry.redactionStatus)) {
    issues.push(
      createMemoryEntryIssue(
        "memory_entry_invalid_redaction_status",
        "Memory entry redaction status must be supported.",
        "redactionStatus",
      ),
    );
  }

  return issues;
}

function findMemoryEntryFrontmatterIssues(
  frontmatter: unknown,
): readonly MemoryValidationIssue[] {
  if (!isRecord(frontmatter)) {
    return [];
  }

  const issues: MemoryValidationIssue[] = [];

  if (typeof frontmatter.date !== "string" || frontmatter.date.length === 0) {
    issues.push(
      createMemoryEntryIssue(
        "memory_frontmatter_missing_date",
        "Memory frontmatter date is required.",
        "frontmatter.date",
      ),
    );
  }

  if (
    frontmatter.sourceTask === undefined ||
    frontmatter.sourceTask === ""
  ) {
    issues.push(
      createMemoryEntryIssue(
        "memory_frontmatter_missing_source_task",
        "Memory frontmatter sourceTask is required.",
        "frontmatter.sourceTask",
      ),
    );
  }

  if (!isMemoryEntryStatus(frontmatter.status)) {
    issues.push(
      createMemoryEntryIssue(
        "memory_frontmatter_invalid_status",
        "Memory frontmatter status must be supported.",
        "frontmatter.status",
      ),
    );
  }

  if (frontmatter.tags === undefined) {
    issues.push(
      createMemoryEntryIssue(
        "memory_frontmatter_missing_tags",
        "Memory frontmatter tags are required.",
        "frontmatter.tags",
      ),
    );
  }

  return issues;
}

function isMemoryEntryStatus(value: unknown): value is MemoryEntryStatus {
  return (
    typeof value === "string" &&
    (MEMORY_ENTRY_STATUSES as readonly string[]).includes(value)
  );
}

function isMemoryRedactionStatus(
  value: unknown,
): value is MemoryRedactionStatus {
  return (
    typeof value === "string" &&
    (MEMORY_REDACTION_STATUSES as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function createMemoryEntryIssue(
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
