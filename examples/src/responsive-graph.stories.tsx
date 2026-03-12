/**
 * Responsive Graph stories.
 *
 * Tests graph layout at mobile/tablet/desktop widths and portrait containers.
 * Verifies fitBounds top-alignment eliminates dead space below compact clusters.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { Graph } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { generateRandomGraph } from './graphs/helpers';

// Spec that mimics the blog's DatasetGraph (community clusters with color encoding)
const mobileSpec: GraphSpec = {
  ...generateRandomGraph(40, 1.5, 4),
  encoding: {
    nodeColor: { field: 'community', type: 'nominal' },
  },
  layout: {
    type: 'force' as const,
    clustering: { field: 'community' },
    chargeStrength: -200,
    linkDistance: 60,
  },
};

// Same spec but with chrome (to test chrome + graph in tight containers)
const withChromeSpec: GraphSpec = {
  ...mobileSpec,
  chrome: {
    title: 'Dataset Connections',
    subtitle: '40 nodes, 4 communities',
  },
};

// ---------------------------------------------------------------------------
// Fixed widths: reproduce the blog's mobile container sizes
// ---------------------------------------------------------------------------
export const MobilePortrait = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">375×320 (iPhone SE - blog mobile)</h3>
      <div className="story-debug-border" style={{ width: 375, height: 320 }}>
        <Graph spec={mobileSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">375×320 with chrome</h3>
      <div className="story-debug-border" style={{ width: 375, height: 320 }}>
        <Graph spec={withChromeSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">390×320 (iPhone 14)</h3>
      <div className="story-debug-border" style={{ width: 390, height: 320 }}>
        <Graph spec={mobileSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">320×480 (tall portrait)</h3>
      <div className="story-debug-border" style={{ width: 320, height: 480 }}>
        <Graph spec={mobileSpec} />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Desktop sizes for comparison
// ---------------------------------------------------------------------------
export const DesktopSizes = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">768×432 (tablet landscape / md breakpoint)</h3>
      <div className="story-debug-border" style={{ width: 768, height: 432 }}>
        <Graph spec={withChromeSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">1024×576 (desktop)</h3>
      <div className="story-debug-border" style={{ width: 1024, height: 576 }}>
        <Graph spec={withChromeSpec} />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Resizable container to interactively test
// ---------------------------------------------------------------------------
export const Resizable = () => {
  const [width, setWidth] = useState(375);
  const [height, setHeight] = useState(320);

  return (
    <div>
      <div className="story-heading" style={{ marginBottom: 12, display: 'flex', gap: 24 }}>
        <label>
          Width: {width}px
          <input
            type="range"
            min={280}
            max={1000}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ marginLeft: 8, width: 150 }}
          />
        </label>
        <label>
          Height: {height}px
          <input
            type="range"
            min={200}
            max={700}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ marginLeft: 8, width: 150 }}
          />
        </label>
      </div>
      <div
        className="story-debug-border"
        style={{ width, height, transition: 'width 0.1s, height 0.1s' }}
      >
        <Graph spec={mobileSpec} />
      </div>
    </div>
  );
};
