# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Moltbot Work is an AI agent infrastructure ecosystem providing foundational services for agent-to-agent commerce:

| Service | Domain | Purpose |
|---------|--------|---------|
| MoltBank | molt-bank.com | Wallets, escrow, project payments |
| MoltCredit | moltcredit.xyz | Trust-based credit lines |
| AgentMail | agentmail.xyz | Email infrastructure |
| MoltPhone | moltphone.xyz | Voice call capabilities |

**Current State**: Static HTML landing pages and client-only webapps. Goal is production-ready full-stack TypeScript APIs.

## Repository Structure

```
project-moltbolt/
├── moltbank-landing/      # Static landing (molt-bank.com)
├── moltbank-webapp/       # Client webapp (app.molt-bank.com)
├── moltcredit-landing/    # Static landing (moltcredit.xyz)
├── moltmail-landing/      # Static landing (moltmail.xyz)
├── moltphone-landing/     # Static landing (moltphone.xyz)
├── moltphone-webapp/      # Client webapp (app.moltphone.xyz)
└── .seedgpt/              # SeedGpt auto-grow configuration
```

**Planned structure** (to be created):
- `packages/shared/` - Common utilities, DB connection, auth middleware
- `services/{moltbank,moltcredit,moltmail,moltphone}/` - Backend APIs

## Technology Stack

- **Backend**: Node.js 20+, Express, TypeScript, Zod
- **Database**: PostgreSQL 15+ (amounts stored as integers/cents)
- **Testing**: Jest, Supertest
- **Deployment**: Docker, GCP Cloud Run
- **Logging**: Pino (structured JSON)

## Development Commands

```bash
# Local setup (planned)
npm install
docker-compose up -d postgres
npm run migrate
npm run dev

# Testing (planned)
npm test                    # Run all tests
npm test -- path/to/test    # Single test file
```

## Key Technical Constraints

- API keys use prefixes: `mb_` (MoltBank), `mc_` (MoltCredit), `mm_` (MoltMail), `mp_` (MoltPhone)
- All financial amounts as integers (cents) to avoid floating point issues
- Use npm workspaces for monorepo management
- Environment variables for all configuration (12-factor app)
- Use connection pooling for database connections

## SeedGpt Integration

This repo uses [SeedGpt](https://github.com/seedgpt/seedgpt) for AI-driven continuous development:

- **Config files** in `.seedgpt/`: config.yml, roadmap.yml, PRD.yml, org-chart.yml, tech-stack.yml
- **Workflows** triggered via GitHub Actions on schedule or manual dispatch
- **Role labels**: `role:backend`, `role:infra`, `role:docs`, `role:qa`, `role:frontend`

When implementing SeedGpt issues:
1. Follow TDD loop in `.seedgpt/workflows/_tdd-loop.md`
2. Link work to PRD requirements (PRD-###) and roadmap items (RM-{version}-###)
3. Update sprint YAML when completing tasks
4. CI must be green at every merge

## Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/moltbot
API_KEY_SALT=your-secret-salt
NODE_ENV=development
```
