import { describe, expect, it } from 'vitest';
import { GraphSearchManager } from '../search';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const nodes = [
  { id: 'node-1', label: 'Alice' },
  { id: 'node-2', label: 'Bob' },
  { id: 'node-3', label: 'Charlie' },
  { id: 'node-4', label: 'alice-bob' },
  { id: 'alpha-5' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphSearchManager', () => {
  it('matches case-insensitively on label', () => {
    const search = new GraphSearchManager();
    const matches = search.search('alice', nodes);
    expect(matches.has('node-1')).toBe(true); // label "Alice"
    expect(matches.has('node-4')).toBe(true); // label "alice-bob"
    expect(matches.size).toBe(2);
  });

  it('matches on node id when label does not match', () => {
    const search = new GraphSearchManager();
    const matches = search.search('alpha', nodes);
    expect(matches.has('alpha-5')).toBe(true);
    expect(matches.size).toBe(1);
  });

  it('supports partial/substring matches', () => {
    const search = new GraphSearchManager();
    const matches = search.search('ob', nodes);
    // "Bob" contains "ob", "alice-bob" contains "ob"
    expect(matches.has('node-2')).toBe(true);
    expect(matches.has('node-4')).toBe(true);
  });

  it('returns empty set for no matches', () => {
    const search = new GraphSearchManager();
    const matches = search.search('zzz', nodes);
    expect(matches.size).toBe(0);
  });

  it('returns empty set for empty query (clears search)', () => {
    const search = new GraphSearchManager();
    const matches = search.search('', nodes);
    expect(matches.size).toBe(0);
  });

  it('treats whitespace-only query as empty', () => {
    const search = new GraphSearchManager();
    const matches = search.search('   ', nodes);
    expect(matches.size).toBe(0);
  });

  it('clearSearch returns null', () => {
    const search = new GraphSearchManager();
    search.search('alice', nodes);
    const result = search.clearSearch();
    expect(result).toBeNull();
  });

  it('getMatches returns current state', () => {
    const search = new GraphSearchManager();
    expect(search.getMatches()).toBeNull();

    search.search('bob', nodes);
    const matches = search.getMatches();
    expect(matches).not.toBeNull();
    expect(matches!.has('node-2')).toBe(true);

    search.clearSearch();
    expect(search.getMatches()).toBeNull();
  });

  it('handles nodes without labels', () => {
    const search = new GraphSearchManager();
    const matches = search.search('alpha', nodes);
    // node "alpha-5" has no label but id matches
    expect(matches.has('alpha-5')).toBe(true);
  });
});
