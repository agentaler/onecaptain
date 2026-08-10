# @onecaptain/cli

OneCaptain CLI — register machines, run the daemon, and manage agents from the command line.

## Install

```bash
npx @onecaptain/cli <command>
```

## Quick Start

1. Generate a machine token from the [OneCaptain dashboard](https://onecaptain.ai).
2. Register this machine:

```bash
npx @onecaptain/cli register --token al_xxxxxxxxxxxxxxxxxxxxxxxx
```

3. Start the daemon:

```bash
npx @onecaptain/cli daemon start
```

The daemon runs in the background, polling for tasks and dispatching them to your local AI runtimes (Claude, Codex, or OpenCode).

## Commands

| Command | Description |
| --- | --- |
| `register --token <token>` | Register this machine with your OneCaptain account |
| `status` | Show registration status and linked workspace |
| `daemon start` | Start the background daemon |
| `daemon stop` | Stop the daemon |
| `email pull` | Download agent emails |
| `email send --to <addr> --subject "..." --body-file <path>` | Send an email |
| `calendar set --event_title "..." --datetime <YYYY-MM-DDTHH:MM>` | Create a scheduled event |
| `issue create --title "..."` | Create and dispatch an issue |
| `sync upload-artifact --conversation_id <id> --file <path>` | Upload a file artifact |
| `config show` | Show current configuration |
| `update` | Update CLI to the latest version |
| `version` | Print CLI version |

Run `npx @onecaptain/cli <command> --help` for all subcommand options.

<details>
<summary><strong>daemon</strong> — manage the background daemon</summary>

```bash
onecaptain daemon start               # Start in background
onecaptain daemon start --foreground  # Start in foreground (for debugging)
onecaptain daemon stop                # Stop the daemon
onecaptain daemon status              # Check if the daemon is running
```

</details>

<details>
<summary><strong>email</strong> — pull, send, reply, forward, and manage sender whitelist</summary>

```bash
onecaptain email pull                                # Download inbox
onecaptain email pull --status unread                # Unread only
onecaptain email pull --folder sent                  # Sent emails
onecaptain email set --email_id <id> --status read   # Mark as read

onecaptain email send --to <addr> --subject "Hi" --body-file body.html
onecaptain email send ... --in-reply-to <email_id>                   # Reply to a thread
onecaptain email send ... --attachment report.pdf                    # Attach a file
onecaptain email forward --email_id <id> --to <addr> --note "FYI"

onecaptain email whitelist list              # List allowed senders
onecaptain email whitelist add <email>       # Allow a sender
onecaptain email whitelist delete <email>    # Remove a sender
```

Options: `--from <addr>` to send from a custom mailbox, `--limit <n>` / `--offset <n>` for pagination, `--json` for machine-readable output.

</details>

<details>
<summary><strong>calendar</strong> — schedule one-off or recurring agent events</summary>

When an event fires, a new task is dispatched to the agent with the event title as the prompt.

```bash
onecaptain calendar set --event_title "Daily standup" --datetime 2026-05-16T09:00
onecaptain calendar set ... --repeat 1week --repeat_stop_date 2026-12-31

onecaptain calendar list                              # List upcoming events
onecaptain calendar show --event_id <id>              # Show full detail
onecaptain calendar update --event_id <id> --datetime 2026-05-17T10:00
onecaptain calendar delete --event_id <id>
```

Datetime is always local time (`YYYY-MM-DDTHH:MM`). Repeat intervals: `1hour`, `1day`, `1week`, `1month`, etc.

</details>

<details>
<summary><strong>issue</strong> — create and manage issues assigned to agents</summary>

```bash
onecaptain issue create --title "Fix login bug"
onecaptain issue create --title "Refactor auth" --body-file spec.md

onecaptain issue list                           # Active issues
onecaptain issue list --completed               # Completed/closed issues
onecaptain issue show --issue_id <id>           # Full detail + conversation
onecaptain issue update --issue_id <id> --status done
onecaptain issue comment --issue_id <id> --body "Looks good"
```

Statuses: `todo`, `in_progress`, `review`, `done`, `closed`, `canceled`, `failed`.

</details>

<details>
<summary><strong>config</strong> — manage CLI configuration</summary>

```bash
onecaptain config show    # Show current config
onecaptain config path    # Show config file path
```

Config is stored at `~/.onecaptain/config.json` and includes:

- `server_url` — OneCaptain server URL
- `profiles` — per-profile settings with workspace bindings
- `watched_workspaces` — workspaces the daemon monitors (each with `id`, `name`, `token`, `agent_ids`)

</details>

## Global Options

```
--server <url>     Override server URL
--profile <name>   Use a specific config profile
--agent_id <id>    Override agent ID (default: $ONECAPTAIN_AGENT_ID env var)
```

## Requirements

- Node.js >= 20

## License

Proprietary — see [LICENSE](../../LICENSE). Not open source.
