import type {
  AeosTask,
  TaskValidationIssue,
  TaskValidationResult,
} from "./tasks.js";

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
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

export function validateAeosTask(task: AeosTask): TaskValidationResult {
  const issues: TaskValidationIssue[] = [];

  if (!hasText(task.id)) {
    issues.push(
      createIssue("task_id_required", "Task id is required.", "id"),
    );
  }

  if (!hasText(task.title)) {
    issues.push(
      createIssue("task_title_required", "Task title is required.", "title"),
    );
  }

  if (!hasText(task.purpose)) {
    issues.push(
      createIssue(
        "task_purpose_required",
        "Task purpose is required.",
        "purpose",
      ),
    );
  }

  if (!hasContextToLoad(task)) {
    issues.push(
      createIssue(
        "task_context_required",
        "Task context to load must include at least one entry.",
        "context.load",
      ),
    );
  }

  if (!hasStopCondition(task)) {
    issues.push(
      createIssue(
        "task_stop_condition_required",
        "Task stop condition is required.",
        "stopCondition.description",
      ),
    );
  }

  for (const path of findFileBoundaryConflicts(task)) {
    issues.push({
      code: "task_file_boundary_conflict",
      message: `File is listed in both files to modify and files not to touch: ${path}`,
      severity: "error",
      path,
      field: "fileBoundary",
    });
  }

  const valid = issues.length === 0;

  return {
    taskId: hasText(task.id) ? task.id : undefined,
    status: valid ? "pass" : "fail",
    valid,
    issues,
    fileBoundary: task.fileBoundary,
  };
}
