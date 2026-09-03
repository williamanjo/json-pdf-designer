**English** | [Português](BACKEND_INTEGRATION.pt-BR.md)

# Integration: frontend with the Designer + backend generating the PDF

How to use `json-pdf-designer` in a system split into two parts: a
**frontend** where the user designs the template (the usual
`<Designer>`) and saves the result, and a **backend/API** that, given a
`templateId` + the real data, brings the two together, generates the
PDF, and emails it out. The key point that makes this work without any
hack: **`generatePdf` is plain JS (pdf-lib) — it runs in Node exactly
the same way it runs in the browser**, no headless browser, no
Puppeteer, nothing extra.

## Overview

```
┌─────────────────────┐        saves {template, bindings}         ┌──────────────┐
│  Frontend (Designer) │ ───────────────────────────────────────▶│   Database   │
│  <Designer/>          │◀─────────────────────────────────────── │              │
└─────────────────────┘        loads it back up to edit again      └──────┬───────┘
                                                                         │ looked up
                                                                         │ by templateId
┌─────────────────────┐   POST /reports/generate                        │
│  Whoever triggers    │   { templateId, data, email }          ┌──────▼───────┐
│  the report (your    │ ───────────────────────────────────────▶│   Backend    │
│  app, a cron job,     │                                         │   (API)      │
│  another service...) │                                         │              │
└─────────────────────┘                                          │ 1. fetch      │
                                                                   │    template   │
                                                                   │ 2. generatePdf│
                                                                   │ 3. send email │
                                                                   └──────────────┘
```

Two sources of truth, each owning only its own part:
- **Template + bindings (`Binding[]`)** — designed on the frontend,
  stored as JSON in the database. Holds no real data, just the structure
  (position, size, color, `{token}`/`{FUNCTION(...)}`).
- **Real data** — only exists at generation time; arrives in the body of
  the POST from whoever requested the report (your own backend, a
  webhook, another API).

## 1. Frontend — design and save the template

The frontend uses the package exactly like the examples
(`examples/report-builder`) already show — the only difference is that
"Save project" (which today downloads a `.json`) becomes a `POST`/`PUT`
to the API instead of a file:

```tsx
import { useState } from "react";
import { Designer, type Template, type Binding } from "json-pdf-designer";
import "json-pdf-designer/theme.css";

function TemplateEditorPage({ templateId }: { templateId?: string }) {
  const [template, setTemplate] = useState<Template>(/* loaded from the backend, or empty */);
  const [bindings, setBindings] = useState<Binding[]>([]);

  async function handleSave() {
    const method = templateId ? "PUT" : "POST";
    const url = templateId ? `/api/templates/${templateId}` : "/api/templates";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Default receipt", template, bindings }),
    });
  }

  return (
    <>
      <Designer template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
      <button onClick={handleSave}>Save</button>
    </>
  );
}
```

`template`/`bindings` are just serializable JS objects (`JSON.stringify`
directly, no class/function hidden inside) — safe to store as they are.

**Preview on the frontend** (optional, with sample data) works exactly
like it already does: `generatePdf(template, data, bindings)` +
`<PdfPreview>`, running in the user's own browser while they design —
completely unrelated to the real generation the backend will do later.

## 2. Database — migration + model (Lucid)

A single table, one row per template. Migration:

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

A `jsonb` column + the `pg` driver already hands back/accepts a plain JS
object (no manual `JSON.parse`/`stringify`) — `row.template`/
`row.bindings` come out of the database in the exact same shape
`<Designer>` produced and `generatePdf` expects. No real report data
ever lives in this table, just the design.

## 3. Backend — route + controller that generates and emails it

Route:

```ts
// start/routes.ts
import router from '@adonisjs/core/services/router'
import ReportsController from '#controllers/reports_controller'

router.post('/api/reports/generate', [ReportsController, 'generate'])
```

Payload validation (VineJS):

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

Controller — only `templateId` arrives alongside `data`/`email`; the
template itself is always read from the database, never from the
request (see "Security" below):

```ts
// app/controllers/reports_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { generatePdf } from 'json-pdf-designer'
import mail from '@adonisjs/mail/services/main'
import ReportTemplate from '#models/report_template'
import { generateReportValidator } from '#validators/report'

export default class ReportsController {
  async generate({ request, response }: HttpContext) {
    const { templateId, data, email, filename = 'report.pdf' } = await request.validateUsing(
      generateReportValidator
    )

    const row = await ReportTemplate.find(templateId)
    if (!row) return response.notFound({ error: 'Template not found' })

    let pdfBytes: Uint8Array
    try {
      // Combines the saved template with the real data and generates the
      // PDF — plain JS, the same function the Designer's own preview uses
      // in the browser.
      pdfBytes = await generatePdf(row.template, data, row.bindings)
    } catch (err) {
      // A content error (e.g. a corrupted background image, see
      // generate.ts) becomes a 422, not a 500 — the template is fine, the
      // DATA that arrived just didn't match what the template expects.
      return response.unprocessableEntity({ error: String(err) })
    }

    await mail.send((message) => {
      message.to(email).subject('Your report').attachData(Buffer.from(pdfBytes), { filename })
    })

    return response.accepted({ ok: true })
  }
}
```

