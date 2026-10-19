import type { TooltipContent, TooltipField } from '@opendata-ai/openchart-core';
/** Author order and supplementary fields survive; formatted text never decides identity. */
export function sharedTooltipFields(content: TooltipContent): TooltipField[] {
  return content.fields.filter(
    (field) => field.role !== 'x' && field.role !== 'series' && field.role !== 'total',
  );
}
export function scopeTooltipContent(
  content: TooltipContent,
  scope: { layer?: string; panel?: string },
): TooltipContent {
  return {
    ...content,
    fields: content.fields.map((field) =>
      field.source ? { ...field, source: { ...field.source, ...scope } } : field,
    ),
  };
}
