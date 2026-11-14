export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/**
 * Descrição de uma requisição, no formato que o `http.request()` do axios
 * aceita (sem depender do axios aqui). Cada `<DOMINIO>_ROUTES.<acao>(dto)`
 * devolve uma destas.
 */
export interface HttpRequestConfig {
  method: HttpMethod
  url: string
  /** Query string. */
  params?: object
  /** Corpo (JSON). */
  data?: unknown
}

/** Troca os `:param` de um padrão de caminho pelos valores (codificados). */
export function buildPath(
  pattern: string,
  params: Record<string, string>
): string {
  return pattern.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`Missing path param "${name}"`)
    return encodeURIComponent(value)
  })
}

/** Caminhos sem domínio próprio. */
export const SYSTEM_PATHS = {
  health: "/health",
} as const
