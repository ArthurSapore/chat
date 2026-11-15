# Workspace, configs e novos pacotes

## pnpm + Turbo

- `pnpm-workspace.yaml`: `apps/*` e `packages/*`; `allowBuilds` só para o necessário (`esbuild: true`).
- Dependências internas com `"workspace:*"`.
- `turbo.json`: `build` depende de `^build` e gera `dist/**` (inputs incluem `.env*`);
  `lint`, `format`, `typecheck` dependem dos equivalentes upstream; `test` depende de `^build`
  com `outputs: ["coverage/**"]`; `dev` com `cache: false, persistent: true`.
- Todo pacote expõe os scripts que o turbo orquestra: `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`) e,
  quando aplicável, `dev`, `build`, `format`.

## Pacotes internos "source-only"

`@workspace/contracts` e `@workspace/ui` não têm build: `exports` aponta direto para `.ts/.tsx`.

```json
{
  "name": "@workspace/<nome>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "lint": "eslint", "typecheck": "tsc --noEmit" }
}
```

Consequências:
- Vite resolve o TS direto; a API precisa de `noExternal: ["@workspace/<nome>"]` no `tsup.config.ts`.
- Cada consumidor declara `paths` no tsconfig (`"@workspace/ui/*": ["../../packages/ui/src/*"]`).
- `packages/contracts` contém tipos **e schemas Zod** de entrada compartilhados (`zod` como
  dependência): a API valida com o schema e o front usa o mesmo schema no `zodResolver`.
  Também contém as **rotas HTTP** de cada domínio (`<DOMINIO>_PATHS` e `<DOMINIO>_ROUTES`).
  Nada além disso de runtime (sem banco, axios ou React).

### Estrutura do `packages/contracts`

```
src/
  index.ts        # export * from "./dtos"; export * from "./routes"; export * das rotas de domínio
  routes.ts       # HttpMethod, HttpRequestConfig, buildPath, ApiErrorBody
  dtos/
    index.ts      # export * de cada domínio
    common.ts     # ISODateString e afins
    <dominio>.ts  # DTOs, schemas Zod de entrada (+ z.infer), DTOs <Acao>Request e mapas de eventos
  <dominio>/
    routes.ts     # <DOMINIO>_PATHS (padrões Express) e <DOMINIO>_ROUTES (configs de requisição)
```

```ts
// src/dtos/items.ts
import { z } from "zod"
import type { ISODateString } from "./common"

export interface ItemDto {
  id: string
  name: string
  createdAt: ISODateString
}

export const createItemSchema = z.object({ name: z.string().trim().min(1) })
export type CreateItemInput = z.infer<typeof createItemSchema>
```

### Rotas HTTP (`<DOMINIO>_PATHS` / `<DOMINIO>_ROUTES`)

Front e api usam a **mesma** definição de rota — nunca strings de URL soltas em nenhum dos dois.

```ts
// src/organization/routes.ts
import { buildPath, type HttpRequestConfig } from "../routes"
import type { CreateNewOrganizationRequest } from "../dtos/organization"

/** Padrões Express — a api faz `router.post(ORGANIZATION_PATHS.organizations, ...)`. */
export const ORGANIZATION_PATHS = {
  organizations: "/organizations",
  organization: "/organizations/:organizationId",
} as const

/** O front faz `http.request(ORGANIZATION_ROUTES.createNewOrganization(dto))`. */
export const ORGANIZATION_ROUTES = {
  createNewOrganization(dto: CreateNewOrganizationRequest): HttpRequestConfig {
    return { method: "POST", url: ORGANIZATION_PATHS.organizations, data: dto }
  },
  getOrganization({ organizationId }: { organizationId: string }): HttpRequestConfig {
    return {
      method: "GET",
      url: buildPath(ORGANIZATION_PATHS.organization, { organizationId }),
    }
  },
} as const
```

- `HttpRequestConfig` (`{ method, url, params?, data? }`) é compatível com o `AxiosRequestConfig`,
  mas o contracts **não** depende do axios.
- Path params via `buildPath` (codifica os valores); query string em `params`; corpo em `data`.
- Nomes: `<DOMINIO>_PATHS` / `<DOMINIO>_ROUTES` em `UPPER_SNAKE_CASE`; ações em camelCase iguais
  às dos requests do front (`createNewOrganization` ↔ `createNewOrganizationRequest`).

Datas trafegam como string ISO (`ISODateString`). Se houver mais de um domínio com eventos,
cada um exporta seu mapa (`ItemClientEvents`…) e `dtos/index.ts` os combina por interseção
em `ClientToServerEvents` / `ServerToClientEvents`.

## Utilitários

Pastas `utils/` com arquivos `<assunto>-utils.ts`, colocadas no **menor escopo** que as usa:

| Quem usa | Onde fica | Import |
|---|---|---|
| Front **e** back | `packages/utils/src/<assunto>-utils.ts` | `@workspace/utils` |
| Vários pontos de um app | `apps/<app>/src/utils/<assunto>-utils.ts` | `@/utils/<assunto>-utils` |
| Uma feature do web | `apps/web/src/feature/<feature>/utils/<assunto>-utils.ts` | `@/feature/<feature>/utils/<assunto>-utils` |
| Um módulo da api | `apps/api/src/modules/<modulo>/utils/<assunto>-utils.ts` | `@/modules/<modulo>/utils/<assunto>-utils` |

