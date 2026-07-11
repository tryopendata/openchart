import { describe, expect, it } from 'vitest';
import { MARK_ENCODING_RULES } from '../encoding';
import type { MarkType } from '../spec';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChannelNames(markType: MarkType): string[] {
  return Object.keys(MARK_ENCODING_RULES[markType]);
}

function getRequiredChannels(markType: MarkType): string[] {
  return Object.entries(MARK_ENCODING_RULES[markType])
    .filter(([, rule]) => rule.required)
    .map(([ch]) => ch);
}

function getOptionalChannels(markType: MarkType): string[] {
  return Object.entries(MARK_ENCODING_RULES[markType])
    .filter(([, rule]) => !rule.required)
    .map(([ch]) => ch);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MARK_ENCODING_RULES', () => {
  it('has entries for all 12 mark types', () => {
    const expectedTypes: MarkType[] = [
      'bar',
      'line',
      'area',
      'point',
      'circle',
      'arc',
      'text',
      'rule',
      'tick',
      'rect',
      'lollipop',
      'beeswarm',
    ];
    for (const type of expectedTypes) {
      expect(MARK_ENCODING_RULES[type]).toBeDefined();
    }
  });

  it('every mark type has x, y, color, size, and detail channels', () => {
    const baseChannels = ['x', 'y', 'color', 'size', 'detail'];
    for (const [_markType, rules] of Object.entries(MARK_ENCODING_RULES)) {
      for (const ch of baseChannels) {
        expect(rules[ch as keyof typeof rules]).toBeDefined();
      }
    }
  });
});

describe('bar encoding rules', () => {
  it('requires x and y', () => {
    expect(getRequiredChannels('bar')).toContain('x');
    expect(getRequiredChannels('bar')).toContain('y');
  });

  it('supports x2 and y2 as optional', () => {
    expect(getOptionalChannels('bar')).toContain('x2');
    expect(getOptionalChannels('bar')).toContain('y2');
  });

  it('supports opacity, tooltip, href, order, detail', () => {
    const optionals = getOptionalChannels('bar');
    expect(optionals).toContain('opacity');
    expect(optionals).toContain('tooltip');
    expect(optionals).toContain('href');
    expect(optionals).toContain('order');
    expect(optionals).toContain('detail');
  });

  it('does not support shape, strokeDash, text, theta, radius', () => {
    const channels = getChannelNames('bar');
    expect(channels).not.toContain('shape');
    expect(channels).not.toContain('strokeDash');
    expect(channels).not.toContain('text');
    expect(channels).not.toContain('theta');
    expect(channels).not.toContain('radius');
  });
});

describe('line encoding rules', () => {
  it('requires x (temporal/ordinal) and y (quantitative)', () => {
    const rules = MARK_ENCODING_RULES.line;
    expect(rules.x.required).toBe(true);
    expect(rules.x.allowedTypes).toContain('temporal');
    expect(rules.y.required).toBe(true);
    expect(rules.y.allowedTypes).toContain('quantitative');
  });

  it('supports strokeDash as optional', () => {
    expect(getOptionalChannels('line')).toContain('strokeDash');
  });

  it('does not support shape, text, theta, radius, x2, y2', () => {
    const channels = getChannelNames('line');
    expect(channels).not.toContain('shape');
    expect(channels).not.toContain('text');
    expect(channels).not.toContain('theta');
    expect(channels).not.toContain('radius');
    expect(channels).not.toContain('x2');
    expect(channels).not.toContain('y2');
  });
});

describe('point encoding rules', () => {
  it('accepts all four field types on x and y', () => {
    const rules = MARK_ENCODING_RULES.point;
    for (const axis of ['x', 'y'] as const) {
      expect(rules[axis].required).toBe(true);
      expect(rules[axis].allowedTypes).toContain('quantitative');
      expect(rules[axis].allowedTypes).toContain('temporal');
      expect(rules[axis].allowedTypes).toContain('nominal');
      expect(rules[axis].allowedTypes).toContain('ordinal');
    }
  });

  it('supports shape as optional', () => {
    expect(getOptionalChannels('point')).toContain('shape');
  });

  it('supports size as optional quantitative', () => {
    const rules = MARK_ENCODING_RULES.point;
    expect(rules.size.required).toBe(false);
    expect(rules.size.allowedTypes).toContain('quantitative');
  });
});

describe('arc encoding rules', () => {
  it('requires y (quantitative) and color (nominal/ordinal)', () => {
    const rules = MARK_ENCODING_RULES.arc;
    expect(rules.y.required).toBe(true);
    expect(rules.y.allowedTypes).toContain('quantitative');
    expect(rules.color.required).toBe(true);
    expect(rules.color.allowedTypes).toContain('nominal');
  });

  it('supports theta and radius as optional', () => {
    const optionals = getOptionalChannels('arc');
    expect(optionals).toContain('theta');
    expect(optionals).toContain('radius');
  });
});

