import type { RaceMarkEntry } from './marks';

export const computeTableStatic: RaceMarkEntry<'table'>['computeStatic'] = (
  _model,
  _base,
  _mark,
  _measureText,
) => {
  throw new Error('not implemented');
};

export const tableGeometry: RaceMarkEntry<'table'>['geometry'] = (_model, _layout, _frame) => {
  throw new Error('not implemented');
};
