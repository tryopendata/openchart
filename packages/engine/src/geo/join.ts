import type { CompileWarning } from '@opendata-ai/openchart-core';

export function normalizeFips(value: string | number, digits: 2 | 5 = 2): string {
  return String(value).padStart(digits, '0');
}

function detectKeyFormat(keys: string[]): string | null {
  if (keys.length === 0) return null;
  const allNumeric = keys.every((k) => /^\d+$/.test(k));
  if (allNumeric) {
    const maxLen = Math.max(...keys.map((k) => k.length));
    if (maxLen <= 2) return 'state-fips';
    if (maxLen <= 3) return 'iso-numeric';
    if (maxLen <= 5) return 'county-fips';
  }
  if (keys.every((k) => /^[A-Z]{2}$/.test(k))) return 'iso-alpha2';
  if (keys.every((k) => /^[A-Z]{3}$/.test(k))) return 'iso-alpha3';
  return null;
}

function suggestNormalization(unmatchedKeys: string[], featureIds: string[]): string | null {
  const dataFormat = detectKeyFormat(unmatchedKeys);
  const featureFormat = detectKeyFormat(featureIds);

  if (dataFormat === 'state-fips' && featureFormat === 'state-fips') {
    const needsPadding = unmatchedKeys.some((k) => k.length === 1);
    if (needsPadding) return 'Data keys appear to need zero-padding (e.g. "1" -> "01").';
  }
  if (dataFormat === 'county-fips') {
    const needsPadding = unmatchedKeys.some((k) => k.length < 5);
    if (needsPadding)
      return 'County FIPS codes should be 5 digits with zero-padding (e.g. "1001" -> "01001").';
  }
  return null;
}

export interface JoinResult {
  joined: Map<string | number, Record<string, unknown>>;
  warnings: CompileWarning[];
}

export function joinDataToFeatures(
  features: Array<{ id: string | number; properties: Record<string, unknown> }>,
  data: Record<string, unknown>[],
  dataKeyField: string,
  featureIdField: string,
): JoinResult {
  const warnings: CompileWarning[] = [];

  const dataLookup = new Map<string, Record<string, unknown>>();
  const duplicates = new Set<string>();
  const lowerCounts = new Map<string, number>();
  let missingKeys = 0;
  for (const row of data) {
    const value = row[dataKeyField];
    if (value == null || String(value).trim() === '') {
      missingKeys++;
      continue;
    }
    const key = String(value);
    if (dataLookup.has(key)) duplicates.add(key);
    dataLookup.set(key, row);
    lowerCounts.set(key.toLowerCase(), (lowerCounts.get(key.toLowerCase()) ?? 0) + 1);
  }
  if (duplicates.size)
    warnings.push({
      code: 'DUPLICATE_DATA_KEYS',
      message: `${duplicates.size} duplicate map key(s) are ambiguous and will use neutral fill. Filter or aggregate to one observation per feature.`,
      context: { keys: [...duplicates] },
    });
  if (missingKeys)
    warnings.push({
      code: 'MISSING_DATA_KEYS',
      message: `${missingKeys} data row(s) have no map key.`,
      context: { count: missingKeys },
    });
  const ambiguousFallbacks = new Set<string>();
  const joined = new Map<string | number, Record<string, unknown>>();
  const usedDataKeys = new Set<string>();
  let lowerLookup: Map<string, Record<string, unknown>> | null = null;
  let unmatchedFeatureCount = 0;

  for (const feature of features) {
    const featureId =
      featureIdField === 'id'
        ? String(feature.id)
        : String(feature.properties[featureIdField] ?? feature.id);

    let match = duplicates.has(featureId) ? undefined : dataLookup.get(featureId);

    // Try case-insensitive fallback for name-based joins
    if (!match && !duplicates.has(featureId)) {
      if (!lowerLookup) {
        lowerLookup = new Map<string, Record<string, unknown>>();
        for (const [key, row] of dataLookup) {
          if (lowerCounts.get(key.toLowerCase()) === 1) lowerLookup.set(key.toLowerCase(), row);
        }
      }
      const lower = featureId.toLowerCase();
      match = lowerLookup.get(lower);
      if (!match && (lowerCounts.get(lower) ?? 0) > 1) ambiguousFallbacks.add(featureId);
    }

    if (match) {
      joined.set(feature.id, match);
      usedDataKeys.add(String(match[dataKeyField]));
    } else {
      unmatchedFeatureCount++;
    }
  }

  if (ambiguousFallbacks.size)
    warnings.push({
      code: 'AMBIGUOUS_DATA_KEYS',
      message: `${ambiguousFallbacks.size} feature(s) match multiple case variants and will use neutral fill. Use exact, unique keys.`,
      context: { keys: [...ambiguousFallbacks] },
    });
  const unmatchedDataKeys: string[] = [];
  for (const key of dataLookup.keys()) {
    if (!usedDataKeys.has(key)) {
      unmatchedDataKeys.push(key);
    }
  }

  if (unmatchedDataKeys.length > 0) {
    const sampleKeys = unmatchedDataKeys.slice(0, 5);
    const sampleFeatureIds = features.slice(0, 3).map((f) => String(f.id));
    const suggestion = suggestNormalization(unmatchedDataKeys, sampleFeatureIds);
    warnings.push({
      code: 'UNMATCHED_DATA_KEYS',
      message: `${unmatchedDataKeys.length} data row(s) matched no geo feature. Keys: ${sampleKeys.join(', ')}${unmatchedDataKeys.length > 5 ? ` (and ${unmatchedDataKeys.length - 5} more)` : ''}.${suggestion ? ` ${suggestion}` : ''} Expected format matches feature IDs like: ${sampleFeatureIds.join(', ')}.`,
      context: { keys: unmatchedDataKeys },
    });
  }

  if (unmatchedFeatureCount > 0) {
    warnings.push({
      code: 'UNMATCHED_FEATURES',
      message: `${unmatchedFeatureCount} geo feature(s) have no matching data and will use neutral fill.`,
      context: { count: unmatchedFeatureCount },
    });
  }

  return { joined, warnings };
}
