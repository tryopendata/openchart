/**
 * The scroll story's steps: the prose a reader scrolls past and the change each
 * step makes to the sticky chart, through the library's own story API. Lane 2/c
 * fills it (with the base spec it starts from); the scaffold fixes the step shape.
 */
import type { StoryStep } from "@opendata-ai/openchart-vanilla/story";

/** One step of the landing story. */
export type LandingStoryStep = {
  /** Stable id, unique across the steps. */
  id: string;
  /** The paragraph shown for this step. It is about the data, not the library. */
  prose: string;
  /** The change to the chart, applied cumulatively by `createChartStory` or `<ChartStory>`. */
  change: StoryStep;
};

/** The story's four steps, in scroll order. */
export const storySteps: LandingStoryStep[] = [];
