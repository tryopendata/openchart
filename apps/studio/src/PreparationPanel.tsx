import { useEffect, useState } from 'react';
import { fieldType } from './document';
import { type Preparation, prepareRows, type StudioProject } from './project';

export function PreparationPanel({
  project,
  onApply,
}: {
  project: StudioProject;
  onApply: (preparation: Preparation) => void;
}) {
  const [draft, setDraft] = useState(project.preparation);
  useEffect(() => {
    void project.source;
    setDraft(project.preparation);
  }, [project.source, project.preparation]);
  const fields = [...new Set(project.source.flatMap(Object.keys))].filter(
    (key) => project.sourceFields?.[key]?.role !== 'identity',
  );
  const numbers = fields.filter(
    (key) => fieldType(project.source, key, project.sourceFields) === 'number',
  );
  const preview = prepareRows(project.source, draft);
  return (
    <section className="studio-preparation" aria-label="Prepare data">
      <h2>Prepare without losing the source</h2>
      <p className="studio-muted">
        Filter first, then summarize. Missing measurements are excluded from statistics. Count
        includes every row. Apply is one undoable edit.
      </p>
      <div className="studio-control-grid">
        <label className="studio-field">
          Filter field
          <select
            value={draft.filter?.field ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                filter: e.target.value ? { field: e.target.value, value: '' } : undefined,
              })
            }
          >
            <option value="">All rows</option>
            {fields.map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
        {draft.filter && (
          <label className="studio-field">
            Keep value
            <select
              value={draft.filter.value}
              onChange={(e) =>
                setDraft({ ...draft, filter: { ...draft.filter!, value: e.target.value } })
              }
            >
              {[
                ...new Set([
                  '',
                  ...project.source.map((row) => String(row[draft.filter!.field] ?? '')),
                ]),
              ].map((value) => (
                <option key={value} value={value}>
                  {value || '(missing)'}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="studio-field">
          Summary
          <select
            value={draft.summary?.op ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                summary: e.target.value
                  ? {
                      groupby: draft.summary?.groupby ?? [],
                      field:
                        e.target.value === 'count' ? '' : draft.summary?.field || numbers[0] || '',
                      op: e.target.value as NonNullable<Preparation['summary']>['op'],
                    }
                  : undefined,
              })
            }
          >
            <option value="">Keep individual observations</option>
            {['sum', 'mean', 'min', 'max', 'count'].map((op) => (
              <option key={op}>{op}</option>
            ))}
          </select>
        </label>
        {draft.summary && (
          <>
            {draft.summary.op !== 'count' && (
              <label className="studio-field">
                Summarize field
                <select
                  value={draft.summary.field}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      summary: {
                        ...draft.summary!,
                        field: e.target.value,
                        groupby: draft.summary!.groupby.filter((key) => key !== e.target.value),
                      },
                    })
                  }
                >
                  {numbers.map((field) => (
                    <option key={field}>{field}</option>
                  ))}
                </select>
              </label>
            )}
            <fieldset>
              <legend>Group by</legend>
              {fields
                .filter((field) => field !== draft.summary!.field)
                .map((field) => (
                  <label className="studio-check" key={field}>
                    <input
                      type="checkbox"
                      checked={draft.summary!.groupby.includes(field)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          summary: {
                            ...draft.summary!,
                            groupby: e.target.checked
                              ? [...draft.summary!.groupby, field]
                              : draft.summary!.groupby.filter((key) => key !== field),
                          },
                        })
                      }
                    />
                    {field}
                  </label>
                ))}
            </fieldset>
          </>
        )}
      </div>
      <output>
        {project.source.length} source rows → {preview.length} prepared rows
        {draft.summary
          ? draft.summary.op === 'count'
            ? ' · count of rows'
            : ` · ${draft.summary.op} of ${draft.summary.field}`
          : ''}
      </output>
      <button
        type="button"
        className="studio-primary"
        disabled={
          !!draft.summary &&
          (!draft.summary.groupby.length || (draft.summary.op !== 'count' && !draft.summary.field))
        }
        onClick={() => onApply(draft)}
      >
        Apply preparation
      </button>
      {draft.summary && !draft.summary.groupby.length && <p>Choose at least one grouping field.</p>}
      <button
        type="button"
        onClick={() => {
          setDraft({});
          onApply({});
        }}
      >
        Restore all source rows
      </button>
    </section>
  );
}
