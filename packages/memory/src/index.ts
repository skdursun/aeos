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
  loadMemoryEntriesFromStorage,
  parseMemoryMarkdownEntry,
} from "./reader.js";

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

export {
  createMemoryStorageTarget,
  resolveMemoryFilePath,
  writeMemoryFile,
} from "./filesystem-writer.js";
export type {
  MemoryFilePathResult,
  MemoryFileWriteRequest,
  MemoryFileWriteResult,
  MemoryFileWriteSuccess,
  MemoryStorageTarget,
} from "./filesystem-writer.js";
