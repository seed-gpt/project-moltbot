# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/moltcredit/package.json services/moltcredit/
RUN npm ci --workspaces
COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY services/moltcredit services/moltcredit
RUN npm run build -w packages/shared && npm run build -w services/moltcredit

# Stage 2: Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/services/moltcredit/dist services/moltcredit/dist
COPY --from=builder /app/services/moltcredit/package.json services/moltcredit/
COPY services/moltcredit/openapi.yml services/moltcredit/
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "services/moltcredit/dist/index.js"]
