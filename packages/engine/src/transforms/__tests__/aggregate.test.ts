import { describe, expect, it } from 'vitest';
import { runAggregate } from '../aggregate';

describe('runAggregate', () => {
  const data = [
    { region: 'North', product: 'A', revenue: 100, qty: 10 },
    { region: 'North', product: 'B', revenue: 200, qty: 20 },
    { region: 'South', product: 'A', revenue: 150, qty: 15 },
    { region: 'South', product: 'B', revenue: 250, qty: 25 },
    { region: 'South', product: 'A', revenue: 50, qty: 5 },
  ];

  it('computes sum aggregate grouped by one field', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'sum', field: 'revenue', as: 'total_revenue' }],
      groupby: ['region'],
    });

    expect(result).toHaveLength(2);
    const north = result.find((r) => r.region === 'North');
    const south = result.find((r) => r.region === 'South');
    expect(north?.total_revenue).toBe(300);
    expect(south?.total_revenue).toBe(450);
  });

  it('computes mean aggregate', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'mean', field: 'revenue', as: 'avg_revenue' }],
      groupby: ['region'],
    });

    const north = result.find((r) => r.region === 'North');
    const south = result.find((r) => r.region === 'South');
    expect(north?.avg_revenue).toBe(150); // (100+200)/2
    expect(south?.avg_revenue).toBe(150); // (150+250+50)/3
  });

  it('computes count aggregate', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'count', field: 'revenue', as: 'num_rows' }],
      groupby: ['region'],
    });

    const north = result.find((r) => r.region === 'North');
    const south = result.find((r) => r.region === 'South');
    expect(north?.num_rows).toBe(2);
    expect(south?.num_rows).toBe(3);
  });

  it('computes median aggregate', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'median', field: 'revenue', as: 'med_revenue' }],
      groupby: ['region'],
    });

    const north = result.find((r) => r.region === 'North');
    const south = result.find((r) => r.region === 'South');
    expect(north?.med_revenue).toBe(150); // median of [100, 200]
    expect(south?.med_revenue).toBe(150); // median of [50, 150, 250]
  });

  it('computes min and max aggregates', () => {
    const result = runAggregate(data, {
      aggregate: [
        { op: 'min', field: 'revenue', as: 'min_rev' },
        { op: 'max', field: 'revenue', as: 'max_rev' },
      ],
      groupby: ['region'],
    });

    const south = result.find((r) => r.region === 'South');
    expect(south?.min_rev).toBe(50);
    expect(south?.max_rev).toBe(250);
  });

  it('supports multiple groupby fields', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'sum', field: 'revenue', as: 'total' }],
      groupby: ['region', 'product'],
    });

    expect(result).toHaveLength(4);
    const southA = result.find((r) => r.region === 'South' && r.product === 'A');
    expect(southA?.total).toBe(200); // 150 + 50
  });

  it('supports multiple aggregate ops in one transform', () => {
    const result = runAggregate(data, {
      aggregate: [
        { op: 'sum', field: 'revenue', as: 'total_rev' },
        { op: 'mean', field: 'qty', as: 'avg_qty' },
      ],
      groupby: ['region'],
    });

    const north = result.find((r) => r.region === 'North');
    expect(north?.total_rev).toBe(300);
    expect(north?.avg_qty).toBe(15); // (10+20)/2
  });

  it('computes variance aggregate', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'variance', field: 'revenue', as: 'var_rev' }],
      groupby: ['region'],
    });

    const south = result.find((r) => r.region === 'South');
    // South values: [150, 250, 50], mean=150, variance = ((0)^2 + (100)^2 + (-100)^2) / 3
    expect(south?.var_rev).toBeCloseTo(6666.667, 0);
  });

  it('computes stdev aggregate', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'stdev', field: 'revenue', as: 'sd_rev' }],
      groupby: ['region'],
    });

    const south = result.find((r) => r.region === 'South');
    // sqrt(6666.667) ≈ 81.65
    expect(south?.sd_rev).toBeCloseTo(81.65, 1);
  });

  it('computes distinct aggregate (counts unique raw values)', () => {
    const result = runAggregate(data, {
      aggregate: [{ op: 'distinct', field: 'product', as: 'n_products' }],
      groupby: ['region'],
    });

    const north = result.find((r) => r.region === 'North');
    const south = result.find((r) => r.region === 'South');
    expect(north?.n_products).toBe(2); // A, B
    expect(south?.n_products).toBe(2); // A, B (A appears twice but distinct=2)
  });

  it('computes q1 and q3 aggregates', () => {
    const result = runAggregate(data, {
      aggregate: [
        { op: 'q1', field: 'revenue', as: 'q1_rev' },
        { op: 'q3', field: 'revenue', as: 'q3_rev' },
      ],
      groupby: ['region'],
    });

    const south = result.find((r) => r.region === 'South');
    // South values sorted: [50, 150, 250]
    // q1: index = (3-1)*0.25 = 0.5 -> 50 + 0.5*(150-50) = 100
    // q3: index = (3-1)*0.75 = 1.5 -> 150 + 0.5*(250-150) = 200
    expect(south?.q1_rev).toBe(100);
    expect(south?.q3_rev).toBe(200);
  });

  it('handles empty data', () => {
    const result = runAggregate([], {
      aggregate: [{ op: 'sum', field: 'revenue', as: 'total' }],
      groupby: ['region'],
    });
    expect(result).toHaveLength(0);
  });
});
