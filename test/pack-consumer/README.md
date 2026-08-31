# pack-consumer

Não é um projeto rodável direto (sem `node_modules` próprio) — são só os
2 arquivos-molde que a CI (`.github/workflows/ci.yml`) copia pra um
diretório temporário e usa pra instalar o `.tgz` gerado por `npm pack`
e rodar `generatePdf` de verdade contra o pacote PUBLICADO (não contra
o repo via symlink/`file:`, como os 3 exemplos em `examples/` fazem).

Pega exatamente o tipo de regressão que só aparece no pacote publicado:
`exports` errado no `package.json`, arquivo faltando em `files`, `.d.ts`
não gerado, entry point `/server` quebrado — nada disso aparece rodando
contra o código-fonte direto.

Só testa o entry `/server` (sem React) de propósito — é o caso mais
importante de validar (a promessa "gera no backend, sem depender de
React" é um dos maiores diferenciais do pacote, ver README) e o mais
simples de isolar (não precisa instalar react/react-dom, que são peer
dependencies opcionais).

Rodar localmente (a partir da raiz do pacote):

```bash
npm run build
npm pack
mkdir -p /tmp/pack-consumer && cp json-pdf-designer-*.tgz /tmp/pack-consumer/pkg.tgz
cp test/pack-consumer/package.json test/pack-consumer/generate-check.mjs /tmp/pack-consumer/
cd /tmp/pack-consumer && npm install ./pkg.tgz && node generate-check.mjs
```
