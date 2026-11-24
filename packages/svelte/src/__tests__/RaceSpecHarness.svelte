<script lang="ts">
import type { RaceSpec } from '@opendata-ai/openchart-core';
import type { RaceInstance } from '@opendata-ai/openchart-vanilla';
import { untrack } from 'svelte';
import Race from '../Race.svelte';

let { initialSpec }: { initialSpec: RaceSpec } = $props();
let spec = $state(structuredClone(untrack(() => initialSpec)));
let race: { getInstance(): RaceInstance | null };

export function getInstance(): RaceInstance | null {
  return race.getInstance();
}

function roundBars() {
  spec.mark = { type: 'bar', cornerRadius: 8 };
}

function renderEqualSpec() {
  spec = $state.snapshot(spec);
}
</script>

<button type="button" onclick={roundBars}>
  Round bars
</button>
<button type="button" onclick={renderEqualSpec}>
  Render an equal spec
</button>
<Race {spec} bind:this={race} />
