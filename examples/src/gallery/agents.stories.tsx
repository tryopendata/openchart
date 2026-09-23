/**
 * Built for Agents: an LLM writes the spec, the engine validates it, and the
 * chart animates each revision in place.
 *
 * The sessions are scripted (the page is static, so no model runs), but every
 * validation result, diff, and render on the page comes from the real engine.
 * Scripts live in `agents/scenarios.ts`; the replay logic in `agents/replay.ts`.
 *
 * `?final=1` renders every player at its last turn with no motion, which is
 * what the visual-regression baseline captures.
 */

import { GalleryPage, Section, Tokenized } from '../components';
import { AgentReplay } from './agents/AgentReplay';
import { chatAnalyst, dashboardBuilder } from './agents/scenarios';
import './agents/agents.css';

const DOCS = 'https://github.com/tryopendata/openchart/blob/main/docs';

const WIRE_UP_SNIPPET = `const spec = { ...toolCall.input, data: rows };
const { valid, errors } = validateSpec(spec);
if (!valid) return askModelToFix(errors); // each: path, message, suggestion
return <Chart spec={spec} />;`;

function isFinal(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('final') === '1';
  } catch {
    return false;
  }
}

export default { title: 'Agents' };

export const BuiltForAgents = () => {
  const final = isFinal();
  return (
    <GalleryPage
      title="Built for Agents"
      lede={
        <>
          An OpenChart chart is a JSON document, so an LLM can write it,{' '}
          <code className="oca-inline-code">validateSpec</code> can check it against your data, and{' '}
          <code className="oca-inline-code">{'<Chart>'}</code> animates every revision in place.
        </>
      }
    >
      <Section
        id="chat-analyst"
        title="Chat analyst"
        lede="A user asks a question and the agent answers with a spec. The chart renders as soon as the spec validates. In the second turn the agent names a column that doesn't exist, the validator catches it before anything renders, and the fix is one line. The third turn adds an annotation."
      >
        <AgentReplay scenario={chatAnalyst} layout="single" final={final} />
      </Section>

      <Section id="why-a-spec" title="Why a spec">
        <div className="oca-prose-block">
          <p>
            If the model writes D3 or Recharts code, you're running generated JavaScript, debugging
            it when it breaks, and regenerating it for every tweak. A spec is data: you can validate
            it before it touches the screen, store it, diff it, and hand it back to the model to
            edit.
          </p>
          <p>
            Vega-Lite is JSON too, and OpenChart follows its encoding grammar. The difference is
            what happens around the spec. <code>validateSpec</code> checks field names against the
            rows you attached, so a hallucinated column comes back as an error with a suggested fix
            instead of an empty chart. Updates animate from the previous layout to the new one.
            Titles, sources, and annotations are part of the spec, and so are tables, sankeys, and
            bar lists.
          </p>
          <p>
            A narrower option is a tool that takes a chart type and column names and builds the spec
            for the model. That's safe, but the agent can't annotate, restyle, or pick anything the
            tool didn't anticipate. Letting the model write the full spec and validating it keeps
            the safety without the ceiling.
          </p>
        </div>
      </Section>

      <Section
        id="dashboard-builder"
        title="Dashboard builder"
        lede="One prompt, four panels: the SaaS dashboard from the Dashboards page, written by the agent one spec at a time. Area charts, stacked columns, bar lists, and tables are all specs, so one validator and one <Visualization> component handle whatever the agent decides to build."
      >
        <AgentReplay scenario={dashboardBuilder} layout="dashboard" final={final} />
      </Section>

      <Section id="wire-it-up" title="Wire it up">
        <div className="oca-prose-block">
          <p>
            On the render side it's four lines. Give the model the published JSON Schema as a tool,
            attach your rows to whatever it returns, and validate before rendering.{' '}
            <a href={`${DOCS}/generating-specs.md`} target="_blank" rel="noreferrer">
              Generating specs
            </a>{' '}
            has the tool definition and the repair loop.{' '}
            <a href={`${DOCS}/agent-patterns.md`} target="_blank" rel="noreferrer">
              Agent patterns
            </a>{' '}
            is a cookbook of specs that read well.
          </p>
        </div>
        <div className="oca-snippet">
          <pre className="oc-spec-code">
            <Tokenized text={WIRE_UP_SNIPPET} />
          </pre>
        </div>
      </Section>
    </GalleryPage>
  );
};