Exemplos de nomes: `app-utils.ts`, `date-utils.ts`, `string-utils.ts`, `user-organization-utils.ts`.

Regras:
- Puros e tipados, sem estado, sem I/O (fetch, banco, `localStorage`), sem React.
  Na **api**: classe por arquivo com métodos `static` (`DateUtils.toISODate()`). No **web** e em
  `packages/utils`: funções nomeadas com `function` (sem arrow).
  Código com efeito vai em `service/`, `lib/` ou repository; hooks vão em `hooks/`.
- Um arquivo por assunto; não criar `utils.ts` genérico. (Exceção: `packages/ui/src/lib/utils.ts`
  com o `cn`, que é convenção do shadcn.)
- Quando um utilitário passa a ser usado num escopo maior, **mova** para o nível de cima e
  atualize os imports — nunca duplique.
- Uma feature/módulo não importa o `utils/` de outra; se precisar, promova para o `utils/` do app.
- `packages/utils` não depende de DOM nem de Node (`lib: ["ES2022"]`, `types: []`), para rodar nos dois lados.
- **Datas sempre com `date-fns`**, e o `date-fns` só é dependência do `packages/utils`: formatação,
  comparação e datas relativas ("Hoje", "Ontem", "14 de novembro") ficam em `date-utils.ts`
  (`formatTime`, `formatDateTime`, `isSameCalendarDay`, `formatFuzzyDay`…), com `locale: ptBR`
  quando o texto vai para a UI. Apps importam de `@workspace/utils`, nunca o `date-fns` direto, e
  não usam `toLocale*String`/`Intl.DateTimeFormat` para isso.
- Testes com Vitest (`date-utils.test.ts`), usando datas locais (`new Date(y, m, d, h)`) para não
  depender do fuso da máquina.

### `packages/utils`

```json
{
  "name": "@workspace/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "scripts": { "lint": "eslint", "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "date-fns": "^4" }
}
```

```ts
// packages/utils/src/date-utils.ts
import { format, isSameDay, isSameYear, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"

export function formatFuzzyDay(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return "Hoje"
  if (isSameDay(date, subDays(now, 1))) return "Ontem"
  return isSameYear(date, now)
    ? format(date, "d de MMMM", { locale: ptBR })
    : format(date, "d de MMMM de yyyy", { locale: ptBR })
}
```

```ts
// packages/utils/src/index.ts
export * from "./date-utils"
export * from "./string-utils"
```

Consumidores: adicionar `"@workspace/utils": "workspace:*"` nas dependências e o `paths`
`"@workspace/utils/*": ["../../packages/utils/src/*"]` no tsconfig do web. Na api o tsup já
embute via `noExternal: [/^@workspace\//]`.

## TypeScript

`tsconfig.base.json` (raiz) — estender sempre que possível:
`target ES2023`, `module ESNext`, `moduleResolution bundler`, `moduleDetection force`,
`verbatimModuleSyntax`, `strict`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`, `noEmit`, `skipLibCheck`.

- API: `lib ES2023`, `types ["node"]`, `paths { "@/*": ["./src/*"] }`.
- Web: project references (`tsconfig.app.json` para `src`, `tsconfig.node.json` para `vite.config.ts`),
  `jsx react-jsx`, `erasableSyntaxOnly` (sem `enum`/`namespace`/parameter properties no web),
  `allowImportingTsExtensions`.
- contracts adiciona `noUncheckedIndexedAccess`.
- Versão de `typescript`: alinhe com a raiz (`~6.0.2`).

## ESLint (flat config)

```js
import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended /*, reactHooks.configs.flat.recommended, reactRefresh.configs.vite */],
    languageOptions: { globals: globals.browser },
  },
])
```

Pacotes React adicionam `eslint-plugin-react-hooks` e `eslint-plugin-react-refresh`
(com `react-refresh/only-export-components: "off"`). Pacotes TS puros usam
`consistent-type-imports` (`inline-type-imports`) e `no-unused-vars` ignorando `^_`,
com `parserOptions.tsconfigRootDir: import.meta.dirname`.

## Prettier

`.prettierrc` na raiz: `semi: false`, `singleQuote: false`, `tabWidth 2`, `trailingComma es5`,
`printWidth 80`, `endOfLine lf`, plugin `prettier-plugin-tailwindcss` com
`tailwindStylesheet: packages/ui/src/styles/globals.css` e `tailwindFunctions: ["cn", "cva"]`.

VS Code (`.vscode/settings.json`): format on save com Prettier, `preferTypeOnlyAutoImports`,
imports não relativos.

## Env

- `.gitignore` com `.env*` e `!.env.example`: cada app (e a raiz, para o compose) tem um
  `.env.example` commitado com todas as chaves.
- API lê via `dotenv/config` + Zod; web lê `VITE_*` via `import.meta.env` (a URL da API fica
  em `src/config/http.ts` como `API_URL`).
- `VITE_*` são embutidas no build — no Docker entram como `ARG` de build, não como env de runtime.
