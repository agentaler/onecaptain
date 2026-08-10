import { describe, it, expect } from "vitest";
import { fromApiTask } from "./types.js";
import type { TaskApi } from "@onecaptain/shared";

describe("fromApiTask", () => {
  const baseTask: TaskApi = {
    id: "t1",
    agent_id: "a1",
    runtime_id: "rt1",
    conversation_id: "c1",
    workspace_id: "ws1",
    prompt: "hello",
    status: "dispatched",
    priority: 0,
    dispatched_at: null,
    started_at: null,
    completed_at: null,
    result: null,
    error: null,
    created_at: "2026-01-01T00:00:00Z",
    type: "user_dm_message",
    agent: null,
  };

  it("maps runtime_config from agent data", () => {
    const task: TaskApi = {
      ...baseTask,
      agent: {
        name: "Agent 1",
        instructions: "be helpful",
        runtime_config: { model: "custom-model" },
        email_addresses: [],
        colleagues: [],
      },
    };

    const result = fromApiTask(task);
    expect(result.agent?.runtimeConfig).toEqual({ model: "custom-model" });
  });

  it("sets runtimeConfig to empty object when runtime_config is empty", () => {
    const task: TaskApi = {
      ...baseTask,
      agent: {
        name: "Agent 1",
        instructions: "be helpful",
        runtime_config: {},
        email_addresses: [],
        colleagues: [],
      },
    };

    const result = fromApiTask(task);
    expect(result.agent?.runtimeConfig).toEqual({});
  });

  it("handles missing agent gracefully", () => {
    const result = fromApiTask(baseTask);
    expect(result.agent).toBeUndefined();
  });

  it("maps sender snake_case is_owner to camelCase isOwner", () => {
    const task: TaskApi = {
      ...baseTask,
      sender: { name: "Gus", email: "gus@ex.com", is_owner: true },
    };
    const result = fromApiTask(task);
    expect(result.sender).toEqual({ name: "Gus", email: "gus@ex.com", isOwner: true });
  });

  it("maps null sender to undefined", () => {
    const task: TaskApi = { ...baseTask, sender: null };
    const result = fromApiTask(task);
    expect(result.sender).toBeUndefined();
  });

  it("maps undefined sender to undefined", () => {
    const result = fromApiTask(baseTask);
    expect(result.sender).toBeUndefined();
  });

  it("maps colleagues from agent data", () => {
    const task: TaskApi = {
      ...baseTask,
      agent: {
        name: "Agent 1",
        instructions: "be helpful",
        runtime_config: {},
        colleagues: [
          { name: "Scout", email: "scout@onecaptain.ai", description: "Researcher", instruction: "Share findings" },
        ],
      } as any,
    };
    const result = fromApiTask(task);
    expect(result.agent?.colleagues).toEqual([
      { name: "Scout", email: "scout@onecaptain.ai", description: "Researcher", instruction: "Share findings" },
    ]);
  });

  it("defaults colleagues to empty array when missing", () => {
    const task: TaskApi = {
      ...baseTask,
      agent: {
        name: "Agent 1",
        instructions: "be helpful",
        runtime_config: {},
        email_addresses: [],
        colleagues: [],
      },
    };
    const result = fromApiTask(task);
    expect(result.agent?.colleagues).toEqual([]);
  });
});
