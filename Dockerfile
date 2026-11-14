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
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@jobnester/api"]
FROM base AS web-build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @jobnester/web
FROM nginx:alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/out /usr/share/nginx/html
EXPOSE 80
