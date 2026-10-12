import {
  clarity,
  type DesignDiagnostic,
  type DesignQuestion,
  type ReaderSelection,
  type SpecPatch,
  type VizSpec,
} from '@opendata-ai/openchart-core';
import {
  applySpecPatch,
  type RecommendationRoles,
  validateSpec,
} from '@opendata-ai/openchart-engine';
import { exportCSV } from '@opendata-ai/openchart-vanilla';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataEditor } from './DataEditor';
import {
  checkImportSize,
  type DocumentHistory,
  editDocument,
  importDelimited,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  redoDocument,
  undoDocument,
} from './document';
import { Inspector } from './Inspector';
import { PatternThumbnail } from './PatternThumbnail';
import { isSupported, Preview, type PreviewHandle, type SupportedSpec } from './Preview';
import { referencePatterns, revenueSpec } from './patterns';
import { ReaderPanel } from './ReaderPanel';
import { Sheet } from './Sheet';

const DRAFT_KEY = 'openchart.studio.draft.v1';
const emptySelection: ReaderSelection = { preview: null, pinned: [], announcement: '' };
type InspectorTab = 'design' | 'recommend' | 'review';

function readDraft(): SupportedSpec | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  checkImportSize(raw);
  const document: unknown = JSON.parse(raw);
  const result = validateSpec(document);
  if (!result.valid || !result.normalized || !isSupported(result.normalized))
    throw new Error(
      'The saved draft could not be opened. Its original data is still stored in this browser.',
    );
  if (result.normalized.data.length > MAX_IMPORT_ROWS)
    throw new Error(
      'The saved draft exceeds the 20,000 row limit. Export it from its original host.',
    );
  return result.normalized;
}

