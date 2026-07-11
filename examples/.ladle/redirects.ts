/**
 * Legacy-slug redirect map.
 *
 * Maps an old published `?story=` slug to its new gallery destination. Under
 * the big-bang rollout (see plans/ladle-gallery/00-overview.md, constraint
 * C4), the public site only changes at the final flip, so every deleted
 * story's slug must still resolve. Each PR that DELETES a story file adds its
 * entries here in the same commit, keeping the branch internally consistent.
 *
 * The provider reads `?story=` on mount; if it matches a key, it replaces the
 * URL with `?story=<story>` (plus `#<hash>` when set) and lets Ladle navigate.
 *
 * This starts EMPTY. The proving-ground pass (Bar & Column) adds the first
 * batch of entries for the story files it deletes.
 */
export type Redirect = { story: string; hash?: string };

export const redirects: Record<string, Redirect> = {};
