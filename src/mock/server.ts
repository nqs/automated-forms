import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
import { START_PAGE, mockPages, pagesById, type MockField, type MockPage } from "./pages.js";

/**
 * A self-contained, dependency-free mock of the Home Office online form.
 * Multi-page, GOV.UK-styled, with required-field validation and an error
 * summary, repeating groups, a GWF reference and a UAN on completion.
 *
 * Start it with `npm run mock-server` and point the automation at it with
 * `--start-url http://localhost:3999/`.
 */

interface Session {
  answers: Record<string, string>;
  groups: Record<string, Record<string, string>[]>;
  gwf: string;
  uan: string;
  submitted: boolean;
}

const sessions = new Map<string, Session>();

function newSession(): [string, Session] {
  const id = randomBytes(8).toString("hex");
  const session: Session = {
    answers: {},
    groups: {},
    gwf: String(randomInt(100_000_000, 999_999_999)),
    uan: `${rnd4()}-${rnd4()}-${rnd4()}-${rnd4()}`,
    submitted: false,
  };
  sessions.set(id, session);
  return [id, session];
}

function rnd4() {
  return String(randomInt(1000, 9999));
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `
body{font-family:Arial,sans-serif;margin:0;background:#fff;color:#0b0c0c}
header{background:#0b0c0c;color:#fff;padding:10px 0;border-bottom:10px solid #1d70b8}
.w{max-width:960px;margin:0 auto;padding:0 15px}
main{padding:30px 0 60px}
h1{font-size:2rem;margin:0 0 20px}
.hint{color:#505a5f;margin:0 0 10px}
.group{margin-bottom:30px}
.group.err{border-left:5px solid #d4351c;padding-left:15px}
label,legend{display:block;font-weight:700;margin-bottom:5px;font-size:1.1rem}
input[type=text],input[type=email],input[type=password],textarea,select{font-size:1.1rem;padding:5px;border:2px solid #0b0c0c;min-width:60%}
.date input{min-width:0;width:4em;margin-right:10px}
.date label{font-weight:400;display:inline-block}
.opt{display:block;margin:8px 0;font-weight:400}
.opt input{margin-right:8px;transform:scale(1.4)}
.govuk-button{background:#00703c;color:#fff;border:0;padding:10px 15px;font-size:1.2rem;cursor:pointer;box-shadow:0 2px 0 #002d18}
.govuk-error-summary{border:5px solid #d4351c;padding:15px;margin-bottom:30px}
.govuk-error-summary h2{margin:0 0 10px}
.govuk-error-message{color:#d4351c;font-weight:700}
.ref{font-size:1.5rem;font-weight:700}
`;

function render(session: Session, page: MockPage, sid: string, errors: { field: string; message: string }[], values: Record<string, string>) {
  const sub = (s: string) =>
    s
      .replace("{{GWF}}", session.gwf)
      .replace("{{UAN}}", session.uan)
      .replace(/\{\{COUNT:(\w+)\}\}/g, (_, g: string) => String(session.groups[g]?.length ?? 0));
  const heading = sub(page.heading);
  const errorSummary = errors.length
    ? `<div class="govuk-error-summary" role="alert"><h2>There is a problem</h2><ul>${errors.map((e) => `<li><a href="#${e.field}">${escape(e.message)}</a></li>`).join("")}</ul></div>`
    : "";
  const fields = page.fields.map((f) => renderField(f, values, errors.find((e) => e.field === f.name)?.message)).join("");
  const button = page.button ?? "Continue";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(heading)} - Apply for a UK visa - GOV.UK</title><style>${CSS}</style></head>
<body><header><div class="w"><strong>GOV.UK</strong> &nbsp; Apply for a UK visa (mock)</div></header>
<main class="w"><form method="post" action="/${page.id}?s=${sid}" novalidate>
${errorSummary}
<h1>${escape(heading)}</h1>
${page.body ? `<p class="${page.id === "reference" || page.id === "done" ? "ref" : ""}">${escape(sub(page.body))}</p>` : ""}
${fields}
<button type="submit" class="govuk-button">${escape(button)}</button>
</form></main></body></html>`;
}

function renderField(f: MockField, values: Record<string, string>, error?: string): string {
  const err = error ? `<p class="govuk-error-message" id="${f.name}-error">Error: ${escape(error)}</p>` : "";
  const hint = f.hint ? `<p class="hint">${escape(f.hint)}</p>` : "";
  const cls = `group${error ? " err" : ""}`;
  const v = values[f.name] ?? "";
  switch (f.type) {
    case "text":
    case "email":
    case "password":
      return `<div class="${cls}"><label for="${f.name}">${escape(f.label)}</label>${hint}${err}<input type="${f.type}" id="${f.name}" name="${f.name}" value="${escape(f.type === "password" ? "" : v)}"></div>`;
    case "textarea":
      return `<div class="${cls}"><label for="${f.name}">${escape(f.label)}</label>${hint}${err}<textarea id="${f.name}" name="${f.name}" rows="4">${escape(v)}</textarea></div>`;
    case "select":
      return `<div class="${cls}"><label for="${f.name}">${escape(f.label)}</label>${hint}${err}<select id="${f.name}" name="${f.name}"><option value="">Select a country</option>${(f.options ?? [])
        .map((o) => `<option value="${escape(o)}"${o === v ? " selected" : ""}>${escape(o)}</option>`)
        .join("")}</select></div>`;
    case "radio":
    case "checkbox":
      return `<div class="${cls}"><fieldset><legend>${escape(f.label)}</legend>${hint}${err}${(f.options ?? [])
        .map((o, i) => {
          const id = `${f.name}-${i}`;
          const checked = f.type === "radio" ? v === o : v.split("|").includes(o);
          return `<label class="opt" for="${id}"><input type="${f.type}" id="${id}" name="${f.name}" value="${escape(o)}"${checked ? " checked" : ""}>${escape(o)}</label>`;
        })
        .join("")}</fieldset></div>`;
    case "date": {
      const [y = "", m = "", d = ""] = v.split("-");
      return `<div class="${cls}"><fieldset class="date"><legend>${escape(f.label)}</legend>${hint}${err}
<label for="${f.name}-day">Day</label><input type="text" id="${f.name}-day" name="${f.name}-day" value="${escape(d)}" inputmode="numeric">
<label for="${f.name}-month">Month</label><input type="text" id="${f.name}-month" name="${f.name}-month" value="${escape(m)}" inputmode="numeric">
<label for="${f.name}-year">Year</label><input type="text" id="${f.name}-year" name="${f.name}-year" value="${escape(y)}" inputmode="numeric">
</fieldset></div>`;
    }
  }
}

function validate(page: MockPage, body: URLSearchParams): { values: Record<string, string>; errors: { field: string; message: string }[] } {
  const values: Record<string, string> = {};
  const errors: { field: string; message: string }[] = [];
  for (const f of page.fields) {
    const required = f.required ?? true;
    if (f.type === "date") {
      const d = body.get(`${f.name}-day`)?.trim() ?? "";
      const m = body.get(`${f.name}-month`)?.trim() ?? "";
      const y = body.get(`${f.name}-year`)?.trim() ?? "";
      if (!d && !m && !y) {
        if (required) errors.push({ field: `${f.name}-day`, message: `Enter ${f.label.replace(/\?$/, "").toLowerCase()}` });
        continue;
      }
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      if (!y || !m || !d || Number.isNaN(date.getTime()) || y.length !== 4) {
        errors.push({ field: `${f.name}-day`, message: `${f.label.replace(/\?$/, "")} must be a real date` });
        continue;
      }
      values[f.name] = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      continue;
    }
    const raw = f.type === "checkbox" ? body.getAll(f.name).join("|") : (body.get(f.name) ?? "").trim();
    if (!raw) {
      if (required) errors.push({ field: f.name, message: f.type === "radio" || f.type === "checkbox" || f.type === "select" ? `Select ${f.label.replace(/\?$/, "").toLowerCase()}` : `Enter ${f.label.replace(/ \(optional\)/i, "").toLowerCase()}` });
      continue;
    }
    if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) errors.push({ field: f.name, message: "Enter an email address in the correct format" });
    if (f.type === "password" && raw.length < 8) errors.push({ field: f.name, message: "Password must be at least 8 characters" });
    if (f.mustMatch && raw !== (body.get(f.mustMatch) ?? "").trim()) errors.push({ field: f.name, message: `${f.label} must match` });
    values[f.name] = raw;
  }
  return { values, errors };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function createMockServer(): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (status: number, html: string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
      res.end(html);
    };
    const redirect = (to: string) => send(303, "", { location: to });

    let sid = url.searchParams.get("s");
    let session = sid ? sessions.get(sid) : undefined;
    if (!session) {
      [sid, session] = newSession();
      return redirect(`/${START_PAGE}?s=${sid}`);
    }

    const pageId = url.pathname.replace(/^\//, "") || START_PAGE;
    const page = pagesById.get(pageId);
    if (!page) return send(404, "<h1>Page not found</h1>");

    if (req.method === "GET") {
      return send(200, render(session, page, sid!, [], session.answers));
    }

    const body = new URLSearchParams(await readBody(req));
    const { values, errors } = validate(page, body);
    if (errors.length) return send(200, render(session, page, sid!, errors, { ...session.answers, ...values }));

    Object.assign(session.answers, values);
    if (page.repeat) {
      (session.groups[page.repeat.group] ??= []).push(values);
      // Clear the item fields so the next item starts blank.
      for (const f of page.fields) delete session.answers[f.name];
    }
    if (page.id === "pay") session.submitted = true;
    const next = typeof page.next === "function" ? page.next(session.answers) : page.next;
    return redirect(`/${next}?s=${sid}`);
  });
}

export function startMockServer(port = 0): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createMockServer();
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({ server, url: `http://127.0.0.1:${actualPort}/` });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3999);
  startMockServer(port).then(({ url }) => console.log(`Mock Skilled Worker form running at ${url} (${mockPages.length} pages)`));
}
