# API (`apps/api`)

Node + Express 5, ESM, alias `@/*` → `src/*`. Camadas **controller → service → repository**,
injeção de dependência por construtor montada num composition root, PostgreSQL, configuração
via `.env` validada com Zod. Socket.IO é opcional e reutiliza os mesmos services.

**Estilo: classes.** Todo código da api (controllers, services, repositories, routes, gateways,
middlewares, erros, error handler, container, utilitários) é escrito como classe. Só arquivos
de bootstrap/config (`config/env.ts`, `server.ts`) ficam como código de módulo simples.

## package.json

```json
{
  "name": "api",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "db:migrate": "<comando de migration do ORM escolhido>"
  },
  "dependencies": {
    "@workspace/contracts": "workspace:*",
    "cors": "^2", "dotenv": "*", "express": "^5", "jsonwebtoken": "^9",
    "zod": "^4"
    // + ORM/driver escolhido pelo usuário
  },
  "devDependencies": {
    "@types/cors": "*", "@types/express": "^5", "@types/jsonwebtoken": "^9",
    "@types/node": "*", "tsup": "*", "tsx": "^4",
    "typescript": "<mesma da raiz>"
  }
}
```

`tsup.config.ts`: `entry ["src/server.ts"]`, `format ["esm"]`, `platform "node"`,
`target "node20"`, `sourcemap`, `clean`, `noExternal: [/^@workspace\//]`.
`tsconfig.json`: estende `../../tsconfig.base.json`, `lib ["ES2023"]`, `types ["node"]`,
`paths { "@/*": ["./src/*"] }`. Na api pode-se usar parameter properties
(`constructor(private readonly x: X) {}`) — `erasableSyntaxOnly` vale só para o web.

## Configuração (.env)

```ts
// src/config/env.ts
import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  UI_URL: z.string().nonempty().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error("Invalid environment variables:")
  console.error(z.prettifyError(result.error))
  process.exit(1)
}

export const env = result.data
export type Env = typeof env
```

`apps/api/.env.example` lista todas as chaves com valores de exemplo
(`DATABASE_URL=postgres://app:app@localhost:5432/app`). `.env` não é commitado.

## Banco (PostgreSQL) e ORM

**Antes de criar a camada de persistência**, verifique no `apps/api/package.json` se já existe
um ORM/query builder. Se não existir, **pergunte ao usuário** qual usar — não escolha sozinho.
Opções a oferecer: Prisma, Drizzle, TypeORM, MikroORM, Kysely ou `pg` puro.

Independentemente do ORM:
- Conexão encapsulada numa classe `Database` em `src/db/database.ts` (cria o client/pool a
  partir de `env.DATABASE_URL`, expõe o client do ORM e um `close()` para o shutdown), registrada
  no container e injetada nos repositories.
- Schema/models e migrations no lugar padrão do ORM escolhido (ex.: `prisma/`, `src/db/schema.ts`
  + `drizzle/`, `src/db/migrations/`), com script `db:migrate` executado antes de subir a API
  (no compose, como comando de inicialização ou serviço separado).
- Colunas em `snake_case` no banco; DTOs em `camelCase` (o repository faz o mapeamento).
- `id uuid` com `gen_random_uuid()`, `created_at`/`updated_at timestamptz default now()`.
- Nada de SQL concatenado com entrada do usuário; transações coordenadas no service usando o
  mecanismo do ORM, passando o client transacional aos repositories.

```ts
// src/db/database.ts — forma geral (o corpo depende do ORM)
import type { Env } from "@/config/env"

export class Database {
  readonly client: OrmClient // tipo do client do ORM escolhido

  constructor(env: Env) {
    this.client = createOrmClient(env.DATABASE_URL)
  }

  async close() {
    await this.client.close() // $disconnect(), end(), destroy()… conforme o ORM
  }
}
```

## Camadas

Estrutura de um módulo:

```
src/
  utils/                       # utilitários globais da api (<assunto>-utils.ts)
  modules/<modulo>/
    <modulo>.controller.ts
    <modulo>.service.ts
    <modulo>.repository.ts
    <modulo>.routes.ts
    <modulo>.gateway.ts        # opcional (Socket.IO)
    utils/                     # utilitários só deste módulo
```

### Repository — único lugar que fala com o banco

```ts
// src/modules/items/items.repository.ts
import type { CreateItemInput, ItemDto } from "@workspace/contracts"
import type { Database } from "@/db/database"

export class ItemsRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<ItemDto | null> {
    // consulta via this.db.client (ORM escolhido) e mapeia para ItemDto
  }

  async create(input: CreateItemInput): Promise<ItemDto> {
    // insert via this.db.client e mapeia para ItemDto
  }

  private toDto(row: ItemRow): ItemDto {
    return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString() }
  }
}
```

Repositories retornam DTOs do contracts (nunca entidades/rows do ORM para fora da camada).

### Service — regra de negócio, sem Express

```ts
// src/modules/items/items.service.ts
import type { CreateItemInput, ItemDto } from "@workspace/contracts"
import { NotFoundError } from "@/http/errors"
import type { ItemsRepository } from "@/modules/items/items.repository"

export class ItemsService {
  constructor(private readonly itemsRepository: ItemsRepository) {}

  async getById(id: string): Promise<ItemDto> {
    const item = await this.itemsRepository.findById(id)
    if (!item) throw new NotFoundError("Item not found")
    return item
  }

  create(input: CreateItemInput): Promise<ItemDto> {
    return this.itemsRepository.create(input)
  }
}
```

Services lançam erros de domínio (`AppError` e subclasses); nunca acessam `req`/`res`.

