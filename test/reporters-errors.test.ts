import { describe, expect, it } from "vitest";
import { MultipassError, ensureErrorMessage } from "../src/core/errors.js";
import { EXIT_CODES } from "../src/core/exit-codes.js";
import { formatJson, formatRunResultText } from "../src/core/reporters.js";

describe("errors and reporters", () => {
  it("maps failure kinds to exit codes", () => {
    const error = new MultipassError("boom", { kind: "auth" });
    expect(error.exitCode).toBe(EXIT_CODES.AUTH);
    expect(ensureErrorMessage(error)).toBe("boom");
    expect(ensureErrorMessage("plain")).toBe("plain");
  });

  it("formats single and suite results", () => {
    const single = formatRunResultText({
      diagnostics: ["accepted"],
      fixtureId: "fixture",
      mode: "send",
      ok: true,
      providerId: "local",
    });
    const suite = formatRunResultText({
      results: [
        {
          diagnostics: [],
          fixtureId: "fixture",
          mode: "send",
          ok: true,
          providerId: "local",
        },
      ],
      totalPassed: 1,
    });

    expect(single).toContain("PASS");
    expect(suite).toContain("suite 1/1 passed");
    expect(formatJson({ ok: true })).toContain('"ok": true');
  });
});
