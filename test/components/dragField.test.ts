import { describe, expect, it, vi } from "vitest";
import { allowDrop, readDroppedField, type DroppedField } from "../../src/components/dragField";

function makeDragEvent(data: Record<string, string>): React.DragEvent {
  return {
    dataTransfer: {
      getData: (format: string) => data[format] ?? "",
      types: Object.keys(data),
    },
    preventDefault: vi.fn(),
  } as unknown as React.DragEvent;
}

describe("readDroppedField", () => {
  it("JSON válido no dataTransfer retorna o objeto parseado", () => {
    const field: DroppedField = { path: "cliente.nome", kind: "scalar" };
    const event = makeDragEvent({ "application/json": JSON.stringify(field) });
    expect(readDroppedField(event)).toEqual(field);
  });

  it("dataTransfer sem o formato application/json retorna null", () => {
    const event = makeDragEvent({});
    expect(readDroppedField(event)).toBeNull();
  });

  it("JSON malformado retorna null", () => {
    const event = makeDragEvent({ "application/json": "{not valid json" });
    expect(readDroppedField(event)).toBeNull();
  });
});

describe("allowDrop", () => {
  it("chama preventDefault quando types inclui application/json", () => {
    const event = makeDragEvent({ "application/json": "{}" });
    allowDrop(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("não chama preventDefault quando types não inclui application/json", () => {
    const event = makeDragEvent({ "text/plain": "oi" });
    allowDrop(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
