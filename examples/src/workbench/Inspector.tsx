import type {
  ChartSpec,
  DesignDiagnostic,
  DesignQuestion,
  SpecPatch,
  VizSpec,
} from '@opendata-ai/openchart-core';
import { type RecommendationRoles, recommendCompositions } from '@opendata-ai/openchart-engine';
import { motion } from 'motion/react';
import { useId } from 'react';
import { fieldType } from './document';
import { isSupported, type SupportedSpec } from './Preview';

type InspectorTab = 'design' | 'recommend' | 'review';

/** Panels stay mounted so changing tabs never discards chosen field roles. */
export function Inspector({
  spec,
  tab,
  onTabChange,
  onChange,
  diagnostics,
  onPreview,
  question,
  setQuestion,
  roles,
  setRoles,
}: {
  spec: SupportedSpec;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onChange: (spec: VizSpec) => void;
  diagnostics: DesignDiagnostic[];
  onPreview: (patch: SpecPatch) => void;
  question: DesignQuestion;
  setQuestion: (question: DesignQuestion) => void;
  roles: RecommendationRoles;
  setRoles: (roles: RecommendationRoles) => void;
}) {
  const id = useId();
  const tabs = ['design', 'recommend', 'review'] as const;
  return (
    <>
      <div
        className="studio-tabs"
        role="tablist"
        aria-label="Inspector"
        onKeyDown={(event) => {
          const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!direction && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const index =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? 2
                : (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
          onTabChange(tabs[index]);
          (event.currentTarget.querySelectorAll('button')[index] as HTMLButtonElement).focus();
        }}
      >
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`${id}-${name}`}
            aria-controls={`${id}-${name}-panel`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => onTabChange(name)}
          >
            {name === 'recommend' ? 'Suggest' : name[0].toUpperCase() + name.slice(1)}
            {name === 'review' && diagnostics.some((item) => item.status === 'failed') && (
              <span className="studio-count">
                {diagnostics.filter((item) => item.status === 'failed').length}
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((name) => (
        <motion.div
          key={name}
          id={`${id}-${name}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${name}`}
          hidden={tab !== name}
          initial={false}
          animate={{ opacity: tab === name ? 1 : 0 }}
          transition={{ duration: 0.14 }}
        >
          {name === 'design' ? (
            <DesignInspector spec={spec} onChange={onChange} />
          ) : name === 'recommend' ? (
            <RecommendationInspector
              spec={spec}
              onChange={onChange}
              question={question}
              setQuestion={setQuestion}
              roles={roles}
              setRoles={setRoles}
            />
          ) : (
            <ReviewInspector diagnostics={diagnostics} onPreview={onPreview} />
          )}
        </motion.div>
      ))}
    </>
  );
}

function chromeText(spec: SupportedSpec, key: 'title' | 'subtitle' | 'source' | 'footer'): string {
  const value = spec.chrome?.[key];
  return typeof value === 'string' ? value : (value?.text ?? '');
}
export function DesignInspector({
  spec,
  onChange,
}: {
  spec: SupportedSpec;
  onChange: (next: VizSpec) => void;
}) {
  const chart = !('type' in spec) ? spec : null;
  const fields = [...new Set(spec.data.flatMap(Object.keys))].filter(
    (field) => spec.fields?.[field]?.role !== 'identity',
  );
  return (
    <div className="studio-inspector-content">
      <h2>Make the message clear</h2>
      <p className="studio-muted">Start with what readers should understand.</p>
      {(['title', 'subtitle', 'source', 'footer'] as const).map((key) => (
        <label key={key} className="studio-field">
          {
            {
              title: 'Headline',
              subtitle: 'Context & units',
              source: 'Source',
              footer: 'Methodology',
            }[key]
          }
          <textarea
            rows={key === 'title' ? 3 : 2}
            key={chromeText(spec, key)}
            defaultValue={chromeText(spec, key)}
            onBlur={(event) => {
              if (event.target.value !== chromeText(spec, key))
                onChange({
                  ...spec,
                  chrome: {
                    ...spec.chrome,
                    [key]:
                      typeof spec.chrome?.[key] === 'object'
                        ? { ...spec.chrome[key], text: event.target.value }
                        : event.target.value,
                  },
                });
            }}
          />
        </label>
      ))}
      {chart && (
        <>
          <div className="studio-divider" />
          <h3>Field roles</h3>
          {(['x', 'y'] as const).map((axis) => {
            const channel = chart.encoding[axis];
            if (!channel || !('field' in channel)) return null;
            return (
              <label key={axis} className="studio-field">
                {axis.toUpperCase()} axis
                <select
                  value={channel.field}
                  onChange={(event) => {
                    const field = event.target.value;
                    const type = fieldType(spec.data, field, spec.fields);
                    onChange({
                      ...chart,
                      encoding: {
                        ...chart.encoding,
                        [axis]: {
                          field,
                          type:
                            type === 'number'
                              ? 'quantitative'
                              : type === 'date'
                                ? 'temporal'
                                : 'nominal',
                        },
                      },
                    } as ChartSpec);
                  }}
                >
                  {fields.map((field) => (
                    <option key={field}>{field}</option>
                  ))}
                </select>
              </label>
            );
          })}
          <label className="studio-field">
            Motion
            <select
              value={
                typeof chart.animation === 'string'
                  ? chart.animation
                  : chart.animation
                    ? 'legacy'
                    : 'off'
              }
              onChange={(event) =>
                onChange({
                  ...chart,
                  animation:
                    event.target.value === 'off'
                      ? false
                      : (event.target.value as 'fluid' | 'subtle' | 'legacy'),
                })
              }
            >
              <option value="fluid">Fluid · continuous, bounded</option>
              <option value="subtle">Subtle · quick and quiet</option>
              <option value="legacy">Legacy · v8 timing</option>
              <option value="off">Off</option>
            </select>
          </label>
        </>
      )}
      <label className="studio-check">
        <input
          type="checkbox"
          checked={spec.watermark === true}
          onChange={(event) => onChange({ ...spec, watermark: event.target.checked })}
        />{' '}
        Include OpenChart attribution
      </label>
    </div>
  );
}

export function ReviewInspector({
  diagnostics,
  onPreview,
}: {
  diagnostics: DesignDiagnostic[];
  onPreview: (patch: SpecPatch) => void;
}) {
  return (
    <div className="studio-inspector-content">
      <h2>A second pair of eyes</h2>
      <p className="studio-muted">
        Checks explain measurable issues. They never rewrite your finding.
      </p>
      {!diagnostics.length && (
        <p className="studio-review-clear">
          No issues found by the available checks. Review the chart with your readers before
          publishing.
        </p>
      )}
      {diagnostics.map((item, index) => (
        <article className="studio-diagnostic" key={`${item.code}:${index}`}>
          <span className="studio-eyebrow">
            {item.status === 'uncheckable' ? 'Needs context' : item.severity} · {item.origin}
          </span>
          <p>{item.message}</p>
          <small>{item.viewport.width}px preview</small>
          {item.fix && (
            <button type="button" onClick={() => onPreview(item.fix!)}>
              Preview improvement →
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function RecommendationInspector({
  spec,
  onChange,
  question,
  setQuestion,
  roles,
  setRoles,
}: {
  spec: SupportedSpec;
  question: DesignQuestion;
  setQuestion: (question: DesignQuestion) => void;
  roles: RecommendationRoles;
  setRoles: (roles: RecommendationRoles) => void;
  onChange: (spec: VizSpec) => void;
}) {
  const fields = [...new Set(spec.data.flatMap(Object.keys))].filter(
    (key) => spec.fields?.[key]?.role !== 'identity',
  );
  const result = recommendCompositions(spec.data, question, roles);
  const required: Record<DesignQuestion, Array<keyof RecommendationRoles>> = {
    comparison: ['category', 'measure'],
    change: ['time', 'measure', 'series'],
    distribution: ['measure'],
    composition: ['category', 'measure'],
    geography: ['category', 'measure'],
    relationships: ['measure', 'secondMeasure'],
  };
  return (
    <div className="studio-inspector-content">
      <h2>Choose the question</h2>
      <p className="studio-muted">A useful chart starts with an explicit comparison.</p>
      <label className="studio-field">
        What do you want to show?
        <select
          value={question}
          onChange={(event) => setQuestion(event.target.value as DesignQuestion)}
        >
          {[
            'comparison',
            'change',
            'distribution',
            'composition',
            'geography',
            'relationships',
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {required[question].map((role) => (
        <label className="studio-field" key={role}>
          {
            {
              category: 'Categories',
              measure: 'Measure',
              time: 'Date',
              series: 'Series (optional)',
              secondMeasure: 'Second measure',
            }[role]
          }
          <select
            value={roles[role] ?? ''}
            onChange={(event) => setRoles({ ...roles, [role]: event.target.value || undefined })}
          >
            <option value="">Choose a field</option>
            {fields.map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
      ))}
      {(result.missingRoles.length > 0 || result.explanation) && (
        <p className="studio-muted">
          {result.explanation ?? `Choose ${result.missingRoles.join(' and ')} to see suggestions.`}
        </p>
      )}
      {result.recommendations.map((recommendation) => (
        <article className="studio-diagnostic" key={recommendation.id}>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.reason}</p>
          <p className="studio-muted">{recommendation.tradeoff}</p>
          <button
            type="button"
            onClick={() => {
              if (!isSupported(recommendation.spec)) return;
              const rowKey =
                'type' in spec && spec.type === 'table'
                  ? spec.rowKey
                  : !('type' in spec)
                    ? spec.encoding.key?.field
                    : undefined;
              const recommended = recommendation.spec;
              const next = {
                ...recommended,
                ...(!('type' in recommended) && rowKey
                  ? {
                      encoding: {
                        ...recommended.encoding,
                        key: { field: rowKey, type: 'nominal' as const },
                      },
                    }
                  : {}),
                fields: spec.fields,
                theme: spec.theme,
                chrome: spec.chrome,
                watermark: spec.watermark,
                animation: spec.animation,
              };
              if (isSupported(next as VizSpec)) onChange(next as VizSpec);
            }}
          >
            Use this composition
          </button>
        </article>
      ))}
    </div>
  );
}
