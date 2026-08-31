import { Fragment, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { withInlineCode } from "../../src/i18n/withInlineCode";

// withInlineCode devolve um ReactNode (na prática, um array de elementos
// <Fragment>/<code>) — sem @testing-library/react no projeto, inspeciona a
// estrutura do array direto (tipo/props de cada elemento) em vez de montar
// no DOM.
function asArray(node: ReactNode): ReactNode[] {
  expect(Array.isArray(node)).toBe(true);
  return node as ReactNode[];
}

describe("withInlineCode", () => {
  it("texto puro sem backticks retorna algo equivalente ao texto original", () => {
    const result = asArray(withInlineCode("hello world"));
    expect(result).toHaveLength(1);
    const [part] = result;
    expect(isValidElement(part)).toBe(true);
    expect((part as React.ReactElement).type).toBe(Fragment);
    expect((part as React.ReactElement<{ children: ReactNode }>).props.children).toBe("hello world");
  });

  it("um único trecho `code` produz um elemento <code> na saída", () => {
    const result = asArray(withInlineCode("`code`"));
    const codeElements = result.filter(
      (part) => isValidElement(part) && (part as React.ReactElement).type === "code"
    ) as React.ReactElement<{ children: ReactNode }>[];
    expect(codeElements).toHaveLength(1);
    expect(codeElements[0].props.children).toBe("code");
  });

  it('texto com backtick dos dois lados (ex: "use `{campo}` direto") produz o split de 3 partes correto', () => {
    const result = asArray(withInlineCode("use `{campo}` direto"));
    expect(result).toHaveLength(3);

    const [before, code, after] = result as React.ReactElement<{ children: ReactNode }>[];
    expect(before.type).toBe(Fragment);
    expect(before.props.children).toBe("use ");

    expect(code.type).toBe("code");
    expect(code.props.children).toBe("{campo}");

    expect(after.type).toBe(Fragment);
    expect(after.props.children).toBe(" direto");
  });

  it("múltiplos trechos de código na mesma string viram vários elementos <code>", () => {
    const result = asArray(withInlineCode("a `x` b `y` c"));
    expect(result).toHaveLength(5);

    const types = (result as React.ReactElement[]).map((part) => part.type);
    expect(types).toEqual([Fragment, "code", Fragment, "code", Fragment]);

    const codeContents = (result as React.ReactElement<{ children: ReactNode }>[])
      .filter((part) => part.type === "code")
      .map((part) => part.props.children);
    expect(codeContents).toEqual(["x", "y"]);

    const fragmentContents = (result as React.ReactElement<{ children: ReactNode }>[])
      .filter((part) => part.type === Fragment)
      .map((part) => part.props.children);
    expect(fragmentContents).toEqual(["a ", " b ", " c"]);
  });
});