### Controller — HTTP

```ts
// src/modules/items/items.controller.ts
import { createItemSchema } from "@workspace/contracts"
import type { Request, Response } from "express"
import type { ItemsService } from "@/modules/items/items.service"

export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  getById = async (req: Request<{ id: string }>, res: Response) => {
    res.json(await this.itemsService.getById(req.params.id))
  }

  create = async (req: Request, res: Response) => {
    const input = createItemSchema.parse(req.body)
    res.status(201).json(await this.itemsService.create(input))
  }
}
```

Handlers como propriedades arrow da classe para manter o `this` ao passar ao router.
Express 5 propaga rejeições de handlers async para o error handler — sem `try/catch` nem wrapper.

### Routes

```ts
// src/modules/items/items.routes.ts
import { ITEM_PATHS } from "@workspace/contracts"
import { Router } from "express"
import type { ItemsController } from "@/modules/items/items.controller"

// Caminhos completos vêm do contracts (os mesmos que o front usa em ITEM_ROUTES).
export class ItemsRoutes {
  readonly router = Router()

  constructor(private readonly controller: ItemsController) {
    this.router.get(ITEM_PATHS.item, this.controller.getById)
    this.router.post(ITEM_PATHS.items, this.controller.create)
  }
}
```

### Utilitários da api

```ts
// src/utils/date-utils.ts
export class DateUtils {
  static toISODate(date: Date): string {
    return date.toISOString().slice(0, 10)
  }
}
```

Classes com métodos `static`, puras (sem banco, sem `req`/`res`). Escopo:
`modules/<modulo>/utils/` (só o módulo), `src/utils/` (vários módulos), `packages/utils`
(também usado pelo front — lá ficam como funções; ver [workspace.md](workspace.md#utilitários)).

## Injeção de dependência (composition root)

```ts
// src/container.ts
import { env, type Env } from "@/config/env"
import { Database } from "@/db/database"
import { ErrorHandler } from "@/http/error-handler"
import { ItemsController } from "@/modules/items/items.controller"
import { ItemsRepository } from "@/modules/items/items.repository"
import { ItemsRoutes } from "@/modules/items/items.routes"
import { ItemsService } from "@/modules/items/items.service"

export class Container {
  readonly env: Env = env
  readonly db = new Database(this.env)
  readonly errorHandler = new ErrorHandler()

  // items
  readonly itemsRepository = new ItemsRepository(this.db)
  readonly itemsService = new ItemsService(this.itemsRepository)
  readonly itemsController = new ItemsController(this.itemsService)
  readonly itemsRoutes = new ItemsRoutes(this.itemsController)
}
```

- Toda dependência entra pelo construtor; nenhuma classe faz `new` das suas dependências nem
  importa singletons. O `Container` é o **único** lugar que instancia.
- Em testes, instancie as classes passando fakes/mocks no construtor.
- Se o número de módulos crescer, um container de DI (ex.: `awilix`, `tsyringe`) pode substituir
  o manual — mantendo a injeção por construtor.

## Bootstrap e erros

```ts
// src/app.ts
import cors from "cors"
import express, { type Express } from "express"
import type { Container } from "@/container"

export class App {
  readonly express: Express = express()

  constructor(private readonly c: Container) {
    this.express.use(cors({ origin: c.env.UI_URL, credentials: true }))
    this.express.use(express.json())

    this.express.get("/health", (_req, res) => {
      res.json({ status: "ok" })
    })
    this.express.use(c.itemsRoutes.router)

    this.express.use(c.errorHandler.handle)
  }
}
```

```ts
// src/http/errors.ts
export class AppError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404)
  }
}
```

```ts
// src/http/error-handler.ts
import type { NextFunction, Request, Response } from "express"
import { ZodError, z } from "zod"
import { AppError } from "@/http/errors"

export class ErrorHandler {
  handle = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ status: 400, message: z.prettifyError(err) })
    }
    if (err instanceof AppError) {
      return res.status(err.status).json({ status: err.status, message: err.message })
    }
    console.error(err)
    res.status(500).json({ status: 500, message: "Internal server error" })
  }
}
```

Respostas de erro seguem `ApiErrorBody { status, message }` do contracts. Middlewares
(auth, rate limit…) seguem o mesmo formato: classe com o handler como propriedade arrow,
registrada no container.

```ts
// src/server.ts
import { createServer } from "node:http"
import { App } from "@/app"
import { Container } from "@/container"

const container = new Container()
const httpServer = createServer(new App(container).express)

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${container.env.PORT} is already in use`
      : error
  )
  process.exit(1)
})

httpServer.listen(container.env.PORT, () => {
  console.log(`Server running on port ${container.env.PORT}`)
})

function shutdown() {
  httpServer.close(async () => {
    await container.db.close()
    process.exit(0)
  })
}
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
```

## Tempo real (opcional): Socket.IO

- `src/socket/socket-server.ts` com uma classe `SocketServer` que cria
  `Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>` sobre o
  mesmo `httpServer`, com `cors.origin = env.UI_URL` e middleware de handshake (classe
  `SocketAuthMiddleware`: `socket.handshake.auth.token` → `jwt.verify` → `socket.data.userId`).
- Cada módulo pode ter um `<modulo>.gateway.ts` — classe equivalente ao controller para eventos —
  recebendo `io`, `socket` e o **service** injetado (`new ItemsGateway(io, socket, c.itemsService)`).
- Eventos `dominio:acao`, tipados em `packages/contracts`; comandos com ack
  `{ success: boolean; error?: string }` respondido em sucesso e erro.
