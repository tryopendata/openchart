/**
 * Calculate transform: adds a computed field to each row.
 *
 * Supports arithmetic operations on fields and constant values.
 */

import type { CalculateExpression, CalculateTransform, DataRow } from '@opendata-ai/openchart-core';

/**
 * Evaluate a calculate expression against a datum.
 */
function evaluateExpression(datum: DataRow, expr: CalculateExpression): number {
  const fieldValue = Number(datum[expr.field]);

  // Unary operations (single field)
  switch (expr.op) {
    case 'abs':
      return Math.abs(fieldValue);
    case 'round':
      return Math.round(fieldValue);
    case 'floor':
      return Math.floor(fieldValue);
    case 'ceil':
      return Math.ceil(fieldValue);
    case 'log':
      return Math.log(fieldValue);
    case 'sqrt':
      return Math.sqrt(fieldValue);
  }

  // Binary operations (field + field2 or field + value)
  const operand = expr.field2 !== undefined ? Number(datum[expr.field2]) : (expr.value ?? 0);

  switch (expr.op) {
    case '+':
      return fieldValue + operand;
    case '-':
      return fieldValue - operand;
    case '*':
      return fieldValue * operand;
    case '/':
      return operand === 0 ? NaN : fieldValue / operand;
  }
}

/**
 * Apply a calculate transform to data rows.
 *
 * Adds a new field with the computed value to each row.
 *
 * @param data - Input rows.
 * @param transform - Calculate transform definition.
 * @returns New rows with the calculated field added.
 */
export function runCalculate(data: DataRow[], transform: CalculateTransform): DataRow[] {
  return data.map((row) => ({
    ...row,
    [transform.as]: evaluateExpression(row, transform.calculate),
  }));
}
