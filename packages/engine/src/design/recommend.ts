import type {
  ChartSpec,
  CompositionRecommendation,
  DataRow,
  DesignQuestion,
} from '@opendata-ai/openchart-core';

export interface RecommendationRoles {
  measure?: string;
  category?: string;
  time?: string;
  secondMeasure?: string;
  series?: string;
}
export interface RecommendationResult {
  recommendations: CompositionRecommendation[];
  missingRoles: string[];
  explanation?: string;
}

/** Deterministic suggestions require an explicit question and field roles. No aggregation is inferred. */
export function recommendCompositions(
  data: DataRow[],
  question: DesignQuestion,
  roles: RecommendationRoles,
): RecommendationResult {
  if (!data.length)
    return {
      recommendations: [],
      missingRoles: ['data'],
      explanation: 'Add observations before choosing a composition.',
    };
  const required: Record<DesignQuestion, Array<keyof RecommendationRoles>> = {
    comparison: ['measure', 'category'],
    change: ['measure', 'time'],
    distribution: ['measure'],
    composition: ['measure', 'category'],
    geography: ['measure', 'category'],
    relationships: ['measure', 'secondMeasure'],
  };
  const missingRoles = required[question].filter(
    (role) => !roles[role] || !data.some((row) => Object.hasOwn(row, roles[role]!)),
  );
  if (missingRoles.length) return { recommendations: [], missingRoles };
  if (question === 'geography')
    return {
      recommendations: [],
      missingRoles: ['geographic features and join key'],
      explanation: 'Choose a geography and explicit join before creating a map.',
    };
  for (const field of [
    roles.measure,
    ...(question === 'relationships' ? [roles.secondMeasure] : []),
  ]) {
    const present = data.map((row) => row[field!]).filter((value) => value != null);
    if (
      !present.length ||
      present.some((value) => typeof value !== 'number' || !Number.isFinite(value))
    )
      return {
        recommendations: [],
        missingRoles: ['numeric measure'],
        explanation: `Correct the type or values of “${field}” in Data before using it as a measure.`,
      };
  }
  if (question === 'change') {
    if (
      data.some(
        (row) => row[roles.time!] == null || !Number.isFinite(Date.parse(String(row[roles.time!]))),
      )
    )
      return {
        recommendations: [],
        missingRoles: ['valid date'],
        explanation: 'Correct missing or invalid dates before connecting observations.',
      };
    const keys = data.map((row) =>
      JSON.stringify([roles.series ? row[roles.series] : null, row[roles.time!]]),
    );
    if (new Set(keys).size !== keys.length)
      return {
        recommendations: [],
        missingRoles: ['unique date per series'],
        explanation: 'Repeated dates need a series field or an explicit aggregation decision.',
      };
  }
  const measure = { field: roles.measure!, type: 'quantitative' as const };
  const category = { field: roles.category!, type: 'nominal' as const, sort: null };
  const recommendations: CompositionRecommendation[] = [];
  const add = (id: string, title: string, reason: string, tradeoff: string, spec: ChartSpec) =>
    recommendations.push({ id, title, reason, tradeoff, spec });
  if (question === 'comparison' || question === 'composition') {
    const seen = new Set(data.map((row) => row[roles.category!]));
    if (seen.size !== data.length)
      return {
        recommendations: [],
        missingRoles: ['aggregation or a unique category'],
        explanation: 'Repeated categories need an explicit grouping or aggregation decision.',
      };
    add(
      'bars',
      'Compare on a shared baseline',
      'Position and length make differences easy to judge.',
      'Long category lists need more vertical space. Input order is preserved.',
      { mark: 'bar', data, encoding: { x: measure, y: category } },
    );
    add(
      'dots',
      'A quieter dot comparison',
      'Points emphasize positions without a wall of filled bars.',
      'Small differences may need direct value labels.',
      { mark: 'point', data, encoding: { x: measure, y: category } },
    );
    if (
      question === 'composition' &&
      data.every(
        (row) => typeof row[roles.measure!] === 'number' && Number(row[roles.measure!]) >= 0,
      ) &&
      data.some((row) => Number(row[roles.measure!]) > 0) &&
      data.length <= 6
    ) {
      add(
        'shares',
        'Show parts of a whole',
        'A donut makes the whole explicit when categories form a complete partition.',
        'Only use this if the categories are mutually exclusive parts of the same total; bars are more precise.',
        {
          mark: { type: 'arc', innerRadius: 0.65 },
          data,
          encoding: { theta: measure, color: category },
        },
      );
    }
  } else if (question === 'change') {
    const encoding = {
      x: { field: roles.time!, type: 'temporal' as const },
      y: measure,
      ...(roles.series ? { color: { field: roles.series, type: 'nominal' as const } } : {}),
    };
    add(
      'trend',
      'Trace change over time',
      'Connected observations make direction and reversals visible.',
      'Connections assume comparable measurements across dates; missing observations need explanation.',
      { mark: 'line', data, encoding },
    );
    if (roles.series)
      add(
        'small-multiples',
        'Give every series its own space',
        'Shared scales reduce crowding and retain comparison.',
        'Requires more height than an overlaid chart.',
        {
          mark: 'line',
          data,
          encoding: { ...encoding, facet: { field: roles.series, type: 'nominal' } },
        },
      );
  } else if (question === 'distribution') {
    add(
      'distribution',
      'Show the distribution',
      'A histogram reveals spread, skew, and concentrations.',
      'Bin boundaries affect appearance. Review them before drawing conclusions.',
      { mark: 'histogram', data, encoding: { x: measure } },
    );
  } else {
    add(
      'relationship',
      'Inspect the relationship',
      'A scatterplot exposes clusters and unusual observations.',
      'Association does not establish causation; dense data may overlap.',
      {
        mark: 'point',
        data,
        encoding: { x: measure, y: { field: roles.secondMeasure!, type: 'quantitative' } },
      },
    );
  }
  return { recommendations: recommendations.slice(0, 3), missingRoles: [] };
}
