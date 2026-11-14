import {
  IconArrowDown,
  IconArrowUp,
  IconBulb,
  IconCode,
  IconCornerUpLeft,
  IconHash,
  IconLanguage,
  IconLoader2,
  IconX,
} from "@tabler/icons-react"
import * as React from "react"

import {
  Bubble,
  BubbleContent,
  BubbleGroup,
} from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@workspace/ui/components/message-scroller"
import { cn } from "@workspace/ui/lib/utils"

import { ChatMessageView } from "@/components/chat-message"
import {
  appendMessage,
  fetchAfter,
  fetchAround,
  fetchBefore,
  fetchLatest,
  nextSeq,
  toReplyPreview,
  totalMessages,
  updateMessage,
  type ChatMessage,
  type Page,
  type Reaction,
} from "@/lib/fake-chat-api"
import { socket } from "@/services/socket"

/** Quantas mensagens cada requisição traz. */
const PAGE_SIZE = 40
/** Teto de mensagens no DOM. Passou disso, descarta do lado oposto. */
const MAX_IN_MEMORY = 200
/** Distância (px) da borda que dispara o carregamento da próxima página. */
const EDGE_PX = 400

type Loading = "initial" | "older" | "newer" | "jump" | null
type ScrollTarget = { kind: "message"; id: string } | { kind: "end" }

const SUGGESTIONS = [
  { icon: IconBulb, label: "Me explique o scrollAnchor" },
  { icon: IconCode, label: "Mostre um exemplo de código" },
  { icon: IconLanguage, label: "Traduza para inglês" },
]

const FAKE_REPLIES = [
  "Sua mensagem virou uma âncora: subiu para o topo da área visível e eu respondo logo abaixo. Para testar o salto, clique em qualquer citação com ↩ — se a mensagem original estiver fora da janela carregada, a janela é trocada pela vizinhança dela.",
  "Role bastante para cima: a cada borda alcançada entra uma página de 40 mensagens. Passando de 200 em memória, as mais recentes são descartadas e aparece o botão “Voltar ao presente”.",
  "Use o campo # no topo para pular para qualquer mensagem entre as 2.000. A janela vira um trecho do meio do histórico e cresce para os dois lados conforme você rola.",
  "Se você enviar uma mensagem enquanto está no passado, primeiro o chat volta ao presente e só então a mensagem é adicionada.",
]

const nowLabel = () =>
  new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(n)
  })

/* -------------------------------------------------------------------------- */

function WindowInfo({ win }: { win: Page }) {
  const { currentAnchorId, visibleMessageIds } = useMessageScrollerVisibility()
  const first = win.items[0]?.seq
  const last = win.items.at(-1)?.seq
  return (
    <div className="hidden font-mono text-[11px] text-muted-foreground sm:block">
      {first ? `janela #${first}–#${last}` : "janela vazia"} ·{" "}
      {win.items.length} em memória de {totalMessages()} · visíveis{" "}
      {visibleMessageIds.length}
      {currentAnchorId && ` · âncora ${currentAnchorId}`}
    </div>
  )
}

