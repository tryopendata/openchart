# Product Spec: Rich Chart Editing

## Context

OpenChart currently has a solid but narrow editing primitive: drag-to-reposition. The `onEdit` callback fires typed events for 7 element types (text annotations, connectors, range/refline labels, chrome, series labels, legend). All interactions are drag-based. There's no selection, no deletion, no inline text editing, no property modification, and no element creation.

The goal is to evolve this into a full editing surface that enables consumers (chart builder apps, dashboard tools, content creators) to build rich WYSIWYG editors on top of OpenChart's primitives.

**Key constraint:** OpenChart is a library, not an application. The editing capabilities are composable primitives exposed via callbacks and spec updates. The library owns what happens *inside the SVG*. Consumers own everything outside it (toolbars, property panels, undo buttons).

**Core principle: Callback-driven, never mutates.** Every editing interaction follows the same pattern as the existing drag system: the library detects the user intent, fires a typed callback with all the information the consumer needs, and the consumer decides whether/how to apply it to their spec. The library never unilaterally adds, removes, or modifies elements. This keeps consumers in full control and makes undo/redo, validation, and confirmation dialogs straightforward.

---

## Who This Is For

**Primary: Chart builder applications** (Datawrapper-like products embedding OpenChart)
- Need full create/edit/delete lifecycle for annotations and chrome
- Build property panels and toolbars on top of the library's primitives
- Want to ship "click to edit" experiences to their end users

**Secondary: Dashboard builders** (products where users customize chart appearance)
- Need selection + property editing to let users tweak charts within a larger product
- Care about "safe" editing (nothing breaks, easy to undo)

**Tertiary: Content creators / journalists** (using OpenChart-powered tools)
- Need inline text editing for annotation copy and headlines
- Want direct manipulation, not code editing
- Care about "obvious" interactions (no learning curve)

---

## Jobs to Be Done

| Job | Situation | Motivation | Outcome |
|-----|-----------|------------|---------|
| Select an element | I see an annotation I want to modify | I want to indicate what I'm operating on | The element is highlighted and I can act on it |
| Delete an element | I selected an annotation I don't need | I want to remove clutter from my chart | Callback fires with element info; consumer removes it from spec |
| Edit text inline | I'm looking at a title that needs rewording | I want to change text without leaving the chart | Callback fires with old/new text; consumer updates spec |
| Add an annotation | I see a data point worth calling out | I want to add editorial context to the chart | Callback fires with position/type; consumer adds to spec |
| Modify properties | I selected a range annotation | I want to change its color or opacity | Consumer updates spec property; chart re-renders |
| Adjust scale | The y-axis starts at 0 but the data starts at 40 | I want to zoom in on the interesting range | Consumer updates scale config; chart re-renders |

---

## Experience Qualities

**Safe** (primary): Every edit is a callback, not a mutation. The consumer decides whether to apply it. Users should feel comfortable experimenting because the library never does anything irreversible on its own.

**Obvious** (secondary): No tool palette, no mode switching within edit mode. Click selects, drag moves, double-click edits text, Delete fires a delete callback. Interactions are discoverable through standard patterns.

**Powerful** (stretch): For consumers building full editors, the primitives should compose into sophisticated workflows without hacks.

---

## Interaction Model

### The Boundary Rule
**Library owns what's inside the SVG viewport. Consumers own everything outside.**

| Library's job (inside SVG) | Consumer's job (outside SVG) |
|---|---|
| Selection indicators (highlight, bounding box) | Property panels and sidebars |
| Drag handles and repositioning | Toolbars and action buttons |
| Inline text editing overlay | Undo/redo stacks |
| Hover states and cursors | "Add annotation" workflows |
| Keyboard event detection | Application-level shortcuts |
| Visual feedback during interactions | State management and persistence |
| Firing typed callbacks for every interaction | Deciding what to do with them |

