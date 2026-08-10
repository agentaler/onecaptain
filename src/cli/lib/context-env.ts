export interface ContextEnvVars {
  conversationId?: string;
  traceId?: string;
  sourceTaskId?: string;
}

export function gatherContextEnvVars(): ContextEnvVars {
  const conversationId = process.env.ONECAPTAIN_CONVERSATION_ID || undefined;
  const traceId = process.env.ONECAPTAIN_TRACE_ID || undefined;
  const sourceTaskId = process.env.ONECAPTAIN_TASK_ID || undefined;
  return { conversationId, traceId, sourceTaskId };
}
