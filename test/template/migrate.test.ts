import { describe, expect, it } from "vitest";
import { CURRENT_TEMPLATE_VERSION, migrateTemplate } from "../../src/template/migrate";
import type { Template } from "../../src/types";

function baseTemplate(): Record<string, unknown> {
  return {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: "t1",
        name: "titulo",
        type: "text",
        x: 10,
        y: 10,
        width: 100,
        height: 12,
        content: "Olá {nome}",
        fontSize: 14,
        fontColor: "#000000",
        alignment: "left",
      },
    ],
  };
}

describe("migrateTemplate", () => {
  it("template sem `version` (todo template salvo até a v2.0.0) vira a versão corrente", () => {
    const out = migrateTemplate(baseTemplate());
    expect(out.version).toBe(CURRENT_TEMPLATE_VERSION);
  });

  it("não perde nem altera nenhum outro campo ao estampar a versão", () => {
    const input = baseTemplate();
    const out = migrateTemplate(input);
    // Compara tudo menos `version` — o resto tem de ser idêntico à entrada.
    const { version, ...rest } = out as Template & Record<string, unknown>;
    expect(version).toBe(CURRENT_TEMPLATE_VERSION);
    expect(rest).toEqual(input);
  });

  it("não muta a entrada (quem carregou do banco continua com o objeto original)", () => {
    const input = baseTemplate();
    const snapshot = JSON.parse(JSON.stringify(input));
    migrateTemplate(input);
    expect(input).toEqual(snapshot);
  });

  it("template já na versão corrente passa inalterado (identidade)", () => {
    const input = { ...baseTemplate(), version: CURRENT_TEMPLATE_VERSION };
    expect(migrateTemplate(input)).toEqual(input);
  });

  it("é idempotente — migrar duas vezes dá o mesmo resultado", () => {
    const once = migrateTemplate(baseTemplate());
    expect(migrateTemplate(once)).toEqual(once);
  });

  it("versão MAIOR que a corrente falha alto, em vez de gerar PDF faltando pedaço", () => {
    // Arquivo salvo por um build mais novo do pacote: pode ter campos que
    // este build ignoraria em silêncio. Erro é melhor que PDF errado.
    const input = { ...baseTemplate(), version: 99 };
    expect(() => migrateTemplate(input)).toThrow(/versão 99.*só entende até a 1/i);
  });

  it("`version` de tipo/valor inválido dá erro claro citando o valor recebido", () => {
    for (const bad of ["1", 0, -1, 1.5, true, {}]) {
      expect(() => migrateTemplate({ ...baseTemplate(), version: bad })).toThrow(/Template\.version inválida/i);
    }
  });

  it("entrada que não é objeto dá erro claro (null, array, string, número)", () => {
    for (const bad of [null, undefined, [], "x", 42]) {
      expect(() => migrateTemplate(bad)).toThrow(/Template inválido/i);
    }
  });
});
