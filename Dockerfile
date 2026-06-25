FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_CEREBRO_WEB_VERSION
ARG NEXT_PUBLIC_APP_VERSION
ARG CEREBRO_WEB_VERSION
ARG APP_VERSION
ARG RELEASE_VERSION
ARG IMAGE_TAG
ARG GITHUB_REF_NAME
ARG GITHUB_SHA

ENV NEXT_PUBLIC_CEREBRO_WEB_VERSION=$NEXT_PUBLIC_CEREBRO_WEB_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV CEREBRO_WEB_VERSION=$CEREBRO_WEB_VERSION
ENV APP_VERSION=$APP_VERSION
ENV RELEASE_VERSION=$RELEASE_VERSION
ENV IMAGE_TAG=$IMAGE_TAG
ENV GITHUB_REF_NAME=$GITHUB_REF_NAME
ENV GITHUB_SHA=$GITHUB_SHA
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs -u 10001

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN test -f server.js \
  && test -d .next/static/chunks \
  && find .next/static/chunks -maxdepth 1 -type f -name '*.js' -print -quit | grep -q .

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
