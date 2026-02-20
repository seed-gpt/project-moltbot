# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltmail/backend/package*.json ./apps/moltmail/backend/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY apps/moltmail/backend ./apps/moltmail/backend

# Build using project references (handles shared + moltmail together)
RUN npx tsc --build --force apps/moltmail/backend/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltmail/backend/package*.json ./apps/moltmail/backend/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/moltmail/backend/dist ./apps/moltmail/backend/dist
COPY apps/moltmail/backend/openapi.yml ./apps/moltmail/backend/

# Set working directory to moltmail service
WORKDIR /app/apps/moltmail/backend

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
