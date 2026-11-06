#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runApplication } from "./engine/runner.js";
import { safeParseApplication } from "./schema/application.js";
import { generateSchemas } from "./schema/generate.js";
import type { FormDriver } from "./engine/driver.js";
import type { ResolvedRunOptions } from "./engine/types.js";

const USAGE = `ukvisa-apply <command> [options]

Commands
  run        Fill the application from a JSON document and write a status report
  validate   Check an input document against the schema and report problems
  schema     Write JSON Schema files for the input and output documents to ./schemas

Options for run
  --input <file>        Application JSON (required)
  --output <file>       Where to write the status report JSON (default: <artifacts>/status.json)
  --start-url <url>     Override the first page (e.g. a local mock form)
  --stop-at <point>     declaration (default) | payment | never
  --artifacts <dir>     Directory for screenshots and the report (default: ./runs/<timestamp>)
  --model <name>        Stagehand model, provider/model (default: $STAGEHAND_MODEL or anthropic/claude-opus-5-5)
  --driver <name>       stagehand (default) | heuristic (no model; DOM label matching, for the mock form and tests)
  --headed              Show the browser window
  --no-screenshots      Do not capture screenshots
  --max-pages <n>       Safety limit on pages visited (default 200)
  --verbose             Print per-page progress

Environment
  ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY   Key for the chosen model provider
  BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID           Run the browser on Browserbase instead of locally
  CHROME_PATH                                           Local Chrome/Chromium binary`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  const { values } = parseArgs({
    args: rest,
    options: {
      input: { type: "string" },
      output: { type: "string" },
      "start-url": { type: "string" },
      "stop-at": { type: "string" },
      artifacts: { type: "string" },
      model: { type: "string" },
      driver: { type: "string" },
      headed: { type: "boolean", default: false },
      "no-screenshots": { type: "boolean", default: false },
      "max-pages": { type: "string" },
      verbose: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (command === "schema") {
    const files = await generateSchemas();
    files.forEach((f) => console.log(`wrote ${f}`));
    return 0;
  }

  if (!values.input) {
    console.error("--input <file> is required");
    return 2;
  }
  const raw = JSON.parse(await readFile(resolve(values.input), "utf8")) as unknown;

  if (command === "validate") {
    const result = safeParseApplication(raw);
    if (result.success) {
      console.log("Input document is valid");
      return 0;
    }
    for (const issue of result.error.issues) console.error(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return 1;
  }

  if (command !== "run") {
    console.error(`Unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  const stopAt = (values["stop-at"] ?? "declaration") as "declaration" | "payment" | "never";
  if (!["declaration", "payment", "never"].includes(stopAt)) {
    console.error("--stop-at must be declaration, payment or never");
    return 2;
  }
  const modelName = (values.model ?? process.env.STAGEHAND_MODEL ?? "anthropic/claude-opus-5-5") as string;
  const log = values.verbose ? (m: string) => console.error(m) : undefined;

  const report = await runApplication(
    raw,
    {
      ...(values["start-url"] ? { startUrl: values["start-url"] } : {}),
      stopAt,
      ...(values.artifacts ? { artifactsDir: resolve(values.artifacts) } : {}),
      screenshots: !values["no-screenshots"],
      ...(values["max-pages"] ? { maxPages: Number(values["max-pages"]) } : {}),
      modelName,
      ...(log ? { log } : {}),
    },
    { createDriver: (opts) => createDriver(values.driver ?? "stagehand", opts, Boolean(values.headed)) },
  );

  const json = JSON.stringify(report, null, 2);
  if (values.output) {
    const out = resolve(values.output);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, json + "\n");
    console.error(`Status report written to ${out}`);
  }
  console.log(json);
  return report.status === "failed" ? 1 : 0;
}

async function createDriver(kind: string, opts: ResolvedRunOptions, headed: boolean): Promise<FormDriver> {
  if (kind === "heuristic") {
    const { HeuristicDriver } = await import("./engine/heuristicDriver.js");
    return HeuristicDriver.launch({ headless: !headed });
  }
  const { StagehandFormDriver } = await import("./engine/stagehandDriver.js");
  const modelName = opts.modelName as `${"openai" | "anthropic" | "google" | "groq" | "cerebras"}/${string}`;
  const provider = modelName.split("/")[0];
  const apiKey =
    provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : provider === "google" ? process.env.GOOGLE_API_KEY : process.env.MODEL_API_KEY;
  return StagehandFormDriver.launch({
    modelName,
    ...(apiKey ? { modelApiKey: apiKey } : {}),
    headless: !headed,
    ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}),
    ...(process.env.BROWSERBASE_API_KEY ? { browserbaseApiKey: process.env.BROWSERBASE_API_KEY } : {}),
    ...(process.env.BROWSERBASE_PROJECT_ID ? { browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID } : {}),
    verbose: Boolean(opts.log),
  });
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  },
);
