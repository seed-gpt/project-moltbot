# Moltbot Work — Product Requirements Document

## Problem Statement

AI agents are becoming increasingly autonomous and need infrastructure to interact with the world. Currently, there is no unified ecosystem for agents to:
- Make and receive payments
- Establish trust and credit relationships
- Communicate via email
- Make voice calls

The "Molt" ecosystem (moltbot/openclaw projects) was prototyped naively as static landing pages and client-only webapps. These need to be transformed into **production-ready, full-stack applications** with real backends, databases, authentication, and operational infrastructure.

## Target Audience

1. **AI Agent Developers** — Building autonomous agents that need to interact with real-world services
2. **AI-First Companies** — Organizations deploying fleets of agents that need payment, communication, and trust infrastructure
3. **Agent Marketplaces** — Platforms where agents can transact with each other

## Project Components

### 1. MoltBank (molt-bank.com)
**Purpose:** Banking infrastructure for AI agents — wallets, escrow, and project payments

**Current State:**
- `moltbank-landing/` — Static landing page
- `moltbank-webapp/` — Client-only webapp (no backend)

**Target State:**
- Production API backend with wallet management
- USDC-based transactions (simulated initially, real integration later)
- Escrow system with dispute resolution
- Project/milestone-based payments
- Agent directory and leaderboards

### 2. MoltCredit (moltcredit.xyz)
**Purpose:** Trust-based credit lines between AI agents

**Current State:**
- `moltcredit-landing/` — Static landing page only

**Target State:**
- Credit line management API
- Trust score calculations
- Transaction history and settlement via X402 protocol
- Integration with MoltBank for settlements

### 3. AgentMail / MoltMail (moltmail.xyz / agentmail.xyz)
**Purpose:** Email infrastructure for AI agents

**Current State:**
- `moltmail-landing/` — Static landing page only

**Target State:**
- Email sending/receiving API
- @agentmail.xyz address provisioning
- Webhook notifications for incoming mail
- Agent-to-agent messaging

### 4. MoltPhone (moltphone.xyz)
**Purpose:** Voice call capabilities for AI agents

**Current State:**
- `moltphone-landing/` — Static landing page
- `moltphone-webapp/` — Client webapp calling external Vapi-based API

**Target State:**
- Own backend proxying to voice providers (Vapi)
- Call history and transcript storage
- Webhook callbacks
- Rate limiting and billing

## Key Features (Cross-Cutting)

### F1: Agent Registration & Authentication
- Unified agent registration across all Molt services
- API key-based authentication
- Agent profiles with metadata

### F2: Backend API Infrastructure
- RESTful APIs for all services
- OpenAPI/Swagger documentation
- Rate limiting and abuse prevention
- Health checks and monitoring

### F3: Data Persistence
- PostgreSQL for transactional data
- Proper schema design with migrations
- Audit trails for financial operations

### F4: Deployment & Operations
- Docker containerization
- Cloud deployment (GCP Cloud Run initially)
- Environment configuration management
- Logging and error tracking

### F5: Testing & Quality
- Unit tests for business logic
- Integration tests for APIs
- End-to-end test coverage

## Non-Functional Requirements

### Performance
- API response times < 500ms p95
- Support for 100 concurrent agents initially
- Horizontal scalability path

### Security
- API key rotation capability
- Input validation on all endpoints
- SQL injection prevention
- Rate limiting per agent

### Reliability
- 99.5% uptime target
- Graceful degradation
- Database backups

## Non-Goals (Explicit Exclusions)

1. **Real cryptocurrency integration** — Use simulated USDC initially
2. **Complex financial compliance** — This is infrastructure for agent demos, not a real bank
3. **Mobile apps** — Web-only for now
4. **Multi-tenancy** — Single deployment serving all agents
5. **Rebuilding SeedGpt** — Configure and use it, don't reimplement

## User Stories

### US1: Agent Developer Registration
> As an agent developer, I want to register my agent with a single API call and receive an API key, so I can immediately start using Molt services.

### US2: Agent Wallet Management
> As an agent, I want to have a USDC wallet where I can check my balance, deposit funds, and transfer to other agents.

### US3: Escrow for Agent Work
> As an agent hiring another agent, I want to create an escrow that holds payment until work is completed, so both parties are protected.

### US4: Credit Extension
> As an agent with good reputation, I want to extend credit lines to agents I trust, so they can transact now and pay later.

### US5: Agent Email
> As an agent, I want an @agentmail.xyz email address so I can send and receive emails programmatically.

### US6: Voice Calls
> As an agent, I want to make phone calls with AI-generated voice to handle tasks like appointment scheduling.

## Success Metrics

1. **API Uptime** — 99.5%+
2. **Registration Success Rate** — 99%+
3. **Transaction Success Rate** — 99%+ for wallet operations
4. **Developer Experience** — Clear docs, working examples

## Technical Constraints

1. **Monorepo Structure** — All Molt services in this single repo
2. **Consistent Tech Stack** — TypeScript/Node.js for backends
3. **Shared Infrastructure** — Common auth, logging, deployment patterns
4. **Existing Domains** — Use molt-bank.com, moltcredit.xyz, moltmail.xyz, moltphone.xyz
