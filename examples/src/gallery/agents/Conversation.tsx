/**
 * Left column of the agent player: the chat transcript, built from the beats
 * that have started playing. Spec beats render as tool-call steps with their
 * live validation result instead of the JSON itself (the JSON lives in the
 * spec pane on the right).
 */

import { useEffect, useRef } from 'react';
import type { Beat, Slot, VisibleBeat } from './replay';

const SLOT_LABEL: Record<Slot, string> = {
  main: 'chart',
  a: 'panel 1',
  b: 'panel 2',
  c: 'panel 3',
  d: 'panel 4',
};

type SpecBeat = Extract<Beat, { kind: 'spec' }>;

/** What a screen reader hears once a beat finishes; streaming is silent. */
function announcement(vb: VisibleBeat | undefined): string {
  if (!vb?.done) return '';
  const { beat } = vb;
  switch (beat.kind) {
    case 'user':
    case 'prose':
      return beat.text;
    case 'tool':
      return `${beat.label}: ${beat.result}`;
    case 'spec':
      return beat.validation.valid
        ? `validateSpec passed, rendered with ${beat.rowCount} rows`
        : `validateSpec rejected the spec: ${beat.validation.errors.join(' ')}`;
  }
}

function SpecStep({ vb }: { vb: VisibleBeat }) {
  const beat = vb.beat as SpecBeat;
  const lines = vb.visibleText.split('\n').length;
  const changes = vb.done && beat.validation.valid ? beat.changes : null;

  return (
    <div className="oca-step oca-step-spec">
      <div className="oca-step-head">
        <span className="oca-fn">emit_spec</span>
        <span className="oca-step-meta">
          {beat.repairing ? 'repairing from validator feedback' : `→ ${SLOT_LABEL[beat.slot]}`}
        </span>
      </div>
      {!vb.done && <div className="oca-step-status oca-pulse">writing spec · {lines} lines</div>}
      {vb.done && beat.validation.valid && (
        <div className="oca-check oca-check-ok">
          <span aria-hidden="true">✓</span> validateSpec passed · rendered with {beat.rowCount} rows
          {changes && (
            <span className="oca-check-diff">
              {' '}
              · <span className="oca-add">+{changes.add}</span>{' '}
              <span className="oca-del">−{changes.del}</span> lines
            </span>
          )}
        </div>
      )}
      {vb.done && !beat.validation.valid && (
        <div className="oca-check oca-check-err">
          <div className="oca-check-title">
            <span aria-hidden="true">✗</span> validateSpec rejected it · nothing rendered
          </div>
          {beat.validation.errors.map((e) => (
            <code key={e} className="oca-check-msg">
              {e}
            </code>
          ))}
          <div className="oca-check-note">
            The previous chart stays on screen. The error goes back to the model.
          </div>
        </div>
      )}
    </div>
  );
}

export function Conversation({ visible }: { visible: VisibleBeat[] }) {
  const ref = useRef<HTMLElement>(null);
  // Follow the newest step like a chat window, unless the reader has
  // scrolled up to re-read something.
  const atBottom = useRef(true);
  const last = visible[visible.length - 1];
  const scrollKey = `${visible.length}:${last?.visibleText.length ?? 0}:${last?.done}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollKey is the trigger
  useEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [scrollKey]);

  const onScroll = () => {
    const el = ref.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  return (
    <>
      <div className="oca-sr-only" aria-live="polite">
        {announcement(last)}
      </div>
      <section
        className="oca-convo"
        ref={ref}
        onScroll={onScroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable
        tabIndex={0}
        aria-label="Agent transcript"
      >
        {visible.map((vb) => {
          const { beat } = vb;
          const key = `${beat.turn}-${beat.start}`;
          switch (beat.kind) {
            case 'user':
              return (
                <div key={key} className="oca-user">
                  {beat.text}
                </div>
              );
            case 'tool':
              return (
                <div key={key} className="oca-step">
                  <div className="oca-step-head">
                    <span className="oca-fn">{beat.label}</span>
                  </div>
                  <div className={vb.done ? 'oca-step-status' : 'oca-step-status oca-pulse'}>
                    {vb.done ? beat.result : 'running…'}
                  </div>
                </div>
              );
            case 'spec':
              return <SpecStep key={key} vb={vb} />;
            case 'prose':
              return (
                <p key={key} className="oca-prose">
                  {vb.visibleText}
                </p>
              );
          }
          return null;
        })}
      </section>
    </>
  );
}
