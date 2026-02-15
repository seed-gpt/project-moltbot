# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/moltphone/package.json services/moltphone/
RUN npm ci --workspaces
COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY services/moltphone services/moltphone
RUN npx tsc --build --force services/moltphone/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/services/moltphone/dist services/moltphone/dist
COPY --from=builder /app/services/moltphone/package.json services/moltphone/
COPY services/moltphone/openapi.yml services/moltphone/
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "services/moltphone/dist/index.js"]
