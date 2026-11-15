FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run db:generate
FROM base AS runtime
RUN mkdir -p /data/uploads && chown node:node /data/uploads
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@jobnester/api"]
FROM base AS web-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
RUN npm run build -w @jobnester/web
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /app/node_modules ./node_modules
COPY --from=web-build --chown=node:node /app/package.json ./package.json
COPY --from=web-build --chown=node:node /app/packages/core ./packages/core
COPY --from=web-build --chown=node:node /app/apps/web ./apps/web
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@jobnester/web"]
