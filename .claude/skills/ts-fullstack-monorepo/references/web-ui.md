# Web (`apps/web`) e UI (`packages/ui`)

## Web: Vite + React

Dependências principais: `react`, `react-dom`, `@tanstack/react-router`,
`@tanstack/react-query`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`,
`@workspace/ui`, `@workspace/contracts`, `@tabler/icons-react`.
Dev: `@tanstack/router-plugin`, `@tanstack/react-query-devtools`, `@tanstack/react-router-devtools`.

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    // precisa vir antes do plugin do React
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
})
```

`src/routeTree.gen.ts` é gerado pelo plugin: não editar, ignorar no ESLint/Prettier.

Scripts: `dev: vite`, `build: tsc -b && vite build`, `lint: eslint`,
`format: prettier --write "**/*.{ts,tsx}"`, `typecheck: tsc --noEmit`, `preview: vite preview`.

tsconfig em project references:
- `tsconfig.json`: `files: []`, `references` para `tsconfig.app.json` e `tsconfig.node.json`.
- `tsconfig.app.json`: estende a base; `lib [ES2023, DOM, DOM.Iterable]`, `types ["vite/client"]`,
  `jsx react-jsx`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `paths` para `@/*`,
  `@workspace/ui/*` e `@workspace/contracts/*` (apontando para `../../packages/<pkg>/src/*`).
- `tsconfig.node.json`: só `vite.config.ts`, `module/moduleResolution nodenext`, `types ["node"]`.

`erasableSyntaxOnly` ⇒ sem `enum`, `namespace` ou parameter properties no front; use unions e objetos `as const`.

### Estilo: funções, sem arrow functions

O front é escrito com **funções**, não classes (única exceção: subclasses de `Error`), e com
`function` em vez de arrow function **sempre que possível**:

| Caso | Faça | Evite |
|---|---|---|
| Componente | `export function LoginForm() {}` | `export const LoginForm = () => {}` |
| Hook | `export function useX() {}` | `const useX = () => {}` |
| Request / options / util | `export function meQueryOptions() {}` | `export const meQueryOptions = () =>` |
| Handler no componente | `function handleSubmit(values) {}` | `const handleSubmit = (values) => {}` |
| Callback em objeto de config | `onSuccess(user) {}`, `beforeLoad({ context }) {}` | `onSuccess: (user) => ...` |
| `component` de rota | `component: LoginPage` + `function LoginPage() {}` | `component: () => <LoginPage />` |
| Funções num objeto | method shorthand `me() { return ... }` | `me: () => ...` |

Arrow é aceitável só quando não há alternativa razoável: callbacks curtos inline
(`items.map((i) => ...)`, updater `setX((prev) => ...)`, `.catch(() => null)`), seletores do
Zustand (`useStore((s) => s.x)`) e o `create((set) => ({ ... }))` do Zustand. Funções
declaradas dentro de `useEffect` também usam `function`.

```tsx
// src/main.tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { queryClient } from "@/lib/query-client"
import { routeTree } from "@/routeTree.gen"

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0, // o cache fica a cargo do TanStack Query
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
```

### Organização por feature

```
src/
  routes/                        # só roteamento: loaders, beforeLoad, search params, páginas
    __root.tsx
    index.tsx
    login.tsx
    _authenticated.tsx           # layout protegido
  feature/
    <feature>/                   # ex.: auth
      components/                # componentes da feature (login-form.tsx, signup-form.tsx)
      hooks/
        query-options.ts         # queryOptions(...) da feature
        mutation-options.ts      # mutationOptions(...) da feature
      service/
        routes.ts                # caminhos/endpoints da API usados pela feature
        requests.ts              # funções que chamam a API (usam lib/api-client + routes)
      context/                   # contextos React só desta feature (<nome>-context.tsx)
      utils/                     # utilitários só desta feature (<assunto>-utils.ts)
      constants.ts               # query keys, mutation keys, valores fixos da feature
      schemas.ts                 # schemas Zod de formulário (ou reexport do contracts)
      types.ts                   # tipos da feature (inferidos dos schemas, props, etc.)
  context/                       # contextos React gerais da aplicação (<nome>-context.tsx)
  stores/                        # stores Zustand (globais ou por feature)
  utils/                         # utilitários globais do web (date-utils.ts, string-utils.ts…)
  lib/{api-client.ts, query-client.ts}   # clientes configurados (com efeito), não utilitários
  config/env.ts                  # import.meta.env validado com Zod
```

