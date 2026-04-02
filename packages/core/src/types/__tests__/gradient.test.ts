import { describe, expect, it } from 'vitest';
import type { GradientDef } from '../spec';
import { getRepresentativeColor, isGradientDef } from '../spec';

describe('isGradientDef', () => {
  it('returns true for a valid linear gradient', () => {
    expect(
      isGradientDef({
        gradient: 'linear',
        stops: [
          { offset: 0, color: '#f00' },
          { offset: 1, color: '#00f' },
        ],
      }),
    ).toBe(true);
  });

  it('returns true for a valid radial gradient', () => {
    expect(
      isGradientDef({
        gradient: 'radial',
        stops: [{ offset: 0, color: '#f00' }],
      }),
    ).toBe(true);
  });

  it('returns false for a plain string', () => {
    expect(isGradientDef('#ff0000')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGradientDef(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGradientDef(undefined)).toBe(false);
  });

  it('returns false for an object without gradient property', () => {
    expect(isGradientDef({ stops: [] })).toBe(false);
  });

  it('returns false for an object without stops', () => {
    expect(isGradientDef({ gradient: 'linear' })).toBe(false);
  });

  it('returns false for an object with invalid gradient type', () => {
    expect(isGradientDef({ gradient: 'mesh', stops: [] })).toBe(false);
  });
});

describe('getRepresentativeColor', () => {
  it('returns the string directly when given a string', () => {
    expect(getRepresentativeColor('#1b7fa3')).toBe('#1b7fa3');
  });

  it('returns the last stop color for a linear gradient', () => {
    const grad: GradientDef = {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#f00' },
        { offset: 0.5, color: '#0f0' },
        { offset: 1, color: '#00f' },
      ],
    };
    expect(getRepresentativeColor(grad)).toBe('#00f');
  });

  it('returns the last stop color for a radial gradient', () => {
    const grad: GradientDef = {
      gradient: 'radial',
      stops: [
        { offset: 0, color: '#fff' },
        { offset: 1, color: '#000' },
      ],
    };
    expect(getRepresentativeColor(grad)).toBe('#000');
  });

  it('returns #000000 for a gradient with empty stops array', () => {
    const grad: GradientDef = {
      gradient: 'linear',
      stops: [],
    };
    expect(getRepresentativeColor(grad)).toBe('#000000');
  });

  it('returns the single stop color for a gradient with one stop', () => {
    const grad: GradientDef = {
      gradient: 'radial',
      stops: [{ offset: 0, color: '#abc' }],
    };
    expect(getRepresentativeColor(grad)).toBe('#abc');
  });
});
