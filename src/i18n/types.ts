// Idiomas suportados pela UI do Designer — não afeta como o PDF GERADO
// formata data/moeda (isso continua vindo de {DATE(...)}/{CURRENCY(...)}
// no próprio template, ver bindings.ts) — só o que o designer fala com
// quem tá montando o relatório (botões, abas, avisos, placeholders).
export type Locale = "en" | "pt-BR";