Regras da feature:
- Pasta `feature/` no singular; cada feature em kebab-case (`auth`, `user-profile`).
- `service/` não conhece React: só `routes.ts` (strings/funções de URL) e `requests.ts` (fetch tipado).
- `hooks/` contém **options** do TanStack Query, não hooks com `useQuery` dentro — os
  componentes e rotas chamam `useQuery(xQueryOptions())` / `useMutation(xMutationOptions())`.
- Query/mutation keys ficam em `constants.ts`, nunca como string solta nos hooks.
- `types.ts` reexporta tipos do contracts quando existirem; tipos só de tela são declarados aqui.
- Uma feature não importa arquivos internos de outra; o que for comum vai para `lib/`,
  `src/components/` (compostos da aplicação) ou `packages/ui` (primitivos).
- Utilitários: `feature/<feature>/utils/` se só a feature usa; `src/utils/` se vários pontos do
  web usam; `packages/utils` se a api também usa (ver [workspace.md](workspace.md#utilitários)).

### Env do front

```ts
// src/config/env.ts
import { z } from "zod"

export const env = z
  .object({ VITE_API_URL: z.url() })
  .parse(import.meta.env)
```

### Cliente HTTP

```ts
// src/lib/api-client.ts
import type { ApiErrorBody } from "@workspace/contracts"
import { env } from "@/config/env"

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(res.status, body?.message ?? res.statusText)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
```

### Exemplo completo de feature (`src/feature/auth`)

```ts
// service/routes.ts
export const authRoutes = {
  login: "/auth/login",
  signup: "/auth/signup",
  logout: "/auth/logout",
  me: "/auth/me",
} as const
```

```ts
// service/requests.ts
import type { LoginInput, SignupInput, UserDto } from "@/feature/auth/types"
import { authRoutes } from "@/feature/auth/service/routes"
import { api } from "@/lib/api-client"

export function login(input: LoginInput) {
  return api<UserDto>(authRoutes.login, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function signup(input: SignupInput) {
  return api<UserDto>(authRoutes.signup, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function logout() {
  return api<void>(authRoutes.logout, { method: "POST" })
}

export function me() {
  return api<UserDto>(authRoutes.me)
}
```

Consumido como namespace: `import * as authRequests from "@/feature/auth/service/requests"`.

```ts
// constants.ts
export const authKeys = {
  all: ["auth"] as const,
  me() {
    return [...authKeys.all, "me"] as const
  },
}

export const authMutationKeys = {
  login: ["auth", "login"] as const,
  signup: ["auth", "signup"] as const,
  logout: ["auth", "logout"] as const,
}

export const PASSWORD_MIN_LENGTH = 8
```

```ts
// schemas.ts
import { loginSchema } from "@workspace/contracts"
import { z } from "zod"
import { PASSWORD_MIN_LENGTH } from "@/feature/auth/constants"

export { loginSchema }

// schema só de tela: estende o do contracts com confirmação de senha
export const signupFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome"),
    email: z.email("E-mail inválido"),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  })
```

```ts
// types.ts
import type { z } from "zod"
import type { signupFormSchema } from "@/feature/auth/schemas"

export type { LoginInput, SignupInput, UserDto } from "@workspace/contracts"
export type SignupFormValues = z.infer<typeof signupFormSchema>
```

### TanStack Query

```ts
// src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
```

```ts
// src/feature/auth/hooks/query-options.ts
import { queryOptions } from "@tanstack/react-query"
import { authKeys } from "@/feature/auth/constants"
import * as authRequests from "@/feature/auth/service/requests"

export function meQueryOptions() {
  return queryOptions({
    queryKey: authKeys.me(),
    queryFn: authRequests.me,
    staleTime: 5 * 60_000,
  })
}
```

```ts
// src/feature/auth/hooks/mutation-options.ts
import { mutationOptions, type QueryClient } from "@tanstack/react-query"
import { authKeys, authMutationKeys } from "@/feature/auth/constants"
import * as authRequests from "@/feature/auth/service/requests"

export function loginMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationKey: authMutationKeys.login,
    mutationFn: authRequests.login,
    onSuccess(user) {
      queryClient.setQueryData(authKeys.me(), user)
    },
  })
}

export function signupMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationKey: authMutationKeys.signup,
    mutationFn: authRequests.signup,
    onSuccess(user) {
      queryClient.setQueryData(authKeys.me(), user)
    },
  })
}

export function logoutMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationKey: authMutationKeys.logout,
    mutationFn: authRequests.logout,
    onSuccess() {
      queryClient.removeQueries({ queryKey: authKeys.all })
    },
  })
}
```

Uso: `useQuery(meQueryOptions())`, `useSuspenseQuery(...)` ou
`context.queryClient.ensureQueryData(meQueryOptions())` no loader;
`useMutation(loginMutationOptions(useQueryClient()))` no componente.

Regras: keys só em `constants.ts`; options reutilizadas em loaders e componentes; mutations
recebem o `queryClient` e invalidam/atualizam as keys afetadas no `onSuccess`; nunca `useEffect` + `fetch`.

### TanStack Router

```tsx
// src/routes/__root.tsx
import type { QueryClient } from "@tanstack/react-query"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

function RootLayout() {
  return <Outlet />
}

function NotFoundPage() {
  return <p>Página não encontrada</p>
}
```

```tsx
// src/routes/_authenticated.tsx — layout protegido
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { meQueryOptions } from "@/feature/auth/hooks/query-options"

export const Route = createFileRoute("/_authenticated")({
  async beforeLoad({ context, location }) {
    const user = await context.queryClient
      .ensureQueryData(meQueryOptions())
      .catch(() => null)
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
    return { user }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}
```

```tsx
// src/routes/login.tsx
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { LoginForm } from "@/feature/auth/components/login-form"

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
})

function LoginPage() {
  return <LoginForm />
}
```

- Arquivos de rota são finos: carregam dados com as options da feature e renderizam componentes da feature.
- Search params tipados com `validateSearch` (Zod) — filtros/paginação moram na URL.
- Navegação com `<Link to="/items/$itemId" params={{ itemId }}>` / `useNavigate()` (tipados).

### Contextos React

Onde ficam:
- Contexto **geral** da aplicação → `apps/web/src/context/<nome>-context.tsx`.
- Contexto **específico de uma feature** → `apps/web/src/feature/<feature>/context/<nome>-context.tsx`.

Quando usar: estado compartilhado por uma **subárvore** de componentes (uma tela, um wizard,
um calendário) que depende de props do provider. Estado global de cliente vai no Zustand;
dados do servidor no TanStack Query (o provider pode receber esses dados por props).

Estrutura padrão (um arquivo exporta o provider e o hook):

```tsx
// src/feature/scheduling/context/selected-day-context.tsx
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react"
import type { AvailableSlots } from "@/feature/scheduling/types"
import { getClosestAvailableDay } from "@/feature/scheduling/utils/slot-utils"

// 1. Props do provider: o que vem de fora + children
interface SelectedDayContextProps extends PropsWithChildren {
  availableSlots: AvailableSlots
}

// 2. Valores expostos: as props (sem children) + estado e setters internos
interface SelectedDayContextValues
  extends Omit<SelectedDayContextProps, "children"> {
  selectedDay: Date
  setSelectedDay: Dispatch<SetStateAction<Date>>
}

// 3. Contexto tipado, iniciando em null (não exportado)
const SelectedDayContext = createContext<SelectedDayContextValues | null>(null)

// 4. Provider: <Nome>ContextProvider
export function SelectedDayContextProvider({
  children,
  availableSlots,
}: SelectedDayContextProps) {
  const [selectedDay, setSelectedDay] = useState<Date>(
    function getInitialDay() {
      return getClosestAvailableDay(availableSlots)
    }
  )

  const value = useMemo(
    function buildValue() {
      return { availableSlots, selectedDay, setSelectedDay }
    },
    [availableSlots, selectedDay]
  )

  return (
    <SelectedDayContext.Provider value={value}>
      {children}
    </SelectedDayContext.Provider>
  )
}

// 5. Hook de consumo: use<Nome>Context, falha se usado fora do provider
export function useSelectedDayContext(): SelectedDayContextValues {
  const context = useContext(SelectedDayContext)

  if (!context) {
    throw new Error(
      "SelectedDayContext must be used inside of SelectedDayContextProvider"
    )
  }

  return context
}
```

Regras:
- Arquivo `<nome>-context.tsx`; exports `<Nome>ContextProvider` e `use<Nome>Context`. O objeto
  do contexto **não** é exportado — o consumo é sempre pelo hook.
- Interfaces `<Nome>ContextProps extends PropsWithChildren` e
  `<Nome>ContextValues extends Omit<<Nome>ContextProps, "children">` + estado/ações.
- `createContext<Values | null>(null)` e o hook lança erro com a mensagem
  `"<Nome>Context must be used inside of <Nome>ContextProvider"`.
- `value` memoizado com `useMemo` listando **todas** as dependências do objeto (props usadas e
  estado) — desestruture as props em vez de espalhar `...props`, senão a memo é recriada a cada render.
- Valor inicial calculado com inicializador lazy (`useState(function init() {...})`), não chamando a função direto.
- Lógica de cálculo (ex.: achar o próximo dia disponível) vai para `utils/` da feature, mantendo o provider enxuto.
- Funções com `function` (inclusive nos callbacks de `useMemo`/`useCallback`/`useState`).

### Zustand

Somente estado de cliente (UI, preferências, sessão local) — nunca cache de dados do servidor.

```ts
// src/stores/ui-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

type UiState = {
  sidebarOpen: boolean
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar() {
        set((s) => ({ sidebarOpen: !s.sidebarOpen }))
      },
    }),
    { name: "ui" }
  )
)
```

Consuma com seletores para evitar re-render: `const open = useUiStore((s) => s.sidebarOpen)`.
Stores ficam em `src/stores/<nome>-store.ts`. O usuário logado **não** vai para o Zustand —
ele vem de `meQueryOptions()` (estado de servidor).

### Formulários: React Hook Form + Zod

```tsx
// src/feature/auth/components/login-form.tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useForm } from "react-hook-form"
import { loginMutationOptions } from "@/feature/auth/hooks/mutation-options"
import { loginSchema } from "@/feature/auth/schemas"
import type { LoginInput } from "@/feature/auth/types"

export function LoginForm() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: "/login" })
  const login = useMutation(loginMutationOptions(queryClient))

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function handleSubmit(values: LoginInput) {
    await login.mutateAsync(values)
    await navigate({ to: redirect ?? "/" })
  }

  const { errors, isSubmitting } = form.formState

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-2">
      <Input type="email" {...form.register("email")} aria-invalid={!!errors.email} />
      {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}

      <Input type="password" {...form.register("password")} aria-invalid={!!errors.password} />
      {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}

      {login.error && <p className="text-sm text-destructive">{login.error.message}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Entrar
      </Button>
    </form>
  )
}
```

- Schema de entrada compartilhado com a API vem de `@workspace/contracts` (reexportado em
  `schemas.ts`); schemas só de tela (ex.: confirmação de senha) são declarados em `schemas.ts`.
- Tipo do formulário sempre `z.infer` do schema; submit chama uma mutation do Query.
- Erros de campo exibidos com `aria-invalid` + mensagem; se o pacote ui tiver componentes
  `Field`/`Form` do shadcn, prefira-os.

### Tempo real (opcional)


```ts
// src/config/socket.ts
import type { ClientToServerEvents, ServerToClientEvents } from "@workspace/contracts"
import { io, type Socket } from "socket.io-client"
import { env } from "@/config/env"

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const socket: AppSocket = io(env.VITE_API_URL, {
  autoConnect: false,
  auth(callback) {
    callback({ token: getToken() })
  },
})
```

Singleton com `autoConnect: false`; conecte explicitamente após autenticar.

### Hooks de socket (`src/hooks/use-*.ts`)

- Recebem dependências por parâmetro (`socket`, ids) e retornam estado/funções.
- Ouvir eventos: handlers nomeados dentro do `useEffect`; cleanup com `socket.off(evento, handler)`,
  limpeza de timers e reset de estado.
- Estado mutável que não renderiza (flags, timers, último envio) em `useRef`; funções expostas com `useCallback`.
- Constantes de tempo/limites em `UPPER_SNAKE_CASE` no topo do arquivo.

```ts
import type { ItemDto } from "@workspace/contracts"
import { useEffect, useState } from "react"
import type { AppSocket } from "@/config/socket"

export function useItems(socket: AppSocket, roomId: string) {
  const [items, setItems] = useState<ItemDto[]>([])

  useEffect(
    function subscribeToItems() {
      function handleCreated(item: ItemDto) {
        if (item.roomId !== roomId) return
        setItems((prev) => [...prev, item])
      }

      socket.on("item:created", handleCreated)

      return function unsubscribe() {
        socket.off("item:created", handleCreated)
        setItems([])
      }
    },
    [socket, roomId]
  )

  return items
}
```

Emitir com ack (tipo do callback inferido do contrato, sem anotar):

```ts
socket.emit("item:create", { roomId, name }, function handleAck(res) {
  if (!res.success) console.error(res.error)
})
```

### Onde colocar cada componente

| Tipo | Exemplos | Onde |
|---|---|---|
| **Primitivo** — genérico, sem regra de negócio nem dados da app | `button`, `input`, `card`, `dialog`, `select`, `bubble` | `packages/ui/src/components` (via shadcn) |
| **Composto da aplicação** — combina primitivos, usado por várias telas | `app-layout` (grid do sistema), `app-header`, `app-sidebar`, `page-container`, `empty-state` | `apps/web/src/components` |
| **De feature** — conhece a feature (schemas, queries, tipos) | `login-form`, `items-table` | `apps/web/src/feature/<feature>/components` |

- Primitivos não importam nada de `apps/*` (nem router, query ou stores); recebem tudo por props.
- Compostos podem usar router, stores globais e primitivos, mas não importam de uma feature
  específica — se precisarem de dados, recebem por props ou `children`.
- Se um componente de feature passar a ser usado por várias features, generalize e suba para
  `src/components`; se ficar genérico de verdade (sem nada da app), suba para `packages/ui`.

```tsx
// src/components/app-layout.tsx — composto da aplicação
import type { ReactNode } from "react"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="grid min-h-svh grid-cols-[16rem_1fr] grid-rows-[auto_1fr]">
      <AppSidebar className="row-span-2" />
      <AppHeader />
      <main className="min-w-0 p-6">{children}</main>
    </div>
  )
}
```

Usado no layout de rota: `function AuthenticatedLayout() { return <AppLayout><Outlet /></AppLayout> }`.

### Convenções de componentes do app (`src/components` e `feature/*/components`)

- Arquivo kebab-case, export nomeado PascalCase, sempre `function` declarations (nunca `const X = () =>`).
- Handlers internos também como `function handleX() {}`.
- Props em `interface XProps` / `type XProps` acima do componente.
- Compor com componentes de `@workspace/ui/components/*`; ícones de `@tabler/icons-react` com `size-*`.
- Botões só com ícone: `aria-label` + `title`; toggles com `aria-pressed`.
- Para trocar o elemento renderizado de um componente Base UI use a prop `render`
  (`<X render={<a href="..." />} />`), não `asChild`.

## UI: pacote shadcn (`packages/ui`)

`package.json` exporta pastas inteiras, então novos arquivos ficam disponíveis automaticamente:

```json
"exports": {
  "./globals.css": "./src/styles/globals.css",
  "./lib/*": "./src/lib/*.ts",
  "./components/*": "./src/components/*.tsx",
  "./hooks/*": "./src/hooks/*.ts"
}
```

`components.json` do **app** aponta o shadcn para o pacote:

```json
{
  "style": "base-maia",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "../../packages/ui/src/styles/globals.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "tabler",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@workspace/ui/lib/utils",
    "ui": "@workspace/ui/components"
  },
  "rtl": true
}
```

O `components.json` do pacote usa os mesmos valores com aliases `@workspace/ui/*` e `css: src/styles/globals.css`.

Adicionar componente (prefira o MCP `shadcn` para buscar/visualizar antes):

```bash
pnpm dlx shadcn@latest add <componente> -c apps/web
```

`src/lib/utils.ts`: `export { cn } from "cn"`.

### Anatomia de um componente

```tsx
import { Thing as ThingPrimitive } from "@base-ui/react/thing"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const thingVariants = cva("classes base", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground", outline: "border-border bg-background" },
    size: { default: "h-9 px-3", sm: "h-8 px-3" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

function Thing({
  className,
  variant = "default",
  size = "default",
  ...props
}: ThingPrimitive.Props & VariantProps<typeof thingVariants>) {
  return (
    <ThingPrimitive
      data-slot="thing"
      data-variant={variant}
      className={cn(thingVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Thing, thingVariants }
```

Convenções:
- Elemento raiz com `data-slot="<kebab>"`; estado/variante exposto como `data-*`.
- Grupos nomeados (`group/<nome>`) e seletores `group-data-[...]/<nome>:` e `*:data-[slot=...]:` para estilizar filhos.
- Sem primitivo Base UI: `React.ComponentProps<"div">`; com troca de elemento: `useRender` + `mergeProps` de `@base-ui/react`.
- Componentes compostos exportam todas as partes juntas (`Card`, `CardHeader`, `CardContent`…).
- Propriedades lógicas (`ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) — projeto RTL.
- Foco: `focus-visible:ring-[3px] focus-visible:ring-ring/50`; inválido: `aria-invalid:border-destructive`.

## Tema (`globals.css`)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/inter";

@custom-variant dark (&:is(.dark *));
@source "../../../apps/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";

:root { --background: oklch(1 0 0); --primary: oklch(...); --radius: 0.45rem; /* ... */ }
.dark { --background: oklch(0.147 0.004 49.25); /* ... */ }

@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --radius-lg: var(--radius);
  --font-sans: "Inter Variable", sans-serif;
  /* ... */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

- Cores só em oklch e só via tokens (`bg-primary`, `text-muted-foreground`); variações com
  `color-mix(in_oklch, ...)` ou `oklch(from var(--x) ...)`, nunca hex.
- Novo token: declarar em `:root` **e** `.dark`, depois mapear em `@theme inline`.
- `@source` precisa cobrir todo diretório com classes Tailwind (apps e pacote).
- `ThemeProvider` no app gerencia `dark | light | system` com `localStorage` e aplica a classe `.dark` no `<html>`.
