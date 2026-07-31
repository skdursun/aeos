export {
  buildMemoryMarkdownEntry,
  escapeYamlString,
  serializeMemoryBodySections,
  serializeMemoryFrontmatter,
} from "./markdown-entry.js";

export {
  canBuildMarkdownEntry,
  canIndexMemoryEntry,
  validateMemoryEntry,
} from "./validation.js";

export {
  MemorySearchIndex,
  addMemoryEntry,
  clearMemoryIndex,
  createMemorySearchIndex,
  getMemoryCount,
  removeMemoryEntry,
  searchMemoryEntries,
} from "./search-index.js";

export {
  buildMemoryFilePath,
  createMemoryWriteRequest,
  createMemoryWriteResult,
  prepareMemoryFileContent,
} from "./writer.js";
export type {
  MemoryWriteRequest,
  MemoryWriteRequestResult,
  MemoryWriteResult,
  MemoryWriteSuccess,
  MemoryWriteTarget,
} from "./writer.js";
