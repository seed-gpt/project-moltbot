# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltphone/package*.json ./services/moltphone/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY services/moltphone ./services/moltphone

# Build using project references (handles shared + moltphone together)
RUN npx tsc --build --force services/moltphone/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltphone/package*.json ./services/moltphone/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/moltphone/dist ./services/moltphone/dist
COPY services/moltphone/openapi.yml ./services/moltphone/

# Set working directory to moltphone service
WORKDIR /app/services/moltphone

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
