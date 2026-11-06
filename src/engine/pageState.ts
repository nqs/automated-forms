/**
 * Browser-side function that captures what the runner needs to know about a
 * page without involving the model. It is serialised and executed inside the
 * page by Stagehand's `page.evaluate`, so it must be self-contained.
 */
export function capturePageState() {
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

  const h1 = document.querySelector("h1");
  const legend = document.querySelector("fieldset legend");
  const heading = clean(h1?.textContent) || clean(legend?.textContent) || clean(document.title);

  const errors: { field?: string; message: string }[] = [];
  const summary = document.querySelector(".govuk-error-summary, [role='alert'].error-summary, .error-summary");
  if (summary) {
    summary.querySelectorAll("li, a").forEach((node) => {
      const message = clean(node.textContent);
      if (!message) return;
      const href = node.getAttribute("href") ?? undefined;
      if (!errors.some((e) => e.message === message)) {
        errors.push({ field: href?.replace(/^#/, ""), message });
      }
    });
  }
  document.querySelectorAll(".govuk-error-message, .error-message").forEach((node) => {
    const message = clean(node.textContent).replace(/^Error:\s*/i, "");
    if (message && !errors.some((e) => e.message === message)) {
      const field = node.id?.replace(/-error$/, "") || undefined;
      errors.push({ field, message });
    }
  });

  const body = document.querySelector("main") ?? document.body;
  return {
    url: location.href,
    title: clean(document.title),
    heading,
    bodyText: clean(body?.innerText ?? body?.textContent ?? "").slice(0, 20_000),
    errors,
  };
}

/** Browser-side: flag the current document so a later check can tell whether a navigation replaced it. */
export function markDocument() {
  (window as unknown as { __afDoc?: boolean }).__afDoc = true;
}

/** Browser-side: true once the marked document has been replaced (or was never marked). */
export function documentReplaced() {
  return !(window as unknown as { __afDoc?: boolean }).__afDoc;
}

/** Browser-side: click the first button/link whose visible text matches. */
export function clickButtonMatching(pattern: string) {
  const re = new RegExp(pattern, "i");
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "button, input[type=submit], input[type=button], a.govuk-button, [role=button]",
    ),
  );
  const target = candidates.find((el) => {
    const text = (el.textContent || (el as HTMLInputElement).value || "").replace(/\s+/g, " ").trim();
    return re.test(text) && el.offsetParent !== null;
  });
  if (!target) return false;
  target.click();
  return true;
}

/**
 * Serialise a browser-side function (optionally applied to one JSON argument)
 * into a self-contained expression string. Bundlers such as esbuild (used by
 * tsx and vitest) may inject a `__name` helper into function bodies; defining
 * it inline keeps the serialised code runnable inside the page.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function browserExpression(fn: Function, arg?: unknown): string {
  const args = arg === undefined ? "" : JSON.stringify(arg);
  return `(() => { const __name = (f) => f; return (${fn.toString()})(${args}); })()`;
}
