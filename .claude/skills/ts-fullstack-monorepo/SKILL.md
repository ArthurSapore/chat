---
name: ts-fullstack-monorepo
description: Ferramentas, estrutura e convenções de um monorepo TypeScript full-stack com pnpm + Turborepo, API Node (Express 5 em camadas controller/service/repository com injeção de dependência, PostgreSQL, Zod, Socket.IO, config via .env), front React 19 + Vite (TanStack Router, TanStack Query, Zustand, React Hook Form + Zod, Tailwind v4, shadcn/Base UI), pacote de contratos compartilhados e Docker/Docker Compose. Use ao criar um projeto com essa stack, adicionar apps/pacotes, módulos, endpoints, repositórios, rotas, queries, stores, formulários ou componentes, ou ajustar configs (Docker, tsconfig, ESLint, Prettier, Turbo, tsup, Vite, shadcn).
---

# ts-fullstack-monorepo

Monorepo TypeScript com backend Node, front React, banco PostgreSQL e pacotes internos
compartilhados. Esta skill descreve **ferramentas e estrutura**, independentemente do domínio.

## Stack

| Camada | Ferramentas |
|---|---|
| Monorepo | pnpm workspaces, Turborepo 2, Node ≥ 20.19 |
| Linguagem | TypeScript strict, ESM (`"type": "module"`), `verbatimModuleSyntax`, `moduleResolution: "bundler"` |
| API (`apps/api`) | Express 5, camadas **controller → service → repository**, injeção de dependência por construtor (composition root), Zod 4 (env e entrada), dotenv (`.env`), cors, jsonwebtoken, Socket.IO 4 quando houver tempo real; `tsx watch` (dev), `tsup` (build) |
| Banco | PostgreSQL. ORM/query builder: use o que o projeto já tiver; se não houver, **pergunte ao usuário** antes de criar a persistência |
| Web (`apps/web`) | React 19, Vite 8, **TanStack Router** (rotas por arquivo), **TanStack Query** (estado de servidor), **Zustand** (estado de cliente), **React Hook Form** + **Zod** (`@hookform/resolvers`), Tailwind v4, `@tabler/icons-react`, `socket.io-client` quando houver tempo real |
| UI (`packages/ui`) | shadcn (`style: base-maia`, `iconLibrary: tabler`, `rtl: true`), `@base-ui/react`, `class-variance-authority`, `cn`, `tw-animate-css`, fontes `@fontsource-variable/*` |
| Contratos (`packages/contracts`) | DTOs, tipos HTTP, mapas de eventos e schemas Zod compartilhados, consumidos como fonte `.ts` |
| Infra | **Dockerfile por app** + **docker-compose.yml** na raiz (postgres, api, web) |
| Qualidade | ESLint 10 (flat) + typescript-eslint + react-hooks + react-refresh; Prettier 3 + `prettier-plugin-tailwindcss` |
| Tooling extra | MCP `shadcn` em `.mcp.json` (`npx shadcn@latest mcp --cwd apps/web`) |

## Estrutura

```
.
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ server.ts              # bootstrap: container, http server, socket, listen
│  │  │  ├─ app.ts                 # createApp(container): Express, middlewares, rotas
│  │  │  ├─ container.ts           # composition root: instancia e injeta dependências
│  │  │  ├─ config/env.ts          # schema Zod do .env
│  │  │  ├─ db/{pool.ts, migrations/}
│  │  │  ├─ http/{errors.ts, error-handler.ts, validate.ts}
│  │  │  ├─ socket/                # (opcional) Socket.IO tipado
│  │  │  ├─ utils/                 # utilitários globais da api (<assunto>-utils.ts)
│  │  │  └─ modules/<modulo>/
│  │  │     ├─ <modulo>.controller.ts
│  │  │     ├─ <modulo>.service.ts
│  │  │     ├─ <modulo>.repository.ts
│  │  │     ├─ <modulo>.routes.ts
│  │  │     └─ utils/              # utilitários só do módulo
│  │  ├─ Dockerfile
│  │  └─ tsup.config.ts  tsconfig.json  .env.example
│  └─ web/
│     ├─ src/
│     │  ├─ main.tsx               # QueryClientProvider + RouterProvider + ThemeProvider
│     │  ├─ routes/                # TanStack Router (file-based) → routeTree.gen.ts
│     │  ├─ feature/<feature>/
│     │  │  ├─ components/         # componentes da feature
│     │  │  ├─ hooks/              # query-options.ts, mutation-options.ts
│     │  │  ├─ service/            # routes.ts (endpoints), requests.ts (chamadas HTTP)
│     │  │  ├─ context/            # contextos React só da feature
│     │  │  ├─ utils/              # utilitários só da feature
│     │  │  ├─ constants.ts        # query/mutation keys e constantes
│     │  │  ├─ schemas.ts          # schemas Zod
│     │  │  └─ types.ts
│     │  ├─ context/               # contextos React gerais (<nome>-context.tsx)
│     │  ├─ stores/                # stores Zustand
│     │  ├─ utils/                 # utilitários globais do web (<assunto>-utils.ts)
│     │  ├─ lib/{api-client.ts, query-client.ts}
│     │  ├─ config/                # env do front, socket
│     │  ├─ components/            # componentes compostos da aplicação (layout, grids, header…)
│     │  ├─ hooks/                 # hooks globais do web
│     ├─ Dockerfile  nginx.conf
│     └─ vite.config.ts  components.json  tsconfig.{json,app.json,node.json}
├─ packages/
│  ├─ contracts/src/{index.ts, routes.ts, dtos/*.ts}
│  ├─ utils/src/{index.ts, <assunto>-utils.ts}   # utilitários compartilhados front + back
│  └─ ui/src/{components,hooks,lib}/ + styles/globals.css   # componentes primitivos
├─ docker-compose.yml  .dockerignore  .env.example
├─ .mcp.json  .prettierrc  .prettierignore  .vscode/settings.json
└─ package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
```

