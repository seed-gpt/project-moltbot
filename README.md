# MoltBolt — Agent Banking Ecosystem

A production-ready infrastructure ecosystem for autonomous AI agents, providing financial services, credit, communication, and voice capabilities.

## Overview

**MoltBolt** is a comprehensive platform enabling AI agents to engage in commerce, communication, and financial transactions. It provides the foundational building blocks for an agent-driven economy.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MoltBolt Ecosystem                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  MoltBank    │  │  MoltCredit  │  │  MoltMail    │         │
│  │  :3001       │  │  :3002       │  │  :3003       │         │
│  │              │  │              │  │              │         │
│  │ • Wallets    │  │ • Credit     │  │ • Email      │         │
│  │ • Escrow     │  │ • Trust      │  │ • Inbox      │         │
│  │ • Transfers  │  │ • Settlement │  │ • Delivery   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│  ┌────────────────────────┴──────────────┐  ┌──────────────┐  │
│  │      PostgreSQL Database              │  │  MoltPhone   │  │
│  │      (Shared Schema)                  │  │  :3004       │  │
│  │                                       │  │              │  │
│  │  • agents                             │  │ • Voice      │  │
│  │  • wallets                            │  │ • Calls      │  │
│  │  • transactions                       │  │ • Logs       │  │
│  │  • credit_lines                       │  │              │  │
│  │  • emails                             │  └──────────────┘  │
│  │  • calls                              │                    │
│  └───────────────────────────────────────┘                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Domain | Description |
|---------|------|--------|-------------|
| **MoltBank** | 3001 | molt-bank.com | Core banking service: agent registration, wallets, escrow, transfers, and payment settlement |
| **MoltCredit** | 3002 | moltcredit.xyz | Credit line management: trust-based lending, credit scoring, and debt settlement |
| **MoltMail** | 3003 | moltmail.xyz | Email infrastructure: @agentmail.xyz addresses, inbox management, and delivery tracking |
| **MoltPhone** | 3004 | moltphone.xyz | Voice call service: AI-powered phone calls, call logs, and conversation tracking |

Each service exposes:
- RESTful API with OpenAPI documentation at `/docs`
- Health check endpoint at `/health`
- Readiness check endpoint at `/ready`

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all services and database
docker-compose up

# Services will be available at:
# - MoltBank: http://localhost:3001
# - MoltCredit: http://localhost:3002
# - MoltMail: http://localhost:3003
# - MoltPhone: http://localhost:3004

# View API documentation:
# - http://localhost:3001/docs (MoltBank)
# - http://localhost:3002/docs (MoltCredit)
# - http://localhost:3003/docs (MoltMail)
# - http://localhost:3004/docs (MoltPhone)
```

### Local Development

```bash
# 1. Install dependencies
npm ci

# 2. Start PostgreSQL
docker-compose up -d postgres

# 3. Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL

# 4. Run migrations
npm run migrate:up

# 5. Build all packages
npm run build

# 6. Run tests
npm test

# 7. Start a service (example: MoltBank)
npm run dev -w services/moltbank
```

## API Documentation

Each service provides comprehensive OpenAPI documentation:

- **MoltBank**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **MoltCredit**: [http://localhost:3002/docs](http://localhost:3002/docs)
- **MoltMail**: [http://localhost:3003/docs](http://localhost:3003/docs)
- **MoltPhone**: [http://localhost:3004/docs](http://localhost:3004/docs)

### Authentication

All services use API key authentication:

```bash
# Register an agent with MoltBank to get an API key
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "my-agent",
    "name": "My AI Agent",
    "email": "agent@example.com"
  }'

# Use the API key in subsequent requests
curl http://localhost:3001/wallet \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/moltbot` |
| `NODE_ENV` | Environment mode | `development`, `production` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3000` |
| `API_KEY_SALT` | Salt for API key hashing | Auto-generated |
| `LOG_LEVEL` | Logging level | `info` |

## Project Structure

```
project-moltbolt/
├── .github/
│   └── workflows/
│       └── test.yml           # CI/CD test pipeline
├── docs/
│   └── production-readiness.md # Production checklist
├── migrations/                 # Database migrations
├── packages/
│   └── shared/                 # Shared utilities
│       ├── src/
│       │   ├── auth.ts         # Authentication middleware
│       │   ├── db.ts           # Database pool
│       │   ├── errors.ts       # Error handling
│       │   ├── logger.ts       # Structured logging
│       │   ├── rateLimit.ts    # Rate limiting
│       │   └── requestLogger.ts # Request logging
│       └── package.json
├── services/
│   ├── moltbank/               # Banking service
│   │   ├── src/
│   │   │   ├── app.ts          # Express app
│   │   │   ├── server.ts       # Server entry point
│   │   │   └── routes/         # API routes
│   │   ├── openapi.yml         # API spec
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── moltcredit/             # Credit service
│   ├── moltmail/               # Email service
│   └── moltphone/              # Phone service
├── tests/
│   └── e2e/
│       ├── smoke.test.ts       # E2E smoke tests
│       └── jest.config.js      # E2E test config
├── moltbank-landing/           # Landing pages
├── moltbank-webapp/            # Web applications
├── docker-compose.yml
├── package.json
└── README.md
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run tests for a specific package
npm test -w packages/shared
npm test -w services/moltbank

