FROM manimcommunity/manim:stable as base

ENV PYTHONDONTWRITEBYTECODE=1

USER root

RUN apt-get update -y
RUN apt-get install nodejs npm ffmpeg sudo -y

RUN sudo -H python -m pip install --upgrade pip
RUN sudo -H python -m pip install manim-physics manim-chemistry==0.5.1 manim-circuit manim_ml manim-kodisc==1.0.5

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

FROM base AS builder
WORKDIR /app

COPY package*json tsconfig.json src ./

RUN npm ci && \
    npm run build && \
    npm prune --production

FROM base AS runner
WORKDIR /app

RUN mkdir /app/temp /app/output
RUN chmod 777 /app/temp /app/output

COPY /assets /app

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

USER hono
EXPOSE 3001

CMD ["node", "/app/dist/index.js"]