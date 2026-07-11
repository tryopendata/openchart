<!-- Test harness: supplies narrative snippets to ChartStory. -->
<script lang="ts">
import type { ChartSpec } from '@opendata-ai/openchart-core';
import ChartStory from '../ChartStory.svelte';

let { spec, steps, step }: { spec: ChartSpec; steps: unknown[]; step?: number } = $props();
</script>

{#snippet intro()}<p>Intro</p>{/snippet}
{#snippet middle()}<p>Middle</p>{/snippet}
{#snippet end()}<p>End</p>{/snippet}

<ChartStory {spec} steps={steps as never} narrative={[intro, middle, end]} {step} />
