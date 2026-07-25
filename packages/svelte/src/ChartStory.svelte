<!--
  ChartStory: Svelte 5 scrollytelling shell around the vanilla
  `createChartStory`.

  A sticky chart panel plus a scrolling narrative column whose blocks advance
  the story. The vanilla driver owns cumulative patch application, mark
  morphing, crossfade, and camera; this component owns only Svelte lifecycle
  and the sticky layout.

  Narrative is provided as an array of snippets (`narrative`), one per step.
  Pass `step` to drive the story externally; omit for self-driving scroll.
-->
<script lang="ts">
import type { ChartSpec, GeoMapSpec, GraphSpec, LayerSpec } from '@opendata-ai/openchart-core';
import type { MountOptions } from '@opendata-ai/openchart-vanilla';
import {
  type ChartStoryInstance,
  type ChartStoryOptions,
  createChartStory,
} from '@opendata-ai/openchart-vanilla/story';
import { onMount, type Snippet, untrack } from 'svelte';

let {
  spec,
  steps,
  narrative,
  step,
  triggerPosition,
  cameraMode,
  mountOptions,
  class: className,
}: {
  spec: ChartSpec | LayerSpec | GraphSpec | GeoMapSpec;
  steps: ChartStoryOptions['steps'];
  narrative: Snippet[];
  step?: number;
  triggerPosition?: number;
  cameraMode?: 'step' | 'scrub';
  mountOptions?: MountOptions;
  class?: string;
} = $props();

let sectionEl: HTMLElement;
let mountEl: HTMLDivElement;
const stepEls: Array<HTMLElement | null> = $state([]);
let story: ChartStoryInstance | null = null;

onMount(() => {
  if (narrative.length !== steps.length) {
    console.warn(
      `[openchart] ChartStory: narrative length (${narrative.length}) does not match steps length (${steps.length}). Each step should have a corresponding narrative element.`,
    );
  }

  story = createChartStory(
    mountEl,
    {
      spec: untrack(() => spec),
      steps: untrack(() => steps),
      triggerPosition: untrack(() => triggerPosition),
      cameraMode: untrack(() => cameraMode),
    },
    untrack(() => mountOptions),
  );
  story.setContainer(sectionEl);
  stepEls.forEach((el, i) => {
    if (el) story?.registerStep(i, el);
  });
  const initialStep = untrack(() => step);
  if (initialStep !== undefined) story.goTo(initialStep);

  return () => {
    story?.destroy();
    story = null;
  };
});

// Controlled mode: drive the story when `step` changes.
$effect(() => {
  const next = step;
  if (next === undefined) return;
  untrack(() => story)?.goTo(next);
});

export function goTo(index: number): void {
  story?.goTo(index);
}

export function getInstance(): ChartStoryInstance | null {
  return story;
}
</script>

<section
  bind:this={sectionEl}
  class={className ? `oc-story ${className}` : 'oc-story'}
  style="position:relative;display:grid;grid-template-columns:minmax(0,26rem) minmax(0,1fr);gap:3rem;align-items:start;"
>
  <div style="position:relative;">
    <!-- Keyed by index: steps are a fixed ordered list, so the index is the
         stable identity. Don't reorder or splice narrative entries at runtime
         (it would remap step refs to the wrong content); rebuild the story. -->
    {#each narrative as block, i (i)}
      <div
        bind:this={stepEls[i]}
        data-oc-story-step={i}
        style="min-height:80vh;display:flex;align-items:center;"
      >
        <div style="max-width:36rem;">{@render block()}</div>
      </div>
    {/each}
  </div>
  <div style="position:sticky;top:2rem;height:calc(100vh - 4rem);display:flex;align-items:center;justify-content:center;">
    <div bind:this={mountEl} style="width:100%;"></div>
  </div>
</section>
