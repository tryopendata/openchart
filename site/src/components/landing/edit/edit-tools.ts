/**
 * Everything the edit section needs only once its chart is live, as one lazy
 * chunk: the rule deciding which edits apply (it carries the chart library's
 * core), the guard that narrows the library's edit gestures, the touch relay
 * and the self-demonstration. None of it does anything before the live chart
 * exists, so none of it rides in the page's up-front JavaScript.
 */
export { playCalloutDemo } from "./callout-demo";
export { guardEdits } from "./edit-guard";
export { acceptedOffset } from "./edit-state";
export { relayDetachedTouches } from "./touch-drag-relay";
