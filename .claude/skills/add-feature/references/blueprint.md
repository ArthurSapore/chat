# Blueprint de uma feature ponta a ponta

Placeholders: `<feature>` (kebab-case, ex.: `appointment`), `<features>` (plural, usado em
rotas HTTP/tabelas, ex.: `appointments`), `<Feature>` (PascalCase), `<Features>` (PascalCase plural).
Exemplos completos de cada camada estão nas referências da skill base
(`../../ts-fullstack-monorepo/references/`).

## Arquivos

```
packages/contracts/src/dtos/
  <feature>.ts                         # NOVO: DTO, schemas Zod de entrada, tipos inferidos, DTOs <Acao>Request
  index.ts                             # ALTERAR: export * from "./<feature>"
packages/contracts/src/<features>/
  routes.ts                            # NOVO: <FEATURE>_PATHS (api) + <FEATURE>_ROUTES (front)
packages/contracts/src/index.ts        # ALTERAR: export * from "./<features>/routes"

apps/api/src/
  db/...                               # NOVO: schema/model + migration (formato do ORM)
  modules/<features>/
    <features>.repository.ts           # NOVO
    <features>.service.ts              # NOVO
    <features>.service.test.ts         # NOVO
    <features>.controller.ts           # NOVO
    <features>.routes.ts               # NOVO
    <features>.gateway.ts              # NOVO (só se tempo real)
    utils/                             # NOVO (só se precisar)
  container.ts                         # ALTERAR: instanciar repository → service → controller → routes
  app.ts                               # ALTERAR: this.express.use(c.<features>Routes.router) (caminhos completos do contracts)
  config/env.ts                        # ALTERAR (só se houver variável nova)

apps/web/src/
  feature/<feature>/
    components/
      <feature>-form.tsx               # NOVO (criar/editar)
      <feature>-form.test.tsx          # NOVO
      <feature>-list.tsx               # NOVO (listagem)
    hooks/
      query-options.ts                 # NOVO
      mutation-options.ts              # NOVO
    service/
      requests.ts                      # NOVO: <acao>Request(dto) → http.request(<FEATURE>_ROUTES…)
    context/                           # NOVO (só se houver estado de subárvore)
    utils/                             # NOVO (só se precisar)
    constants.ts                       # NOVO: keys do Query + constantes
    schemas.ts                         # NOVO: reexport do contracts + schemas de tela
    types.ts                           # NOVO: reexport do contracts + tipos de tela
  routes/_authenticated/<features>/
    index.tsx                          # NOVO: listagem
    $<feature>Id.tsx                   # NOVO: detalhe/edição
    new.tsx                            # NOVO: criação (se for tela própria)

.env.example / apps/api/.env.example   # ALTERAR (só se houver variável nova)
docker-compose.yml                     # ALTERAR (só se houver variável/serviço novo)
```

## Esqueletos

### Contratos

```ts
// packages/contracts/src/dtos/<feature>.ts
import { z } from "zod"
import type { ISODateString } from "./common"

export interface <Feature>Dto {
  id: string
  // campos…
  createdAt: ISODateString
  updatedAt: ISODateString
}

export const create<Feature>Schema = z.object({
  // campos de entrada com validações e mensagens em pt-BR
})
export type Create<Feature>Input = z.infer<typeof create<Feature>Schema>

export const update<Feature>Schema = create<Feature>Schema.partial()
export type Update<Feature>Input = z.infer<typeof update<Feature>Schema>

export const list<Features>QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})
export type List<Features>Query = z.infer<typeof list<Features>QuerySchema>

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
```

(Se `Paginated<T>` já existir em `common.ts`, reutilize.)

### API — endpoints padrão de um CRUD

| Método | Caminho | Controller | Resposta |
|---|---|---|---|
| GET | `/<features>` | `list` | `200 Paginated<<Feature>Dto>` |
| GET | `/<features>/:id` | `getById` | `200 <Feature>Dto` / `404` |
| POST | `/<features>` | `create` | `201 <Feature>Dto` / `400` |
| PATCH | `/<features>/:id` | `update` | `200 <Feature>Dto` / `400` / `404` |
| DELETE | `/<features>/:id` | `remove` | `204` / `404` |

Implemente só as operações pedidas.

```ts
// apps/api/src/modules/<features>/<features>.controller.ts
export class <Features>Controller {
  constructor(private readonly <features>Service: <Features>Service) {}

  list = async (req: Request, res: Response) => {
    const query = list<Features>QuerySchema.parse(req.query)
    res.json(await this.<features>Service.list(query))
  }

  getById = async (req: Request<{ id: string }>, res: Response) => {
    res.json(await this.<features>Service.getById(req.params.id))
  }

  create = async (req: Request, res: Response) => {
    const input = create<Feature>Schema.parse(req.body)
    res.status(201).json(await this.<features>Service.create(input))
  }

  update = async (req: Request<{ id: string }>, res: Response) => {
    const input = update<Feature>Schema.parse(req.body)
    res.json(await this.<features>Service.update(req.params.id, input))
  }

  remove = async (req: Request<{ id: string }>, res: Response) => {
    await this.<features>Service.remove(req.params.id)
    res.status(204).end()
  }
}
```