## Regras de ouro

1. **Sempre entregar Docker**: todo projeto tem `apps/<app>/Dockerfile` (multi-stage) e um
   `docker-compose.yml` na raiz com `postgres`, `api` e `web`. Novo app ⇒ novo Dockerfile e
   novo serviço no compose. Ver [references/docker.md](references/docker.md).
2. **API em camadas**: controller (HTTP: valida, chama service, responde) → service (regra de
   negócio, sem Express) → repository (único lugar com SQL). Nenhuma camada pula outra.
3. **Injeção de dependência por construtor**: classes recebem dependências no `constructor`;
   ninguém faz `new` de dependência dentro de outra classe. Tudo é montado em `container.ts`.
4. **Configuração só via `.env`** validado com Zod em `config/env.ts`; o código importa `env`,
   nunca `process.env`. Toda variável nova vai no schema **e** no `.env.example`. No front, só `VITE_*`.
5. **PostgreSQL** é a persistência padrão; acesso só via repository, sem SQL concatenado.
   Mudanças de schema por migrations versionadas. **ORM**: se o projeto ainda não tiver um
   definido (verifique `package.json` da api), pergunte ao usuário qual usar (ex.: Prisma,
   Drizzle, TypeORM, MikroORM, Kysely ou `pg` puro) antes de escrever repositories ou migrations
   — não escolha sozinho.
6. **Estilo de código por lado**:
   - **Backend: classes.** Controllers, services, repositories, gateways, middlewares, erros e
     utilitários da api são classes (utilitários como classes com métodos `static`).
   - **Front: funções, e `function` em vez de arrow function sempre que possível** — componentes,
     hooks, requests, query/mutation options, handlers, loaders e utilitários são
     `function nome() {}`; em objetos de configuração use method shorthand (`onSuccess(data) {}`,
     `beforeLoad({ context }) {}`). Arrow só onde não há alternativa razoável: callbacks curtos
     inline (`map`/`filter`, updater do `setState`, seletores e `create((set) => ...)` do Zustand,
     `.catch(() => null)`). Nada de classes no front (exceto subclasses de `Error`).
   - `packages/*` (consumidos pelo front) seguem o estilo do front: funções.
7. **Tipos e schemas compartilhados em `packages/contracts`** (DTOs, payloads, schemas Zod de
   entrada). API e web nunca duplicam.
8. **Front: estado no lugar certo** — dados do servidor no **TanStack Query**; estado de UI/
   cliente global no **Zustand**; estado de formulário no **React Hook Form** com `zodResolver`;
   estado de navegação (params, search) no **TanStack Router**; estado compartilhado por uma
   subárvore de componentes num **Context** (`<nome>-context.tsx`: `<Nome>ContextProvider` +
   `use<Nome>Context`; geral em `src/context/`, de feature em `feature/<feature>/context/`).
   Não copie dados do Query para o Zustand nem para contextos.
