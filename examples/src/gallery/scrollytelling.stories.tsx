/**
 * Features / Scrollytelling — scroll-driven chart narrative.
 *
 * The ChartStory component drives a chart through a sequence of spec patches
 * as the reader scrolls. Each step can change encoding, domain, highlight,
 * annotations, and chrome. The chart morphs between states with data-update
 * transitions.
 *
 * This gallery page wraps the same narrative from charts/scrollytelling but
 * surfaces it within the gallery framework so it shows up in the index.
 */

import type { VizSpec } from '@opendata-ai/openchart-core';
import { ChartStory } from '@opendata-ai/openchart-react';
import { baseSpec, steps } from '../charts/scrollytelling-specs';
import { Demo, GalleryPage, Section } from '../components';
import { useOcMode } from '../components/mode-context';

const NARRATIVE_CSS = `
.ocs-step h3 {
  font-family: var(--oc-font-body, system-ui, -apple-system, sans-serif);
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--oc-text-strong, #0f172a);
  margin: 0 0 0.5rem;
}
.ocs-step p {
  font-family: var(--oc-font-body, system-ui, -apple-system, sans-serif);
  font-size: 1rem;
  line-height: 1.65;
  color: var(--oc-text-muted, #64748b);
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

function ScrollyNarrativeDemo() {
  const mode = useOcMode();
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
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
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const Scrollytelling = () => (
  <GalleryPage
    title="Scrollytelling"
    lede="ChartStory turns a chart into a scroll-driven narrative. Each step patches the spec — changing domains, highlights, annotations, and chrome — and the chart morphs between states. The reader scrolls; the argument builds."
  >
    <Section
      id="narrative"
      title="Scroll-driven narrative"
      lede="Five steps track an argument: obesity stalled after 2021, but diabetes did not. Scroll to advance the story."
    >
      <Demo
        id="scrolly-narrative"
        title="Scroll-driven narrative"
        description="Each step applies a cumulative patch to the base spec. The chart transitions between states as the reader scrolls. Scroll down inside the demo to advance."
        specForPanel={baseSpec as unknown as VizSpec}
        height={800}
      >
        <ScrollyNarrativeDemo />
      </Demo>
    </Section>
  </GalleryPage>
);
