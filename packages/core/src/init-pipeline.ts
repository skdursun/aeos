import type { InitRequest, InitResult } from "./init.js";
import type { InitAdapterSet } from "./init-adapters.js";
import {
  createDefaultInitAdapters,
  createInitStageHandlers,
  type InitAdapterStageHandlers,
} from "./init-adapters.js";
import {
  createInitPipeline,
  createInitResult,
  defaultInitPipelineStages,
  executeInitPipeline,
  type InitPipelineOptions,
} from "./init-executor.js";
import type { InitExecutionPlan } from "./init-engine.js";

export type InitPipelineHandlers = InitAdapterStageHandlers;

export function createInitPipelineHandlers(
  adapters: InitAdapterSet,
): InitPipelineHandlers {
  return createInitStageHandlers(adapters);
}

export function createDefaultInitPipeline(
  request: InitRequest,
  options: InitPipelineOptions = {},
): InitExecutionPlan {
  return createInitPipeline(request, {
    ...options,
    stages: options.stages ?? defaultInitPipelineStages,
  });
}

export async function runInitPipeline(
  request: InitRequest,
  adapters: InitAdapterSet = createDefaultInitAdapters(),
  options: InitPipelineOptions = {},
): Promise<InitResult> {
  const handlers = createInitPipelineHandlers(adapters);
  const pipelineResult = await executeInitPipeline(request, handlers, {
    ...options,
    stages: options.stages ?? defaultInitPipelineStages,
  });

  return createInitResult(pipelineResult);
}
