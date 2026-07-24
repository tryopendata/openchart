/**
 * happy-dom implements no canvas 2D context, so every scatter-canvas test that
 * paints needs a stub. Same shape as `graph/__tests__/graph-mount.test.ts`, but
 * recording: each call lands in `calls` so tests can assert on batching, paint
 * order, and clip geometry.
 */

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface CanvasStub {
  calls: RecordedCall[];
  /** Property assignments (fillStyle, globalAlpha, …) in order. */
  sets: { prop: string; value: unknown }[];
  /** Every call of one method, in order. */
  callsTo(method: string): RecordedCall[];
  restore(): void;
}

type CanvasProto = { getContext: (id: string) => unknown };

/**
 * Install a recording 2D context stub.
 *
 * @param contextResult `'stub'` (default) returns the recorder; `'null'` makes
 *   `getContext` return null so tests can exercise the no-context guard.
 */
export function stubCanvas2D(contextResult: 'stub' | 'null' = 'stub'): CanvasStub {
  const calls: RecordedCall[] = [];
  const sets: { prop: string; value: unknown }[] = [];

  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop) => {
      const name = String(prop);
      if (name === 'measureText') {
        return () => ({ width: 0 });
      }
      return (...args: unknown[]) => {
        calls.push({ method: name, args });
      };
    },
    set: (_t, prop, value) => {
      sets.push({ prop: String(prop), value });
      return true;
    },
  });

  const proto = HTMLCanvasElement.prototype as unknown as CanvasProto;
  const original = proto.getContext;
  proto.getContext = () => (contextResult === 'null' ? null : ctx);

  return {
    calls,
    sets,
    callsTo(method: string) {
      return calls.filter((c) => c.method === method);
    },
    restore() {
      proto.getContext = original;
    },
  };
}
