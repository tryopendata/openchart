/**
 * The spec pane: streams the JSON the agent is writing, then, on refinement
 * turns, switches to a line diff against the previous spec in the slot (the
 * rejected attempt, for a repair) so the reader sees exactly what changed.
 */

import { useEffect, useRef, useState } from 'react';
import { Tokenized } from '../../components';
import type { Beat, VisibleBeat } from './replay';

type SpecBeat = Extract<Beat, { kind: 'spec' }>;

export function SpecPane({ paneBeat }: { paneBeat: VisibleBeat | null }) {
  const bodyRef = useRef<HTMLPreElement>(null);
  const beat = paneBeat?.beat as SpecBeat | undefined;
  const diff = paneBeat?.done ? beat?.diff : null;
  const canDiff = Boolean(diff);
  // The toggle belongs to one beat; a new spec resets it to the diff.
  const [fullFor, setFullFor] = useState<number | null>(null);
  const showDiff = canDiff && fullFor !== beat?.start;

  const text = paneBeat?.visibleText ?? '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the stream as it grows
  useEffect(() => {
    const el = bodyRef.current;
    if (el && paneBeat && !paneBeat.done) el.scrollTop = el.scrollHeight;
    if (el && paneBeat?.done) el.scrollTop = 0;
  }, [text.length, paneBeat?.done, showDiff]);

  return (
    <div className="oca-pane">
      <div className="oca-pane-head">
        <span className="oca-pane-title">
          {showDiff
            ? beat?.repairing
              ? 'What the repair changed'
              : 'What changed'
            : paneBeat && !paneBeat.done
              ? 'Streaming spec'
              : 'Spec'}
        </span>
        {beat && (
          <span className="oca-pane-note">+ data: {beat.rowCount} rows, attached by the host</span>
        )}
        {canDiff && beat && (
          <button
            type="button"
            className="oca-pane-toggle"
            onClick={() => setFullFor(showDiff ? beat.start : null)}
          >
            {showDiff ? 'Full spec' : 'Show diff'}
          </button>
        )}
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable */}
      <pre className="oc-spec-code oca-pane-body" ref={bodyRef} tabIndex={0}>
        {!paneBeat && <span className="oca-empty">The agent's spec streams here.</span>}
        {paneBeat && !showDiff && <Tokenized text={text} />}
        {showDiff &&
          diff?.map((l, i) =>
            l.type === 'gap' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static diff output
              <span key={i} className="oca-diff-line oca-diff-gap">
                {`  ⋯ ${l.count} unchanged lines`}
              </span>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static diff output
              <span key={i} className={`oca-diff-line oca-diff-${l.type}`}>
                <span className="oca-diff-gutter" aria-hidden="true">
                  {l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}
                </span>
                <Tokenized text={l.line} />
              </span>
            ),
          )}
      </pre>
    </div>
  );
}
