/**
 * Validates a demo spec with the library's own `validateSpec`, so a bad spec
 * fails the build with every problem listed instead of rendering a broken chart.
 */
import { isRaceSpec } from "@opendata-ai/openchart-core";
import { prepareRace, type ValidationError, validateSpec } from "@opendata-ai/openchart-engine";

/** Thrown when a demo's spec fails validation. The message lists every problem and the demo id. */
export class InvalidDemoError extends Error {
  /** The validator's findings, for callers that want them structured. */
  readonly problems: readonly ValidationError[];

  constructor(id: string, problems: readonly ValidationError[], options?: ErrorOptions) {
    super(
      `Demo "${id}" has an invalid spec:\n${problems.map(describeProblem).join("\n")}`,
      options,
    );
    this.name = "InvalidDemoError";
    this.problems = problems;
  }
}

function describeProblem({ path, message, suggestion }: ValidationError): string {
  const where = path === "" ? "(spec root)" : path;
  return `- ${where}: ${message}${suggestion ? ` ${suggestion}` : ""}`;
}

/**
 * Checks a demo spec.
 *
 * @throws {InvalidDemoError} When the spec is not a valid VizSpec.
 */
export function validateDemo(id: string, spec: unknown): void {
  const { valid, errors } = validateSpec(spec);
  if (!valid) throw new InvalidDemoError(id, errors);
  if (!isRaceSpec(spec)) return;
  // State specs don't get a static render. Check the data rules here for every race.
  try {
    prepareRace(spec, {});
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new InvalidDemoError(id, [{ path: "", code: "INVALID_VALUE", message, suggestion: "" }], {
      cause,
    });
  }
}
