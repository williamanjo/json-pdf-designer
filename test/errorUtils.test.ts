import { describe, expect, it } from "vitest";
import { toErrorMessage } from "../src/errorUtils";

describe("toErrorMessage", () => {
  it("usa a mensagem do Error quando é um Error de verdade", () => {
    expect(toErrorMessage(new Error("deu ruim"), "fallback")) .toBe("deu ruim");
  });

  it("usa o fallback string quando não é um Error", () => {
    expect(toErrorMessage("string qualquer", "fallback")).toBe("fallback");
    expect(toErrorMessage(42, "fallback")).toBe("fallback");
  });

  it("usa o fallback função (recebe o valor original) quando não é um Error", () => {
    expect(toErrorMessage("oops", String)).toBe("oops");
    expect(toErrorMessage({ code: 1 }, (e) => `erro: ${JSON.stringify(e)}`)).toBe('erro: {"code":1}');
  });
});
