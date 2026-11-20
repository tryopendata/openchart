/** Demo spec validation, as the build runs it before rendering a figure. */
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { InvalidDemoError, validateDemo } from "./validate";

describe("validateDemo", () => {
  it.each([fixtureBar, fixtureTable])("accepts the valid spec of $id", ({ id, spec }) => {
    expect(() => validateDemo(id, spec)).not.toThrow();
  });

  it("throws InvalidDemoError naming the demo and listing every problem", () => {
    const spec = { mark: "bar", data: [{ a: 1 }], encoding: { x: { field: "missing" } } };
    let thrown: unknown;
    try {
      validateDemo("comparison/broken", spec);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InvalidDemoError);
    const { message, problems } = thrown as InvalidDemoError;
    expect(problems.length).toBeGreaterThan(0);
    expect(message.split("\n")[0]).toBe('Demo "comparison/broken" has an invalid spec:');
    for (const problem of problems) expect(message).toContain(problem.message);
  });
});
