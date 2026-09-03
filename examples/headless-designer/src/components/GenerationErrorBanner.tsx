import { useState } from "react";
import type { GenerationProblem } from "../lib/generationError";
import type { ShellDict } from "../i18n";

type Props = {
  problem: GenerationProblem;
  // Dicionário da CASCA, e agora ele carrega MENOS do que carregava: os
  // rótulos em volta ("problema no dado", "ver detalhe") continuam nossos,
  // mas o título e a ação de cada falha vêm dentro do `problem` — resolvidos
  // pelo pacote pros erros dele, pelo `failures.*` da casca pros nossos.
  tt: ShellDict;
  onDismiss: () => void;
};

// Banner de falha de geração.
//
// O que este componente NÃO faz mais, e é a mudança que importa: ele não
// escolhe texto. Antes tinha um `switch` sobre nove códigos com dois casos
// especiais (o teto de páginas e o caractere fora da fonte carregavam um
// `titleArg` pra interpolar), e cada código precisava de entrada em
// `genErrors` nos dois idiomas — nove títulos e nove ações mantidos aqui,
// duplicando o que o pacote já sabia dizer.
//
// Na 3.0.0 `describePdfError` devolve `{ code, blame, title, action?, field?,
// detail }` com título e ação JÁ LOCALIZADOS, então a interpolação (e o
// `titleArg` que existia só pra ela) mora do lado de quem tem o número. Aqui
// sobrou render.
//
// A tradução continua acontecendo na RENDERIZAÇÃO, não no `catch`: o estado do
// App guarda o erro CRU e chama `describeGenerationError(err, locale)` ao
// renderizar, então trocar o idioma com o banner aberto retraduz o banner sem
// gerar o PDF de novo.
export default function GenerationErrorBanner({ problem, tt, onDismiss }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  // `blame: "package"` é a única culpa que pinta o banner de outra cor: é a
  // que diz "não é o seu template, é bug nosso".
  const isBug = problem.blame === "package";

  return (
    <div className={`gen-banner${isBug ? " gen-banner--bug" : ""}`}>
      <div className="gen-banner-body">
        <span className="gen-banner-title">
          {problem.title}
          {/* O enum de culpa é do pacote (data/template/config/package); o
              RÓTULO dele é etiqueta de UI, então a tradução é nossa. Índice
              direto em vez de `switch`: valor novo no enum do pacote para de
              compilar aqui, porque o objeto não teria a chave. */}
          <span className="gen-banner-blame">({tt.banner.blame[problem.blame]})</span>
          {problem.field && (
            <span className="gen-banner-blame">
              {/* O NOME do campo é dado do template — não se traduz. */}
              {tt.banner.fieldLabel} <code>{problem.field}</code>
            </span>
          )}
        </span>
        {/* `action` é opcional no contrato do pacote: há erro pra qual não
            existe nada útil pra pedir. */}
        {problem.action && <span>{problem.action}</span>}
        {/* `detail` é a mensagem CRUA, em inglês, de propósito: é o texto que
            a pessoa cola num issue. Fica escondido atrás do toggle porque não
            é pra ela ter que ler. */}
        {showDetail && <code className="gen-banner-detail">{problem.detail}</code>}
      </div>
      <div className="gen-banner-actions">
        <button type="button" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? tt.banner.hideDetail : tt.banner.showDetail}
        </button>
        <button type="button" className="remove-btn" aria-label={tt.banner.dismiss} onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
