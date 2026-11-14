# Testes (Vitest)

**Vitest é sempre o test runner** — em `apps/api`, `apps/web` e `packages/*`. Não usar Jest,
Mocha ou outro runner. Mocks, spies, timers e cobertura também via Vitest (`vi.fn`, `vi.spyOn`,
`vi.useFakeTimers`, `@vitest/coverage-v8`).

## Convenções

- Arquivo de teste ao lado do arquivo testado: `items.service.ts` → `items.service.test.ts`,
  `login-form.tsx` → `login-form.test.tsx`.
- **Tudo em inglês**: `describe` com o nome da unidade (ou do método/cenário), `it` descrevendo
  o comportamento (`it("throws NotFoundError when the item does not exist")`), além de nomes de
  funções, helpers, variáveis e fixtures. Português só nos dados que simulam texto do usuário.
- Import explícito: `import { describe, expect, it, vi } from "vitest"` (sem globals).
- Scripts em todo pacote testável: `"test": "vitest run"`, `"test:watch": "vitest"`,
  `"test:coverage": "vitest run --coverage"`.
- Turbo orquestra com a task `test` (ver [workspace.md](workspace.md#pnpm--turbo)); `pnpm test` na raiz roda tudo.

## API

Dependências de dev: `vitest`, `@vitest/coverage-v8`.

```ts
// apps/api/vitest.config.ts
import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
})
```

Como a DI é por construtor, testes unitários instanciam a classe passando dublês — sem
mockar módulos:

```ts
// src/modules/items/items.service.test.ts
import { describe, expect, it, vi } from "vitest"
import { NotFoundError } from "@/http/errors"
import type { ItemsRepository } from "@/modules/items/items.repository"
import { ItemsService } from "@/modules/items/items.service"

function makeSut() {
  const itemsRepository = {
    findById: vi.fn(),
    create: vi.fn(),
  } as unknown as ItemsRepository

  return { sut: new ItemsService(itemsRepository), itemsRepository }
}

describe("ItemsService", () => {
  it("throws NotFoundError when the item does not exist", async () => {
    const { sut, itemsRepository } = makeSut()
    vi.mocked(itemsRepository.findById).mockResolvedValue(null)

    await expect(sut.getById("missing-id")).rejects.toBeInstanceOf(NotFoundError)
  })
})
```

- **Unitários**: services, utilitários e controllers (controller com `req`/`res` fakes).
- **Integração de repositories**: contra um PostgreSQL real (serviço `postgres` do compose ou
  um banco de teste com `DATABASE_URL` próprio em `.env.test`), rodando as migrations antes.
  Separe com `include: ["src/**/*.int.test.ts"]` num projeto/config próprio se ficarem lentos.
- `vi.mock` só para dependências externas sem injeção (ex.: SDK de terceiros).

## Web

Dependências de dev: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`,
`@testing-library/user-event`, `@testing-library/jest-dom` (só os matchers; o runner continua Vitest).

Configuração no próprio `vite.config.ts` (reaproveita plugins e aliases):

```ts
// apps/web/vite.config.ts
/// <reference types="vitest/config" />
export default defineConfig({
  plugins: [/* ... */],
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", include: ["src/**/*.{ts,tsx}"] },
  },
})
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(function cleanupDom() {
  cleanup()
})
```

Helper para renderizar com os providers necessários:

```tsx
// src/test/render.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}
```

O que testar no front:
- **Utilitários e schemas Zod**: testes unitários puros.
- **Componentes/formulários**: comportamento via Testing Library (`screen.getByRole`,
  `userEvent`), nunca detalhes de implementação.
- **Requests**: mocke a camada `service/requests.ts` da feature com `vi.mock` ou
  `vi.spyOn(globalThis, "fetch")`; não bata na API real.
- **Contextos**: renderize o `<Nome>ContextProvider` e verifique que `use<Nome>Context` lança
  erro fora dele.
- **Stores Zustand**: teste as ações chamando `useXStore.getState()` e resetando o estado no `beforeEach`.

Estilo nos testes do front segue o do app: helpers e componentes auxiliares com `function`;
callbacks de `describe`/`it` podem ser arrow (callback inline do runner).

## Pacotes (`packages/*`)

`packages/utils` e `packages/contracts` (schemas Zod) usam Vitest com `environment: "node"` e
config mínima (`vitest.config.ts` com `include: ["src/**/*.test.ts"]`). `packages/ui` usa
`jsdom` + Testing Library como o web.
