/**
 * Pure reducer for the hands-on hero desk state: tracks the active editorial
 * form and fuel spotlight with no autoplay or timer state. Switching forms
 * preserves the spotlight, switching spotlights preserves the form, and
 * toggling the active fuel returns to the all-sources overview.
 */

import {
  DEFAULT_HERO_FORM,
  DEFAULT_HERO_SPOTLIGHT,
  type HeroFormId,
  type HeroFuel,
  type HeroSpotlight,
} from "../../../landing/hero";

/** The hero desk's interactive state: active editorial form and fuel spotlight. */
export type DeskState = {
  form: HeroFormId;
  spotlight: HeroSpotlight;
};

/** Actions dispatched by the form tabs, spotlight picker and data table rows. */
export type DeskAction =
  | { type: "set-form"; form: HeroFormId }
  | { type: "set-spotlight"; spotlight: HeroSpotlight }
  | { type: "toggle-spotlight"; fuel: HeroFuel };

/** Initial desk state rendered on the server and on first client mount. */
export const INITIAL_DESK_STATE: DeskState = {
  form: DEFAULT_HERO_FORM,
  spotlight: DEFAULT_HERO_SPOTLIGHT,
};

/** Applies one desk action to produce the next immutable hero desk state. */
export function deskReducer(state: DeskState, action: DeskAction): DeskState {
  switch (action.type) {
    case "set-form":
      return state.form === action.form ? state : { ...state, form: action.form };
    case "set-spotlight":
      return state.spotlight === action.spotlight
        ? state
        : { ...state, spotlight: action.spotlight };
    case "toggle-spotlight":
      return {
        ...state,
        spotlight: state.spotlight === action.fuel ? "all" : action.fuel,
      };
  }
}
