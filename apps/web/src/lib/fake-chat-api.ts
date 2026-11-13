/**
 * "Backend" em memória para a demo de chat.
 *
 * Simula uma API com paginação por cursor nos três sentidos:
 *   - fetchLatest(limit)          → as N mensagens mais recentes
 *   - fetchBefore(id, limit)      → N mensagens antes de `id`  (rolar para cima)
 *   - fetchAfter(id, limit)       → N mensagens depois de `id` (rolar para baixo)
 *   - fetchAround(id, limit)      → uma janela centrada em `id` (pular até a mensagem)
 *
 * Cada resposta diz se ainda existe algo antes/depois (hasOlder / hasNewer),
 * que é o que o front usa para saber se deve continuar paginando.
 */

export type Role = "user" | "assistant"
export type Reaction = "like" | "dislike" | "heart"

export type ReplyPreview = {
  id: string
  seq: number
  role: Role
  text: string
}

export type ChatMessage = {
  id: string
  seq: number
  role: Role
  text: string
  time: string
  streaming?: boolean
  attachment?: { name: string; size: string }
  reactions?: Reaction[]
  replyTo?: ReplyPreview
  /** Enviada nesta sessão — só essas viram scrollAnchor. Nunca vem da API. */
  live?: boolean
}

export type Page = {
  items: ChatMessage[]
  hasOlder: boolean
  hasNewer: boolean
}

const TOTAL = 2000
const LATENCY_MS = 450

/* --------------------------- geração determinística ------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const USER_LINES = [
  "Como eu faço para paginar mensagens antigas?",
  "Isso funciona bem com imagens que carregam depois?",
  "E se a mensagem que eu quero ainda não estiver carregada?",
  "Faz sentido virtualizar a lista?",
  "Consegue me dar um exemplo com cursor?",
  "Qual a diferença entre before, after e around?",
  "Como eu mantenho a posição quando entra conteúdo em cima?",
  "Dá para destacar a mensagem depois de pular até ela?",
  "Perfeito, obrigado!",
  "Hmm, não entendi essa parte.",
  "E no mobile, muda alguma coisa?",
  "Tem algum limite de mensagens em memória?",
]

const BOT_SENTENCES = [
  "Paginação por cursor evita duplicar ou pular mensagens quando chegam itens novos.",
  "O servidor devolve um bloco e diz se existe mais conteúdo antes ou depois.",
  "Ao inserir no topo, o scroller compensa a altura para a leitura não pular.",
  "Para pular até uma mensagem distante, carregue a vizinhança dela e substitua a janela.",
  "Depois do render, chame scrollToMessage e destaque o item por alguns instantes.",
  "Manter um teto de mensagens em memória limita o custo do DOM sem virtualizar.",
  "content-visibility: auto faz o navegador pular a pintura do que está fora da tela.",
  "Quando a janela não está no presente, o botão de 'ir ao fim' precisa recarregar as recentes.",
  "Mensagens enviadas agora viram âncoras e sobem para o topo da área visível.",
  "Respostas citadas guardam uma prévia do original, então não precisam carregá-lo.",
]

const ATTACHMENTS = [
  { name: "relatorio-trimestral.pdf", size: "2,4 MB" },
  { name: "especificacao-api.pdf", size: "860 KB" },
  { name: "contrato-assinado.pdf", size: "1,1 MB" },
]

const BASE_TIME = new Date(2026, 6, 1, 8, 0).getTime()

function formatTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function preview(m: ChatMessage): ReplyPreview {
  return { id: m.id, seq: m.seq, role: m.role, text: m.text }
}

function generate(): ChatMessage[] {
  const rand = mulberry32(42)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const out: ChatMessage[] = []

  for (let seq = 1; seq <= TOTAL; seq++) {
    const role: Role = seq % 2 === 1 ? "user" : "assistant"
    const text =
      role === "user"
        ? pick(USER_LINES)
        : Array.from({ length: 1 + Math.floor(rand() * 3) }, () =>
            pick(BOT_SENTENCES)
          ).join(" ")

    const message: ChatMessage = {
      id: `m-${seq}`,
      seq,
      role,
      text,
      time: formatTime(new Date(BASE_TIME + seq * 7 * 60_000)),
    }

    // ~10% das mensagens respondem a algo bem anterior (até 1500 mensagens atrás)
    if (seq > 30 && rand() < 0.1) {
      const distance = 1 + Math.floor(rand() * Math.min(seq - 2, 1500))
      message.replyTo = preview(out[seq - 1 - distance])
    }
    if (rand() < 0.03) message.attachment = pick(ATTACHMENTS)
    if (role === "assistant" && rand() < 0.08)
      message.reactions = [pick<Reaction>(["like", "heart", "dislike"])]

    out.push(message)
  }
  return out
}

const db: ChatMessage[] = generate()

/* ---------------------------------- API ---------------------------------- */

const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS))

/** ids são `m-<seq>` e seq começa em 1, então o índice é O(1). */
function indexOf(id: string) {
  const seq = Number(id.replace("m-", ""))
  return Number.isInteger(seq) && seq >= 1 && seq <= db.length ? seq - 1 : -1
}

function slice(start: number, end: number): Page {
  const s = Math.max(0, start)
  const e = Math.min(db.length, end)
  return { items: db.slice(s, e), hasOlder: s > 0, hasNewer: e < db.length }
}

export async function fetchLatest(limit: number): Promise<Page> {
  await wait()
  return slice(db.length - limit, db.length)
}

export async function fetchBefore(id: string, limit: number): Promise<Page> {
  await wait()
  const i = indexOf(id)
  return slice(i - limit, i)
}

export async function fetchAfter(id: string, limit: number): Promise<Page> {
  await wait()
  const i = indexOf(id)
  return slice(i + 1, i + 1 + limit)
}

/** Janela centrada em `id`. Retorna null se a mensagem não existe. */
export async function fetchAround(
  id: string,
  limit: number
): Promise<Page | null> {
  await wait()
  const i = indexOf(id)
  if (i < 0) return null
  const start = Math.max(0, Math.min(i - Math.floor(limit / 2), db.length - limit))
  return slice(start, start + limit)
}

export function totalMessages() {
  return db.length
}

export function nextSeq() {
  return db.length + 1
}

export function toReplyPreview(m: ChatMessage) {
  return preview(m)
}

/** Persiste uma mensagem nova (sem flags locais como `live`/`streaming`). */
export function appendMessage(m: ChatMessage) {
  db.push({ ...m, live: undefined, streaming: undefined })
}

export function updateMessage(id: string, patch: Partial<ChatMessage>) {
  const i = indexOf(id)
  if (i >= 0) db[i] = { ...db[i], ...patch, live: undefined, streaming: undefined }
}