function FloatingPill({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function ChatRoom({
  autoScroll,
  onAutoScrollChange,
  onAtPresentChange,
}: {
  autoScroll: boolean
  onAutoScrollChange: (value: boolean) => void
  onAtPresentChange: (value: boolean) => void
}) {
  const { scrollToEnd, scrollToMessage } = useMessageScroller()

  const [win, setWin] = React.useState<Page>({
    items: [],
    hasOlder: false,
    hasNewer: false,
  })
  const [loading, setLoading] = React.useState<Loading>("initial")
  const [highlighted, setHighlighted] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  const [replyingTo, setReplyingTo] = React.useState<ChatMessage | null>(null)
  const [jumpInput, setJumpInput] = React.useState("")

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const winRef = React.useRef(win)
  const busyRef = React.useRef(true)
  const generationRef = React.useRef(0)
  const jumpingRef = React.useRef(false)
  /** Rolagem pedida para depois do próximo render (a mensagem ainda não existe no DOM). */
  const pendingScrollRef = React.useRef<ScrollTarget | null>(null)
  /** Mensagem visível + offset, para compensar quando removemos itens do topo. */
  const compensateRef = React.useRef<{ id: string; top: number } | null>(null)
  const replyIndex = React.useRef(0)
  const streamTimer = React.useRef<number | null>(null)

  React.useLayoutEffect(() => {
    winRef.current = win
  })

  React.useEffect(() => {
    onAtPresentChange(!win.hasNewer)
  }, [win.hasNewer, onAtPresentChange])

  /* ------------------------------ carga inicial ----------------------------- */

  React.useEffect(() => {
    let cancelled = false
    fetchLatest(PAGE_SIZE).then((page) => {
      if (cancelled) return
      pendingScrollRef.current = { kind: "end" }
      setWin(page)
      setLoading(null)
      busyRef.current = false
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(
    () => () => {
      if (streamTimer.current) window.clearInterval(streamTimer.current)
    },
    []
  )

  React.useEffect(() => {
    if (!highlighted) return
    const t = window.setTimeout(() => setHighlighted(null), 1800)
    return () => window.clearTimeout(t)
  }, [highlighted])

  React.useEffect(() => {
    if (!notFound) return
    const t = window.setTimeout(() => setNotFound(null), 2500)
    return () => window.clearTimeout(t)
  }, [notFound])

  /* ------------------------------- carregamento ----------------------------- */

  /**
   * Executa uma requisição. `force` (saltos) passa por cima de uma carga em
   * andamento e invalida o resultado dela via `generation`, para que uma página
   * antiga não seja mesclada numa janela que já foi trocada.
   */
  async function load(
    kind: Exclude<Loading, null>,
    task: (isStale: () => boolean) => Promise<void>,
    { force = false } = {}
  ) {
    if (busyRef.current && !force) return
    if (force) generationRef.current++
    const generation = generationRef.current
    const isStale = () => generation !== generationRef.current
    busyRef.current = true
    setLoading(kind)
    try {
      await task(isStale)
    } finally {
      if (!isStale()) {
        busyRef.current = false
        setLoading(null)
      }
    }
  }

  function loadOlder() {
    const { items, hasOlder } = winRef.current
    if (!hasOlder || items.length === 0) return
    void load("older", async (isStale) => {
      const page = await fetchBefore(items[0].id, PAGE_SIZE)
      if (isStale()) return
      // Inserir no topo: o MessageScroller preserva a posição sozinho
      // (preserveScrollOnPrepend, ligado por padrão).
      setWin((cur) => {
        let next = [...page.items, ...cur.items]
        let hasNewer = cur.hasNewer
        if (next.length > MAX_IN_MEMORY) {
          next = next.slice(0, MAX_IN_MEMORY) // descarta as mais recentes
          hasNewer = true
        }
        return { items: next, hasOlder: page.hasOlder, hasNewer }
      })
    })
  }

  function loadNewer() {
    const { items, hasNewer } = winRef.current
    if (!hasNewer || items.length === 0) return
    void load("newer", async (isStale) => {
      const page = await fetchAfter(items[items.length - 1].id, PAGE_SIZE)
      if (isStale()) return
      // Aqui podemos remover itens do TOPO, e isso o scroller não compensa.
      // Guardamos a mensagem visível para reposicionar depois do render.
      compensateRef.current = captureVisibleAnchor()
      setWin((cur) => {
        let next = [...cur.items, ...page.items]
        let hasOlder = cur.hasOlder
        if (next.length > MAX_IN_MEMORY) {
          next = next.slice(next.length - MAX_IN_MEMORY) // descarta as mais antigas
          hasOlder = true
        }
        return { items: next, hasOlder, hasNewer: page.hasNewer }
      })
    })
  }

  function captureVisibleAnchor() {
    const viewport = viewportRef.current
    if (!viewport) return null
    const top = viewport.getBoundingClientRect().top
    for (const el of viewport.querySelectorAll<HTMLElement>(
      "[data-message-id]"
    )) {
      const rect = el.getBoundingClientRect()
      if (rect.bottom > top)
        return { id: el.dataset.messageId!, top: rect.top - top }
    }
    return null
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (jumpingRef.current) return
    const el = e.currentTarget
    if (el.scrollTop < EDGE_PX) loadOlder()
    else if (el.scrollHeight - el.scrollTop - el.clientHeight < EDGE_PX)
      loadNewer()
  }

  /* --------------------------------- saltos --------------------------------- */

  const scrollToTarget = React.useCallback(
    (target: ScrollTarget, behavior: ScrollBehavior) =>
      target.kind === "end"
        ? scrollToEnd({ behavior })
        : scrollToMessage(target.id, { align: "center", behavior }),
    [scrollToEnd, scrollToMessage]
  )

  /**
   * Itens recém-montados têm altura estimada (content-visibility +
   * contain-intrinsic-size). Ao renderizarem de verdade, o alvo pode se mover
   * alguns pixels, então reaplicamos a rolagem por alguns frames.
   */
  const settle = React.useCallback(
    (target: ScrollTarget) => {
      jumpingRef.current = true
      let frames = 0
      const tick = () => {
        scrollToTarget(target, "auto")
        if (++frames < 6) requestAnimationFrame(tick)
        else jumpingRef.current = false
      }
      requestAnimationFrame(tick)
    },
    [scrollToTarget]
  )

  // Depois que a nova janela renderiza: executa a rolagem pendente, ou
  // compensa a remoção de itens do topo.
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    const target = pendingScrollRef.current
    if (target) {
      if (scrollToTarget(target, "auto")) {
        pendingScrollRef.current = null
        settle(target)
      }
      return
    }

    const anchor = compensateRef.current
    if (!anchor || !viewport) return
    compensateRef.current = null
    const el = viewport.querySelector<HTMLElement>(
      `[data-message-id="${anchor.id}"]`
    )
    if (!el) return
    const delta =
      el.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top -
      anchor.top
    if (Math.abs(delta) > 0.5) viewport.scrollTop += delta
  }, [win, scrollToTarget, settle])

  async function jumpTo(id: string) {
    setNotFound(null)

    // 1) Já está na janela? Só rolar.
    if (winRef.current.items.some((m) => m.id === id)) {
      setHighlighted(id)
      scrollToMessage(id, { align: "center", behavior: "smooth" })
      // Corrige o destino ao fim da animação (alturas estimadas no caminho).
      const viewport = viewportRef.current
      if (viewport) {
        const fix = () =>
          scrollToMessage(id, { align: "center", behavior: "smooth" })
        viewport.addEventListener("scrollend", fix, { once: true })
        window.setTimeout(
          () => viewport.removeEventListener("scrollend", fix),
          1500
        )
      }
      return
    }

    // 2) Não está: busca a vizinhança e TROCA a janela inteira.
    await load(
      "jump",
      async (isStale) => {
        const page = await fetchAround(id, PAGE_SIZE)
        if (isStale()) return
        if (!page) {
          setNotFound(id)
          return
        }
        // 3) A rolagem só pode acontecer depois do render (ver useLayoutEffect).
        pendingScrollRef.current = { kind: "message", id }
        setHighlighted(id)
        setWin(page)
      },
      { force: true }
    )
  }

  async function goToPresent() {
    if (!winRef.current.hasNewer) {
      scrollToEnd({ behavior: "smooth" })
      return
    }
    await load(
      "jump",
      async (isStale) => {
        const page = await fetchLatest(PAGE_SIZE)
        if (isStale()) return
        pendingScrollRef.current = { kind: "end" }
        setWin(page)
      },
      { force: true }
    )
  }

  /* ---------------------------------- envio --------------------------------- */

  const isStreaming = win.items.some((m) => m.streaming)

  async function send(textToSend = draft) {
    const text = textToSend.trim()
    if (!text || isStreaming) return
    setDraft("")
    const replyTo = replyingTo ? toReplyPreview(replyingTo) : undefined
    setReplyingTo(null)

    // Enviar estando no passado: volta ao presente antes.
    if (winRef.current.hasNewer) {
      await goToPresent()
      await nextFrames(8)
    }

    const userSeq = nextSeq()
    const userMsg: ChatMessage = {
      id: `m-${userSeq}`,
      seq: userSeq,
      role: "user",
      text,
      time: nowLabel(),
      replyTo,
      live: true,
    }
    appendMessage(userMsg)

    const botSeq = nextSeq()
    const botId = `m-${botSeq}`
    appendMessage({
      id: botId,
      seq: botSeq,
      role: "assistant",
      text: "",
      time: "",
    })
    const bot: ChatMessage = {
      id: botId,
      seq: botSeq,
      role: "assistant",
      text: "",
      time: "",
      streaming: true,
      live: true,
    }

    setWin((cur) => ({ ...cur, items: [...cur.items, userMsg, bot] }))

    const reply = FAKE_REPLIES[replyIndex.current++ % FAKE_REPLIES.length]
    const words = reply.split(" ")
    let i = 0
    window.setTimeout(() => {
      streamTimer.current = window.setInterval(() => {
        i++
        const done = i >= words.length
        const partial = words.slice(0, i).join(" ")
        const time = done ? nowLabel() : ""
        setWin((cur) => ({
          ...cur,
          items: cur.items.map((m) =>
            m.id === botId ? { ...m, text: partial, streaming: !done, time } : m
          ),
        }))
        if (done) {
          updateMessage(botId, { text: partial, time })
          if (streamTimer.current) window.clearInterval(streamTimer.current)
          streamTimer.current = null
        }
      }, 50)
    }, 600)
  }

  function toggleReaction(id: string, reaction: Reaction) {
    const message = winRef.current.items.find((m) => m.id === id)
    if (!message) return
    const current = message.reactions ?? []
    let reactions = current.includes(reaction)
      ? current.filter((r) => r !== reaction)
      : [...current, reaction]
    if (reaction === "like" && reactions.includes("like"))
      reactions = reactions.filter((r) => r !== "dislike")
    if (reaction === "dislike" && reactions.includes("dislike"))
      reactions = reactions.filter((r) => r !== "like")

    updateMessage(id, { reactions })
    setWin((cur) => ({
      ...cur,
      items: cur.items.map((m) => (m.id === id ? { ...m, reactions } : m)),
    }))
  }

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="mx-auto flex h-svh w-full max-w-3xl flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-medium">Message + MessageScroller</h1>
          <WindowInfo win={win} />
        </div>

        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            const seq = Number.parseInt(jumpInput, 10)
            if (seq > 0) void jumpTo(`m-${seq}`)
          }}
        >
          <div className="flex h-8 items-center gap-1 rounded-4xl border bg-input/30 ps-2.5 focus-within:ring-[3px] focus-within:ring-ring/50">
            <IconHash className="size-3.5 text-muted-foreground" />
            <input
              type="number"
              min={1}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder="ir para…"
              aria-label="Número da mensagem"
              className="w-20 [appearance:textfield] bg-transparent pe-2 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <Button size="sm" variant="outline" type="submit">
            Ir
          </Button>
        </form>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => onAutoScrollChange(e.target.checked)}
            className="accent-primary"
          />
          autoScroll
        </label>
      </header>

      <MessageScroller className="flex-1">
        <MessageScrollerViewport ref={viewportRef} onScroll={handleScroll}>
          <MessageScrollerContent className="px-4 py-6">
            {win.items.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                // Só mensagens enviadas agora são âncoras. Se as do histórico
                // fossem, cada página carregada "puxaria" a rolagem até elas.
                scrollAnchor={message.live === true && message.role === "user"}
                className={cn(
                  "-mx-2 rounded-3xl p-2 transition-colors duration-700",
                  highlighted === message.id && "bg-primary/15 duration-150"
                )}
              >
                <ChatMessageView
                  message={message}
                  onJump={(id) => void jumpTo(id)}
                  onReply={setReplyingTo}
                  onToggleReaction={toggleReaction}
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {/* Indicadores de carregamento (fora do Content, para não virarem "itens") */}
        {loading === "initial" && (
          <FloatingPill className="top-1/2 -translate-y-1/2">
            <IconLoader2 className="size-3.5 animate-spin" /> Carregando
            conversa…
          </FloatingPill>
        )}
        {loading === "older" && (
          <FloatingPill className="top-3">
            <IconLoader2 className="size-3.5 animate-spin" /> Carregando
            anteriores…
          </FloatingPill>
        )}
        {loading === "jump" && (
          <FloatingPill className="top-3">
            <IconLoader2 className="size-3.5 animate-spin" /> Buscando mensagem…
          </FloatingPill>
        )}
        {loading === "newer" && (
          <FloatingPill className="bottom-16">
            <IconLoader2 className="size-3.5 animate-spin" /> Carregando
            seguintes…
          </FloatingPill>
        )}
        {notFound && (
          <FloatingPill className="top-3 text-destructive">
            Mensagem #{notFound.replace("m-", "")} não existe
          </FloatingPill>
        )}

        <MessageScrollerButton direction="start" />
        {win.hasNewer ? (
          // Fora do presente, "ir ao fim" precisa recarregar as recentes.
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void goToPresent()}
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 border-border shadow-md"
          >
            <IconArrowDown data-icon="inline-start" />
            Voltar ao presente
          </Button>
        ) : (
          <MessageScrollerButton direction="end" />
        )}
      </MessageScroller>

      <form
        className="flex flex-col gap-3 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <BubbleGroup className="flex-row flex-wrap">
          {SUGGESTIONS.map(({ icon: Icon, label }) => (
            <Bubble key={label} variant="secondary">
              <BubbleContent
                render={
                  <button type="button" onClick={() => void send(label)} />
                }
                aria-disabled={isStreaming}
                className="flex items-center gap-2 py-1.5 text-xs disabled:opacity-50"
              >
                <Icon className="size-4 text-primary" />
                {label}
              </BubbleContent>
            </Bubble>
          ))}
        </BubbleGroup>

        <div className="flex flex-col rounded-3xl border bg-input/30 focus-within:ring-[3px] focus-within:ring-ring/50">
          {replyingTo && (
            <div className="flex items-start gap-2 border-b px-4 py-2 text-xs">
              <IconCornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <button
                type="button"
                className="min-w-0 flex-1 text-start"
                onClick={() => void jumpTo(replyingTo.id)}
              >
                <span className="font-medium">
                  Respondendo a #{replyingTo.seq}
                </span>
                <span className="line-clamp-1 text-muted-foreground">
                  {replyingTo.text}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Cancelar resposta"
                onClick={() => setReplyingTo(null)}
              >
                <IconX />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 p-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              rows={1}
              placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
              className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || isStreaming}
              aria-label="Enviar"
              onClick={() => {
                socket.emit(
                  "conversation:join",
                  { conversationId: "conversation-123" },
                  (response: unknown) => {
                    console.log(response)
                  }
                )
              }}
            >
              <IconArrowUp />
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

export function ChatDemo() {
  const [autoScroll, setAutoScroll] = React.useState(false)
  const [atPresent, setAtPresent] = React.useState(true)

  return (
    // Seguir o fim só faz sentido no presente; fora dele, cada página
    // carregada embaixo dispararia uma rolagem até o fim.
    <MessageScrollerProvider autoScroll={autoScroll && atPresent}>
      <ChatRoom
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onAtPresentChange={setAtPresent}
      />
    </MessageScrollerProvider>
  )
}
