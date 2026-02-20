# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltbank/backend/package*.json ./apps/moltbank/backend/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY apps/moltbank/backend ./apps/moltbank/backend

# Build using project references (handles shared + moltbank together)
RUN npx tsc --build --force apps/moltbank/backend/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/moltbank/backend/package*.json ./apps/moltbank/backend/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/moltbank/backend/dist ./apps/moltbank/backend/dist
COPY apps/moltbank/backend/openapi.yml ./apps/moltbank/backend/

# Set working directory to moltbank service
WORKDIR /app/apps/moltbank/backend

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
