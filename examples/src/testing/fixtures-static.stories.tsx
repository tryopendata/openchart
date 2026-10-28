// biome-ignore-all lint/security/noDangerouslySetInnerHtml: Static renderer escapes the fixture's SVG content.
import { renderStaticSVG } from '@opendata-ai/openchart-vanilla/static';
import { siteSpecs } from '../../../packages/vanilla/src/__tests__/__fixtures__/static-specs';

export default { title: 'Static / Fixtures' };

type FigureSpec = Parameters<typeof renderStaticSVG>[0];

// The RFC §8 figures as the static goldens render them: light and dark side by side.
function Pair({ name, spec }: { name: string; spec: FigureSpec }) {
  const cell = 'display' in spec && spec.display === 'sparkline';
  const width = cell ? 120 : 680;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
      {(['off', 'force'] as const).map((darkMode) => (
        <div
          key={darkMode}
          style={{ width, padding: 16, background: darkMode === 'force' ? '#09090b' : '#fff' }}
          dangerouslySetInnerHTML={{
            __html: renderStaticSVG(spec, {
              width,
              height: cell ? 16 : 320,
              darkMode,
              idPrefix: `site-${name}-${darkMode}`,
            }),
          }}
        />
      ))}
    </div>
  );
}
export const SiteFigures = () => (
  <div className="story-chart" style={{ width: 1440, maxWidth: 'none' }}>
    {Object.entries(siteSpecs).map(([name, spec]) => (
      <section key={name}>
        <h3 style={{ font: '600 13px system-ui', margin: '0 0 8px' }}>{name}</h3>
        <Pair name={name} spec={spec} />
      </section>
    ))}
  </div>
);
