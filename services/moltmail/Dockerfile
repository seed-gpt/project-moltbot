# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files from root and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltmail/package*.json ./services/moltmail/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY tsconfig.json ./tsconfig.json
COPY packages/shared ./packages/shared
COPY services/moltmail ./services/moltmail

# Build using project references (handles shared + moltmail together)
RUN npx tsc --build --force services/moltmail/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/moltmail/package*.json ./services/moltmail/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/moltmail/dist ./services/moltmail/dist
COPY services/moltmail/openapi.yml ./services/moltmail/

# Set working directory to moltmail service
WORKDIR /app/services/moltmail

# Expose port
EXPOSE 3000

# Run the service
CMD ["node", "dist/index.js"]
