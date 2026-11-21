/**
 * Pure reducer tests for the hands-on hero desk state: default Line + Coal view,
 * switching editorial forms while preserving spotlight, changing fuel spotlights,
 * and toggling a fuel row back to "all".
 */
import { describe, expect, it } from "vitest";
import { type DeskAction, type DeskState, deskReducer, INITIAL_DESK_STATE } from "./desk-state";

const run = (actions: DeskAction[], state: DeskState = INITIAL_DESK_STATE) =>
  actions.reduce(deskReducer, state);

describe("deskReducer", () => {
  it("starts on Line with Coal spotlighted", () => {
    expect(INITIAL_DESK_STATE).toEqual({ form: "line", spotlight: "Coal" });
  });

  it("switches editorial form while preserving the active spotlight", () => {
    expect(run([{ type: "set-form", form: "facets" }])).toEqual({
      form: "facets",
      spotlight: "Coal",
    });
    expect(
      run([
        { type: "set-spotlight", spotlight: "Solar" },
        { type: "set-form", form: "area" },
        { type: "set-form", form: "table" },
      ]),
    ).toEqual({ form: "table", spotlight: "Solar" });
  });

  it("switches spotlight while preserving the active form", () => {
    expect(
      run([
        { type: "set-form", form: "area" },
        { type: "set-spotlight", spotlight: "all" },
      ]),
    ).toEqual({ form: "area", spotlight: "all" });
  });

  it("toggles an inactive fuel on and toggles the active fuel back to all", () => {
    const gas = run([{ type: "toggle-spotlight", fuel: "Gas" }]);
    expect(gas).toEqual({ form: "line", spotlight: "Gas" });
    expect(deskReducer(gas, { type: "toggle-spotlight", fuel: "Gas" })).toEqual({
      form: "line",
      spotlight: "all",
    });
  });

  it("toggles the default Coal spotlight back to all on first toggle", () => {
    expect(run([{ type: "toggle-spotlight", fuel: "Coal" }])).toEqual({
      form: "line",
      spotlight: "all",
    });
  });
});