```ts
// apps/api/src/container.ts — trecho a acrescentar
readonly <features>Repository = new <Features>Repository(this.db)
readonly <features>Service = new <Features>Service(this.<features>Repository)
readonly <features>Controller = new <Features>Controller(this.<features>Service)
readonly <features>Routes = new <Features>Routes(this.<features>Controller)
```

Service: `list`, `getById` (lança `NotFoundError`), `create`, `update` (verifica existência),
`remove` (verifica existência) + regras de negócio/permissão. Repository: as operações
equivalentes no ORM, sempre devolvendo DTO.

### Front

```ts
// packages/contracts/src/<features>/routes.ts — rotas compartilhadas (api registra, front chama)
import { buildPath, type HttpRequestConfig } from "../routes"

export const <FEATURE>_PATHS = {
  list: "/<features>",
  detail: "/<features>/:id",
} as const

export const <FEATURE>_ROUTES = {
  list(dto: List<Features>Request): HttpRequestConfig {
    return { method: "GET", url: <FEATURE>_PATHS.list, params: dto }
  },
  getById({ id }: Get<Feature>Request): HttpRequestConfig {
    return { method: "GET", url: buildPath(<FEATURE>_PATHS.detail, { id }) }
  },
  create(dto: Create<Feature>Request): HttpRequestConfig {
    return { method: "POST", url: <FEATURE>_PATHS.list, data: dto }
  },
  update({ id, ...data }: Update<Feature>Request): HttpRequestConfig {
    return { method: "PATCH", url: buildPath(<FEATURE>_PATHS.detail, { id }), data }
  },
  remove({ id }: Remove<Feature>Request): HttpRequestConfig {
    return { method: "DELETE", url: buildPath(<FEATURE>_PATHS.detail, { id }) }
  },
} as const
```

```ts
// feature/<feature>/service/requests.ts — só escolhe a rota e repassa o DTO
import { http } from "@/config/http"

export async function list<Features>Request(dto: List<Features>Request) {
  return http.request<Paginated<<Feature>Dto>>(<FEATURE>_ROUTES.list(dto))
}

export async function get<Feature>Request(dto: Get<Feature>Request) {
  return http.request<<Feature>Dto>(<FEATURE>_ROUTES.getById(dto))
}

export async function create<Feature>Request(dto: Create<Feature>Request) {
  return http.request<<Feature>Dto>(<FEATURE>_ROUTES.create(dto))
}

export async function update<Feature>Request(dto: Update<Feature>Request) {
  return http.request<<Feature>Dto>(<FEATURE>_ROUTES.update(dto))
}

export async function remove<Feature>Request(dto: Remove<Feature>Request) {
  return http.request<void>(<FEATURE>_ROUTES.remove(dto))
}
```

```ts
// feature/<feature>/constants.ts
export const <feature>Keys = {
  all: ["<features>"] as const,
  list(query: List<Features>Query) {
    return [...<feature>Keys.all, "list", query] as const
  },
  detail(id: string) {
    return [...<feature>Keys.all, "detail", id] as const
  },
}
```

```ts
// feature/<feature>/hooks/query-options.ts
export function <features>QueryOptions(query: List<Features>Query) {
  return queryOptions({
    queryKey: <feature>Keys.list(query),
    async queryFn() {
      const { data } = await list<Features>Request(query)
      return data
    },
  })
}

export function <feature>QueryOptions(id: string) {
  return queryOptions({
    queryKey: <feature>Keys.detail(id),
    async queryFn() {
      const { data } = await get<Feature>Request({ id })
      return data
    },
  })
}
```

```ts
// feature/<feature>/hooks/mutation-options.ts
export function create<Feature>MutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    async mutationFn(dto: Create<Feature>Request) {
      const { data } = await create<Feature>Request(dto)
      return data
    },
    onSuccess() {
      return queryClient.invalidateQueries({ queryKey: <feature>Keys.all })
    },
  })
}
// update<Feature>MutationOptions / remove<Feature>MutationOptions no mesmo formato
```

```tsx
// routes/_authenticated/<features>/index.tsx
export const Route = createFileRoute("/_authenticated/<features>/")({
  validateSearch: list<Features>QuerySchema,
  loaderDeps({ search }) {
    return search
  },
  loader({ context, deps }) {
    return context.queryClient.ensureQueryData(<features>QueryOptions(deps))
  },
  component: <Features>Page,
})

function <Features>Page() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(<features>QueryOptions(search))
  return <<Feature>List items={data.items} />
}
```

### Testes mínimos

| Camada | Arquivo | O que cobre |
|---|---|---|
| contracts | `<feature>.test.ts` | schema aceita válido e rejeita inválido |
| api | `<features>.service.test.ts` | regras de negócio, `NotFoundError`, chamadas ao repository (dublê via construtor) |
| api | `<features>.controller.test.ts` (opcional) | status HTTP e validação de entrada |
| web | `<feature>-form.test.tsx` | validação exibida, submit chama a mutation |
| web | utils/context da feature | quando existirem |
