/**
 * Resolved simulationConfig equality for update-diff's visual-only detection.
 *
 * The old React heuristic only compared `clustering.field`, so a physics change
 * (charge strength, settle/energy, raw force numbers) with the same ids silently
 * took the position-preserving path and never reheated. That's a correctness bug
 * for the flagship API. Here we compare the FULL resolved config via a stable
 * stringify so any physics change forces a structural update.
 */

/** The subset of engine SimulationConfig fields that affect the simulation. */
export interface SimulationConfigLike {
  chargeStrength: number;
  linkDistance: number;
  clustering: { field: string; strength: number } | null;
  alphaDecay: number;
  velocityDecay: number;
  collisionRadius: number;
  collisionPadding?: number;
  linkStrength?: number;
  centerForce?: boolean;
  seed?: number;
  warmupTicks?: number;
  warmupBudgetMs?: number;
  initialAlpha?: number;
}

/**
 * A stable, key-ordered stringify of the config fields that influence the
 * settled layout. `initialAlpha` is INTENTIONALLY excluded: it's the update
 * reheat impulse the mount sets per-update, not a spec-level physics knob, so it
 * must not force a structural update on its own.
 */
function stableKey(c: SimulationConfigLike): string {
  return JSON.stringify([
    c.chargeStrength,
    c.linkDistance,
    c.clustering ? [c.clustering.field, c.clustering.strength] : null,
    c.alphaDecay,
    c.velocityDecay,
    c.collisionRadius,
    c.collisionPadding ?? null,
    c.linkStrength ?? null,
    c.centerForce ?? null,
    c.seed ?? null,
    c.warmupTicks ?? null,
    c.warmupBudgetMs ?? null,
  ]);
}

/** Deep-equal two resolved simulation configs (excluding `initialAlpha`). */
export function simulationConfigEqual(a: SimulationConfigLike, b: SimulationConfigLike): boolean {
  return stableKey(a) === stableKey(b);
}
