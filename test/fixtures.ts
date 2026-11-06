import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export function exampleApplication(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(here, "..", "examples", "application.example.json"), "utf8")) as Record<string, unknown>;
}

export function tmpDir(name: string): string {
  return join(here, "..", "runs", "test", `${name}-${Date.now()}`);
}