# Run tests in watch mode
npm test -- --watch
```

### E2E Tests

```bash
# Start services
docker-compose up -d

# Run E2E smoke tests
npm test -w tests/e2e

# Run with integration tests enabled
RUN_INTEGRATION_TESTS=true npm test -w tests/e2e
```

### CI/CD

GitHub Actions automatically runs tests on every push and pull request:

1. Starts PostgreSQL test database
2. Installs dependencies
3. Builds all packages
4. Runs all tests (unit + E2E)

See [`.github/workflows/test.yml`](.github/workflows/test.yml) for configuration.

## Deployment

### GCP Cloud Run

Each service is containerized and deployed to Google Cloud Run:

```bash
# Build and deploy a service
gcloud run deploy moltbank \
  --source services/moltbank \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=your-connection-string

# Deploy all services
./scripts/deploy-all.sh
```

### Docker

```bash
# Build a service
docker build -t moltbank:latest -f services/moltbank/Dockerfile .

# Run with environment variables
docker run -p 3001:3000 \
  -e DATABASE_URL=your-connection-string \
  moltbank:latest
```

## Database Migrations

Database migrations use `node-pg-migrate`:

```bash
# Create a new migration
npm run migrate:create -- my-migration-name

# Run pending migrations
npm run migrate:up

# Rollback the last migration
npm run migrate:down
```

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test**
   ```bash
   npm run build
   npm test
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Add my feature"
   git push origin feature/my-feature
   ```

4. **Create pull request**
   - CI will automatically run tests
   - Request review from team
   - Merge when approved and tests pass

## Production Readiness

See [`docs/production-readiness.md`](docs/production-readiness.md) for the complete production readiness checklist.

Key features:
- ✅ Structured request logging (JSON for GCP)
- ✅ Health and readiness endpoints
- ✅ Database connection pooling
- ✅ API key authentication
- ✅ Rate limiting
- ✅ Error handling middleware
- ✅ OpenAPI documentation
- ✅ E2E smoke tests
- ✅ CI/CD pipeline
- ✅ Docker containerization

## Key User Flows

### 1. Agent Registration
```bash
POST /register
{
  "handle": "my-agent",
  "name": "My AI Agent",
  "email": "agent@example.com"
}
# Returns: { api_key: "..." }
```

### 2. Wallet Operations
```bash
# Check balance
GET /wallet
Authorization: Bearer YOUR_API_KEY

# Deposit funds
POST /wallet/deposit
{ "amount": 100.00 }

# Transfer to another agent
POST /wallet/transfer
{ "to_handle": "other-agent", "amount": 50.00 }
```

### 3. Escrow Payments
```bash
# Create escrow
POST /escrow/create
{ "to_handle": "contractor", "amount": 100.00, "description": "Project work" }

# Release escrow
POST /escrow/:id/release
```

### 4. Credit Lines
```bash
# Request credit line
POST /credit-lines
{ "amount": 1000, "term_months": 12 }

# Check credit lines
GET /credit-lines
```

### 5. Email Communication
```bash
# Send email
POST /emails/send
{ "to": "agent@agentmail.xyz", "subject": "Hello", "body": "Message" }

# Check inbox
GET /emails/inbox
```

### 6. Voice Calls
```bash
# Initiate call
POST /calls/initiate
{ "to": "+15551234567", "message": "Hello from AI agent" }

# Get call logs
GET /calls
```

## Monitoring

All services emit structured JSON logs compatible with Google Cloud Platform logging:

```json
{
  "method": "POST",
  "path": "/wallet/transfer",
  "status": 200,
  "duration_ms": 45,
  "agent_id": "abc123",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

Log levels:
- `info`: Successful requests (2xx)
- `warn`: Client errors (4xx)
- `error`: Server errors (5xx)

## SeedGpt Auto-Grow

This project uses [SeedGpt](https://github.com/seedgpt/seedgpt) for AI-driven continuous development:

- **Configuration**: `.seedgpt/config.yml`
- **Roadmap**: `.seedgpt/roadmap.yml`
- **PRD**: `.seedgpt/prd.md`

SeedGpt automatically generates GitHub issues from the roadmap and creates pull requests to implement them.

## Contributing

1. Check the roadmap in `.seedgpt/roadmap.yml` for planned features
2. Create an issue or pick an existing one
3. Follow the development workflow above
4. Ensure all tests pass
5. Submit a pull request

## License

Proprietary — Spring Software Gibraltar

---

**Built by [Spring Software Gibraltar](https://springsoftware.io) 🦞**

**Production Status**: ✅ Ready for deployment
