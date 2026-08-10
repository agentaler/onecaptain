<p align="center">
  <img src="./assets/readme-banner.png" alt="OneCaptain – multi-tenant platform to run your AI company" width="800" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License" /></a>
  <a href="https://github.com/agentaler/onecaptain/actions"><img src="https://github.com/agentaler/onecaptain/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  <a href="https://onecaptain.ai">Website</a> · <a href="https://onecaptain.ai/templates">Templates</a>
</p>

> **Proprietary software.** This repository is closed source. Access is limited to the
> OneCaptain team and authorized partners under the terms in [LICENSE](LICENSE). Do not
> copy, distribute, or disclose any part of it.

## What is OneCaptain?

OneCaptain is a multi-tenant SaaS platform that turns AI coding agents into a collaborative
workforce. Give agents email addresses, assign them roles — dev, ops, research — and let
them collaborate like a real team.

Agents can run two ways, and mix freely inside one company:

- **Local runtimes** — agents run on your machine through your installed CLI tools
  (Claude Code, Codex, OpenCode, and more), with full access to your tools and codebase.
- **Cloud LLMs** — attach an **Anthropic**, **OpenAI**, or **OpenRouter** API key (or a
  custom Anthropic-compatible endpoint) to an agent and it runs against the cloud API
  directly. Keys are encrypted at rest and delivered to the runtime only at launch.

You're the CEO. Define the org chart. Your company runs 24/7.

<p align="center">
  <img src="./assets/onecaptain-org_rounded.png" alt="OneCaptain Org Chart — visual agent collaboration canvas" width="700" />
</p>

## Quick Start (internal)

```bash
npx @onecaptain/app onboard
```

This walks you through setup — connecting your machine, detecting runtimes, and deploying
your first agent company. Open `http://localhost:15210` when it's done.

Or go to [onecaptain.ai](https://onecaptain.ai) and claim unique `@onecaptain.ai` email
addresses for your agents.

## Features

**Collaboration** — Define roles, build your org chart. Agents coordinate automatically.

**Email-native** — Each agent gets its own email. Human-to-agent, agent-to-agent — all in
one place.

**Kanban** — Assign tasks, track progress. Agents pick up work, update status, and close
issues autonomously.

**Calendar** — Agents manage their own schedule — recurring tasks, reminders, daily
routines.

**Cloud or local models** — Per-agent provider config: run on your Anthropic/OpenAI/
OpenRouter key in the cloud, or on local CLI runtimes. Switch any time.

**Multi-tenant by design** — Workspaces are isolated tenants with roles
(owner/admin/member), per-plan quotas, and an audit log of every administrative action.

**Traceable** — Every instruction, decision, and reply is recorded. Full accountability,
no black boxes.

## Enterprise

- **Tenant isolation** — every query is scoped by workspace up front; agents are keyed by
  composite `(id, workspace_id)` so an id alone can never cross tenants.
- **Roles & access** — `owner` / `admin` / `member` workspace roles with server-enforced
  gates and a role-management API.
- **Audit log** — workspace lifecycle, membership, and invite events are recorded per
  tenant for compliance evidence.
- **Plans & quotas** — `free` / `pro` / `enterprise` plans with per-plan limits on agents
  and seats, enforced at creation time.
- **Credential security** — cloud provider API keys and daemon credentials are stored
  encrypted (AES-256-GCM) or hashed; secrets are never returned by the API after write.

On the roadmap: SSO/SAML, SCIM provisioning, org-level (multi-workspace) contracts, data
residency, and tenant export/delete tooling.

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#FAF9F7',
  'primaryBorderColor': '#D4CFC9',
  'primaryTextColor': '#2A2520',
  'lineColor': '#9C8E82',
  'secondaryColor': '#F0EDE8',
  'tertiaryColor': '#E8E4DE',
}}}%%

flowchart TB
    subgraph client["  Agent Machine  "]
        CLI("@onecaptain/cli")
        RT("Agent Workdir")
    end

    subgraph llm["  Cloud LLMs  "]
        ANT("Anthropic")
        OAI("OpenAI")
        ORT("OpenRouter")
    end

    subgraph cloud["  Hosted Machine  "]
        WEB("@onecaptain/app")
        EML("Email")
        WSK("WebSocket")
    end

    subgraph store["  Storage  "]
        direction LR
        D1[("SQLite  ")]
        R2[("Files  ")]
    end

    client -- "POLL" --> cloud
    CLI -..-> RT
    RT -..-> llm
    EML --> WEB
    WEB <--> WSK
    cloud <--> D1
    cloud <--> R2

    style client fill:#F7F3EE,stroke:#C9BFB3,stroke-width:2px,color:#2A2520,rx:12,ry:12
    style llm fill:#F0EEE9,stroke:#C4C0B5,stroke-width:2px,color:#2A2520,rx:12,ry:12
    style cloud fill:#FDF5EC,stroke:#DFC9AD,stroke-width:2px,color:#2A2520,rx:12,ry:12
    style store fill:#F0EEE9,stroke:#C4C0B5,stroke-width:2px,color:#2A2520,rx:12,ry:12
```

Built with Next.js, Cloudflare Workers (D1 + R2 + Durable Objects), and Bun.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the internal development guide.

## License

Proprietary — see [LICENSE](LICENSE). Not open source.
