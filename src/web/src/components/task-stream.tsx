"use client";

import { useMemo } from "react";
import type { TaskMessageResponse } from "@onecaptain/shared";
import type { TaskApi as Task } from "@onecaptain/shared";
import { RuntimeErrorBlock } from "@/components/agent-chat/runtime-error-block";

/* ── Grouped stream items ── */

interface ErrorItem {
  kind: "error";
  id: string;
  content: string;
}

function itemKey(msg: TaskMessageResponse): string {
  return msg.id || `seq-${msg.seq}`;
}

// Only `type:"error"` task_messages ever reach TaskStream now — the chat no
// longer renders intermediate text/thinking (replies arrive via `send-dm`), and
// the WS/init paths filter to errors-only before this component sees them.
function groupMessages(messages: TaskMessageResponse[]): ErrorItem[] {
  const items: ErrorItem[] = [];

  for (const msg of messages) {
    if (msg.type === "error") {
      items.push({ kind: "error", id: itemKey(msg), content: msg.content || msg.output });
    }
  }

  return items;
}

/* ── TaskStream ──
 *
 * The chat no longer surfaces intermediate reasoning/tool steps ("thinking")
 * or a live status badge — the reply lands as one clean bubble (rendered by
 * message-list once the task settles). TaskStream only renders FAILURES while
 * a task is live: a runtime error is a real message, not thinking, and going
 * silent on failure is worse. Both RuntimeErrorBlock paths are kept.
 */

export function TaskStream({
  task,
  messages,
  connectionLost,
  onRetry,
  provider,
}: {
  task: Task;
  messages: TaskMessageResponse[];
  connectionLost?: boolean;
  onRetry?: () => void;
  /** Provider of the conversation's agent runtime, used to attribute runtime errors (issue #236). */
  provider?: string | null;
}) {
  const errorItems = useMemo(() => groupMessages(messages), [messages]);

  // Nothing to show unless the stream surfaced an error, the task failed, or
  // the connection dropped — the successful reply is rendered as a bubble.
  if (
    errorItems.length === 0 &&
    !(task.status === "failed" && task.error) &&
    !connectionLost
  ) {
    return null;
  }

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      {/* Stream error messages — attributed to the agent runtime (issue #236) */}
      {errorItems.length > 0 && (
        <div className="space-y-1 mt-1">
          {errorItems.map((item) => (
            <RuntimeErrorBlock key={item.id} provider={provider} message={item.content} />
          ))}
        </div>
      )}

      {/* Task-level error display — attributed to the agent runtime (issue #236) */}
      {task.status === "failed" && task.error && (
        <div className="mt-2">
          <RuntimeErrorBlock
            provider={provider}
            message={task.error}
            onRetry={onRetry}
          />
        </div>
      )}

      {connectionLost && (
        <p className="text-sm text-muted-foreground animate-pulse mt-1">
          Connection lost — retrying...
        </p>
      )}
    </div>
  );
}
