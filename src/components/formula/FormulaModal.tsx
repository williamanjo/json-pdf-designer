import { useRef, useState } from "react";
import { useT, withInlineCode } from "../../i18n";
import type { FieldSources } from "../../designer/helpers";
import { templateExpressionErrors } from "../../expressions/resolve";
import { templateSuspiciousOperators } from "../../expressions/suspicious";
import { braceError, tokenAtCaret } from "../../expressions/templateText";
import { applySuggestion, insertAtCaret, suggestAt, type Suggestion } from "../../expressions/suggest";
import { DataTypeFields } from "./DataTypeFields";
import { useUiComponents } from "../ui/useUiComponents";

export type FormulaTarget = {
  // How the target is named in the title ("Invoice column", "totals row, 3").
  label: string;
  value: string;
  onSave: (next: string) => void;
  // Placeholder do caminho no bloco "Tipo de dado".
  pathPlaceholder?: string;
};

type Props = {
  target: FormulaTarget;
  sources: FieldSources;
  // Only a table column formula shows the "Data type" picker — it is the
  // only target that resolves per row and whose format `parseColumnFormula`
  // knows how to decompose.
  showDataType?: boolean;
  onClose: () => void;
};

// Where a field's value is written: bound fields on the left, a multiline
// editor with autocomplete in the center, live validation.
//
// There is ONE editor, and what it shows is the field's value as it is —
// with the braces, already filled in with whatever was there. There is no
// "compose on one side and append on the other": whoever opens the ƒx wants
// to work on what exists, and a second field only raised the question of
// which of the two wins.
//
// It exists because composing an expression in a one-line Input inside a
// 320px sidebar is typing blind: nothing told you which data paths exist,
// and the defects that showed up in practice (`{fatura /}`, which became a
// key name and rendered empty; `{CURRENCY(total` left unclosed, which comes
// out printed as text) were typos that assisted composition prevents.
//
// All the logic that is easy to get wrong (where the word starts, what is
// left of the text after accepting a suggestion, where the braces open and
// close) lives in pure, tested modules — expressions/suggest.ts and
// expressions/templateText.ts. This file is a shell.
export function FormulaModal({ target, sources, showDataType, onClose }: Props) {
  const t = useT();
  const { Button, Modal, Textarea } = useUiComponents();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Draft: nothing is saved until "Save".
  const [draft, setDraft] = useState(target.value);
  const [caret, setCaret] = useState(target.value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // Tab of the left-hand list. It starts on the item's fields when there is
  // one: that is the scope of whoever is editing a row, the common case.
  const [fieldsTab, setFieldsTab] = useState<"item" | "arrays">(sources.item ? "item" : "arrays");

  // The `{...}` the caret is in, if it is in one at all. That is what
  // separates "I am writing an expression" from "I am writing literal text".
  const span = tokenAtCaret(draft, caret);

  // An unbalanced brace comes first: with one left open the resolver does not
  // even see the stretch as a token, so validating what is inside says nothing.
  const braces = braceError(draft, t);
  const syntax = braces ? null : templateExpressionErrors(draft, t)[0]?.message;
  const suspicious = braces || syntax ? null : templateSuspiciousOperators(draft, t)[0]?.message;
  const blocked = Boolean(braces || syntax);

  const suggestions = suggestOpen && span ? suggestAt(span.inner, caret - span.start) : [];
  const active = suggestions[Math.min(activeIndex, suggestions.length - 1)];

  // Writes into the textarea and repositions the caret. `setSelectionRange`
  // has to run AFTER React paints the new value, otherwise the browser sends
  // the cursor back to the end — hence the requestAnimationFrame.
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

  // Applies an edit made OVER the content inside the braces, and recomposes
  // the whole value around it.
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
      // Closes the list without closing the modal — the Modal's Escape only
      // acts on the second press, because this one stops propagation.
      e.stopPropagation();
      setSuggestOpen(false);
    }
  }

  // Clicking a field in the list: inside the braces the bare path goes in,
  // outside them it arrives wrapped — there `total` would be the word "total".
  function insertField(path: string) {
    if (span) {
      writeInsideSpan(insertAtCaret(span.inner, caret - span.start, path));
      return;
    }
    const result = insertAtCaret(draft, caret, `{${path}}`);
    write(result.text, result.caret);
  }

  // MESMO widget da barra de abas da sidebar do Designer: `jpd-tab` +
  // `data-active` são as mesmas classes de lá. A definição completa (que
  // acrescenta o arrasto pra reordenar) mora com a barra do Designer; esta
  // aqui usa só o subconjunto sem arrasto.
  const tabButton = (key: "item" | "arrays", label: string) => (
    <button type="button" onClick={() => setFieldsTab(key)} className="jpd-tab" data-active={fieldsTab === key || undefined}>
      {label}
    </button>
  );

  const fieldChip = (path: string) => (
    <button key={path} type="button" onClick={() => insertField(path)} aria-label={t.formulaModal.insertFieldAria(path)} className="jpd-chip jpd-chip--action">
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
      {/* `jpd-formula` é grid de UMA coluna até 40rem de viewport e de duas
          (barra de 11rem + editor fluido) a partir daí — o único ponto
          responsivo da biblioteca. Ver o @media em _group-c.css. */}
      <div className="jpd-formula">
        <div className="jpd-formula__sources">
          {(sources.item || sources.arrays.length > 0) && (
            <div className="jpd-tabs jpd-tabs--scroll">
              {sources.item && tabButton("item", t.formulaModal.itemTab)}
              {sources.arrays.length > 0 && tabButton("arrays", t.formulaModal.arrayPaths)}
            </div>
          )}

          {fieldsTab === "item" && sources.item && (
            <div className="jpd-stack jpd-stack--tight">
              <p className="jpd-hint">
                {t.formulaModal.itemFields(sources.item.path)} {t.formulaModal.itemFieldsHint}
              </p>
              <div className="jpd-chiplist">{sources.item.columns.map(fieldChip)}</div>
            </div>
          )}

          {fieldsTab === "arrays" && sources.arrays.length > 0 && (
            <div className="jpd-stack jpd-stack--tight">
              <p className="jpd-hint">{t.formulaModal.arrayPathsHint}</p>
              <div className="jpd-chiplist">
                {sources.arrays.flatMap((source) => [
                  fieldChip(source.path),
                  ...(source.columns ?? []).map((col) => fieldChip(`${source.path}.${col}`)),
                ])}
              </div>
            </div>
          )}

          {!sources.item && sources.arrays.length === 0 && <p className="jpd-hint">{t.formulaModal.noFields}</p>}
        </div>

        <div className="jpd-formula__editor">
          {showDataType && <DataTypeFields formula={draft} onChange={setDraft} pathPlaceholder={target.pathPlaceholder} />}

          <div className="jpd-suggest">
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
            <p className="jpd-hint">
              {withInlineCode(t.formulaModal.fieldValueHint)} {t.formulaModal.suggestionsHint}
            </p>

            {suggestions.length > 0 && (
              // `mouseDown` em vez de `click`: o blur do textarea fecha a
              // lista antes de um click chegar.
              <ul className="jpd-popover jpd-popover--anchor-stretch">
                {suggestions.map((s, i) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        accept(s);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className="jpd-menuitem jpd-suggest__item"
                      data-active={s === active || undefined}
                    >
                      <span className="jpd-suggest__name">{s.hintKey ? t.fieldFunctionSnippets[s.hintKey] : s.name}</span>
                      {s.hintKey && <span className="jpd-hint">{t.fieldFunctions[s.hintKey]}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {braces && <p className="jpd-error">{braces}</p>}
          {syntax && <p className="jpd-error">{syntax}</p>}
          {suspicious && <p className="jpd-warn">{suspicious}</p>}
        </div>
      </div>
    </Modal>
  );
}
