// biome-ignore-all lint/security/noDangerouslySetInnerHtml: Static renderer escapes the shared fixture's SVG content.
import { renderStaticSVG } from '@opendata-ai/openchart-vanilla/static';
import { staticPlatformSpecs } from '../../../packages/vanilla/src/__tests__/__fixtures__/static-platform-specs';
import { siteSpecs } from '../../../packages/vanilla/src/__tests__/__fixtures__/static-specs';

export default { title: 'Testing / Static Site Fixtures' };

type SiteFigure = keyof typeof siteSpecs;
type PlatformFigure = keyof typeof staticPlatformSpecs;

function StaticPair({ name }: { name: SiteFigure }) {
  const cell = name.endsWith('Cell');
  return (
    <Pair
      name={name}
      spec={siteSpecs[name]}
      width={cell ? 120 : 680}
      height={cell ? 16 : 320}
      cell={cell}
    />
  );
}

function PlatformPair({ name }: { name: PlatformFigure }) {
  return (
    <Pair
      name={`platform-${name}`}
      spec={staticPlatformSpecs[name]}
      width={name === 'legend-notes' ? 330 : 640}
      height={420}
    />
  );
}

function Pair({
  name,
  spec,
  width,
  height,
  cell = false,
}: {
  name: string;
  spec: Parameters<typeof renderStaticSVG>[0];
  width: number;
  height: number;
  cell?: boolean;
}) {
  return (
    <div
      className="story-chart static-site-pair"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: 16,
        width: '100%',
        alignItems: 'start',
      }}
    >
      <style>{'.static-site-figure svg { display: block; width: 100%; height: auto; }'}</style>
      {(['off', 'force'] as const).map((darkMode) => (
        <section
          key={darkMode}
          data-static-site-theme={darkMode === 'force' ? 'dark' : 'light'}
          style={{
            minWidth: 0,
            padding: 16,
            background: darkMode === 'force' ? '#09090b' : '#fff',
            color: darkMode === 'force' ? '#e4e4e7' : '#27272a',
          }}
        >
          <div style={{ fontSize: 12, marginBottom: 16 }}>
            {darkMode === 'force' ? 'Dark' : 'Light'}
          </div>
          <div
            className={cell ? 'static-site-cell' : 'static-site-figure'}
            style={cell ? { width: 120, height: 16 } : undefined}
            dangerouslySetInnerHTML={{
              __html: renderStaticSVG(spec, {
                width,
                height,
                darkMode,
                idPrefix: `site-gallery-${name}-${darkMode}`,
              }),
            }}
          />
        </section>
      ))}
    </div>
  );
}

export const ByPreset = () => <StaticPair name="byPreset" />;
export const ByAgent = () => <StaticPair name="byAgent" />;
export const TimeToGreen = () => <StaticPair name="timeToGreen" />;
export const History = () => <StaticPair name="history" />;
export const Weekly = () => <StaticPair name="weekly" />;
export const StepFailures = () => <StaticPair name="stepFailures" />;
export const KeptAttach = () => <StaticPair name="keptAttach" />;
export const MajorShares = () => <StaticPair name="majorShares" />;
export const ShareOverTime = () => <StaticPair name="shareOverTime" />;
export const Lift = () => <StaticPair name="lift" />;
export const RateCell = () => <StaticPair name="rateCell" />;
export const CountCell = () => <StaticPair name="countCell" />;
export const SparkCell = () => <StaticPair name="sparkCell" />;

export const PlatformChrome = () => <PlatformPair name="chrome" />;
export const PlatformLegendNotes = () => <PlatformPair name="legend-notes" />;
export const PlatformMap = () => <PlatformPair name="map" />;
export const PlatformTilemap = () => <PlatformPair name="tilemap" />;
export const PlatformLine = () => <PlatformPair name="line" />;
export const PlatformBar = () => <PlatformPair name="bar" />;
export const PlatformPie = () => <PlatformPair name="pie" />;
