# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltcredit/package*.json ./services/moltcredit/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY services/moltcredit ./services/moltcredit

# Build using project references (handles shared + moltcredit together)
RUN npx tsc --build --force services/moltcredit/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltcredit/package*.json ./services/moltcredit/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/moltcredit/dist ./services/moltcredit/dist
COPY services/moltcredit/openapi.yml ./services/moltcredit/

# Set working directory to moltcredit service
WORKDIR /app/services/moltcredit

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
