# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/moltmail/package.json services/moltmail/
RUN npm ci --workspaces
COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY services/moltmail services/moltmail
RUN npx tsc --build services/moltmail/tsconfig.json

# Stage 2: Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/services/moltmail/dist services/moltmail/dist
COPY --from=builder /app/services/moltmail/package.json services/moltmail/
COPY services/moltmail/openapi.yml services/moltmail/
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "services/moltmail/dist/index.js"]
