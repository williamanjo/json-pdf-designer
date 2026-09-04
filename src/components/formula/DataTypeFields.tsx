import { useT } from "../../i18n";
import { buildColumnFormula, parseColumnFormula } from "../../fields/table/columnFormula";
import { useUiComponents } from "../ui/useUiComponents";

type Props = {
  // A fórmula inteira, como texto — a mesma string que vai pro campo.
  formula: string;
  onChange: (formula: string) => void;
  // Placeholder do caminho: o nome da coluna, quando há um.
  pathPlaceholder?: string;
};

// O bloco "Tipo de dado": um seletor de função e os argumentos dela
// (símbolo, casas decimais, formato de data), derivados da PRÓPRIA fórmula.
//
// Movido de PropertyPanelTable, sem mudar comportamento, quando o ƒx passou
// a abrir o modal (FormulaModal.tsx). A diferença é só quem recebe a escrita:
// antes ia direto pro binding a cada tecla, agora vai pro rascunho do modal e
// só o "Salvar" comita.
//
// Só aparece pra fórmula "limpa" (vazia, `{path}` nu, ou UMA chamada de
// função) — `parseColumnFormula` devolve "raw" pra `FAT-{fatura}` e coisas
// misturadas, e não há como decompor isso num seletor sem perder o prefixo.
export function DataTypeFields({ formula, onChange, pathPlaceholder }: Props) {
  const t = useT();
  const { Input, Select } = useUiComponents();
  const parsed = parseColumnFormula(formula);
  if (parsed.kind === "raw") return null;

  const path = parsed.kind === "func" || parsed.kind === "bare" ? parsed.path : "";
  const symbol = parsed.kind === "func" ? parsed.symbol : "R$";
  const decimals = parsed.kind === "func" ? parsed.decimals : "2";
  const outFormat = parsed.kind === "func" ? parsed.outFormat : "DD/MM/YYYY";
  const inFormat = parsed.kind === "func" ? parsed.inFormat : "";
  const fn = parsed.kind === "func" ? parsed.fn : "";

  return (
    <div className="jpd-stack jpd-stack--snug jpd-subcard">
      <div className="jpd-grid2">
        <Select
          label={t.table.dataType}
          value={fn}
          onChange={(e) => onChange(buildColumnFormula(e.target.value, path, symbol, decimals, outFormat, inFormat))}
        >
          <option value="">{t.table.plainText}</option>
          <option value="NUMBER">{t.table.number}</option>
          <option value="CURRENCY">{t.table.currency}</option>
          <option value="DATE">{t.table.date}</option>
          <option value="UPPER">{t.table.uppercase}</option>
          <option value="LOWER">{t.table.lowercase}</option>
          <option value="TRIM">{t.table.trimEdges}</option>
        </Select>
        <Input
          label={t.table.fieldPath}
          mono
          placeholder={pathPlaceholder}
          value={path}
          onChange={(e) => onChange(buildColumnFormula(fn, e.target.value, symbol, decimals, outFormat, inFormat))}
        />
      </div>
      {fn === "CURRENCY" && (
        <div className="jpd-grid2">
          <Input
            label={t.table.symbol}
            value={symbol}
            onChange={(e) => onChange(buildColumnFormula("CURRENCY", path, e.target.value, decimals, "", ""))}
          />
          <Input
            label={t.table.decimalPlaces}
            type="number"
            min={0}
            value={decimals}
            onChange={(e) => onChange(buildColumnFormula("CURRENCY", path, symbol, e.target.value, "", ""))}
          />
        </div>
      )}
      {fn === "NUMBER" && (
        <Input
          label={t.table.decimalPlaces}
          type="number"
          min={0}
          value={decimals}
          onChange={(e) => onChange(buildColumnFormula("NUMBER", path, "", e.target.value, "", ""))}
        />
      )}
      {fn === "DATE" && (
        <div className="jpd-grid2">
          <Input
            label={t.table.outputFormat}
            mono
            value={outFormat}
            onChange={(e) => onChange(buildColumnFormula("DATE", path, "", "", e.target.value, inFormat))}
          />
          <Input
            label={t.table.inputFormat}
            mono
            placeholder={t.table.inputFormatPlaceholder}
            value={inFormat}
            onChange={(e) => onChange(buildColumnFormula("DATE", path, "", "", outFormat, e.target.value))}
          />
        </div>
      )}
    </div>
  );
}
