/**
 * The dashboard builder's stage: the Dashboards page's SaaS layout, with each
 * panel filled by whatever spec the agent has emitted for its slot so far.
 * Panel sizes match `SaasDashboard` so the finished result looks the same.
 */

import type { VizSpec } from '@opendata-ai/openchart-core';
import { Visualization } from '@opendata-ai/openchart-react';
import type { ReactNode } from 'react';
import { Panel, SAAS_GRID_CSS, TileTitle, useDashRootClass } from '../dashboards.layouts';
import type { Slot } from './replay';

function Fill({
  spec,
  height,
  children,
}: {
  spec?: VizSpec;
  height?: number;
  children?: ReactNode;
}) {
  return (
    <>
      {children}
      <div style={height ? { height } : { minHeight: 200 }}>
        {spec ? (
          <Visualization spec={spec} style={height ? { height: '100%' } : undefined} />
        ) : (
          <div className="oca-viz-empty">Waiting for a spec…</div>
        )}
      </div>
    </>
  );
}

export function DashboardStage({ slots }: { slots: Partial<Record<Slot, VizSpec>> }) {
  const rootClass = useDashRootClass('oc-dash-saas oca-dash');
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: SAAS_GRID_CSS }} />
      <div className={rootClass}>
        <Panel>
          <Fill spec={slots.a} height={400} />
        </Panel>
        <Panel className="oc-dash-short">
          <Fill spec={slots.b} height={180}>
            {slots.b && <TileTitle>Signups by channel</TileTitle>}
          </Fill>
        </Panel>
        <Panel>
          <Fill spec={slots.c} height={280} />
        </Panel>
        <Panel>
          <Fill spec={slots.d} />
        </Panel>
      </div>
    </>
  );
}
