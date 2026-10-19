/**
 * Data-update transitions (Phase 7). Newly-added nodes fade in over
 * `update.duration` (quantized for fill batching); removed nodes and edges
 * linger as ghost marks fading out over `exit.duration`. Both are read into
 * the render state and drawn by the canvas renderer.
 */

import type { GraphCompilation } from '@opendata-ai/openchart-engine';
import type { AnimationScheduler } from '../motion/scheduler';
import { createTween, prefersReducedMotion, resolveEase } from '../motion/tween';
import type { GraphRenderState, PositionedEdge, PositionedNode } from './types';
import type { diffGraphUpdate } from './update-diff';

export interface GraphUpdateFades {
  /**
   * Start the enter-fade and the exit-ghost fade for one update. Snaps
   * instantly under reduced motion or when the phase is disabled.
   */
  start(diff: ReturnType<typeof diffGraphUpdate>, compilation: GraphCompilation): void;
  /** Drop fade state; the caller has already stopped or finished the tweens. */
  clear(): void;
  /** The fade fields of one frame's render state. */
  frame(): Pick<GraphRenderState, 'enterAlpha' | 'exiting'>;
}

export function createGraphUpdateFades(
  scheduler: AnimationScheduler,
  invalidate: () => void,
): GraphUpdateFades {
  // Null when no enter-fade is live.
  let enterAlphaMap: Map<string, number> | null = null;
  let exitingGhosts: { nodes: PositionedNode[]; edges: PositionedEdge[]; alpha: number } | null =
    null;

  function start(diff: ReturnType<typeof diffGraphUpdate>, compilation: GraphCompilation): void {
    const updateCfg = compilation.animation?.update ?? null;
    const exitCfg = compilation.animation?.exit ?? null;
    const reduced = prefersReducedMotion();

    // -- Enter fade --
    if (diff.enteringIds.length > 0 && updateCfg && !reduced) {
      const entering = diff.enteringIds;
      enterAlphaMap = new Map(entering.map((id) => [id, 0]));
      const ease = resolveEase(updateCfg.ease);
      const tween = createTween({
        duration: updateCfg.duration,
        ease,
        apply: (t) => {
          // Quantize to 8 buckets so per-node alpha keeps fill-batching bounded.
          const q = Math.round(t * 8) / 8;
          if (enterAlphaMap) for (const id of entering) enterAlphaMap.set(id, q);
          invalidate();
        },
        onDone: () => {
          enterAlphaMap = null;
          invalidate();
        },
      });
      scheduler.add(tween);
    }

    // -- Exit ghosts --
    if ((diff.exitingNodes.length > 0 || diff.exitingEdges.length > 0) && exitCfg && !reduced) {
      exitingGhosts = { nodes: diff.exitingNodes, edges: diff.exitingEdges, alpha: 1 };
      const ease = resolveEase(exitCfg.ease);
      const tween = createTween({
        duration: exitCfg.duration,
        ease,
        apply: (t) => {
          if (exitingGhosts) exitingGhosts.alpha = 1 - t;
          invalidate();
        },
        onDone: () => {
          exitingGhosts = null;
          invalidate();
        },
      });
      scheduler.add(tween);
    }
  }

  return {
    start,
    clear() {
      enterAlphaMap = null;
      exitingGhosts = null;
    },
    frame() {
      return { enterAlpha: enterAlphaMap ?? undefined, exiting: exitingGhosts ?? undefined };
    },
  };
}
