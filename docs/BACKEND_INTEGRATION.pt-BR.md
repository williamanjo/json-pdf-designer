**Português** | [English](BACKEND_INTEGRATION.md)

# Integração: frontend com o Designer + backend gerando o PDF

Como usar o `json-pdf-designer` num sistema separado em duas partes: um
**frontend** onde o usuário desenha o template (o `<Designer>` de sempre) e
salva o resultado, e um **backend/API** que, a partir de um `templateId` +
os dados reais, junta os dois, gera o PDF e manda por e-mail. Ponto-chave
que faz isso funcionar sem gambiarra: **`generatePdf` é JS puro (pdf-lib) —
roda em Node exatamente igual roda no navegador**, sem headless browser,
sem Puppeteer, sem nada a mais.

## Visão geral

```
┌─────────────────────┐        salva {template, bindings}        ┌──────────────┐
│  Frontend (Designer) │ ───────────────────────────────────────▶│   Banco de   │
│  <Designer/>          │◀─────────────────────────────────────── │   dados      │
└─────────────────────┘        carrega pra editar de novo         └──────┬───────┘
                                                                         │ busca por
                                                                         │ templateId
┌─────────────────────┐   POST /reports/generate                        │
│  Quem dispara o       │   { templateId, data, email }          ┌──────▼───────┐
│  relatório (seu app,  │ ───────────────────────────────────────▶│   Backend    │
│  um cron, outro       │                                         │   (API)      │
│  serviço...)          │                                         │              │
└─────────────────────┘                                          │ 1. busca      │
                                                                   │    template   │
                                                                   │ 2. generatePdf│
                                                                   │ 3. envia email│
                                                                   └──────────────┘
```

Duas fontes de verdade, cada uma cuidando só da própria parte:
- **Template + vínculos (Binding[])** — desenhado no frontend, guardado
  como JSON no banco. Não tem dado real dentro, só a estrutura (posição,
  tamanho, cor, `{token}`/`{FUNÇÃO(...)}`).
- **Dado real** — só existe na hora de gerar; vem no corpo do POST de quem
  pede o relatório (seu próprio backend, um webhook, outra API).

## 1. Frontend — desenhar e salvar o template

O frontend usa o pacote exatamente como os exemplos (`examples/report-builder`)
já mostram — a única diferença é que "Salvar projeto" (que hoje baixa um
`.json`) vira um `POST`/`PUT` pra API em vez de um arquivo:

```tsx
import { useState } from "react";
import { Designer, type Template, type Binding } from "json-pdf-designer";
import "json-pdf-designer/style.css";

function TemplateEditorPage({ templateId }: { templateId?: string }) {
  const [template, setTemplate] = useState<Template>(/* carregado do backend ou vazio */);
  const [bindings, setBindings] = useState<Binding[]>([]);

  async function handleSave() {
    const method = templateId ? "PUT" : "POST";
    const url = templateId ? `/api/templates/${templateId}` : "/api/templates";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Recibo padrão", template, bindings }),
    });
  }

  return (
    <>
      <Designer template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
      <button onClick={handleSave}>Salvar</button>
    </>
  );
}
```

`template`/`bindings` são só objetos JS serializáveis (`JSON.stringify`
direto, sem classe/função por dentro) — dá pra guardar como estão.

**Preview no frontend** (opcional, com dado de exemplo) continua igual ao
que já existe: `generatePdf(template, data, bindings)` + `<PdfPreview>`,
rodando no navegador do usuário enquanto ele desenha — não tem relação
nenhuma com a geração de verdade que o backend vai fazer depois.

## 2. Banco de dados — migration + model (Lucid)

Uma tabela só, uma linha por template. Migration:

```ts
// database/migrations/xxxx_create_report_templates_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'report_templates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('name').notNullable()
      table.jsonb('template').notNullable()   // Template (page, schemas, headerHeight...)
      table.jsonb('bindings').notNullable()   // Binding[]
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

Model:

```ts
// app/models/report_template.ts
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { Template, Binding } from 'json-pdf-designer'

export default class ReportTemplate extends BaseModel {
  static table = 'report_templates'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare template: Template

