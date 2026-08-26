# custom-ui-example

Mesma lib [`json-pdf-designer`](../..) do exemplo
[`report-builder`](../report-builder), só que a casca inteira (header,
sidebar, textarea, botões) é **CSS puro escrito à mão** (`src/index.css`)
— nenhum `Button`/`Card`/`Input`/ícone importado do pacote. Existe pra
provar que o `<Designer>` funciona igual, sem depender de nenhum design
system alheio (nem Tailwind configurado neste app).

O `<Designer>` em si continua com a aparência pronta do pacote — ele é
uma peça só (canvas + painel de propriedades + toolbar), não dá pra
"desmontar" e trocar só uma parte. O que fica 100% livre é a CASCA em
volta dele: aqui, esse redor não usa nada pronto.

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5174` (porta fixa em `vite.config.ts` — o
`report-builder` usa a 5173, pra rodar os dois ao mesmo tempo sem
conflito).

## O que tem

- **Um template fixo** (recibo: título, cliente/data, tabela de itens com
  `SUM` no rodapé) — sem explorador de campos, sem múltiplas fontes JSON.
  O `<Designer>` continua editável do mesmo jeito (arrastar, redimensionar,
  editar vínculo, adicionar coluna) — só não tem UI extra pra descobrir
  campos automaticamente num JSON arbitrário.
- **Textarea de dados** (JSON cru, editável) + botão "Gerar PDF" — sem
  prévia (`PdfPreviewModal` também é um componente pronto do pacote, fora
  de propósito aqui): clicar já gera e baixa direto.
- Dados de exemplo são **fabricados** (`Cliente Exemplo`, sem CNPJ/nome
  real nenhum).

## Estrutura do código

```
src/
  data/
    reciboTemplate.ts -> template/binding fixos + dados de amostra (fabricados)
  App.tsx     -> casca (header/sidebar/textarea/botão) + handleGenerate — sem template embutido
  index.css   -> CSS puro (sem Tailwind) da casca — cores/layout próprios, nada do pacote
  main.tsx    -> importa "json-pdf-designer/style.css" (obrigatório — estiliza o <Designer> por
                 dentro) + "./index.css" (só a casca deste app)
```

## Por que ainda importa `json-pdf-designer/style.css`

O CSS do pacote não depende do consumidor ter Tailwind configurado — vem
**pré-compilado** (`dist/style.css`, gerado a partir do próprio `src/` da
lib). Esse import é sobre o `<Designer>` renderizar certo por dentro
(painel de propriedades etc), não sobre a casca deste app — a prova de
que dá pra usar sem Tailwind nenhum no lado do consumidor é este próprio
example não ter `@tailwindcss/vite` nem `tailwind.config` em lugar nenhum.