export function Workbench({ restoreDraft = true }: { restoreDraft?: boolean }) {
  const [history, setHistory] = useState<DocumentHistory>({
    past: [],
    present: revenueSpec,
    future: [],
  });
  const spec = history.present as SupportedSpec;
  const [pattern, setPattern] = useState('line');
  const [question, setQuestion] = useState<DesignQuestion>('comparison');
  const [roles, setRoles] = useState<RecommendationRoles>({});
  const [tab, setTab] = useState<InspectorTab>('design');
  const [panel, setPanel] = useState<'patterns' | 'inspector' | null>(null);
  const [editing, setEditing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DesignDiagnostic[]>([]);
  const [view, setView] = useState<'preview' | 'data'>('preview');
  const [width, setWidth] = useState(768);
  const [replay, setReplay] = useState(0);
  const [selection, setSelection] = useState(emptySelection);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [source, setSource] = useState('');
  const [importError, setImportError] = useState('');
  const [json, setJson] = useState('');
  const [patch, setPatch] = useState<SpecPatch | null>(null);
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'csv'>('svg');
  const [exporting, setExporting] = useState(false);
  const [previewYear, setPreviewYear] = useState<string | null>(null);
  const timeField =
    !('type' in spec) && spec.encoding.x?.type === 'temporal' ? spec.encoding.x.field : null;
  const years = timeField
    ? [
        ...new Set(
          spec.data
            .map((row) => String(row[timeField]).slice(0, 4))
            .filter((year) => /^\d{4}$/.test(year)),
        ),
      ].sort()
    : [];
  const finalYear = years.at(-1);
  const selectedYear = previewYear && years.includes(previewYear) ? previewYear : years.at(-1);
  const previewSpec = useMemo(() => {
    if (!timeField || !previewYear || !selectedYear || selectedYear === finalYear) return spec;
    const subtitle = spec.chrome?.subtitle;
    const text = `${typeof subtitle === 'string' ? subtitle : (subtitle?.text ?? '')} · Preview through ${selectedYear}`;
    return {
      ...spec,
      data: spec.data.filter((row) => String(row[timeField]).slice(0, 4) <= selectedYear),
      chrome: {
        ...spec.chrome,
        subtitle: typeof subtitle === 'object' ? { ...subtitle, text } : text,
      },
    } as SupportedSpec;
  }, [spec, timeField, previewYear, selectedYear, finalYear]);
  const preview = useRef<PreviewHandle>(null);
  const reduceMotion = useReducedMotion();
  const changed = useRef(false);
  const change = (next: VizSpec) => {
    if (!isSupported(next)) {
      setNotice(
        'This reference workbench supports charts, maps, and tables. Use the library for other visualization types.',
      );
      return;
    }
    const validation = validateSpec(next);
    if (!validation.valid) {
      setNotice(validation.errors.map((error) => error.message).join('\n'));
      return;
    }
    changed.current = true;
    setHistory((current) => editDocument(current, next));
  };
  useEffect(() => {
    try {
      const draft = restoreDraft ? readDraft() : null;
      if (draft) {
        setHistory({ past: [], present: draft, future: [] });
        setSaved(true);
        setPattern('');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [restoreDraft]);
  useEffect(() => {
    if (!changed.current) return;
    setSaved(false);
    const save = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(spec));
        setSaved(true);
      } catch {
        setNotice(
          'This browser could not save the draft. Export the JSON document to keep your work.',
        );
      }
    };
    const timer = setTimeout(save, 350);
    const flush = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [spec]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable=true]'))
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        changed.current = true;
        setHistory(event.shiftKey ? redoDocument : undoDocument);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  const proposed = useMemo(() => {
    if (!patch) return null;
    try {
      return applySpecPatch(spec, patch) as SupportedSpec;
    } catch {
      return null;
    }
  }, [patch, spec]);
  const titleValue = spec.chrome?.title;
  const title =
    typeof titleValue === 'string' ? titleValue : (titleValue?.text ?? 'Untitled visualization');
  const table = 'type' in spec && spec.type === 'table';

  function importDocument(text: string) {
    try {
      checkImportSize(text);
      if (text.trimStart().startsWith('{')) {
        const result = validateSpec(JSON.parse(text));
        if (!result.valid || !result.normalized)
          throw new Error(result.errors.map((error) => error.message).join('\n'));
        if (!isSupported(result.normalized))
          throw new Error('Choose a chart, map, or table spec for this workbench.');
        if (result.normalized.data.length > MAX_IMPORT_ROWS)
          throw new Error('This workbench accepts up to 20,000 rows.');
        change(result.normalized);
      } else {
        const imported = importDelimited(text);
        change({
          type: 'table',
          theme: clarity,
          watermark: false,
          mobileLayout: 'priority',
          rowKey: imported.key,
          fields: {
            ...Object.fromEntries(
              Object.entries(imported.fields).map(([key, type]) => [key, { type }]),
            ),
            [imported.key]: { type: 'text', role: 'identity' },
          },
          data: imported.rows,
          columns: Object.keys(imported.fields).map((key) => ({ key, label: key, sortable: true })),
          pagination: { pageSize: 10 },
          chrome: {
            title: 'What does your data show?',
            subtitle: 'Choose a question to explore a composition.',
          },
        });
        setTab('recommend');
      }
      setImportOpen(false);
      setImportError('');
      setPattern('');
      setRoles({});
      setPreviewYear(null);
      setSelection(emptySelection);
      setView('data');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  }
  async function download() {
    setExporting(true);
    try {
      const format = table ? 'csv' : exportFormat;
      const result =
        format === 'csv' ? exportCSV(spec.data) : await preview.current?.export(format);
      if (result === undefined) throw new Error('Switch to preview before exporting.');
      const blob =
        typeof result === 'string'
          ? new Blob([result], {
              type: format === 'svg' ? 'image/svg+xml' : 'text/csv;charset=utf-8',
            })
          : result;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `openchart.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Your ${format.toUpperCase()} export is ready.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }
  const patterns = (
    <>
      <div className="studio-rail-title">
        <span className="studio-eyebrow">A starting point</span>
        <h2>What’s the story?</h2>
        <p>
          Eight considered compositions.
          <br />
          Make one your own.
        </p>
      </div>
      <div className="studio-patterns">
        {referencePatterns.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={`studio-pattern ${pattern === item.id ? 'is-active' : ''}`}
            aria-pressed={pattern === item.id}
            onClick={() => {
              change(structuredClone(item.spec));
              setPattern(item.id);
              setPreviewYear(null);
              setRoles({});
              setPanel(null);
              setSelection(emptySelection);
              setView('preview');
            }}
          >
            <div className="studio-pattern-top">
              <span>0{index + 1}</span>
              <PatternThumbnail kind={item.id} />
            </div>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
    </>
  );
  const inspector = (
    <Inspector
      spec={spec}
      tab={tab}
      onTabChange={setTab}
      onChange={change}
      diagnostics={diagnostics}
      onPreview={setPatch}
      question={question}
      setQuestion={setQuestion}
      roles={roles}
      setRoles={setRoles}
    />
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className="studio">
        <header className="studio-header">
          <a className="studio-brand" href="./workbench.html">
            <svg viewBox="0 0 28 28" aria-hidden="true">
              <path d="M3 24V13M10 24V4M17 24V9M24 24V1" />
            </svg>
            <span>
              OpenChart <small>STUDIO</small>
            </span>
          </a>
          <div className="studio-document">
            <span>{title}</span>
            <small>{saved ? 'Saved in this browser' : 'Local draft'}</small>
          </div>
          <div className="studio-header-actions">
            <button
              type="button"
              className="studio-mobile-control"
              onClick={() => setPanel('patterns')}
            >
              Patterns
            </button>
            <button
              type="button"
              onClick={() => {
                setImportError('');
                setImportOpen(true);
              }}
            >
              Import data
            </button>
            <select
              aria-label="Export format"
              value={table ? 'csv' : exportFormat}
              onChange={(event) => setExportFormat(event.target.value as typeof exportFormat)}
            >
              {!table && (
                <>
                  <option value="svg">SVG</option>
                  <option value="png">PNG</option>
                </>
              )}
              <option value="csv">CSV</option>
            </select>
            <button
              type="button"
              className="studio-primary"
              disabled={exporting}
              onClick={download}
            >
              {exporting ? 'Exporting…' : 'Export ↗'}
            </button>
          </div>
        </header>
        <div className="studio-body">
          <aside className="studio-rail">{patterns}</aside>
          <main className="studio-main">
            <div className="studio-toolbar">
              <fieldset className="studio-segmented" aria-label="Workspace view">
                {(['preview', 'data'] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={view === item}
                    onClick={() => setView(item)}
                  >
                    {item === 'preview' ? 'Canvas' : 'Data'}
                  </button>
                ))}
              </fieldset>
              <div className="studio-tools">
                <button
                  type="button"
                  disabled={!history.past.length}
                  aria-label="Undo"
                  title="Undo (⌘Z / Ctrl+Z)"
                  onClick={() => {
                    changed.current = true;
                    setHistory(undoDocument);
                  }}
                >
                  ↶
                </button>
                <button
                  type="button"
                  disabled={!history.future.length}
                  aria-label="Redo"
                  onClick={() => {
                    changed.current = true;
                    setHistory(redoDocument);
                  }}
                >
                  ↷
                </button>
                <span className="studio-tool-divider" />
                <button type="button" onClick={() => setReplay((value) => value + 1)}>
                  ↻ Replay
                </button>
                <label className="studio-size">
                  <span className="studio-sr-only">Preview width</span>
                  <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
                    {[320, 390, 768, 1280].map((value) => (
                      <option key={value} value={value}>
                        {value < 400 ? 'Phone' : value === 768 ? 'Article' : 'Wide'} · {value}px
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="studio-mobile-control"
                  onClick={() => setPanel('inspector')}
                >
                  Edit
                </button>
              </div>
            </div>
            {notice && (
              <output className="studio-notice">
                <span>{notice}</span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => setNotice('')}
                >
                  ×
                </button>
              </output>
            )}
            <div className="studio-workspace">
              {view === 'data' && (
                <DataEditor
                  data={spec.data}
                  fields={spec.fields}
                  onChange={(data, fields) => change({ ...spec, data, fields } as SupportedSpec)}
                />
              )}
              <div
                className={`studio-preview-area ${view === 'data' ? 'is-hidden' : ''}`}
                inert={view === 'data'}
              >
                <div className="studio-preview-meta">
                  <span>LIVE PREVIEW</span>
                  <span>{width}px target · fits available space</span>
                </div>
                <motion.div
                  className="studio-paper"
                  animate={{ maxWidth: width }}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 32 }
                  }
                >
                  <Preview
                    ref={preview}
                    editing={editing && previewSpec === spec}
                    onReview={setDiagnostics}
                    spec={previewSpec}
                    editSource={spec}
                    replay={replay}
                    onChange={change}
                    onInspect={setSelection}
                  />
                </motion.div>
                {years.length > 1 && (
                  <div className="studio-narrative">
                    <label>
                      Preview through{' '}
                      <input
                        type="range"
                        aria-label="Preview through year"
                        min="0"
                        max={years.length - 1}
                        value={years.indexOf(selectedYear!)}
                        onChange={(event) => {
                          setPreviewYear(years[Number(event.target.value)]);
                          setEditing(false);
                        }}
                      />
                    </label>
                    <strong>{selectedYear}</strong>
                    <small>
                      Preview and image exports follow this year. Your complete dataset stays in the
                      document.
                    </small>
                  </div>
                )}
                {!('type' in spec) && (
                  <div className="studio-edit-mode">
                    <button
                      type="button"
                      aria-pressed={editing}
                      onClick={() => {
                        setPreviewYear(null);
                        setEditing(!editing);
                        setSelection(emptySelection);
                      }}
                    >
                      {previewSpec !== spec
                        ? 'Show all years to edit chart'
                        : editing
                          ? 'Done editing chart'
                          : 'Edit chart elements'}
                    </button>
                    <p>
                      {editing
                        ? 'Double-click text to edit. Drag labels or annotations. Changes can be undone.'
                        : 'Inspect values below, or edit text and annotations directly on the chart.'}
                    </p>
                  </div>
                )}
                <ReaderPanel
                  selection={selection}
                  spec={spec}
                  onClose={() => preview.current?.clearSelection()}
                />
                <div className="studio-evidence">
                  <span>Every chart starts with evidence.</span>
                  <button type="button" onClick={() => setView('data')}>
                    View data →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('design');
                      setPanel('inspector');
                    }}
                  >
                    Source & methodology →
                  </button>
                </div>
              </div>
            </div>
            <footer className="studio-footer">
              <span>Portable by design. Yours to publish.</span>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const draft = readDraft();
                      if (draft) change(draft);
                      else setNotice('No saved draft yet. Your first edit creates one.');
                    } catch (error) {
                      setNotice(String(error));
                    }
                  }}
                >
                  Reopen draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJson(JSON.stringify(spec, null, 2));
                    setImportError('');
                    setJsonOpen(true);
                  }}
                >
                  JSON document
                </button>
              </div>
            </footer>
          </main>
          <aside className="studio-inspector">{inspector}</aside>
        </div>
        {panel && (
          <Sheet
            title={panel === 'patterns' ? 'Choose a starting point' : 'Refine your visualization'}
            onClose={() => setPanel(null)}
          >
            {panel === 'patterns' ? patterns : inspector}
          </Sheet>
        )}
        {importOpen && (
          <Sheet title="Start with your data" onClose={() => setImportOpen(false)}>
            <p>
              Paste CSV, TSV, or an existing OpenChart JSON document. Your data stays in this
              browser.
            </p>
            <label className="studio-field">
              Choose a local file
              <input
                type="file"
                accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_IMPORT_BYTES) {
                    setImportError('Choose a file smaller than 5 MB.');
                    return;
                  }
                  try {
                    const text = await file.text();
                    setSource(text);
                  } catch {
                    setImportError('The file could not be read. Try choosing it again.');
                  }
                }}
              />
            </label>
            <label className="studio-field">
              Or paste data
              <textarea
                rows={12}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder={'country,value\nJapan,84.7\nBrazil,75.8'}
              />
            </label>
            {importError && (
              <p role="alert" className="studio-error">
                {importError}
              </p>
            )}
            <button
              type="button"
              className="studio-primary"
              disabled={!source.trim()}
              onClick={() => importDocument(source)}
            >
              Preview your data →
            </button>
          </Sheet>
        )}
        {jsonOpen && (
          <Sheet title="Portable JSON document" onClose={() => setJsonOpen(false)}>
            <p>This is the same VizSpec used by the library. Editing JSON is optional.</p>
            <label className="studio-field">
              <span className="studio-sr-only">JSON spec</span>
              <textarea
                className="studio-code"
                rows={20}
                value={json}
                onChange={(event) => setJson(event.target.value)}
              />
            </label>
            {importError && (
              <p role="alert" className="studio-error">
                {importError}
              </p>
            )}
            <button
              type="button"
              className="studio-primary"
              onClick={() => {
                try {
                  checkImportSize(json);
                  const result = validateSpec(JSON.parse(json));
                  if (!result.valid || !result.normalized)
                    throw new Error(result.errors.map((error) => error.message).join('\n'));
                  if (!isSupported(result.normalized))
                    throw new Error('This workbench supports charts, maps, and tables.');
                  if (result.normalized.data.length > MAX_IMPORT_ROWS)
                    throw new Error('This workbench accepts up to 20,000 rows.');
                  change(result.normalized);
                  setJsonOpen(false);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : String(error));
                }
              }}
            >
              Apply document
            </button>
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'openchart.json';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download JSON
            </button>
          </Sheet>
        )}
        {patch && (
          <Sheet title="Review the improvement" onClose={() => setPatch(null)}>
            <p>
              {patch.label}. Nothing changes until you apply it. Undo restores the previous
              document.
            </p>
            {proposed ? (
              <div className="studio-fix-preview">
                <h3>Before</h3>
                <Preview
                  spec={{ ...spec, animation: false }}
                  replay={0}
                  onChange={() => {}}
                  onInspect={() => {}}
                />
                <h3>After</h3>
                <Preview
                  spec={{ ...proposed, animation: false }}
                  replay={0}
                  onChange={() => {}}
                  onInspect={() => {}}
                />
                <button
                  type="button"
                  className="studio-primary"
                  onClick={() => {
                    change(proposed);
                    setPatch(null);
                  }}
                >
                  Apply improvement
                </button>
              </div>
            ) : (
              <p role="alert">The document changed. Close this preview and run the review again.</p>
            )}
          </Sheet>
        )}
      </div>
    </MotionConfig>
  );
}