No DOM, no browser `canvas`, no `document` — `generatePdf` only uses
`pdf-lib`/`fontkit`, which run in Node like any other package (Adonis
runs on Node, so it imports the same as anything else). `downloadPdf`
(the `URL.createObjectURL`/`<a download>` one) is the ONLY function in
the package that's browser-only — the backend never calls that one,
just `generatePdf` + `Buffer.from(bytes)`.

### Custom font on the backend

If the template uses `fontBytes` (full accent/Unicode coverage — see
`docs/USAGE.md`), load the `.ttf`/`.otf` from disk instead of `fetch`,
once, in a provider/setup (not on every request):

```ts
// providers/pdf_fonts_provider.ts (or a simple singleton)
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

## 4. Suggested API contract

| Route | What it does |
| --- | --- |
| `POST /api/templates` | Creates a new template (`{ name, template, bindings }`) |
| `PUT /api/templates/:id` | Updates an existing template |
| `GET /api/templates/:id` | Loads `{ template, bindings }` back for `<Designer>` to edit |
| `GET /api/templates` | Lists (name + id) for a picker on the frontend |
| `POST /api/reports/generate` | Combines `templateId` + `data`, generates the PDF, emails it |

## 5. Security

- **Never accept `template`/`bindings` in the `/reports/generate` body**
  — only `templateId`. If the client could send the template along, it
  would control what the server draws (including `backgroundImage` —
  arbitrary base64) and how much processing a giant repeated section
  consumes. The template should only ever change through the
  `/templates` routes, which must require the same authenticated
  owner/tenant that created that template.
- **Cap the size of `data`** (body-parser with a `limit`, e.g. 2–5MB) —
  a repeated section iterates the whole array; an absurd array turns
  into a PDF with thousands of pages and hangs the process.
- **Always validate `email`** (format, and if it makes sense, that it
  belongs to the same tenant as the template) before sending — avoids
  turning the endpoint into a spam relay.
- A simple audit log (who generated it, `templateId`, timestamp,
  recipient) — useful for debugging a "where's my report" without
  storing the whole PDF.

## 6. Synchronous or queued?

For small templates (few pages), generating and emailing right inside
the controller (as above) is enough — `generatePdf` for a typical
report runs in milliseconds. If your catalog has heavy templates or the
volume of requests is high, move the actual generation off the request/
response cycle: the controller just writes the request row with
`status = "pending"` and responds immediately; a background worker (a
queue consumer, a cron job, whatever your project already uses to run
scheduled/background work) polls for pending rows and processes them.
The exact scheduling mechanism doesn't matter — what matters is the
shape below.

Requests table:

```ts
// database/migrations/xxxx_create_report_requests_table.ts
this.schema.createTable('report_requests', (table) => {
  table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
  table.uuid('template_id').notNullable().references('id').inTable('report_templates')
  table.jsonb('data').notNullable()
  table.string('email').notNullable()
  table.string('filename').nullable()
  table.enum('status', ['pending', 'done', 'error']).notNullable().defaultTo('pending')
  table.text('error_message').nullable()
  table.timestamp('processed_at').nullable()
  table.timestamp('created_at')
  table.timestamp('updated_at')
})
```

The controller only creates the request (nothing generated
synchronously):

```ts
async generate({ request, response }: HttpContext) {
  const payload = await request.validateUsing(generateReportValidator)
  const row = await ReportTemplate.find(payload.templateId)
  if (!row) return response.notFound({ error: 'Template not found' })

  const reportRequest = await ReportRequest.create({ ...payload, status: 'pending' })
  return response.accepted({ id: reportRequest.id })
}
```

Whatever runs your background jobs picks up the pending rows and does
the actual work:

```ts
// jobs/generate_report_job.ts
import { generatePdf } from 'json-pdf-designer'
import mail from '@adonisjs/mail/services/main'
import ReportRequest from '#models/report_request'

export default class GenerateReportJob {
  async handle() {
    const pending = await ReportRequest.query().where('status', 'pending').preload('template')

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
            .subject('Your report')
            .attachData(Buffer.from(pdfBytes), { filename: reportRequest.filename ?? 'report.pdf' })
        })
        reportRequest.status = 'done'
        reportRequest.processedAt = DateTime.now()
      } catch (err) {
        reportRequest.status = 'error'
        reportRequest.errorMessage = String(err)
      }
      await reportRequest.save()
    }
  }
}
```

Wire this job into whatever scheduling infrastructure your project
already has (a cron entry, a queue worker, a scheduled task runner) —
running it every few minutes is plenty for an on-demand report. If your
volume justifies reacting immediately instead of waiting for the next
tick, publish an event/message when the request is created and have the
worker react to that instead of (or in addition to) polling — but for
most on-demand-report use cases, a short poll interval is simpler and
good enough.

## 7. Template version compatibility

Saved templates stick around indefinitely, but the package evolves (new
field types, new options). The data model was already designed for
this: new fields on `ChartSchema`/`KpiSchema` (`pieStyle`,
`legendPosition`, `sortBy`, icon, etc.) are always **optional**, with a
default applied at draw time when absent (see
`docs/ARCHITECTURE.md`) — upgrading the package on the backend doesn't
break a template saved before that field existed. Still, it's worth
storing the package version (from the backend's own `package.json`)
alongside the generation log, so you know which version produced a
given PDF if you ever need to investigate a visual difference.
