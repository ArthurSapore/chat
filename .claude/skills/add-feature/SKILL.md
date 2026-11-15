---
name: add-feature
description: Adiciona uma funcionalidade completa (ponta a ponta) a um projeto que segue a stack ts-fullstack-monorepo — contratos compartilhados, módulo da API (controller/service/repository com DI e migration no PostgreSQL), feature no front (service, query/mutation options, schemas, componentes, rotas TanStack Router), testes Vitest e ajustes de env/Docker. Use quando o usuário pedir para criar, adicionar ou implementar uma funcionalidade, feature, módulo, CRUD, tela ou endpoint novo nesse tipo de projeto.
---

# add-feature

Fluxo para adicionar uma funcionalidade a um projeto que usa a stack **ts-fullstack-monorepo**.
As convenções (estrutura, estilo, bibliotecas) vêm da skill base — este arquivo define **o
processo** e **o que entregar**.

> Antes de começar, leia `../ts-fullstack-monorepo/SKILL.md`. Consulte as referências dela
> (`references/api.md`, `web-ui.md`, `testing.md`, `workspace.md`, `docker.md`) conforme a camada
> que estiver implementando. Se o projeto divergir da skill base, **o projeto vence**: siga o
> padrão que já existe no código e avise o usuário da divergência.

## 1. Entender o pedido

Extraia do pedido (e pergunte com `AskUserQuestion` **só o que faltar**, numa única rodada):

| Item | Exemplo |
|---|---|
| Nome da feature (kebab-case, singular para entidade) | `appointment`, `user-profile` |
| Entidade e campos (nome, tipo, obrigatório, validações) | `startsAt: Date`, `notes?: string (≤ 500)` |
| Operações | listar (com filtros/paginação?), detalhar, criar, editar, excluir |
| Camadas envolvidas | só API, só front, ou ponta a ponta (padrão) |
| Telas/rotas do front | `/appointments`, `/appointments/$appointmentId` |
| Regras de negócio e permissões | só o dono edita; rota protegida |
| Tempo real? | eventos Socket.IO necessários? |

Não pergunte o que dá para inferir do projeto (estrutura, libs, estilo).

## 2. Reconhecer o projeto

Antes de escrever código, leia o que já existe:

- `apps/api/package.json` → **ORM/driver de banco**. Se não houver nenhum definido, **pergunte ao
  usuário qual usar** (Prisma, Drizzle, TypeORM, MikroORM, Kysely ou `pg` puro) e pare até ter a resposta.
- `apps/api/src/container.ts`, `app.ts` e um módulo existente → padrão real de registro de rotas e DI.
- `apps/web/src/feature/*` e `src/routes/*` → uma feature existente para copiar o formato.
- `packages/contracts/src/dtos/` → nomes e estilo dos DTOs.
- `apps/web/src/components/` e `packages/ui/src/components/` → componentes que já podem ser reaproveitados.
- Se a feature (ou parte dela) já existir, **estenda**, não duplique.

## 3. Planejar

Monte a lista de arquivos a criar/alterar (use [references/blueprint.md](references/blueprint.md))
e mostre ao usuário um resumo curto antes de implementar quando a feature tocar mais de uma camada.
Ordem de implementação — de dentro para fora, para que cada passo compile sobre o anterior:

1. **Contratos** (`packages/contracts`)
2. **Banco**: schema/model + migration
3. **API**: repository → service → controller → routes → registro no container/app (→ gateway, se tempo real)
4. **Front**: types/schemas/constants → service (routes, requests) → hooks (query/mutation options) → context (se houver) → componentes → rotas
5. **Testes** Vitest de cada camada
6. **Config**: env (`.env.example` + schema Zod), `docker-compose.yml` se surgir variável/serviço novo

## 4. Implementar — regras que não podem ser quebradas

Resumo das regras da skill base que mais se aplicam a uma feature nova:

- **Contratos primeiro**: DTO + schema Zod de entrada em `packages/contracts`, usados pela API
  (validação) e pelo front (`zodResolver`). Nunca duplicar tipos.
- **API em classes**, camadas separadas, DI só pelo construtor e instanciação só no `Container`.
  Acesso ao banco só no repository; repository retorna DTO; erros de domínio via `AppError`.
- **Config** só via `env` validado com Zod; variável nova também no `.env.example` (e no compose).
- **Front em funções com `function`** (sem arrow sempre que possível).
- **Estrutura da feature no front**: `components/`, `hooks/{query-options,mutation-options}.ts`,
  `service/requests.ts` (`<acao>Request(dto)` → `http.request(<FEATURE>_ROUTES.<acao>(dto))`), `context/` e `utils/` (se precisar), `constants.ts`,
  `schemas.ts`, `types.ts`. Keys do Query em `constants.ts`.
- **Estado**: servidor no TanStack Query; formulário no React Hook Form; navegação/filtros no
  TanStack Router (`validateSearch`); subárvore em Context; global de cliente em Zustand.
- **Componentes**: antes de criar, procure no shadcn (MCP `shadcn`); se existir, instale com o CLI
  em vez de criar do zero. Primitivos novos em `packages/ui`, compostos da
  aplicação em `apps/web/src/components`, específicos em `feature/<feature>/components`.
- **Utilitários** no menor escopo (feature/módulo → app → `packages/utils`).
- **Testes Vitest** junto com o código, nunca outro runner.
- Prettier do projeto (sem `;`, aspas duplas), textos de UI em pt-BR. Sempre em inglês:
  funções, variáveis, parâmetros, tipos e os textos de `describe`/`it` dos testes.

## 5. Verificar

Rode e corrija até passar (não declare concluído sem isso):

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Se houver migration, rode-a contra o banco local (`docker compose up -d postgres` + `db:migrate`).
Quando possível, suba o app (`pnpm dev`) e exercite o fluxo principal da tela. Se algo não puder
ser verificado (ex.: sem Docker disponível), diga explicitamente o que ficou sem verificar.

## 6. Entregar

Resumo final ao usuário com:
- arquivos criados/alterados agrupados por camada;
- endpoints (`MÉTODO /caminho`) e rotas do front adicionadas;
- variáveis de ambiente e migrations novas (e como rodar);
- o que foi testado e o que ficou pendente;
- divergências entre o projeto e a skill base encontradas no caminho.

## Checklist da feature

- [ ] DTOs e schemas Zod em `packages/contracts`, exportados no `index.ts`
- [ ] Migration criada com o ORM do projeto (ou o escolhido pelo usuário)
- [ ] Repository, service, controller e routes como classes, registrados no `Container` e no `App`
- [ ] Validação de entrada com o schema do contracts; erros via `AppError`
- [ ] Feature do front com a estrutura padrão e funções `function`
- [ ] Rotas do front com loader usando as query options; rotas protegidas com `beforeLoad`
- [ ] Formulários com React Hook Form + `zodResolver`; mutations invalidando as keys afetadas
- [ ] Testes Vitest: service (dublês por construtor), schemas/utils, componentes principais
- [ ] `.env.example`, schema de env e `docker-compose.yml` atualizados se houve config nova
- [ ] `pnpm typecheck`, `pnpm lint` e `pnpm test` passando
