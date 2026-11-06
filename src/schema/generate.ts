import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { skilledWorkerApplication } from "./application.js";
import { applicationStatusReport } from "./status.js";

/** Emit JSON Schema files for the input and output documents into ./schemas. */
export async function generateSchemas(outDir = join(process.cwd(), "schemas")): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const input = z.toJSONSchema(skilledWorkerApplication, { io: "input", unrepresentable: "any" });
  const output = z.toJSONSchema(applicationStatusReport, { io: "output", unrepresentable: "any" });
  const files = [
    [join(outDir, "skilled-worker-application.schema.json"), { $id: "https://example.invalid/schemas/skilled-worker-application.schema.json", title: "UK Skilled Worker visa application input", ...input }],
    [join(outDir, "application-status.schema.json"), { $id: "https://example.invalid/schemas/application-status.schema.json", title: "UK visa automation status report", ...output }],
  ] as const;
  for (const [path, schema] of files) await writeFile(path, JSON.stringify(schema, null, 2) + "\n");
  return files.map(([path]) => path);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateSchemas().then((files) => files.forEach((f) => console.log(`wrote ${f}`)));
}