### The Callback Contract
Every editing interaction follows this pattern:
1. User performs an action inside the SVG (click, drag, double-click, keypress)
2. Library shows transient visual feedback (selection highlight, drag preview, text cursor)
3. Library fires a typed callback with all context the consumer needs
4. Consumer updates their spec (or doesn't - they can ignore, validate, confirm, etc.)
5. Consumer passes updated spec back; library re-renders

The library **never** adds, removes, or modifies spec elements on its own. It only shows transient visual state and fires callbacks.

### Selection Model
- **Single-select.** Click an element to select it. Visual highlight appears.
- **Click empty space to deselect.**
- **Hover and selection are visually distinct.** Hover: subtle highlight or cursor change. Selection: bounding box or accent ring. They must look different so clicking feels like it did something.
- **No multi-select** initially. Charts have 5-15 editable elements. Multi-select adds complexity without proportional value. (Revisit if demand materializes.)
- Selection state lives in the library (SVG needs to render the indicator) but is communicated via callbacks.

### Selection Persistence Across Re-renders
When a consumer applies an edit and passes an updated spec, the chart re-renders (full teardown/rebuild in `mount.ts`). Selection would be destroyed.

**Solution:** The library accepts a `selectedElement` option (element ID or index) in `MountOptions`. The React/Vue/Svelte adapters expose this as a prop. After re-render, the library restores selection to the specified element. Consumers track selected element ID in their state and pass it back.

This also gives framework adapters a declarative way to control selection (e.g., selecting an element from a sidebar list).

### Inline Text Editing
- **Double-click** a text annotation or chrome element to enter edit mode.
- An HTML input/textarea overlays the SVG text, positioned to match using viewBox-aware coordinate transforms.
- **Enter** commits (fires callback with old/new text), **Escape** cancels.
- Only for text annotations and chrome. Axis labels and data labels are computed from the spec and not directly editable.

**Scoping note:** Chrome text (title, subtitle, source, byline) is simpler to overlay (always horizontal, known positions, predictable fonts). Text annotations are harder (arbitrary positions, viewBox transforms, potential rotation). Phase 2 should start with chrome, extend to annotations as a fast follow.

### Keyboard Shortcuts
| Key | Action | Scope |
|-----|--------|-------|
| Delete / Backspace | Fire delete callback for selected element | Only when SVG has focus AND element is selected |
| Escape | Deselect / cancel text edit / cancel drag | When SVG has focus |
| Enter | Commit text edit | Only during text editing |
| Tab | Cycle selection to next editable element (spatial order: top-to-bottom, left-to-right) | When SVG has focus |

**Focus management:** Keyboard shortcuts only fire when the SVG container has focus. Clicking an element inside the SVG focuses the container. This prevents Delete/Backspace from conflicting with browser navigation or form inputs elsewhere on the page.

---

## Element Identity

The current system matches edited elements by content (e.g., `annotation.text === edit.annotation.text`). This breaks with duplicate text and doesn't survive serialization.

**Solution: Two-tier identity**
1. **Optional `id` field** on annotations, chrome entries, and other editable elements. If provided, all callbacks include it. Recommended for any consumer building a real editor.
2. **Array index fallback.** Every callback includes the element's index in the spec array (e.g., `annotationIndex: 2`). Not as stable as IDs (mutations shift indices) but deterministic and way better than content matching.

The `applyEdit` utility (Phase 4) uses ID when available, falls back to index.

---

## Phasing

### Phase 1: Selection + Deletion
**Highest ROI. Prerequisite for everything else.**

What it delivers:
- Click to select any editable element (annotations, chrome, legend, series labels)
- Visual selection state (bounding box or highlight) distinct from hover state
- `onSelect` callback fires with element type, ID/index, and element data
- `onDeselect` callback fires when clicking empty space or pressing Escape
- Delete/Backspace fires `onDelete` callback with element type, ID/index, and element data (library does NOT remove the element; consumer handles it)
- `selectedElement` option in MountOptions for declarative/persistent selection
- Optional `id` field on annotation types + array index in all callbacks
- Focus management: keyboard shortcuts scoped to SVG focus

Why this first: Selection is the anchor for every future editing feature. Without it, "what am I operating on?" has no answer. Deletion (as a callback) is the natural companion.

### Phase 2: Inline Text Editing
**Unlocks the content creator persona.**

What it delivers:
- Double-click chrome elements (title, subtitle, source, byline) to edit text in place
- Double-click text annotations to edit annotation text in place
- HTML overlay positioned using viewBox-aware coordinate transforms
- `onTextEdit` callback fires with element reference, old text, and new text
- Enter commits (fires callback), Escape cancels (no callback, overlay dismissed)
- Consumer updates spec with new text on callback; chart re-renders

**Start with chrome text** (simpler positioning), extend to annotation text.

Why this second: Text editing is the highest-value content authoring primitive. Combined with Phase 1 and existing drag, you have a complete edit lifecycle for existing elements.

### Phase 3: Element Creation
**Completes the create/edit/delete lifecycle.**

What it delivers:
- `onAddRequest` callback pattern: consumer provides a partial annotation (type, position, defaults), library could show a placement preview, callback fires with the proposed element
- Or simpler: consumer adds element to spec directly, passes updated spec, uses `selectedElement` to auto-select the new element
- Connector creation: new annotations can include `connector: true` and the library renders it
- `addAnnotation(partialAnnotation)` imperative method that fills in reasonable defaults (position, anchor direction, connector style) based on where the user clicked

Why this third: Creation requires selection (Phase 1) to be useful (create then immediately edit). It requires text editing (Phase 2) because new annotations need text content.

### Phase 4: Spec Editing Utilities (Consumer Helpers)
**Reduces boilerplate for property editing workflows.**

What it delivers:
- `applyEdit(spec, edit) => newSpec` utility function that applies any `ElementEdit` to a spec, eliminating the switch statement every consumer currently writes
- Uses ID when available, falls back to array index
- `getEditableProperties(elementType) => PropertyDescriptor[]` helper for building property panels
- Documented patterns for scale/axis property editing
- Type-safe spec update helpers for common operations

Why this fourth: DX quality-of-life. Makes Phases 1-3 easier to integrate but is not blocking.

### Phase 5 (Future): Polish
- Undo/redo helper: `createEditHistory(initialSpec)` utility managing spec snapshots
- Copy/paste for selected annotations (Cmd+C/V with callback pattern)
- Multi-select for batch operations
- Connector editing: add/remove/restyle connectors on existing annotations
- Responsive editing: different annotation positions at different breakpoints

---

## Key Design Decisions

### All Edits Are Callbacks
The library never mutates the spec. Every interaction fires a callback:
- Drag -> `onEdit` (existing)
- Select -> `onSelect`
- Delete -> `onDelete` (consumer removes from spec)
- Text edit -> `onTextEdit` (consumer updates text in spec)
- Add -> consumer adds to spec directly or via `addAnnotation` method

This means consumers can: show confirmation dialogs before deleting, validate text input before accepting, implement undo by storing spec snapshots, or ignore any edit they don't want.

### Unified vs. Separate Callbacks
Two options:
1. **Extend `onEdit` union** with new variants (select, delete, text-edit). Single callback, exhaustive switch. Follows existing pattern.
2. **Separate callbacks** (`onSelect`, `onDelete`, `onTextEdit`). More explicit, easier to wire up selectively.

**Recommendation: Both.** New variants flow through `onEdit` for consumers who want a single handler. Separate callbacks exist as convenience aliases. If both are provided, both fire. This matches the existing pattern where `onAnnotationEdit` (legacy) and `onEdit` (unified) both fire.

### What NOT to Build
- **Built-in toolbar or property panel.** Application UI, not library concern.
- **Scale/axis editing via direct manipulation.** Dragging axis ticks to change the domain is confusing. Scale editing belongs in property panels (consumer-side) with typed spec helpers from Phase 4.
- **Data editing.** OpenChart is visualization, not a spreadsheet.
- **Collaborative editing.** CRDTs and OT are application concerns.
- **Mode-based tool palettes.** No "annotation tool" vs "selection tool." Keep it modeless within edit mode.

### Transient vs. Committed State
Some editing state (selection highlight, drag preview, text editing cursor) renders as SVG overlays without recompiling the chart. Only committed changes (drag end, text commit via callback, spec update) trigger spec recompilation.

---

## Accessibility

- Selection state announced via ARIA attributes on SVG elements
- Tab cycling follows spatial order (top-to-bottom, left-to-right) for predictability
- Screen reader users can navigate editable elements via Tab and hear element descriptions
- Delete action has keyboard-only path (Tab to select, Delete to remove)
- Text editing overlay is a real HTML input with proper focus management

---

## Competitive Position

OpenChart's unique angle: **a declarative chart grammar with first-class visual editing primitives.** No other library combines both:
- Vega-Lite has the grammar but no editing
- Datawrapper has editing but no embeddable grammar
- Figma has editing but no data awareness (annotations don't snap to data coordinates)
- Observable has the grammar but is code-first

---

## Verification

Each phase should be verified with:
1. Updated annotation-editing story demonstrating the new interactions
2. Unit tests for new event types and interaction handlers
3. Visual verification via playwright screenshots
4. Consumer integration pattern documented in the story's inspector panel
5. Callback contract tested: library fires correct events, never mutates spec

---

## Critical Files
- `packages/core/src/types/events.ts` - Event types, `ElementEdit` union, `ChartEventHandlers`
- `packages/core/src/types/spec.ts` - Spec types, annotation types (add `id` fields)
- `packages/vanilla/src/mount.ts` - All interaction wiring (drag handlers, new selection/keyboard handlers)
- `packages/vanilla/src/svg-renderer.ts` - Selection indicator rendering, hover states
- `packages/react/src/Chart.tsx` - React adapter for new callbacks + `selectedElement` prop
- `examples/src/annotation-editing.stories.tsx` - Reference implementation / demo
