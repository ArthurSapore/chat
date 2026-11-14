/**
 * Criar um `Intl.DateTimeFormat` é caro; `toLocaleTimeString` cria um a cada
 * chamada. Um formatador por módulo é reutilizado por todas as mensagens.
 */
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
})

/** "14:05" a partir de uma data ISO. */
export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso))
}
