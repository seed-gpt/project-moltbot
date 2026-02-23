#!/bin/bash
set -e

# Move moltphone tests
mkdir -p apps/moltphone/backend/tests/routes
git mv apps/moltphone/backend/src/routes/calls.test.ts apps/moltphone/backend/tests/routes/calls.test.ts

# Move moltbank tests
mkdir -p apps/moltbank/backend/tests/routes
git mv apps/moltbank/backend/src/app.test.ts apps/moltbank/backend/tests/app.test.ts
git mv apps/moltbank/backend/src/routes/agents.test.ts apps/moltbank/backend/tests/routes/agents.test.ts
git mv apps/moltbank/backend/src/routes/escrow.test.ts apps/moltbank/backend/tests/routes/escrow.test.ts
git mv apps/moltbank/backend/src/routes/stats.test.ts apps/moltbank/backend/tests/routes/stats.test.ts
git mv apps/moltbank/backend/src/routes/wallet.test.ts apps/moltbank/backend/tests/routes/wallet.test.ts

# Move moltcredit tests
mkdir -p apps/moltcredit/backend/tests/routes
git mv apps/moltcredit/backend/src/routes/credit.test.ts apps/moltcredit/backend/tests/routes/credit.test.ts

# Move moltmail tests
mkdir -p apps/moltmail/backend/tests/routes
git mv apps/moltmail/backend/src/routes/emails.test.ts apps/moltmail/backend/tests/routes/emails.test.ts

# Move shared tests
mkdir -p packages/shared/tests
git mv packages/shared/src/auth.test.ts packages/shared/tests/auth.test.ts
git mv packages/shared/src/errors.test.ts packages/shared/tests/errors.test.ts

echo "All test files moved successfully"
