import { expect, it } from 'vitest';
import { createSVGElement } from '../../renderers/svg-dom';
import { setNumbers } from '../svg-attrs';

it('writes finite SVG numbers at up to two decimal places and skips invalid values', () => {
  const element = createSVGElement('rect');
  setNumbers(element, { x: 12.345, y: -4.567, width: 20.1, height: NaN });
  expect([...element.attributes].map(({ name, value }) => [name, value])).toEqual([
    ['x', '12.35'],
    ['y', '-4.57'],
    ['width', '20.1'],
  ]);
  setNumbers(element, { x: Infinity, y: -Infinity, width: 20, height: 0 });
  expect([...element.attributes].map(({ name, value }) => [name, value])).toEqual([
    ['x', '12.35'],
    ['y', '-4.57'],
    ['width', '20'],
    ['height', '0'],
  ]);
});