  @column()
  declare bindings: Binding[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

Coluna `jsonb` + driver `pg` já entrega/recebe objeto JS direto (sem
`JSON.parse`/`stringify` manual) — `row.template`/`row.bindings` saem do
banco no mesmo formato que o `<Designer>` produziu e que `generatePdf`
espera. Nenhum dado real do relatório fica nessa tabela, só o desenho.

## 3. Backend — rota + controller que gera e manda o e-mail

Rota:

```ts
// start/routes.ts
import router from '@adonisjs/core/services/router'
import ReportsController from '#controllers/reports_controller'

router.post('/api/reports/generate', [ReportsController, 'generate'])
```

Validação do payload (VineJS):

```ts
// app/validators/report.ts
import vine from '@vinejs/vine'

export const generateReportValidator = vine.compile(
  vine.object({
    templateId: vine.string().uuid(),
    data: vine.object({}).allowUnknownProperties(),
    email: vine.string().email(),
    filename: vine.string().optional(),
  })
)
```

Controller — só o `templateId` chega junto com `data`/`email`; o template
em si é sempre lido do banco, nunca do request (ver "Segurança" abaixo):

```ts
// app/controllers/reports_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { generatePdf } from 'json-pdf-designer'
import mail from '@adonisjs/mail/services/main'
import ReportTemplate from '#models/report_template'
import { generateReportValidator } from '#validators/report'

export default class ReportsController {
  async generate({ request, response }: HttpContext) {
    const { templateId, data, email, filename = 'relatorio.pdf' } = await request.validateUsing(
      generateReportValidator
    )

    const row = await ReportTemplate.find(templateId)
    if (!row) return response.notFound({ error: 'Template não encontrado' })

    let pdfBytes: Uint8Array
    try {
      // Junta o template salvo com o dado real e gera o PDF — puro JS,
      // mesma função que o preview do Designer usa no navegador.
      pdfBytes = await generatePdf(row.template, data, row.bindings)
    } catch (err) {
      // erro de conteúdo (ex: imagem de fundo corrompida, ver generate.ts)
      // vira 422, não 500 — template tá ok, o DADO que chegou é que não
      // bateu com o que o template espera.
      return response.unprocessableEntity({ error: String(err) })
    }

    await mail.send((message) => {
      message.to(email).subject('Seu relatório').attachData(Buffer.from(pdfBytes), { filename })
    })

    return response.accepted({ ok: true })
  }
}
```

Sem DOM, sem `canvas` do navegador, sem `document` — `generatePdf` só usa
`pdf-lib`/`fontkit`, que rodam em Node normalmente (Adonis roda em Node,
então importa igual qualquer outro pacote). `downloadPdf` (o
`URL.createObjectURL`/`<a download>`) é a ÚNICA função do pacote que só
funciona no navegador — o backend nunca chama essa, só `generatePdf` +
`Buffer.from(bytes)`.

### Fonte customizada no backend

Se o template usa `fontBytes` (acentuação/Unicode completo — ver
`docs/USAGE.pt-BR.md`), carregue o `.ttf`/`.otf` do disco em vez de `fetch`,
uma vez só num provider/setup (não a cada request):

```ts
// providers/pdf_fonts_provider.ts (ou um singleton simples)
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'

export let reportFontBytes: Uint8Array

export async function loadReportFont() {
  reportFontBytes = await readFile(app.makePath('resources/fonts/inter-regular.ttf'))
}
```

```ts
pdfBytes = await generatePdf(row.template, data, row.bindings, { fontBytes: reportFontBytes })
```

## 4. Contrato de API sugerido

| Rota | O que faz |
| --- | --- |
| `POST /api/templates` | Cria um template novo (`{ name, template, bindings }`) |
| `PUT /api/templates/:id` | Atualiza um template existente |
| `GET /api/templates/:id` | Carrega `{ template, bindings }` de volta pro `<Designer>` editar |
| `GET /api/templates` | Lista (nome + id) pra um seletor no frontend |
| `POST /api/reports/generate` | Junta `templateId` + `data`, gera o PDF, manda e-mail |

## 5. Segurança

- **Nunca aceite `template`/`bindings` no corpo do `/reports/generate`** —
  só o `templateId`. Se o cliente puder mandar o template junto, ele
  controla o que o servidor desenha (inclusive `backgroundImage` — base64
  arbitrário) e quanto processamento uma seção repetida gigante consome.
  O template só muda pelas rotas de `/templates`, que devem exigir o mesmo
  dono/tenant autenticado que criou aquele template.
- **Limite o tamanho de `data`** (body-parser com `limit`, ex. 2–5MB) — uma
  seção repetida itera o array inteiro; um array absurdo vira um PDF de
  milhares de páginas e trava o processo.
- **`email` sempre validado** (formato +, se fizer sentido, pertence ao
  mesmo tenant do template) antes de mandar — evita virar relay de spam.
- Log de auditoria simples (quem gerou, `templateId`, timestamp,
  destinatário) — útil pra debugar "cadê meu relatório" sem guardar o PDF
  inteiro.

## 6. Síncrono ou em fila?

Pra templates pequenos (poucas páginas), gerar e mandar o e-mail dentro do
próprio controller (como acima) é suficiente — `generatePdf` de um
relatório comum roda em milissegundos. Se o catálogo tiver templates
pesados ou o volume de disparos for alto, tire a geração de dentro do
ciclo request/response: o controller só grava a solicitação com
`status = "pendente"` e responde na hora; um worker em segundo plano (um
consumidor de fila, um job cron, o que seu projeto já usar pra rodar
trabalho agendado/em segundo plano) faz o poll das solicitações
pendentes e processa. O mecanismo de agendamento exato não importa — o
que importa é o formato abaixo.

Tabela de solicitações:

```ts
// database/migrations/xxxx_create_report_requests_table.ts
this.schema.createTable('report_requests', (table) => {
  table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
  table.uuid('template_id').notNullable().references('id').inTable('report_templates')
  table.jsonb('data').notNullable()
  table.string('email').notNullable()
  table.string('filename').nullable()
  table.enum('status', ['pendente', 'concluido', 'erro']).notNullable().defaultTo('pendente')
  table.text('error_message').nullable()
  table.timestamp('processed_at').nullable()
  table.timestamp('created_at')
  table.timestamp('updated_at')
})
```

O controller só cria a solicitação (sem gerar nada síncrono):

```ts
async generate({ request, response }: HttpContext) {
  const payload = await request.validateUsing(generateReportValidator)
  const row = await ReportTemplate.find(payload.templateId)
  if (!row) return response.notFound({ error: 'Template não encontrado' })

  const reportRequest = await ReportRequest.create({ ...payload, status: 'pendente' })
  return response.accepted({ id: reportRequest.id })
}
```

O que quer que rode seus jobs em segundo plano pega as solicitações
pendentes e faz o trabalho de verdade:

```ts
// jobs/generate_report_job.ts
import { generatePdf } from 'json-pdf-designer'
import mail from '@adonisjs/mail/services/main'
import ReportRequest from '#models/report_request'

export default class GenerateReportJob {
  async handle() {
    const pending = await ReportRequest.query().where('status', 'pendente').preload('template')

    for (const reportRequest of pending) {
      try {
        const pdfBytes = await generatePdf(
          reportRequest.template.template,
          reportRequest.data,
          reportRequest.template.bindings
        )
        await mail.send((message) => {
          message
            .to(reportRequest.email)
            .subject('Seu relatório')
            .attachData(Buffer.from(pdfBytes), { filename: reportRequest.filename ?? 'relatorio.pdf' })
        })
        reportRequest.status = 'concluido'
        reportRequest.processedAt = DateTime.now()
      } catch (err) {
        reportRequest.status = 'erro'
        reportRequest.errorMessage = String(err)
      }
      await reportRequest.save()
    }
  }
}
```

Encaixe esse job na infraestrutura de agendamento que seu projeto já
tiver (uma entrada de cron, um worker de fila, um runner de tarefa
agendada) — rodar a cada poucos minutos já basta pra um relatório sob
demanda. Se o volume justificar reagir na hora em vez de esperar o
próximo tick, publique um evento/mensagem quando a solicitação é criada
e faça o worker reagir a isso em vez de (ou além de) fazer poll — mas
pra maioria dos casos de relatório sob demanda, um intervalo de poll
curto já é mais simples e suficiente.

## 7. Compatibilidade de versão do template

Templates salvos ficam armazenados por tempo indeterminado, mas o pacote
evolui (novos tipos de campo, novas opções). O modelo de dados já foi
desenhado pra isso: campos novos em `ChartSchema`/`KpiSchema` (`pieStyle`,
`legendPosition`, `sortBy`, ícone, etc.) são sempre **opcionais**, com um
default aplicado na hora de desenhar quando ausentes (ver
`docs/ARCHITECTURE.pt-BR.md`) — atualizar o pacote no backend não quebra
template salvo antes do campo existir. Ainda assim, é uma boa guardar a
versão do pacote (`package.json` do backend) junto do log de geração, pra
saber com qual versão um PDF específico foi gerado se algum dia precisar
investigar uma diferença visual.
