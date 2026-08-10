import { useCallback, useState } from "react";
import { toast } from "sonner";
import type {
  Artifact,
  Issue,
  IssueComment,
  Message,
  TaskApi as Task,
} from "@onecaptain/shared";
import { getIssue, getTask, getTrace } from "@/lib/api";
import type { TraceTask } from "@/lib/api";

export type IssueDetail = {
  issue: Issue & { trace_id?: string | null };
  messages: Message[];
  comments: IssueComment[];
  artifacts: Artifact[];
} | null;

/**
 * Owns the chat view's detail-sheet state: the artifact / email / calendar /
 * issue sheets (open flags + selected ids), the loaded issue detail (+ trace +
 * active task + loading), and the `openIssue` loader.
 *
 * Extracted verbatim from agent-chat-view.tsx. NOTE: the issue-sheet WebSocket
 * effect is intentionally LEFT IN the component — moving it into this hook
 * (called early, where the sheet state must live) would register its effect out
 * of order (it is currently the LAST effect, #26 in the canonical order), which
 * would change effect timing. To preserve order exactly, the effect stays in
 * the component and reads this hook's returned state/setters. The hook only
 * exposes the state + `openIssue`; behavior is unchanged.
 */
export function useChatSheets(workspaceId: string) {
  const [artifactSheetOpen, setArtifactSheetOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null,
  );
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [calendarEventSheetOpen, setCalendarEventSheetOpen] = useState(false);
  const [selectedCalendarEventId, setSelectedCalendarEventId] = useState<
    string | null
  >(null);
  const [issueSheetOpen, setIssueSheetOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [issueDetail, setIssueDetail] = useState<IssueDetail>(null);
  const [issueDetailLoading, setIssueDetailLoading] = useState(false);
  const [issueTraceTasks, setIssueTraceTasks] = useState<TraceTask[] | null>(
    null,
  );
  const [issueActiveTask, setIssueActiveTask] = useState<Task | null>(null);

  const openIssue = useCallback(
    async (issueId: string) => {
      setSelectedIssueId(issueId);
      setIssueSheetOpen(true);
      setIssueDetailLoading(true);
      setIssueTraceTasks(null);
      setIssueActiveTask(null);
      try {
        const res = await getIssue(workspaceId, issueId);
        setIssueDetail(res);
        if (res.issue.latest_task_id) {
          getTask(res.issue.latest_task_id, workspaceId)
            .then((task) => setIssueActiveTask(task))
            .catch(() => setIssueActiveTask(null));
        }
        if (res.issue.trace_id) {
          getTrace(res.issue.trace_id, workspaceId)
            .then((t) => setIssueTraceTasks(t.tasks))
            .catch(() => setIssueTraceTasks(null));
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load issue",
        );
        setIssueSheetOpen(false);
      } finally {
        setIssueDetailLoading(false);
      }
    },
    [workspaceId],
  );

  const issueConvId = issueDetail?.issue?.conversation_id ?? null;
  const issueTaskId = issueDetail?.issue?.latest_task_id ?? null;

  return {
    artifactSheetOpen,
    setArtifactSheetOpen,
    selectedArtifact,
    setSelectedArtifact,
    emailSheetOpen,
    setEmailSheetOpen,
    selectedEmailId,
    setSelectedEmailId,
    calendarEventSheetOpen,
    setCalendarEventSheetOpen,
    selectedCalendarEventId,
    setSelectedCalendarEventId,
    issueSheetOpen,
    setIssueSheetOpen,
    selectedIssueId,
    setSelectedIssueId,
    issueDetail,
    setIssueDetail,
    issueDetailLoading,
    issueTraceTasks,
    issueActiveTask,
    setIssueActiveTask,
    openIssue,
    issueConvId,
    issueTaskId,
  };
}
