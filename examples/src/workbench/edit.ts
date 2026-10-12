import type { ChartSpec, ElementEdit } from '@opendata-ai/openchart-core';

/** Persist supported direct edits in VizSpec, preserving authored text styles. */
export function applyElementEdit(spec: ChartSpec, edit: ElementEdit): ChartSpec {
  const next = structuredClone(spec);
  if (edit.type === 'legend-toggle') return spec;
  if (edit.type === 'add') {
    next.annotations = [...(next.annotations ?? []), edit.annotation];
    return next;
  }
  if (edit.type === 'legend') {
    next.legend = { ...(typeof next.legend === 'object' ? next.legend : {}), offset: edit.offset };
    return next;
  }
  if (edit.type === 'series-label') {
    const labels = typeof next.labels === 'object' ? next.labels : {};
    next.labels = { ...labels, offsets: { ...labels.offsets, [edit.series]: edit.offset } };
    return next;
  }
  if (edit.type === 'chrome' || (edit.type === 'text-edit' && edit.element.type === 'chrome')) {
    const key =
      edit.type === 'chrome'
        ? edit.key
        : edit.element.type === 'chrome'
          ? edit.element.key
          : 'title';
    const current = next.chrome?.[key];
    const value = typeof current === 'object' ? current : { text: current ?? '' };
    next.chrome = {
      ...next.chrome,
      [key]: {
        ...value,
        ...(edit.type === 'chrome' ? { offset: edit.offset } : { text: edit.newText }),
      },
    };
    return next;
  }
  if ('element' in edit && edit.element.type === 'annotation') {
    const annotation = next.annotations?.[edit.element.index];
    if (!annotation || !next.annotations) return spec;
    if (edit.type === 'delete') next.annotations.splice(edit.element.index, 1);
    else if (edit.type === 'annotation' && annotation.type === 'text')
      annotation.offset = edit.offset;
    else if (edit.type === 'annotation-anchor' && annotation.type === 'text') {
      annotation.x = edit.x;
      annotation.y = edit.y;
    } else if (edit.type === 'annotation-connector' && annotation.type === 'text')
      annotation.connectorOffset = { ...annotation.connectorOffset, [edit.endpoint]: edit.offset };
    else if (
      (edit.type === 'range-label' || edit.type === 'refline-label') &&
      (annotation.type === 'range' || annotation.type === 'refline')
    )
      annotation.labelOffset = edit.labelOffset;
    else if (edit.type === 'text-edit') {
      if (annotation.type === 'text') annotation.text = edit.newText;
      else if (annotation.type === 'range' || annotation.type === 'refline')
        annotation.label = edit.newText;
    }
    return next;
  }
  if (edit.type === 'delete' && edit.element.type === 'chrome' && next.chrome) {
    delete next.chrome[edit.element.key];
    return next;
  }
  return spec;
}
