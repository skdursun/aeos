import {
  findMemoryFrontmatterIssues,
  isMemoryFrontmatter,
  isMemoryType,
  validateMemoryFrontmatter,
} from "./memory-validation.js";
import type { MemoryFrontmatter } from "./memory.js";

const validMemoryFrontmatter: MemoryFrontmatter = {
  type: "decision",
  title: "Use dependency-free memory validation helpers",
  date: "2026-07-31T00:00:00.000Z",
  sourceTask: "TASK-0029",
  status: "draft",
  tags: ["memory", "validation"],
};

const invalidMemoryFrontmatter = {
  type: "unsupported",
  title: "",
  sourceTask: 29,
  tags: ["memory", 29],
} satisfies Record<string, unknown>;

const secretLikeInvalidMemoryFrontmatter = {
  type: "decision",
  title: "Avoid secret-like frontmatter keys",
  sourceTask: "TASK-0029",
  tags: ["memory"],
  api_key: "redacted-example",
} satisfies Record<string, unknown>;

export const memoryTypeAccepted = isMemoryType(validMemoryFrontmatter.type);
export const memoryTypeRejected = isMemoryType(invalidMemoryFrontmatter.type);

export const validMemoryFrontmatterAccepted = isMemoryFrontmatter(
  validMemoryFrontmatter,
);
export const invalidMemoryFrontmatterRejected = isMemoryFrontmatter(
  invalidMemoryFrontmatter,
);

export const validMemoryFrontmatterValidation =
  validateMemoryFrontmatter(validMemoryFrontmatter);
export const invalidMemoryFrontmatterValidation = validateMemoryFrontmatter(
  invalidMemoryFrontmatter,
);

export const invalidMemoryFrontmatterIssues = findMemoryFrontmatterIssues(
  invalidMemoryFrontmatter,
);
export const secretLikeMemoryFrontmatterIssues =
  findMemoryFrontmatterIssues(secretLikeInvalidMemoryFrontmatter);
