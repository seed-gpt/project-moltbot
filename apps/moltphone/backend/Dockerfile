# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltphone/backend/package*.json ./apps/moltphone/backend/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY apps/moltphone/backend ./apps/moltphone/backend

# Build using project references (handles shared + moltphone together)
RUN npx tsc --build --force apps/moltphone/backend/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltphone/backend/package*.json ./apps/moltphone/backend/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/moltphone/backend/dist ./apps/moltphone/backend/dist
COPY apps/moltphone/backend/openapi.yml ./apps/moltphone/backend/

# Set working directory to moltphone service
WORKDIR /app/apps/moltphone/backend

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
