/**
 * The event catalog. track() accepts only these names. Name events object_verb in
 * the past tense (install_copied) and keep properties snake_case. No SDK import here,
 * so server code and tests can read the catalog without loading posthog-js.
 */

export const Events = {
  exampleViewed: "example_viewed",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

// Property values are flat scalars: never free text a user typed, emails or tokens.
export type EventProps = Record<string, string | number | boolean | null>;
