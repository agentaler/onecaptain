import { mkdirSync } from "fs";
import { join } from "path";
import { writeInstructionFileIfChanged } from "./context.js";
import type { Task } from "../types.js";

export interface ExecEnvConfig {
  workspacesRoot: string;
  token?: string;
}

export interface ExecEnvResult {
  workDir: string;
  timelineDir: string;
  env: Record<string, string>;
}

export function prepare(
  config: ExecEnvConfig,
  task: Task,
): ExecEnvResult {
  const workDir = join(config.workspacesRoot, task.workspaceId, task.agentId, "workdir");

  mkdirSync(workDir, { recursive: true });

  const timelineDir = join(workDir, ".context_timeline");
  mkdirSync(timelineDir, { recursive: true });

  writeInstructionFileIfChanged(workDir, task);

  const env: Record<string, string> = {
    ONECAPTAIN_WORKSPACE_ID: task.workspaceId,
    ONECAPTAIN_AGENT_ID: task.agentId,
    ONECAPTAIN_TASK_ID: task.id,
    ONECAPTAIN_CONVERSATION_ID: task.conversationId,
    ONECAPTAIN_TRACE_ID: task.traceId ?? "",
    ONECAPTAIN_CHANNEL: task.channel ?? "default",
    ONECAPTAIN_HEALTH_PORT: process.env.ONECAPTAIN_HEALTH_PORT || "19514",
    ...(config.token ? { ONECAPTAIN_TOKEN: config.token } : {}),
  };

  return { workDir, timelineDir, env };
}

