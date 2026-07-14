/**
 * Scrollytelling story (plan 11).
 *
 * `ScrollyNarrative` is the interactive dogfood: a 5-step narrative driven by
 * scroll through the React `<ChartStory>` shell. Scroll the preview to advance.
 *
 * The steps track an argument (obesity stalled after 2021; diabetes did not),
 * not a tour of the API. Earlier this demo walked the five story primitives in
 * the order the plan listed them, which is why nothing on screen ever had a
 * reason to move. See `./scrollytelling-specs.ts` for the beats.
 *
 * It is the ONLY export here on purpose. Ladle turns every named export of a
 * matched story file into a sidebar entry, so the specs live in
 * `./scrollytelling-specs.ts` (not a story module) and the deterministic
 * per-step fixtures the visual suite screenshots live under `Testing / Fixtures`
 * in `../testing/fixtures-scrollytelling.stories.tsx`. Exported from here they
 * showed up in the public sidebar as four static charts pretending to be
 * scrollytelling demos.
 *
 * Dark mode: `<ChartStory>` mounts its chart through the VANILLA story driver,
 * which does not read React context — so unlike `<Chart>`, it does not inherit
 * the `VizThemeProvider` the Ladle provider wraps everything in. The resolved
 * mode has to be handed down explicitly via `mountOptions.darkMode`, or the
 * chart renders its light-mode near-black title onto the dark canvas.
 */

import { ChartStory } from '@opendata-ai/openchart-react';
import { useOcMode } from '../components/mode-context';
import { baseSpec, steps } from './scrollytelling-specs';

export default { title: 'Charts / Scrollytelling' };

/** Narrative prose. Styled off the gallery `--gx-*` tokens so it tracks the
 *  theme; unstyled it falls back to the browser default serif on a dark
 *  canvas, which reads as a different site. */
const NARRATIVE_CSS = `
.ocs-step h3 {
  font-family: var(--gx-font-body, system-ui, -apple-system, sans-serif);
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--gx-text-strong, #0f172a);
  margin: 0 0 0.5rem;
}
.ocs-step p {
  font-family: var(--gx-font-body, system-ui, -apple-system, sans-serif);
  font-size: 1rem;
  line-height: 1.65;
  color: var(--gx-text-muted, #64748b);
  margin: 0;
  max-width: 34rem;
}
`;

const narrative = [
  <div className="ocs-step" key="0">
    <h3>Two curves, one decade</h3>
    <p>
      Obesity and diagnosed diabetes are supposed to move together, and for ten years they did. Both
      climbed, year after year, in step. Scroll to follow what happened next.
    </p>
  </div>,
  <div className="ocs-step" key="1">
    <h3>The climb</h3>
    <p>
      Obesity rose from 27.7 percent of adults in the median state to 33.9 percent by 2021, roughly
      six-tenths of a point every year for a decade.
    </p>
  </div>,
  <div className="ocs-step" key="2">
    <h3>Then it stopped</h3>
    <p>
      At full scale you cannot see it. Zoom into the last few years and the decade-long climb turns
      flat: 33.9, then 33.6, then 34.4, then 34.3.
    </p>
  </div>,
  <div className="ocs-step" key="3">
    <h3>2021 is where they split</h3>
    <p>
      The plateau is real, and it is not an artifact of one survey. The CDC&apos;s measured survey
      sees it too, in the first cycle in decades with no significant increase.
    </p>
  </div>,
  <div className="ocs-step" key="4">
    <h3>But diabetes never bent</h3>
    <p>
      Pull back out and the other line is still going up. Same years, same drugs, same people, and
      diagnosed diabetes rose every single step to a record. Only one of these curves bent.
    </p>
  </div>,
];

export const ScrollyNarrative = () => {
  const mode = useOcMode();
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS constant, no user input */}
      <style dangerouslySetInnerHTML={{ __html: NARRATIVE_CSS }} />
      <ChartStory
        spec={baseSpec}
        steps={steps}
        narrative={narrative}
        mountOptions={{ darkMode: mode === 'dark' ? 'force' : 'off' }}
      />
      <div style={{ height: '60vh' }} />
    </div>
  );
};