describe('text encoding rules', () => {
  it('requires text channel', () => {
    const rules = MARK_ENCODING_RULES.text;
    expect(rules.text!.required).toBe(true);
  });

  it('has optional x and y', () => {
    const rules = MARK_ENCODING_RULES.text;
    expect(rules.x.required).toBe(false);
    expect(rules.y.required).toBe(false);
  });

  it('supports size as optional quantitative', () => {
    const rules = MARK_ENCODING_RULES.text;
    expect(rules.size.required).toBe(false);
    expect(rules.size.allowedTypes).toContain('quantitative');
  });
});

describe('rule encoding rules', () => {
  it('has optional x, y, x2, y2', () => {
    const rules = MARK_ENCODING_RULES.rule;
    expect(rules.x.required).toBe(false);
    expect(rules.y.required).toBe(false);
    expect(rules.x2!.required).toBe(false);
    expect(rules.y2!.required).toBe(false);
  });

  it('supports strokeDash as optional', () => {
    expect(getOptionalChannels('rule')).toContain('strokeDash');
  });
});

describe('tick encoding rules', () => {
  it('requires x and y', () => {
    expect(getRequiredChannels('tick')).toContain('x');
    expect(getRequiredChannels('tick')).toContain('y');
  });

  it('supports opacity, tooltip, href, detail', () => {
    const optionals = getOptionalChannels('tick');
    expect(optionals).toContain('opacity');
    expect(optionals).toContain('tooltip');
    expect(optionals).toContain('href');
    expect(optionals).toContain('detail');
  });
});

describe('rect encoding rules', () => {
  it('requires x and y', () => {
    expect(getRequiredChannels('rect')).toContain('x');
    expect(getRequiredChannels('rect')).toContain('y');
  });

  it('supports x2, y2, opacity, order', () => {
    const optionals = getOptionalChannels('rect');
    expect(optionals).toContain('x2');
    expect(optionals).toContain('y2');
    expect(optionals).toContain('opacity');
    expect(optionals).toContain('order');
  });
});

describe('lollipop encoding rules', () => {
  it('has the same rules as circle (semantic alias)', () => {
    const lollipopRules = MARK_ENCODING_RULES.lollipop;
    const circleRules = MARK_ENCODING_RULES.circle;
    expect(lollipopRules).toEqual(circleRules);
  });

  it('requires x (quantitative) and y (nominal/ordinal)', () => {
    const rules = MARK_ENCODING_RULES.lollipop;
    expect(rules.x.required).toBe(true);
    expect(rules.x.allowedTypes).toEqual(['quantitative']);
    expect(rules.y.required).toBe(true);
    expect(rules.y.allowedTypes).toContain('nominal');
    expect(rules.y.allowedTypes).toContain('ordinal');
  });
});

describe('beeswarm encoding rules', () => {
  it('marks both axes optional (the compiler enforces the combination)', () => {
    const rules = MARK_ENCODING_RULES.beeswarm;
    expect(rules.x.required).toBe(false);
    expect(rules.y.required).toBe(false);
  });

  it('accepts quantitative and nominal/ordinal on both axes', () => {
    const rules = MARK_ENCODING_RULES.beeswarm;
    for (const axis of [rules.x, rules.y]) {
      expect(axis.allowedTypes).toContain('quantitative');
      expect(axis.allowedTypes).toContain('nominal');
      expect(axis.allowedTypes).toContain('ordinal');
    }
  });

  it('supports optional size (quantitative) for sized dots', () => {
    const rules = MARK_ENCODING_RULES.beeswarm;
    expect(rules.size.required).toBe(false);
    expect(rules.size.allowedTypes).toEqual(['quantitative']);
  });
});

describe('common channels across marks', () => {
  it('tooltip is optional on all mark types', () => {
    const allTypes: MarkType[] = [
      'bar',
      'line',
      'area',
      'point',
      'circle',
      'arc',
      'text',
      'rule',
      'tick',
      'rect',
      'lollipop',
      'beeswarm',
    ];
    for (const type of allTypes) {
      const rules = MARK_ENCODING_RULES[type];
      if (rules.tooltip) {
        expect(rules.tooltip.required).toBe(false);
      }
    }
  });

  it('href is optional on all mark types that have it', () => {
    const allTypes: MarkType[] = [
      'bar',
      'line',
      'area',
      'point',
      'circle',
      'arc',
      'text',
      'rule',
      'tick',
      'rect',
      'lollipop',
      'beeswarm',
    ];
    for (const type of allTypes) {
      const rules = MARK_ENCODING_RULES[type];
      if (rules.href) {
        expect(rules.href.required).toBe(false);
      }
    }
  });

  it('opacity is optional quantitative on all mark types that have it', () => {
    const allTypes: MarkType[] = [
      'bar',
      'line',
      'area',
      'point',
      'circle',
      'arc',
      'text',
      'rule',
      'tick',
      'rect',
      'lollipop',
      'beeswarm',
    ];
    for (const type of allTypes) {
      const rules = MARK_ENCODING_RULES[type];
      if (rules.opacity) {
        expect(rules.opacity.required).toBe(false);
        expect(rules.opacity.allowedTypes).toContain('quantitative');
      }
    }
  });
});
