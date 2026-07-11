/**
 * Vue scrollytelling shell around the vanilla `createChartStory`.
 *
 * Mirrors the React `<ChartStory>`: a sticky chart panel plus a scrolling
 * narrative column whose blocks advance the story. The vanilla driver owns
 * cumulative patch application, mark morphing, crossfade, and camera; this
 * component owns only Vue lifecycle and the sticky layout.
 *
 * Narrative is provided as the default slot's children (one root node per
 * step) or via the `narrative` prop (an array of vnodes/strings). Pass `step`
 * to drive it externally; omit for self-driving scroll.
 */

import type { ChartSpec, GraphSpec, LayerSpec } from '@opendata-ai/openchart-core';
import type { MountOptions } from '@opendata-ai/openchart-vanilla';
import {
  type ChartStoryInstance,
  type ChartStoryOptions,
  createChartStory,
} from '@opendata-ai/openchart-vanilla/story';
import {
  type CSSProperties,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  type PropType,
  ref,
  type VNode,
  watch,
} from 'vue';

export interface ChartStoryProps {
  spec: ChartSpec | LayerSpec | GraphSpec;
  steps: ChartStoryOptions['steps'];
  narrative?: VNode[];
  step?: number;
  triggerPosition?: number;
  cameraMode?: 'step' | 'scrub';
  mountOptions?: MountOptions;
}

const sectionStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 26rem) minmax(0, 1fr)',
  gap: '3rem',
  alignItems: 'start',
};

const stepStyle: CSSProperties = {
  minHeight: '80vh',
  display: 'flex',
  alignItems: 'center',
};

const panelStyle: CSSProperties = {
  position: 'sticky',
  top: '2rem',
  height: 'calc(100vh - 4rem)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const ChartStory = defineComponent({
  name: 'ChartStory',
  props: {
    spec: {
      type: Object as PropType<ChartSpec | LayerSpec | GraphSpec>,
      required: true,
    },
    steps: {
      type: Array as PropType<ChartStoryOptions['steps']>,
      required: true,
    },
    narrative: {
      type: Array as PropType<VNode[]>,
      default: undefined,
    },
    step: {
      type: Number,
      default: undefined,
    },
    triggerPosition: {
      type: Number,
      default: undefined,
    },
    cameraMode: {
      type: String as PropType<'step' | 'scrub'>,
      default: undefined,
    },
    mountOptions: {
      type: Object as PropType<MountOptions>,
      default: undefined,
    },
  },
  setup(props, { slots, expose }) {
    const sectionRef = ref<HTMLElement | null>(null);
    const mountRef = ref<HTMLDivElement | null>(null);
    const stepEls = ref<Array<HTMLElement | null>>([]);
    let story: ChartStoryInstance | null = null;

    onMounted(() => {
      const mount = mountRef.value;
      if (!mount) return;
      story = createChartStory(
        mount,
        {
          spec: props.spec,
          steps: props.steps,
          triggerPosition: props.triggerPosition,
          cameraMode: props.cameraMode,
        },
        props.mountOptions,
      );
      if (sectionRef.value) story.setContainer(sectionRef.value);
      stepEls.value.forEach((el, i) => {
        if (el) story?.registerStep(i, el);
      });
      if (props.step !== undefined) story.goTo(props.step);
    });

    watch(
      () => props.step,
      (next) => {
        if (next !== undefined) story?.goTo(next);
      },
    );

    onUnmounted(() => {
      story?.destroy();
      story = null;
    });

    expose({
      goTo(index: number) {
        story?.goTo(index);
      },
      get instance() {
        return story;
      },
    });

    return () => {
      // Prefer the `narrative` prop; fall back to default slot children so
      // consumers can author steps as template markup.
      const blocks = props.narrative ?? slots.default?.() ?? [];
      return h('section', { ref: sectionRef, style: sectionStyle }, [
        h(
          'div',
          { style: { position: 'relative' } },
          blocks.map((content, i) =>
            h(
              'div',
              {
                key: i,
                ref: (el: unknown) => {
                  stepEls.value[i] = el as HTMLElement | null;
                },
                'data-oc-story-step': i,
                style: stepStyle,
              },
              [h('div', { style: { maxWidth: '36rem' } }, [content])],
            ),
          ),
        ),
        h('div', { style: panelStyle }, [h('div', { ref: mountRef, style: { width: '100%' } })]),
      ]);
    };
  },
});
