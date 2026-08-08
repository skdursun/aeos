import type {
  AeosTask,
  TaskValidationIssue,
  TaskValidationResult,
} from "./tasks.js";

type RuntimeRecord = Record<string, unknown>;

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function isRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: RuntimeRecord, field: string): string | undefined {
  const fieldValue = value[field];

  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function hasArray(value: RuntimeRecord, field: string): boolean {
  return Array.isArray(value[field]);
}

function hasBoolean(value: RuntimeRecord, field: string): boolean {
  return typeof value[field] === "boolean";
}

function createIssue(
  code: string,
  message: string,
  field: string,
): TaskValidationIssue {
  return {
    code,
    message,
    severity: "error",
    field,
  };
}

export function hasRequiredTaskIdentity(task: AeosTask): boolean {
  return hasText(task.id) && hasText(task.title) && hasText(task.purpose);
}

export function hasContextToLoad(task: AeosTask): boolean {
  return (task.context?.load.length ?? 0) > 0;
}

export function hasStopCondition(task: AeosTask): boolean {
  return hasText(task.stopCondition?.description);
}

export function findFileBoundaryConflicts(
  task: AeosTask,
): readonly string[] {
  const filesToModify = task.fileBoundary?.filesToModify ?? [];
  const filesNotToTouch = new Set(task.fileBoundary?.filesNotToTouch ?? []);
  const conflicts = new Set<string>();

  for (const path of filesToModify) {
    if (filesNotToTouch.has(path)) {
      conflicts.add(path);
    }
  }

  return [...conflicts];
}

export function hasAeosTaskContractShape(value: unknown): value is AeosTask {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasText(stringField(value, "id")) ||
    !hasText(stringField(value, "title")) ||
    !hasText(stringField(value, "purpose")) ||
    !hasText(stringField(value, "status")) ||
    !hasText(stringField(value, "executionMode"))
  ) {
    return false;
  }

  const context = value.context;
  const fileBoundary = value.fileBoundary;
  const stopCondition = value.stopCondition;

  if (
    !isRecord(context) ||
    !isRecord(fileBoundary) ||
    !isRecord(stopCondition)
  ) {
    return false;
  }

  return (
    hasArray(context, "load") &&
    hasArray(context, "doNotLoad") &&
    hasArray(fileBoundary, "filesToModify") &&
    hasArray(fileBoundary, "filesNotToTouch") &&
    hasBoolean(fileBoundary, "allowGeneratedFiles") &&
    hasBoolean(fileBoundary, "requireStopOnBoundaryConflict") &&
    hasText(stringField(stopCondition, "description")) &&
    hasBoolean(stopCondition, "stopAfterCompletion") &&
    hasArray(value, "allowedOperations") &&
    hasArray(value, "forbiddenOperations") &&
    hasArray(value, "steps") &&
    hasArray(value, "verification")
  );
}

