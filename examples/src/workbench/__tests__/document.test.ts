import { validateSpec } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import {
  checkImportSize,
  coerceField,
  editDocument,
  fieldType,
  importDelimited,
  redoDocument,
  undoDocument,
} from '../document';
import { applyElementEdit } from '../edit';
import { referencePatterns, revenueSpec } from '../patterns';

describe('workbench document', () => {
  it('imports quoted CSV and preserves identifiers, missing values and persistent row keys', () => {
    let count = 0;
    const result = importDelimited(
      'id,name,value\n001,"One, two",12.5\n002,Three,',
      () => `row-${count++}`,
    );
    expect(result.rows).toEqual([
      { _rowId: 'row-0', id: '001', name: 'One, two', value: 12.5 },
      { _rowId: 'row-1', id: '002', name: 'Three', value: null },
    ]);
    expect(result.fields.id).toBe('text');
    expect(() => importDelimited('x,x\n1,2')).toThrow('unique');
    expect(() => importDelimited('x,y\n1,2,3')).toThrow('same number');
  });
  it('undoes and redoes complete document edits', () => {
    const state = { past: [], present: revenueSpec, future: [] };
    const next = editDocument(state, { ...revenueSpec, chrome: { title: 'Edited' } });
    expect(undoDocument(next).present).toEqual(revenueSpec);
    expect(redoDocument(undoDocument(next)).present).toEqual(next.present);
  });
  it('keeps every reference pattern a valid portable spec', () => {
    for (const pattern of referencePatterns)
      expect(validateSpec(pattern.spec).errors, pattern.id).toEqual([]);
  });
  it('preserves explicit field types through portable JSON and rejects ambiguous conversions', () => {
    const fields = JSON.parse(JSON.stringify({ value: { type: 'text' } }));
    expect(fieldType([{ value: '120' }], 'value', fields)).toBe('text');
    expect(() => coerceField('2025-02-29', 'date')).toThrow('valid ISO date');
    expect(coerceField('2024-02-29', 'date')).toBe('2024-02-29T00:00:00.000Z');
    expect(() => coerceField('0x10', 'number')).toThrow('not a number');
    expect(() => coerceField(' ', 'number')).toThrow('not a number');
    expect(() => checkImportSize('a'.repeat(5_000_001))).toThrow('5 MB');
    expect(() => importDelimited(`x\n${'1\n'.repeat(20_001)}`)).toThrow('20,000');
  });
  it('persists direct edits without dropping authored text styles and supports undo', () => {
    const source = {
      ...revenueSpec,
      chrome: { title: { text: 'Original', style: { color: '#0f766e' } } },
    };
    const edited = applyElementEdit(source, {
      type: 'text-edit',
      element: { type: 'chrome', key: 'title' },
      oldText: 'Original',
      newText: 'Revised',
    });
    expect(edited.chrome?.title).toEqual({ text: 'Revised', style: { color: '#0f766e' } });
    expect(source.chrome.title.text).toBe('Original');
    expect(
      undoDocument(editDocument({ past: [], present: source, future: [] }, edited)).present,
    ).toEqual(source);
  });
});
