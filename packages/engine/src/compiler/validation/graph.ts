/** Graph spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { checkSchemeUnused, didYouMean } from './helpers';

// ---------------------------------------------------------------------------
// Graph validation
// ---------------------------------------------------------------------------

export function validateGraphSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  // Validate nodes array exists and is non-empty
  if (!Array.isArray(spec.nodes)) {
    errors.push({
      message: 'Spec error: graph spec requires a "nodes" array',
      path: '/nodes',
      code: 'MISSING_FIELD',
      suggestion:
        'Add a nodes array with objects that have an "id" field, e.g. nodes: [{ id: "a" }, { id: "b" }]',
    });
    return; // Can't validate further without nodes
  }

  if (spec.nodes.length === 0) {
    errors.push({
      message: 'Spec error: "nodes" must be a non-empty array',
      path: '/nodes',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one node, e.g. nodes: [{ id: "a" }]',
    });
    return;
  }

  // Validate each node has a string id
  const nodeIds = new Set<string>();
  const nodes = spec.nodes as Record<string, unknown>[];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      errors.push({
        message: `Spec error: nodes[${i}] must be an object`,
        path: jsonPointer('nodes', i),
        code: 'INVALID_TYPE',
        suggestion: 'Each node must be an object with at least an "id" field, e.g. { id: "a" }',
      });
      continue;
    }
    if (typeof node.id !== 'string' || node.id === '') {
      errors.push({
        message: `Spec error: nodes[${i}] must have a non-empty string "id" field`,
        path: jsonPointer('nodes', i, 'id'),
        code: 'MISSING_FIELD',
        suggestion: 'Add a string id to the node, e.g. { id: "node1" }',
      });
    } else {
      nodeIds.add(node.id);
    }
  }

  // Validate seedNode shape. An id that doesn't resolve is NOT an error: it
  // warns and no-ops in normalizeGraphSpec. Validation errors throw and
  // createGraph re-throws, so in React an unknown id would hit an error
  // boundary — and seedNode is typically a host config constant that a filtered
  // or paginated node update can legitimately drop out of the node array, which
  // would make an app crash on a data change. Edge source/target do error,
  // because a dangling edge has no sensible rendering.
  if (spec.seedNode !== undefined) {
    if (typeof spec.seedNode === 'string') {
      if (spec.seedNode === '') {
        errors.push({
          message: 'Spec error: "seedNode" must be a non-empty node id',
          path: '/seedNode',
          code: 'MISSING_FIELD',
          suggestion: `Use one of the existing node ids, e.g. seedNode: "${[...nodeIds][0] ?? 'a'}"`,
        });
      }
    } else if (
      typeof spec.seedNode !== 'object' ||
      spec.seedNode === null ||
      Array.isArray(spec.seedNode)
    ) {
      errors.push({
        message: `Spec error: "seedNode" must be a node id string or an object like { id, style }, got ${Array.isArray(spec.seedNode) ? 'array' : typeof spec.seedNode}`,
        path: '/seedNode',
        code: 'INVALID_TYPE',
        suggestion: `Use the id shorthand (seedNode: "${[...nodeIds][0] ?? 'a'}") or the object form (seedNode: { id: "${[...nodeIds][0] ?? 'a'}", style: { radius: 14 } })`,
      });
    } else {
      const seedId = (spec.seedNode as Record<string, unknown>).id;
      if (typeof seedId !== 'string' || seedId === '') {
        errors.push({
          message: 'Spec error: "seedNode" must have a non-empty string "id" field',
          path: '/seedNode/id',
          code: 'MISSING_FIELD',
          suggestion: `Add the seed node id, e.g. seedNode: { id: "${[...nodeIds][0] ?? 'a'}" }`,
        });
      }
    }
  }

  // Validate edges array exists
  if (!Array.isArray(spec.edges)) {
    errors.push({
      message: 'Spec error: graph spec requires an "edges" array',
      path: '/edges',
      code: 'MISSING_FIELD',
      suggestion: 'Add an edges array (can be empty), e.g. edges: [{ source: "a", target: "b" }]',
    });
    return;
  }

  // Validate each edge has string source and target that reference existing nodes
  const edges = spec.edges as Record<string, unknown>[];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || typeof edge !== 'object') {
      errors.push({
        message: `Spec error: edges[${i}] must be an object`,
        path: jsonPointer('edges', i),
        code: 'INVALID_TYPE',
        suggestion:
          'Each edge must be an object with "source" and "target" fields, e.g. { source: "a", target: "b" }',
      });
      continue;
    }

    if (typeof edge.source !== 'string' || edge.source === '') {
      errors.push({
        message: `Spec error: edges[${i}] must have a non-empty string "source" field`,
        path: jsonPointer('edges', i, 'source'),
        code: 'MISSING_FIELD',
        suggestion: 'Add a source node id, e.g. { source: "a", target: "b" }',
      });
    } else if (nodeIds.size > 0 && !nodeIds.has(edge.source)) {
      errors.push({
        message: `Spec error: edges[${i}].source "${edge.source}" does not reference an existing node id`,
        path: jsonPointer('edges', i, 'source'),
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the existing node ids: ${[...nodeIds].slice(0, 5).join(', ')}${nodeIds.size > 5 ? '...' : ''}.${didYouMean(edge.source, [...nodeIds])}`,
      });
    }

    if (typeof edge.target !== 'string' || edge.target === '') {
      errors.push({
        message: `Spec error: edges[${i}] must have a non-empty string "target" field`,
        path: jsonPointer('edges', i, 'target'),
        code: 'MISSING_FIELD',
        suggestion: 'Add a target node id, e.g. { source: "a", target: "b" }',
      });
    } else if (nodeIds.size > 0 && !nodeIds.has(edge.target)) {
      errors.push({
        message: `Spec error: edges[${i}].target "${edge.target}" does not reference an existing node id`,
        path: jsonPointer('edges', i, 'target'),
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the existing node ids: ${[...nodeIds].slice(0, 5).join(', ')}${nodeIds.size > 5 ? '...' : ''}.${didYouMean(edge.target, [...nodeIds])}`,
      });
    }
  }

  // Validate encoding fields against the FULL union of keys across ALL
  // nodes/edges. Sparse fields (present only on edges[3]) must not hard-fail;
  // first-row sampling would just move the cliff and make failures
  // data-order-dependent. Object.keys over 50k rows is cheap.
  if (spec.encoding && typeof spec.encoding === 'object') {
    const encoding = spec.encoding as Record<string, unknown>;
    const nodeFields = new Set<string>();
    for (const node of nodes) {
      if (node && typeof node === 'object') {
        for (const key of Object.keys(node as Record<string, unknown>)) nodeFields.add(key);
      }
    }
    const edgeFields = new Set<string>();
    for (const edge of edges) {
      if (edge && typeof edge === 'object') {
        for (const key of Object.keys(edge as Record<string, unknown>)) edgeFields.add(key);
      }
    }

    const nodeChannels = [
      'nodeColor',
      'nodeSize',
      'nodeOpacity',
      'nodeLabel',
      'nodeLabelPriority',
    ] as const;
    for (const channel of nodeChannels) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (
        ch?.field &&
        typeof ch.field === 'string' &&
        nodes.length > 0 &&
        !nodeFields.has(ch.field)
      ) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist on nodes. Available fields: ${[...nodeFields].join(', ')}`,
          path: jsonPointer('encoding', channel, 'field'),
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the node fields: ${[...nodeFields].join(', ')}.${didYouMean(ch.field, [...nodeFields])}`,
        });
      }
    }

    const edgeChannels = ['edgeColor', 'edgeWidth', 'edgeStyle'] as const;
    for (const channel of edgeChannels) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (
        ch?.field &&
        typeof ch.field === 'string' &&
        edges.length > 0 &&
        !edgeFields.has(ch.field)
      ) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist on edges. Available fields: ${[...edgeFields].join(', ')}`,
          path: jsonPointer('encoding', channel, 'field'),
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the edge fields: ${[...edgeFields].join(', ')}.${didYouMean(ch.field, [...edgeFields])}`,
        });
      }
    }

    // Graph never reads scale.scheme: colors come from scale.range/scale.domain
    checkSchemeUnused(
      encoding,
      errors,
      'graph colors come from scale.range and scale.domain',
      'Remove scale.scheme. To customize graph colors, provide explicit colors via scale.range.',
    );
  }

  // Validate layout type if specified
  if (spec.layout && typeof spec.layout === 'object') {
    const layout = spec.layout as Record<string, unknown>;
    if (layout.type && layout.type !== 'force') {
      errors.push({
        message: `Spec error: layout.type "${layout.type}" is not supported. Only "force" is currently supported`,
        path: '/layout/type',
        code: 'INVALID_VALUE',
        suggestion:
          'Use layout.type: "force" or omit the layout field to use the default force layout',
      });
    }
  }
}
