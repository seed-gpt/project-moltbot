# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltcredit/backend/package*.json ./apps/moltcredit/backend/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY apps/moltcredit/backend ./apps/moltcredit/backend

# Build using project references (handles shared + moltcredit together)
RUN npx tsc --build --force apps/moltcredit/backend/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltcredit/backend/package*.json ./apps/moltcredit/backend/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/moltcredit/backend/dist ./apps/moltcredit/backend/dist
COPY apps/moltcredit/backend/openapi.yml ./apps/moltcredit/backend/

# Set working directory to moltcredit service
WORKDIR /app/apps/moltcredit/backend

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
