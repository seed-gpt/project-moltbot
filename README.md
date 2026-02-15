# Moltbot Work — AI Agent Infrastructure Ecosystem

A collection of infrastructure services for AI agents, providing the foundational building blocks for agent-to-agent commerce and communication.

## Project Overview

The **Molt ecosystem** provides essential infrastructure for autonomous AI agents:

| Service | Domain | Purpose |
|---------|--------|---------|
| **MoltBank** | molt-bank.com | Wallets, escrow, and project payments for agents |
| **MoltCredit** | moltcredit.xyz | Trust-based credit lines between agents |
| **AgentMail** | moltmail.xyz / agentmail.xyz | Email infrastructure for agent communication |
| **MoltPhone** | moltphone.xyz | Voice call capabilities via AI |

### Current State

These services were prototyped as static HTML landing pages and client-only webapps by moltbot (openclaw). The goal is to transform them into **production-ready, full-stack applications** with:

- Real backend APIs (Node.js/TypeScript)
- PostgreSQL database persistence
- Proper authentication and authorization
- Production deployment on GCP Cloud Run
- Comprehensive testing and documentation

### Repository Structure

```
project-moltbolt/
├── moltbank-landing/      # Static landing page (molt-bank.com)
├── moltbank-webapp/       # Client webapp (app.molt-bank.com)
├── moltcredit-landing/    # Static landing page (moltcredit.xyz)
├── moltmail-landing/      # Static landing page (moltmail.xyz)
├── moltphone-landing/     # Static landing page (moltphone.xyz)
├── moltphone-webapp/      # Client webapp (app.moltphone.xyz)
├── .seedgpt/              # SeedGpt configuration
└── README.md
```

### Key User Flows

1. **Agent Registration** — Register with handle/name, receive API key
2. **Wallet Operations** — Deposit, transfer, check balance
3. **Escrow Payments** — Lock funds, release on completion
4. **Credit Lines** — Extend credit, track balances, settle debts
5. **Email Communication** — Send/receive emails with @agentmail.xyz
6. **Voice Calls** — Initiate AI-powered phone calls

### Architecture Notes

- **Monorepo**: All services share common utilities from `packages/shared`
- **API-First**: RESTful APIs with OpenAPI documentation
- **Database**: PostgreSQL with proper schema and migrations
- **Auth**: API key-based authentication (Bearer token)
- **Deployment**: Docker containers on GCP Cloud Run

---

## SeedGpt Auto-Grow

This project is wired for **SeedGpt auto-grow**, enabling continuous AI-driven development.

### What is SeedGpt?

[SeedGpt](https://github.com/seedgpt/seedgpt) is a Python CLI and GitHub Actions workflow system that enables a single Claude Code agent to continuously improve a repository over time. It provides:

- **Issue Generator** — Creates GitHub issues from the roadmap
- **Issue Resolver** — Implements issues via Pull Requests
- **Genesis Wiring** — Initial project setup (this configuration)

### Configuration Files

| File | Purpose |
|------|---------|
| `.seedgpt/config.yml` | Engine configuration |
| `.seedgpt/roadmap.yml` | Versioned roadmap with tasks |
| `.seedgpt/org-chart.yml` | Role definitions and allocations |
| `.seedgpt/tech-stack.yml` | Technology stack specification |
| `.seedgpt/prd.md` | Full product requirements document |
| `.seedgpt/PRD.yml` | Structured PRD for task tracking |

### How SeedGpt Works Here

1. **Issue Generation** — SeedGpt reads the roadmap and creates GitHub issues for planned tasks
2. **Issue Resolution** — When triggered, SeedGpt picks up issues and creates PRs to implement them
3. **Progress Tracking** — Roadmap items are updated as work completes

### Triggering Workflows

SeedGpt workflows are triggered via GitHub Actions:

```yaml
# Manual trigger or scheduled
on:
  workflow_dispatch:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

The workflows:
1. Install SeedGpt CLI
2. Read configuration from `.seedgpt/`
3. Generate issues or resolve existing ones
4. Update roadmap status

### Relationship to SeedGpt

This repository **uses** SeedGpt as a tool — it does not implement or extend SeedGpt itself. The `.seedgpt/` configuration tells SeedGpt:

- What to build (roadmap)
- How to build it (tech stack, org chart)
- What "done" looks like (PRD acceptance criteria)

SeedGpt is installed and invoked by the GitHub Actions workflows it generates, which call its CLI directly.

---

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker (for local development)

### Local Setup

```bash
# Install dependencies
npm install

# Start local database
docker-compose up -d postgres

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/moltbot
API_KEY_SALT=your-secret-salt
NODE_ENV=development
```

---

## License

Proprietary — Spring Software Gibraltar

---

*Built by [Spring Software Gibraltar](https://springsoftware.io) 🦞*
