import type { RaceMarkEntry } from './marks';

export const computeLineStatic: RaceMarkEntry<'line'>['computeStatic'] = (
  _model,
  _base,
  _mark,
  _measureText,
) => {
  throw new Error('not implemented');
};

export const lineGeometry: RaceMarkEntry<'line'>['geometry'] = (_model, _layout, _frame) => {
  throw new Error('not implemented');
};