export function validateAeosTask(task: AeosTask): TaskValidationResult {
  const issues: TaskValidationIssue[] = [];
  const taskRecord: RuntimeRecord = isRecord(task) ? task : {};
  const taskId = stringField(taskRecord, "id");
  const title = stringField(taskRecord, "title");
  const purpose = stringField(taskRecord, "purpose");
  const status = stringField(taskRecord, "status");
  const executionMode = stringField(taskRecord, "executionMode");
  const context = taskRecord.context;
  const fileBoundary = taskRecord.fileBoundary;
  const stopCondition = taskRecord.stopCondition;

  if (!hasText(taskId)) {
    issues.push(
      createIssue("task_id_required", "Task id is required.", "id"),
    );
  }

  if (!hasText(title)) {
    issues.push(
      createIssue("task_title_required", "Task title is required.", "title"),
    );
  }

  if (!hasText(purpose)) {
    issues.push(
      createIssue(
        "task_purpose_required",
        "Task purpose is required.",
        "purpose",
      ),
    );
  }

  if (!hasText(status)) {
    issues.push(
      createIssue("task_status_required", "Task status is required.", "status"),
    );
  }

  if (!hasText(executionMode)) {
    issues.push(
      createIssue(
        "task_execution_mode_required",
        "Task execution mode is required.",
        "executionMode",
      ),
    );
  }

  if (!isRecord(context)) {
    issues.push(
      createIssue(
        "task_context_shape_required",
        "Task context must include load and doNotLoad arrays.",
        "context",
      ),
    );
  } else {
    if (!hasArray(context, "load")) {
      issues.push(
        createIssue(
          "task_context_load_required",
          "Task context load must be an array.",
          "context.load",
        ),
      );
    }

    if (!hasArray(context, "doNotLoad")) {
      issues.push(
        createIssue(
          "task_context_do_not_load_required",
          "Task context doNotLoad must be an array.",
          "context.doNotLoad",
        ),
      );
    }
  }

  if (isRecord(context) && Array.isArray(context.load) && context.load.length === 0) {
    issues.push(
      createIssue(
        "task_context_required",
        "Task context to load must include at least one entry.",
        "context.load",
      ),
    );
  }

  if (!isRecord(fileBoundary)) {
    issues.push(
      createIssue(
        "task_file_boundary_shape_required",
        "Task file boundary must include modification and protection arrays.",
        "fileBoundary",
      ),
    );
  } else {
    if (!hasArray(fileBoundary, "filesToModify")) {
      issues.push(
        createIssue(
          "task_files_to_modify_required",
          "Task filesToModify must be an array.",
          "fileBoundary.filesToModify",
        ),
      );
    }

    if (!hasArray(fileBoundary, "filesNotToTouch")) {
      issues.push(
        createIssue(
          "task_files_not_to_touch_required",
          "Task filesNotToTouch must be an array.",
          "fileBoundary.filesNotToTouch",
        ),
      );
    }

    if (!hasBoolean(fileBoundary, "allowGeneratedFiles")) {
      issues.push(
        createIssue(
          "task_allow_generated_files_required",
          "Task allowGeneratedFiles must be a boolean.",
          "fileBoundary.allowGeneratedFiles",
        ),
      );
    }

    if (!hasBoolean(fileBoundary, "requireStopOnBoundaryConflict")) {
      issues.push(
        createIssue(
          "task_stop_on_boundary_conflict_required",
          "Task requireStopOnBoundaryConflict must be a boolean.",
          "fileBoundary.requireStopOnBoundaryConflict",
        ),
      );
    }
  }

  if (!isRecord(stopCondition)) {
    issues.push(
      createIssue(
        "task_stop_condition_shape_required",
        "Task stop condition must include a description and stopAfterCompletion flag.",
        "stopCondition",
      ),
    );
  } else if (!hasText(stringField(stopCondition, "description"))) {
    issues.push(
      createIssue(
        "task_stop_condition_required",
        "Task stop condition is required.",
        "stopCondition.description",
      ),
    );
  }

  if (isRecord(stopCondition) && !hasBoolean(stopCondition, "stopAfterCompletion")) {
    issues.push(
      createIssue(
        "task_stop_after_completion_required",
        "Task stopAfterCompletion must be a boolean.",
        "stopCondition.stopAfterCompletion",
      ),
    );
  }

  for (const [field, code, message] of [
    [
      "allowedOperations",
      "task_allowed_operations_required",
      "Task allowedOperations must be an array.",
    ],
    [
      "forbiddenOperations",
      "task_forbidden_operations_required",
      "Task forbiddenOperations must be an array.",
    ],
    ["steps", "task_steps_required", "Task steps must be an array."],
    [
      "verification",
      "task_verification_required",
      "Task verification must be an array.",
    ],
  ] as const) {
    if (!hasArray(taskRecord, field)) {
      issues.push(createIssue(code, message, field));
    }
  }

  if (hasAeosTaskContractShape(task)) {
    for (const path of findFileBoundaryConflicts(task)) {
    issues.push({
      code: "task_file_boundary_conflict",
      message: `File is listed in both files to modify and files not to touch: ${path}`,
      severity: "error",
      path,
      field: "fileBoundary",
    });
    }
  }

  const valid = issues.length === 0;

  return {
    taskId: hasText(taskId) ? taskId : undefined,
    status: valid ? "pass" : "fail",
    valid,
    issues,
    fileBoundary: hasAeosTaskContractShape(task) ? task.fileBoundary : undefined,
  };
}
