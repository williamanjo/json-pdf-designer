import { PageLimitError, UnsupportedGlyphError, ExpressionError } from "json-pdf-designer";

// Tradução de um erro de `generatePdf` numa mensagem que diz o que FAZER.
//
// O ponto deste arquivo é não usar `err.message` cru. O pacote exporta os erros
// como CLASSES justamente pra isso: dá pra distinguir "o dado é grande demais"
// de "falta uma fonte" de "bug do pacote" com `instanceof`, sem casar texto de
// mensagem (que muda). Num backend, é o mesmo ponto onde se escolhe entre 413,
// 400 e 500.

export type GenerationProblem = {
  // Título curto — o que aconteceu.
  title: string;
  // O que a pessoa faz agora.
  action: string;
  // Culpa de quem: muda o tom da UI e, num servidor, o status HTTP.
  blame: "dado" | "template" | "configuracao" | "pacote";
  // Campo do template envolvido, quando o erro sabe qual.
  field?: string;
  // Mensagem original, pra quem quiser o detalhe cru.
  detail: string;
};

export function describeGenerationError(err: unknown): GenerationProblem {
  const detail = err instanceof Error ? err.message : String(err);

  // Documento maior que o teto de páginas. O pacote interrompe em vez de
  // devolver um PDF truncado que parece completo.
  if (err instanceof PageLimitError) {
    return {
      title: `O relatório passou de ${err.maxPages} páginas`,
      action:
        "Filtre os dados antes de gerar, divida em vários PDFs, ou aumente o teto " +
        "em generatePdf(..., { maxPages }) se você realmente quer um documento desse tamanho.",
      blame: "dado",
      field: err.field,
      detail,
    };
  }

  // Caractere que a fonte não sabe escrever. Este example já carrega a Inter
  // (loadDefaultFont), então só cai aqui um caractere fora dela também — emoji,
  // CJK, árabe.
  if (err instanceof UnsupportedGlyphError) {
    return {
      title: `O caractere ${JSON.stringify(err.char)} não existe na fonte`,
      action:
        "Troque a fonte por uma que cubra esse caractere (generatePdf aceita fontBytes), " +
        "ou remova o caractere do dado. O pacote não descarta em silêncio: um relatório é " +
        "documento assinado.",
      blame: "dado",
      field: err.field,
      detail,
    };
  }

  // Expressão inválida NÃO chega aqui na prática — a geração é tolerante e o
  // campo sai vazio (o painel de problemas é quem aponta, antes de gerar). Se
  // chegar, é porque alguém chamou a API estrita.
  if (err instanceof ExpressionError) {
    return {
      title: "Expressão inválida no template",
      action: 'Veja o painel "Problemas do template" — ele lista cada expressão quebrada e onde está.',
      blame: "template",
      detail,
    };
  }

  // Os erros abaixo o pacote lança como Error comum, então não há classe pra
  // testar. Em vez de casar a mensagem (frágil), reconhecemos pelo formato do
  // que o pacote documenta e caímos num genérico honesto quando não dá.
  if (/tamanho inválido/i.test(detail)) {
    return {
      title: "Tamanho de página inválido",
      action: 'Confira largura/altura na aba "Página" — precisam ser dois números maiores que zero, em mm.',
      blame: "template",
      detail,
    };
  }

  if (/imagem/i.test(detail) && /corrompid|não é PNG|não suportado|limite/i.test(detail)) {
    return {
      title: "Problema com uma imagem",
      action: "Reenvie a imagem pelo editor (PNG ou JPEG, até 15MB).",
      blame: "template",
      detail,
    };
  }

  if (/Unknown font format|wawoff2|fonte/i.test(detail)) {
    return {
      title: "Não deu pra carregar a fonte",
      action: "A fonte deste example vem de src/assets/inter-regular.ttf — confira se o arquivo está lá e íntegro.",
      blame: "configuracao",
      detail,
    };
  }

  if (/Template (inválido|na versão)|Template\.version/i.test(detail)) {
    return {
      title: "Template em formato incompatível",
      action:
        "O arquivo foi salvo por uma versão mais nova do json-pdf-designer, ou não é um template válido. " +
        "Atualize o pacote, ou carregue outro projeto.",
      blame: "template",
      detail,
    };
  }

  if (/Paginação travada/i.test(detail)) {
    return {
      title: "Bug de paginação do pacote",
      action: "Isso não é problema do seu template — reporte em github.com/williamanjo/json-pdf-designer com o projeto que reproduz.",
      blame: "pacote",
      detail,
    };
  }

  return {
    title: "Não deu pra gerar o PDF",
    action: "Confira o detalhe abaixo. Se não fizer sentido, salve o projeto e reporte.",
    blame: "pacote",
    detail,
  };
}
