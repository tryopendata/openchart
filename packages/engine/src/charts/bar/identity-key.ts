/** The identity a bar keeps across data updates and playback periods. */
import { serializeKeyValue } from '../../compiler/keys';

/**
 * A bar's `color|category` identity key: the serialized color value (empty without a color
 * field) and the serialized category value. Bar renderers stamp it as the mark key, playback
 * pivots on it, and time validation checks duplicates against it, so all of them agree.
 */
export function barIdentityKey(
  row: Record<string, unknown>,
  categoryField: string,
  colorField?: string,
): string {
  const series = colorField ? serializeKeyValue(row[colorField]) : '';
  return `${series}|${serializeKeyValue(row[categoryField])}`;
}
