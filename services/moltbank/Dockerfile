# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltbank/package*.json ./services/moltbank/

# Install dependencies for all workspaces
RUN npm ci --workspaces

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY services/moltbank ./services/moltbank

# Build shared package first, then moltbank
RUN npm run build -w packages/shared
RUN npm run build -w services/moltbank

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltbank/package*.json ./services/moltbank/

# Install production dependencies only
RUN npm ci --workspaces --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/moltbank/dist ./services/moltbank/dist

# Set working directory to moltbank service
WORKDIR /app/services/moltbank

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
