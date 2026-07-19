/**
 * Graph search manager.
 *
 * Provides case-insensitive substring matching against node labels/ids.
 * Returns a Set of matching node ids that the renderer uses to dim
 * non-matching nodes and edges.
 */

export class GraphSearchManager {
  private matchedIds: Set<string> | null = null;
  /** The last active (non-empty) query, so a data update can re-run it. */
  private query: string | null = null;

  /**
   * Search for nodes matching the query string.
   * Returns a Set of matching node ids, or an empty set if nothing matches.
   */
  search(query: string, nodes: Array<{ id: string; label?: string }>): Set<string> {
    const q = query.toLowerCase().trim();

    if (q === '') {
      this.matchedIds = null;
      this.query = null;
      return new Set();
    }

    this.query = query;

    const matches = new Set<string>();
    for (const node of nodes) {
      const label = (node.label ?? '').toLowerCase();
      const id = node.id.toLowerCase();
      if (label.includes(q) || id.includes(q)) {
        matches.add(node.id);
      }
    }

    this.matchedIds = matches;
    return matches;
  }

  /**
   * Clear the current search.
   * Returns null to indicate no active search.
   */
  clearSearch(): Set<string> | null {
    this.matchedIds = null;
    this.query = null;
    return null;
  }

  /** Get the current set of matched ids, or null if no search is active. */
  getMatches(): Set<string> | null {
    return this.matchedIds;
  }

  /** The last active query string, or null when no search is active. */
  getQuery(): string | null {
    return this.query;
  }
}
