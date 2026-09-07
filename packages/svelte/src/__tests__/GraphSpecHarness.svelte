<!--
  Test harness: swaps Graph's spec through reactive state.

  @testing-library/svelte's `rerender` unmounts and remounts the component, so
  it cannot tell a wrapper-driven remount from an in-place update. Driving the
  prop from $state here does.
-->
<script lang="ts">
import type { GraphSpec } from '@opendata-ai/openchart-core';
import { untrack } from 'svelte';
import Graph from '../Graph.svelte';

let {
  initialSpec,
  controller,
}: { initialSpec: GraphSpec; controller: { setSpec?: (spec: GraphSpec) => void } } = $props();

// untrack: both props are read once, at setup, and never tracked afterwards.
let spec = $state(untrack(() => initialSpec));
untrack(() => {
  controller.setSpec = (next: GraphSpec) => {
    spec = next;
  };
});
</script>

<Graph {spec} />
