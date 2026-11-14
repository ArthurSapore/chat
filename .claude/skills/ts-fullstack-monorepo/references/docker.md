# Docker e Docker Compose

**Todo projeto entrega**: um `Dockerfile` por app (`apps/api/Dockerfile`, `apps/web/Dockerfile`),
um `docker-compose.yml` e um `.dockerignore` na raiz. O build sempre usa a **raiz do monorepo
como contexto** (os apps dependem de `packages/*`), com `turbo prune` para copiar só o necessário.

## .dockerignore (raiz)

```
**/node_modules
**/dist
**/.turbo
**/.env
**/.env.*
!**/.env.example
.git
.vscode
.idea
coverage
```

## apps/api/Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# 1. recorta o monorepo só com o que a api usa
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune api --docker

# 2. instala deps (camada cacheada pelo lockfile) e builda
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo build --filter=api
# deixa só dependências de produção da api numa pasta isolada
RUN pnpm --filter=api deploy --prod /prod/api

# 3. runtime enxuto
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /prod/api/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Notas:
- `pnpm deploy` pode exigir `inject-workspace-packages=true` no `.npmrc` (pnpm ≥ 10) ou a flag
  `--legacy`; como o tsup embute `@workspace/*` (`noExternal`), o runtime só precisa das deps externas.
- Migrations: rode antes do `CMD` (ex.: `CMD ["sh", "-c", "node dist/migrate.js && node dist/server.js"]`)
  ou num serviço `migrate` separado no compose — nunca dependa de rodá-las manualmente.
- Configuração vem só de variáveis de ambiente (o compose injeta); não copie `.env` para a imagem.

## apps/web/Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# VITE_* são embutidas no bundle em tempo de build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm turbo build --filter=web

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
```

```nginx
# apps/web/nginx.conf — fallback para o roteamento client-side (TanStack Router)
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## docker-compose.yml (raiz)

```yaml
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-app}
      POSTGRES_DB: ${POSTGRES_DB:-app}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    environment:
      PORT: 3000
      DATABASE_URL: postgres://${POSTGRES_USER:-app}:${POSTGRES_PASSWORD:-app}@postgres:5432/${POSTGRES_DB:-app}
      UI_URL: ${UI_URL:-http://localhost:8080}
      JWT_SECRET: ${JWT_SECRET:?defina JWT_SECRET no .env}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - api

volumes:
  postgres-data:
```

Regras:
- O compose lê o `.env` da raiz (com `.env.example` commitado listando `POSTGRES_*`,
  `JWT_SECRET`, `UI_URL`, `VITE_API_URL`).
- Dentro da rede do compose a API acessa o banco pelo nome do serviço (`postgres`), não `localhost`.
- `depends_on` com `condition: service_healthy` para o banco; healthcheck em todo serviço de dados.
- Dados persistem em volume nomeado.
- Em dev local é comum subir só `docker compose up -d postgres` e rodar `pnpm dev` na máquina,
  com `DATABASE_URL=postgres://app:app@localhost:5432/app` no `apps/api/.env`.
- Novo app ⇒ novo Dockerfile seguindo o mesmo padrão (prune → install → build → runtime) e
  novo serviço no compose. Nova variável ⇒ compose + `.env.example` + schema Zod.
