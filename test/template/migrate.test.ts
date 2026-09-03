import { describe, expect, it } from "vitest";
import { CURRENT_TEMPLATE_VERSION, migrateTemplate } from "../../src/template/migrate";
import { TemplateNotAnObjectError, TemplateVersionInvalidError, TemplateVersionTooNewError } from "../../src/errors";
import type { Template } from "../../src/types";

// Colhe o erro que `fn` lança, pra afirmar sobre a CLASSE e os campos
// estruturados em vez de casar a frase. `toThrow(/texto/)` era o que os
// examples faziam, e é exatamente o acoplamento que as classes removem.
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw, and it did not");
}

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
    const err = thrownBy(() => migrateTemplate(input));
    expect(err).toBeInstanceOf(TemplateVersionTooNewError);
    const typed = err as TemplateVersionTooNewError;
    expect(typed.code).toBe("templateVersionTooNew");
    expect(typed.found).toBe(99);
    expect(typed.supported).toBe(CURRENT_TEMPLATE_VERSION);
    expect(typed.blame).toBe("template");
  });

  it("`version` de tipo/valor inválido dá TemplateVersionInvalidError carregando o valor recebido", () => {
    for (const bad of ["1", 0, -1, 1.5, true, {}]) {
      const err = thrownBy(() => migrateTemplate({ ...baseTemplate(), version: bad }));
      expect(err, JSON.stringify(bad)).toBeInstanceOf(TemplateVersionInvalidError);
      const typed = err as TemplateVersionInvalidError;
      expect(typed.code).toBe("templateVersionInvalid");
      // O valor CRU, não a frase: é o que deixa quem chama logar/decidir sem
      // parsear a mensagem.
      expect(typed.received).toEqual(bad);
      expect(typed.implicitVersion).toBe(1);
    }
  });

  it("entrada que não é objeto dá TemplateNotAnObjectError nomeando o tipo recebido", () => {
    const esperado: Array<[unknown, string]> = [
      [null, "object"],
      [undefined, "undefined"],
      [[], "array"],
      ["x", "string"],
      [42, "number"],
    ];
    for (const [bad, tipo] of esperado) {
      const err = thrownBy(() => migrateTemplate(bad));
      expect(err, JSON.stringify(bad ?? null)).toBeInstanceOf(TemplateNotAnObjectError);
      const typed = err as TemplateNotAnObjectError;
      expect(typed.code).toBe("templateNotAnObject");
      expect(typed.receivedType, JSON.stringify(bad ?? null)).toBe(tipo);
    }
  });
});
