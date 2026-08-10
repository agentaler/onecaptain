import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { gatherContextEnvVars } from "./context-env.js";

describe("gatherContextEnvVars", () => {
  const envKeys = ["ONECAPTAIN_CONVERSATION_ID", "ONECAPTAIN_TRACE_ID", "ONECAPTAIN_TASK_ID"];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
  });

  it("returns all env vars when set", () => {
    process.env.ONECAPTAIN_CONVERSATION_ID = "conv_123";
    process.env.ONECAPTAIN_TRACE_ID = "trace_456";
    process.env.ONECAPTAIN_TASK_ID = "task_789";

    const result = gatherContextEnvVars();
    expect(result).toEqual({
      conversationId: "conv_123",
      traceId: "trace_456",
      sourceTaskId: "task_789",
    });
  });

  it("returns undefined for unset vars", () => {
    const result = gatherContextEnvVars();
    expect(result.conversationId).toBeUndefined();
    expect(result.traceId).toBeUndefined();
    expect(result.sourceTaskId).toBeUndefined();
  });

  it("handles partial env vars", () => {
    process.env.ONECAPTAIN_CONVERSATION_ID = "conv_123";

    const result = gatherContextEnvVars();
    expect(result.conversationId).toBe("conv_123");
    expect(result.traceId).toBeUndefined();
    expect(result.sourceTaskId).toBeUndefined();
  });
});