9. **Front organizado por feature** em `src/feature/<feature>/` sempre com a mesma forma:
   `components/`, `hooks/{query-options,mutation-options}.ts`, `service/{routes,requests}.ts`,
   `constants.ts`, `schemas.ts`, `types.ts`. `hooks/` exporta *options* do TanStack Query
   (`queryOptions`/`mutationOptions`), keys só em `constants.ts`, `service/` sem React.
   Detalhes em [references/web-ui.md](references/web-ui.md#organização-por-feature).
10. **Rotas do front por arquivo** em `src/routes` (TanStack Router plugin gera `routeTree.gen.ts`
   — não editar). Loaders usam `queryClient.ensureQueryData(...)`.
11. **Utilitários (`utils/`) no menor escopo que os usa**, em arquivos `<assunto>-utils.ts`
    (`date-utils.ts`, `string-utils.ts`, `app-utils.ts`…):
    - usado por front **e** back → `packages/utils` (`@workspace/utils`);
    - usado em vários lugares de um app → `apps/<app>/src/utils/`;
    - usado só por uma feature/módulo → `feature/<feature>/utils/` (web) ou `modules/<modulo>/utils/` (api).
    Puros, sem estado nem efeitos (na api: classes com métodos `static`; no web e em `packages/utils`: `function`); ao passar a ser usado num escopo maior, **mova**
    (nunca duplique). Detalhes em [references/workspace.md](references/workspace.md#utilitários).
12. **Pacotes internos são source-only** (`exports` → `.ts/.tsx`); tsup usa
   `noExternal: [/^@workspace\//]`. Imports com `@/*` no app e `@workspace/<pkg>` entre pacotes.
13. **Componentes em três níveis**:
    - **Primitivos** (botão, input, card, dialog, bubble… — genéricos, sem regra de negócio,
      normalmente via shadcn) → `packages/ui/src/components`.
    - **Compostos da aplicação** (layout do sistema com grids, header, sidebar, page shell,
      empty states — combinam primitivos e são usados por várias telas) → `apps/web/src/components`.
    - **De feature** (login-form, tabelas de uma entidade) → `apps/web/src/feature/<feature>/components`.
    Estilo só por tokens oklch do `globals.css` e propriedades lógicas (RTL).
14. **Prettier**: sem `;`, aspas duplas, 2 espaços, trailing comma `es5`, 80 colunas, LF.
15. **Nomes**: arquivos kebab-case (sufixos `.controller.ts`, `.service.ts`, `.repository.ts`,
    `.routes.ts` na API); componentes/classes PascalCase; constantes `UPPER_SNAKE_CASE`.
16. **Versões alinhadas** de `typescript`, `eslint`, `@types/*` em todos os pacotes.

## Comandos

```bash
pnpm dev                                   # turbo dev (todos os apps)
pnpm build                                 # turbo build
pnpm lint
pnpm typecheck
pnpm format
pnpm --filter <app> add <dep>              # dependência num pacote
pnpm dlx shadcn@latest add <comp> -c apps/web
docker compose up -d postgres              # só o banco, para dev local
docker compose up --build                  # stack completa
```

## Onde olhar

- API (env, DI, camadas, PostgreSQL, erros, Socket.IO) → [references/api.md](references/api.md)
- Web e UI (Router, Query, Zustand, formulários, componentes, shadcn, tema) → [references/web-ui.md](references/web-ui.md)
- Docker e Compose → [references/docker.md](references/docker.md)
- Workspace e configs (pnpm, Turbo, contratos, tsconfig, ESLint, Prettier) → [references/workspace.md](references/workspace.md)

## Checklist antes de concluir

- [ ] Dockerfile de cada app e `docker-compose.yml` existem e refletem apps/variáveis novas.
- [ ] Variáveis novas no schema Zod e no `.env.example`.
- [ ] Novo módulo da API tem controller, service e repository registrados no `container.ts`.
- [ ] Acesso ao banco só em repositories (sem SQL concatenado); migration criada para mudanças de schema.
- [ ] Tipos/schemas que cruzam front/back em `packages/contracts`.
- [ ] Utilitários novos no escopo certo (`packages/utils`, `src/utils` do app ou `utils/` da feature/módulo).
- [ ] Feature do front segue a estrutura padrão (components, hooks, service, constants, schemas, types).
- [ ] Componentes no nível certo: primitivos em `packages/ui`, compostos da aplicação em `apps/web/src/components`, de feature na feature.
- [ ] Estilo: classes na api; `function` (sem arrow sempre que possível) no web.
- [ ] ORM: usado o já existente ou o escolhido pelo usuário (nunca escolhido sem perguntar).
- [ ] Dados do servidor via TanStack Query (keys em `constants.ts`), formulários com RHF + Zod.
- [ ] Contextos em `context/<nome>-context.tsx` (geral em `src/context`, de feature em `feature/<feature>/context`), com Provider + hook `use<Nome>Context` que lança erro fora do provider.
- [ ] `pnpm typecheck` e `pnpm lint` passam; arquivos formatados com Prettier.
