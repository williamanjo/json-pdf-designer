import type { Template, TemplateVersion } from "../types";

// Versão do FORMATO de documento que este build entende. NÃO é a versão do
// pacote: o pacote vai de 2.0.0 pra 2.1.0 pra 3.0.0 sem que o formato do
// Template mude. Sobe só quando o JSON salvo muda de forma.
export const CURRENT_TEMPLATE_VERSION = 1 satisfies TemplateVersion;

// Template salvo antes do campo `version` existir — todo template criado até
// a v2.0.0 do pacote. Nenhuma mudança de forma aconteceu desde então, então
// tratar como 1 é exato, não uma aproximação.
const IMPLICIT_VERSION = 1;

// Cada entrada leva do formato N pro N+1. Uma migração por degrau, aplicada
// em cadeia — nunca `if (version === 1) ... if (version === 2) ...` espalhado
// por quem consome, que é como isso vira intratável na terceira versão.
//
// Hoje está vazio de propósito: existe UMA versão. O valor de ter isto agora
// é que a primeira mudança de formato entra como UMA entrada aqui, sem tocar
// em nenhum chamador — o custo de introduzir a cadeia depois de já haver
// template em banco é muito maior.
//
// Exemplo de como a primeira vai ser:
//   1: (t) => ({ ...t, schemas: t.schemas.map(renameTypeToKind) }),
const MIGRATIONS: Record<number, (template: Record<string, unknown>) => Record<string, unknown>> = {};

function readVersion(input: Record<string, unknown>): number {
  const raw = input.version;
  if (raw === undefined || raw === null) return IMPLICIT_VERSION;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    throw new Error(
      `Template.version inválida (${JSON.stringify(raw)}) — esperado um inteiro >= 1, ou ausente para o formato ${IMPLICIT_VERSION}.`
    );
  }
  return raw;
}

// Normaliza um Template vindo de fora (banco, arquivo, API) pro formato que
// este build entende, aplicando as migrações necessárias em ordem.
//
// Ponto único: `generatePdf` chama isto antes de qualquer outra coisa, então
// todo template que gera PDF passa por aqui. Quem carrega template pra editar
// (não pra gerar) deve chamar explicitamente — é export público.
//
// Versão MAIOR que a corrente é erro, não aviso: significa que o arquivo foi
// salvo por um build mais novo do pacote e pode conter campos que este build
// ignoraria em silêncio. Falhar alto é melhor que gerar um PDF faltando
// pedaço sem ninguém perceber.
export function migrateTemplate(input: unknown): Template {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`Template inválido — esperado um objeto, recebido ${Array.isArray(input) ? "array" : typeof input}.`);
  }

  let current = input as Record<string, unknown>;
  const from = readVersion(current);

  if (from > CURRENT_TEMPLATE_VERSION) {
    throw new Error(
      `Template na versão ${from}, mas este build só entende até a ${CURRENT_TEMPLATE_VERSION} — atualize o json-pdf-designer.`
    );
  }

  for (let v = from; v < CURRENT_TEMPLATE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) {
      throw new Error(`Falta a migração de Template da versão ${v} para a ${v + 1} — bug do pacote, não do seu template.`);
    }
    current = step(current);
  }

  // Estampa a versão corrente mesmo quando nada migrou: um template que
  // entrou sem `version` sai com `version: 1`, então quem salvar de volta
  // grava explícito e o próximo carregamento não depende mais do default.
  return { ...current, version: CURRENT_TEMPLATE_VERSION } as unknown as Template;
}
