import { describe, expect, it, vi, afterEach } from "vitest";
import { syncCommand } from "./sync";

describe("syncCommand", () => {
  const cmd = syncCommand();

  it("registers sync subcommands (upload-artifact + send-dm)", () => {
    const names = cmd.commands.map((c) => c.name());
    expect(names).toContain("upload-artifact");
    expect(names).toContain("send-dm");
  });

  it("send-dm: --agent_id and --conversation_id are optional (env fallback)", () => {
    const sub = cmd.commands.find((c) => c.name() === "send-dm")!;
    const opts = (sub as unknown as { options: { long: string; mandatory?: boolean }[] }).options;
    const mandatory = opts.filter((o) => o.mandatory).map((o) => o.long);
    expect(mandatory).toEqual([]); // nothing required at the flag level
    const longs = opts.map((o) => o.long);
    expect(longs).toContain("--message");
    expect(longs).toContain("--message-file");
    expect(longs).toContain("--conversation_id");
    expect(longs).toContain("--agent_id");
  });

  describe("send-dm behavior", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      delete process.env.ONECAPTAIN_CONVERSATION_ID;
    });

    function runSendDm(args: string[]) {
      // Throw on exit so we can assert it was hit without actually exiting.
      const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let thrown: Error | null = null;
      try {
        // parseAsync runs the action; commander dispatches to the subcommand.
        return { promise: syncCommand().parseAsync(["node", "onecaptain", "send-dm", ...args]), exit, errSpy };
      } catch (e) {
        thrown = e as Error;
        return { thrown, exit, errSpy };
      }
    }

    it("TC2: --message and --message-file together → error, exit 1", async () => {
      const { promise, errSpy } = runSendDm([
        "--message", "hi",
        "--message-file", "/tmp/does-not-matter",
      ]);
      await expect(promise).rejects.toThrow("exit:1");
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining("mutually exclusive"),
      );
    });

    it("TC3: no conversation id (no env, no flag) → error, exit 1", async () => {
      delete process.env.ONECAPTAIN_CONVERSATION_ID;
      const { promise, errSpy } = runSendDm(["--message", "hello"]);
      await expect(promise).rejects.toThrow("exit:1");
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining("no conversation id"),
      );
    });

    it("empty --message → error, exit 1", async () => {
      process.env.ONECAPTAIN_CONVERSATION_ID = "c1";
      const { promise, errSpy } = runSendDm(["--message", "   "]);
      await expect(promise).rejects.toThrow("exit:1");
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining("must not be empty"),
      );
    });
  });
});
