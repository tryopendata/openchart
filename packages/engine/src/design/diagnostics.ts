import type { ChartLayout, ChartSpec, DesignDiagnostic } from '@opendata-ai/openchart-core';
import { computeLabelBounds, contrastRatio, isOpaqueColor } from '@opendata-ai/openchart-core';
import { resolveObservationIdentities } from './identity';

/** A fixed figure budget may be exhausted by the stable source-note capacity. */
export function noteCapacityDiagnostic(layout: ChartLayout): DesignDiagnostic | undefined {
  if ((layout.chrome.noteBandHeight ?? 0) <= 0 || layout.area.height > 0) return undefined;
  return {
    code: 'layout.note-capacity',
    path: '/annotations',
    origin: 'author',
    status: 'failed',
    severity: 'error',
    viewport: layout.dimensions,
    message:
      'Reserved annotation note capacity leaves no plotting space. Increase the requested height, explicitly choose chromeLayout: "grow", or reduce annotation text/count.',
  };
}

/** Checks use resolved geometry and authored metadata, never headline interpretation. */
export function diagnoseChart(spec: ChartSpec, layout: ChartLayout): DesignDiagnostic[] {
  const diagnostics: DesignDiagnostic[] = [];
  const viewport = layout.dimensions;
  const emit = (
    code: string,
    path: string,
    message: string,
    origin: 'author' | 'default',
    status: 'failed' | 'uncheckable' = 'failed',
    severity: 'info' | 'warning' | 'error' = 'warning',
  ) => {
    diagnostics.push({ code, path, message, origin, status, severity, viewport });
  };
  const key = spec.encoding.key?.field;
  if (key && resolveObservationIdentities(spec.data, key).some((id) => !id.persistent)) {
    emit(
      'identity.invalid-key',
      '/encoding/key',
      'Observation keys must be present and unique. Ambiguous selections cannot persist across revisions.',
      'author',
      'failed',
      'error',
    );
  }
  const channels = [spec.encoding.x, spec.encoding.y].filter(
    (channel) => channel && 'field' in channel,
  );
  for (const channel of channels) {
    if (!channel || !('field' in channel)) continue;
    const missing = spec.data.filter(
      (row) => row[channel.field] == null || row[channel.field] === '',
    ).length;
    if (missing)
      emit(
        'data.missing',
        '/data',
        `${missing} observations have no ${channel.field}. Missing values are not zero; explain omissions or gaps in the methodology.`,
        'author',
      );
    const meta = spec.fields?.[channel.field];
    if (meta?.representation === 'percent' && channel.format?.includes('%')) {
      emit(
        'format.percent-scale',
        '/encoding',
        'Percent values are already 0–100; a percent formatter multiplies them by 100. Choose a number format or supply proportions.',
        'author',
      );
    }
  }
  const colors = spec.encoding.color;
  if (colors && 'field' in colors && colors.type === 'nominal') {
    const count = new Set(spec.data.map((row) => row[colors.field])).size;
    if (count > 6)
      emit(
        'color.crowded',
        '/encoding/color',
        `${count} series compete for color. Highlight an authored focus or use small multiples.`,
        'author',
      );
  }
  const background = layout.theme.colors.background;
  if (!isOpaqueColor(background)) {
    emit(
      'contrast.unknown-background',
      '/theme/colors/background',
      'Contrast cannot be verified against a transparent background. Supply the host surface color for a check.',
      spec.theme?.colors ? 'author' : 'default',
      'uncheckable',
      'info',
    );
  } else if (contrastRatio(layout.theme.colors.axis, background) < 4.5) {
    emit(
      'contrast.axis',
      '/theme/colors/axis',
      'Axis text contrast is below 4.5:1 against the resolved background.',
      spec.theme?.colors ? 'author' : 'default',
    );
  }
  const labels = layout.marks.flatMap((mark) =>
    'label' in mark && mark.label?.visible ? [computeLabelBounds(mark.label)] : [],
  );
  let collision = false;
  for (let i = 0; i < labels.length && !collision; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i];
      const b = labels[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      ) {
        collision = true;
        break;
      }
    }
  }
  if (collision)
    emit(
      'labels.collision',
      '/labels',
      'Visible data labels overlap at this viewport. Increase space or reduce label density.',
      spec.labels ? 'author' : 'default',
    );
  if (
    spec.labels &&
    typeof spec.labels === 'object' &&
    spec.labels.density === 'all' &&
    layout.marks.some((mark) => 'label' in mark && mark.label && !mark.label.visible)
  ) {
    emit(
      'labels.hidden',
      '/labels',
      'Some requested labels cannot fit at this viewport. Inspect the data view or give the figure more room.',
      'author',
    );
  }
  const exhaustedNotes = noteCapacityDiagnostic(layout);
  if (exhaustedNotes) diagnostics.push(exhaustedNotes);
  else if (layout.area.width < 80 || layout.area.height < 80)
    emit(
      'layout.constrained',
      '/chromeLayout',
      'Essential chart content has less than 80px of plotting space. Grow the figure or simplify its composition.',
      spec.chromeLayout ? 'author' : 'default',
    );
  if (layout.theme.fonts.sizes.axisTick < 12) {
    emit(
      'type.small-axis',
      '/theme/fonts/sizes/axisTick',
      'Axis labels are smaller than the 12px editorial target.',
      spec.theme?.fonts?.sizes?.axisTick !== undefined ? 'author' : 'default',
      'failed',
      'info',
    );
    diagnostics[diagnostics.length - 1].fix = {
      label: 'Use 12px axis labels',
      precondition: JSON.stringify(spec),
      changes: [{ path: '/theme/fonts/sizes/axisTick', value: 12 }],
    };
  }
  return diagnostics;
}
