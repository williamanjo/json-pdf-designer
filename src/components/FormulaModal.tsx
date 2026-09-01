import { useRef, useState } from "react";
import { useT, withInlineCode } from "../i18n";
import type { FieldSources } from "../designer/helpers";
import { templateExpressionErrors } from "../expressions/resolve";
import { templateSuspiciousOperators } from "../expressions/suspicious";
import { braceError, tokenAtCaret } from "../expressions/templateText";
import { applySuggestion, insertAtCaret, suggestAt, type Suggestion } from "../expressions/suggest";
import { DataTypeFields } from "./DataTypeFields";
import { Button, Modal, Textarea } from "./ui";

export type FormulaTarget = {
  // Como o alvo é chamado no título ("coluna Fatura", "linha de totais, 3").
  label: string;
  value: string;
  onSave: (next: string) => void;
  // Placeholder do caminho no bloco "Tipo de dado".
  pathPlaceholder?: string;
};

type Props = {
  target: FormulaTarget;
  sources: FieldSources;
  // Só a fórmula de coluna de tabela mostra o seletor "Tipo de dado" — é o
  // único alvo que resolve por linha e cujo formato `parseColumnFormula`
  // sabe decompor.
  showDataType?: boolean;
  onClose: () => void;
};

// Onde o valor do campo é escrito: campos vinculados à esquerda, editor
// multilinha com autocomplete no centro, validação ao vivo.
//
// O editor é UM só, e o que ele mostra é o valor do campo como ele é — com as
// chaves, já preenchido com o que estava lá. Não há "compor de um lado e
// adicionar do outro": quem abre o ƒx quer mexer no que existe, e um segundo
// campo só criava a dúvida de qual dos dois vale.
//
// Existe porque compor expressão num Input de uma linha dentro de uma sidebar
// de 320px é digitar às cegas: nada dizia quais caminhos de dado existem, e os
// defeitos que apareceram na prática (`{fatura /}`, que virou nome de chave e
// renderizou vazio; `{CURRENCY(total` sem fechar, que sai impresso como texto)
// eram erros de digitação que uma composição assistida evita antes de
// acontecer.
//
// Toda a lógica que erra fácil (onde a palavra começa, o que sobra do texto
// depois de aceitar uma sugestão, onde as chaves abrem e fecham) mora em
// módulo puro e testado — expressions/suggest.ts e expressions/templateText.ts.
// Este arquivo é casca.
export function FormulaModal({ target, sources, showDataType, onClose }: Props) {
  const t = useT();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Rascunho: nada é gravado até o "Salvar".
  const [draft, setDraft] = useState(target.value);
  const [caret, setCaret] = useState(target.value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // Aba da lista da esquerda. Começa nos campos do item quando há um: é o
  // escopo de quem está editando uma linha, o caso mais comum.
  const [fieldsTab, setFieldsTab] = useState<"item" | "arrays">(sources.item ? "item" : "arrays");

  // O `{...}` em que o caret está, se estiver em algum. É o que separa "estou
  // escrevendo expressão" de "estou escrevendo texto literal".
  const span = tokenAtCaret(draft, caret);

  // Chave desbalanceada vem primeiro: com uma aberta, o resolvedor nem vê o
  // trecho como token, então validar a expressão de dentro não diria nada.
  const braces = braceError(draft, t);
  const syntax = braces ? null : templateExpressionErrors(draft, t)[0]?.message;
  const suspicious = braces || syntax ? null : templateSuspiciousOperators(draft, t)[0]?.message;
  const blocked = Boolean(braces || syntax);

  const suggestions = suggestOpen && span ? suggestAt(span.inner, caret - span.start) : [];
  const active = suggestions[Math.min(activeIndex, suggestions.length - 1)];

  // Escreve no textarea e reposiciona o caret. O `setSelectionRange` tem de
  // rodar DEPOIS do React pintar o valor novo, senão o navegador devolve o
  // cursor pro fim — daí o requestAnimationFrame.
  function write(text: string, nextCaret: number) {
    setDraft(text);
    setCaret(nextCaret);
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  // Aplica uma edição feita SOBRE o conteúdo de dentro das chaves, e recompõe
  // o valor inteiro em volta dela.
  function writeInsideSpan(result: { text: string; caret: number }) {
    if (!span) return;
    write(draft.slice(0, span.start) + result.text + draft.slice(span.end), span.start + result.caret);
  }

  function accept(suggestion: Suggestion) {
    if (!span) return;
    writeInsideSpan(applySuggestion(span.inner, caret - span.start, suggestion));
    setSuggestOpen(true);
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if ((e.key === "Enter" || e.key === "Tab") && active) {
      e.preventDefault();
      accept(active);
      return;
    }
    if (e.key === "Escape") {
      // Fecha a lista sem fechar o modal — o Escape do Modal só age no
      // segundo toque, porque este para a propagação.
      e.stopPropagation();
      setSuggestOpen(false);
    }
  }

  // Clique num campo da lista: dentro das chaves entra o caminho nu, fora
  // delas entra já embrulhado — ali `total` seria só a palavra "total".
  function insertField(path: string) {
    if (span) {
      writeInsideSpan(insertAtCaret(span.inner, caret - span.start, path));
      return;
    }
    const result = insertAtCaret(draft, caret, `{${path}}`);
    write(result.text, result.caret);
  }

  const tabButton = (key: "item" | "arrays", label: string) => (
    <button
      type="button"
      onClick={() => setFieldsTab(key)}
      className={`flex-shrink-0 whitespace-nowrap px-2 py-1.5 text-xs font-medium ${
        fieldsTab === key
          ? "border-b-2 border-sky-500 text-sky-600 dark:border-blue-400 dark:text-blue-400"
          : "text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );

  const fieldChip = (path: string) => (
    <button
      key={path}
      type="button"
      onClick={() => insertField(path)}
      aria-label={t.formulaModal.insertFieldAria(path)}
      className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-left font-mono text-[10px] text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
    >
      {path}
    </button>
  );

  return (
    <Modal
      title={t.formulaModal.title(target.label)}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.formulaModal.cancel}
          </Button>
          <Button
            onClick={() => {
              target.onSave(draft);
              onClose();
            }}
            disabled={blocked}
            title={blocked ? t.formulaModal.blockedBySyntax : undefined}
          >
            {t.formulaModal.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          {(sources.item || sources.arrays.length > 0) && (
            <div className="flex flex-nowrap items-center gap-0.5 border-b border-slate-200 dark:border-gray-700">
              {sources.item && tabButton("item", t.formulaModal.itemTab)}
              {sources.arrays.length > 0 && tabButton("arrays", t.formulaModal.arrayPaths)}
            </div>
          )}

          {fieldsTab === "item" && sources.item && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-slate-400 dark:text-gray-400">
                {t.formulaModal.itemFields(sources.item.path)} {t.formulaModal.itemFieldsHint}
              </p>
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">{sources.item.columns.map(fieldChip)}</div>
            </div>
          )}

          {fieldsTab === "arrays" && sources.arrays.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-slate-400 dark:text-gray-400">{t.formulaModal.arrayPathsHint}</p>
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
                {sources.arrays.flatMap((source) => [
                  fieldChip(source.path),
                  ...(source.columns ?? []).map((col) => fieldChip(`${source.path}.${col}`)),
                ])}
              </div>
            </div>
          )}

          {!sources.item && sources.arrays.length === 0 && (
            <p className="text-[10px] text-slate-400 dark:text-gray-400">{t.formulaModal.noFields}</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {showDataType && <DataTypeFields formula={draft} onChange={setDraft} pathPlaceholder={target.pathPlaceholder} />}

          <div className="relative flex flex-col gap-1">
            <Textarea
              ref={areaRef}
              mono
              rows={5}
              label={t.formulaModal.fieldValue}
              placeholder={'FAT-{fatura} — {CURRENCY(total, "R$")}'}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
                setSuggestOpen(true);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              // Sem `onFocus` de propósito: a lista abre ao DIGITAR, não ao
              // clicar no campo.
              onBlur={() => setSuggestOpen(false)}
            />
            <p className="text-[10px] text-slate-400 dark:text-gray-400">
              {withInlineCode(t.formulaModal.fieldValueHint)} {t.formulaModal.suggestionsHint}
            </p>

            {suggestions.length > 0 && (
              // `mouseDown` em vez de `click`: o blur do textarea fecha a
              // lista antes de um click chegar.
              <ul className="absolute left-0 right-0 top-full z-10 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {suggestions.map((s, i) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        accept(s);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`flex w-full flex-col items-start px-2 py-1 text-left ${
                        s === active ? "bg-sky-50 dark:bg-blue-900/30" : ""
                      }`}
                    >
                      <span className="font-mono text-[11px] text-slate-700 dark:text-gray-100">
                        {s.hintKey ? t.fieldFunctionSnippets[s.hintKey] : s.name}
                      </span>
                      {s.hintKey && (
                        <span className="text-[10px] text-slate-400 dark:text-gray-400">{t.fieldFunctions[s.hintKey]}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {braces && <p className="text-[10px] text-red-600 dark:text-red-400">{braces}</p>}
          {syntax && <p className="text-[10px] text-red-600 dark:text-red-400">{syntax}</p>}
          {suspicious && <p className="text-[10px] text-amber-600 dark:text-amber-400">{suspicious}</p>}
        </div>
      </div>
    </Modal>
  );
}
