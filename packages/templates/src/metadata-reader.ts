export interface TemplateVariableMetadata {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
  readonly defaultValue?: string;
}

export interface TemplateMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly variables: readonly TemplateVariableMetadata[];
  readonly requiredFiles: readonly string[];
  readonly optionalFiles: readonly string[];
}

export type TemplateMetadataReadErrorCode =
  | "template_metadata_missing"
  | "template_metadata_read_failed"
  | "template_metadata_parse_failed"
  | "template_metadata_invalid_shape";

export interface TemplateMetadataReadError {
  readonly code: TemplateMetadataReadErrorCode;
  readonly message: string;
  readonly path: string;
}

export type TemplateMetadataReadResult =
  | {
      readonly ok: true;
      readonly path: string;
      readonly metadata: TemplateMetadata;
    }
  | {
      readonly ok: false;
      readonly path: string;
      readonly metadata: TemplateMetadata;
      readonly error: TemplateMetadataReadError;
    };

export interface TemplateMetadataShapeValidationResult {
  readonly ok: boolean;
  readonly metadata: TemplateMetadata;
  readonly error?: Omit<TemplateMetadataReadError, "path">;
}

const emptyTemplateMetadata: TemplateMetadata = {
  id: "",
  name: "",
  description: "",
  version: "",
  variables: [],
  requiredFiles: [],
  optionalFiles: [],
};

type ReadFileSync = (path: string, encoding: "utf8") => string;

export function readTemplateMetadata(path: string): TemplateMetadataReadResult {
  let rawMetadata: string;

  try {
    rawMetadata = getReadFileSync()(path, "utf8");
  } catch (error) {
    return {
      ok: false,
      path,
      metadata: emptyTemplateMetadata,
      error: {
        code: errorHasCode(error, "ENOENT")
          ? "template_metadata_missing"
          : "template_metadata_read_failed",
        message: errorHasCode(error, "ENOENT")
          ? "Template metadata file was not found."
          : "Template metadata file could not be read.",
        path,
      },
    };
  }

  let parsedMetadata: unknown;

  try {
    parsedMetadata = JSON.parse(rawMetadata);
  } catch {
    return {
      ok: false,
      path,
      metadata: emptyTemplateMetadata,
      error: {
        code: "template_metadata_parse_failed",
        message: "Template metadata file must contain valid JSON.",
        path,
      },
    };
  }

  const validation = validateTemplateMetadataShape(parsedMetadata);

  if (!validation.ok) {
    return {
      ok: false,
      path,
      metadata: validation.metadata,
      error: {
        code: validation.error?.code ?? "template_metadata_invalid_shape",
        message:
          validation.error?.message ??
          "Template metadata has an invalid shape.",
        path,
      },
    };
  }

  return {
    ok: true,
    path,
    metadata: validation.metadata,
  };
}

export function validateTemplateMetadataShape(
  metadata: unknown,
): TemplateMetadataShapeValidationResult {
  if (!isRecord(metadata)) {
    return invalidShape("Template metadata must be a JSON object.");
  }

  const id = metadata.id;
  const name = metadata.name;
  const description = metadata.description;
  const version = metadata.version;
  const variables = toTemplateVariables(metadata.variables);
  const requiredFiles = metadata.requiredFiles ?? metadata.required_files;
  const optionalFiles = metadata.optionalFiles ?? metadata.optional_files;

  if (
    !isString(id) ||
    !isString(name) ||
    !isString(description) ||
    !isString(version)
  ) {
    return invalidShape(
      "Template metadata requires string id, name, description, and version fields.",
    );
  }

  if (variables === undefined) {
    return invalidShape(
      "Template metadata variables must be an array of variable objects.",
      {
        id,
        name,
        description,
        version,
      },
    );
  }

  if (!isStringArray(requiredFiles) || !isStringArray(optionalFiles)) {
    return invalidShape(
      "Template metadata requires requiredFiles and optionalFiles string arrays.",
      {
        id,
        name,
        description,
        version,
        variables,
      },
    );
  }

  return {
    ok: true,
    metadata: {
      id,
      name,
      description,
      version,
      variables,
      requiredFiles,
      optionalFiles,
    },
  };
}

function invalidShape(
  message: string,
  metadata: Partial<TemplateMetadata> = {},
): TemplateMetadataShapeValidationResult {
  return {
    ok: false,
    metadata: {
      id: metadata.id ?? "",
      name: metadata.name ?? "",
      description: metadata.description ?? "",
      version: metadata.version ?? "",
      variables: metadata.variables ?? [],
      requiredFiles: metadata.requiredFiles ?? [],
      optionalFiles: metadata.optionalFiles ?? [],
    },
    error: {
      code: "template_metadata_invalid_shape",
      message,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getReadFileSync(): ReadFileSync {
  const processValue = (globalThis as Record<string, unknown>).process;

  if (!isRecord(processValue)) {
    throw new Error("Node process API is unavailable.");
  }

  const getBuiltinModule = processValue.getBuiltinModule;

  if (typeof getBuiltinModule !== "function") {
    throw new Error("Node builtin module loader is unavailable.");
  }

  const fsModule = getBuiltinModule("node:fs");

  if (!isRecord(fsModule) || typeof fsModule.readFileSync !== "function") {
    throw new Error("Node filesystem API is unavailable.");
  }

  return fsModule.readFileSync as ReadFileSync;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isString);
}

function toTemplateVariables(
  value: unknown,
): readonly TemplateVariableMetadata[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const variables: TemplateVariableMetadata[] = [];

  for (const variable of value) {
    if (!isRecord(variable)) {
      return undefined;
    }

    const defaultValue = variable.defaultValue ?? variable.default_value;

    if (
      !isString(variable.name) ||
      (variable.description !== undefined && !isString(variable.description)) ||
      typeof variable.required !== "boolean" ||
      (defaultValue !== undefined && !isString(defaultValue))
    ) {
      return undefined;
    }

    variables.push({
      name: variable.name,
      description: variable.description,
      required: variable.required,
      defaultValue,
    });
  }

  return variables;
}

function errorHasCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}
