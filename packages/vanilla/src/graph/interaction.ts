/**
 * Graph interaction manager.
 *
 * Handles mouse/touch events on the canvas and translates them into
 * high-level graph interactions: pan, zoom, hover, select, drag nodes.
 * Uses the spatial index for hit testing and ZoomTransform for coordinate
 * conversion.
 */

import type { SpatialIndex } from './spatial-index';
import { ZoomTransform } from './zoom';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 15;
const ZOOM_STEP = -0.001;
const HIT_DISTANCE = 5;

// ---------------------------------------------------------------------------
// Callback interface
// ---------------------------------------------------------------------------

export interface InteractionCallbacks {
  onTransformChange(transform: ZoomTransform): void;
  onHoverChange(nodeId: string | null): void;
  onSelectionChange(nodeIds: string[]): void;
  onNodeDragStart(nodeId: string): void;
  onNodeDrag(nodeId: string, x: number, y: number): void;
  onNodeDragEnd(nodeId: string): void;
  onDoubleClick(nodeId: string): void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface DragState {
  nodeId: string;
  started: boolean;
}

interface PanState {
  startX: number;
  startY: number;
}

// ---------------------------------------------------------------------------
// GraphInteractionManager
// ---------------------------------------------------------------------------

export class GraphInteractionManager {
  private canvas: HTMLCanvasElement;
  private spatialIndex: SpatialIndex;
  private callbacks: InteractionCallbacks;
  private transform = ZoomTransform.identity();

  private dragState: DragState | null = null;
  private panState: PanState | null = null;
  private mousedownNodeId: string | null = null;
  private selectedIds: Set<string> = new Set();

  // Touch state
  private lastTouchDist: number | null = null;
  private lastTouchCenter: { x: number; y: number } | null = null;

  // Bound handlers for cleanup
  private boundWheel: (e: WheelEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundDblClick: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundMouseLeave: (e: MouseEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    spatialIndex: SpatialIndex,
    callbacks: InteractionCallbacks,
  ) {
    this.canvas = canvas;
    this.spatialIndex = spatialIndex;
    this.callbacks = callbacks;

    // Bind handlers
    this.boundWheel = this.onWheel.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseLeave = this.onMouseLeave.bind(this);
    this.boundDblClick = this.onDblClick.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);

    // Attach event listeners
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    canvas.addEventListener('mousedown', this.boundMouseDown);
    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('mouseup', this.boundMouseUp);
    canvas.addEventListener('mouseleave', this.boundMouseLeave);
    canvas.addEventListener('dblclick', this.boundDblClick);
    canvas.addEventListener('touchstart', this.boundTouchStart, {
      passive: false,
    });
    canvas.addEventListener('touchmove', this.boundTouchMove, {
      passive: false,
    });
    canvas.addEventListener('touchend', this.boundTouchEnd);
  }

  setTransform(transform: ZoomTransform): void {
    this.transform = transform;
  }

  getTransform(): ZoomTransform {
    return this.transform;
  }

  destroy(): void {
    this.canvas.removeEventListener('wheel', this.boundWheel);
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('mouseleave', this.boundMouseLeave);
    this.canvas.removeEventListener('dblclick', this.boundDblClick);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    this.canvas.removeEventListener('touchend', this.boundTouchEnd);
  }

  // -------------------------------------------------------------------------
  // Mouse handlers
  // -------------------------------------------------------------------------

  private canvasXY(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private hitTest(screenX: number, screenY: number): string | null {
    const graph = this.transform.screenToGraph(screenX, screenY);
    const node = this.spatialIndex.findNearest(graph.x, graph.y, HIT_DISTANCE / this.transform.k);
    return node?.id ?? null;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const { x, y } = this.canvasXY(e);
    const factor = e.deltaY * ZOOM_STEP;
    const newK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.transform.k * (1 + factor)));
    this.transform = this.transform.zoomAt(newK, x, y);
    this.callbacks.onTransformChange(this.transform);
  }

  private onMouseDown(e: MouseEvent): void {
    const { x, y } = this.canvasXY(e);
    const hitId = this.hitTest(x, y);

    if (hitId) {
      // Start potential node drag
      this.dragState = { nodeId: hitId, started: false };
      this.mousedownNodeId = hitId;
    } else {
      // Start pan
      this.panState = { startX: x, startY: y };
      this.mousedownNodeId = null;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const { x, y } = this.canvasXY(e);

    if (this.dragState) {
      const graph = this.transform.screenToGraph(x, y);
      if (!this.dragState.started) {
        this.dragState.started = true;
        this.callbacks.onNodeDragStart(this.dragState.nodeId);
      }
      this.callbacks.onNodeDrag(this.dragState.nodeId, graph.x, graph.y);
      return;
    }

    if (this.panState) {
      const dx = x - this.panState.startX;
      const dy = y - this.panState.startY;
      this.transform = this.transform.pan(dx, dy);
      this.panState = { startX: x, startY: y };
      this.callbacks.onTransformChange(this.transform);
      return;
    }

    // Hover detection
    const hitId = this.hitTest(x, y);
    this.callbacks.onHoverChange(hitId);

    // Update cursor
    this.canvas.style.cursor = hitId ? 'pointer' : 'default';
  }

  private onMouseUp(e: MouseEvent): void {
    const { x, y } = this.canvasXY(e);

    if (this.dragState) {
      if (this.dragState.started) {
        this.callbacks.onNodeDragEnd(this.dragState.nodeId);
      } else {
        // Was a click on a node (no drag movement)
        this.handleNodeClick(this.dragState.nodeId, e.shiftKey);
      }
      this.dragState = null;
      return;
    }

    if (this.panState) {
      this.panState = null;

      // If mouse up is on background (no node), treat as background click
      if (!this.mousedownNodeId) {
        const hitId = this.hitTest(x, y);
        if (!hitId) {
          // Background click: clear selection
          this.selectedIds.clear();
          this.callbacks.onSelectionChange([]);
        }
      }
      return;
    }
  }

  private onDblClick(e: MouseEvent): void {
    const { x, y } = this.canvasXY(e);
    const hitId = this.hitTest(x, y);
    if (hitId) {
      this.callbacks.onDoubleClick(hitId);
    }
  }

  private onMouseLeave(_e: MouseEvent): void {
    this.callbacks.onHoverChange(null);
    this.canvas.style.cursor = 'default';

    // Cancel any in-progress pan
    if (this.panState) {
      this.panState = null;
    }
  }

  private handleNodeClick(nodeId: string, shiftKey: boolean): void {
    if (shiftKey) {
      // Toggle node in multi-select
      if (this.selectedIds.has(nodeId)) {
        this.selectedIds.delete(nodeId);
      } else {
        this.selectedIds.add(nodeId);
      }
    } else {
      // Single select
      this.selectedIds.clear();
      this.selectedIds.add(nodeId);
    }

    this.callbacks.onSelectionChange([...this.selectedIds]);
  }

  // -------------------------------------------------------------------------
  // Touch handlers
  // -------------------------------------------------------------------------

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 2) {
      // Pinch-zoom start
      const [t0, t1] = [e.touches[0], e.touches[1]];
      this.lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      this.lastTouchCenter = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const hitId = this.hitTest(x, y);
      if (hitId) {
        this.mousedownNodeId = hitId;
      } else {
        this.panState = { startX: x, startY: y };
        this.mousedownNodeId = null;
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 2 && this.lastTouchDist !== null) {
      const [t0, t1] = [e.touches[0], e.touches[1]];
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const rect = this.canvas.getBoundingClientRect();
      const centerX = (t0.clientX + t1.clientX) / 2 - rect.left;
      const centerY = (t0.clientY + t1.clientY) / 2 - rect.top;

      const scale = newDist / this.lastTouchDist;
      const newK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.transform.k * scale));
      this.transform = this.transform.zoomAt(newK, centerX, centerY);

      // Pan from center movement
      if (this.lastTouchCenter) {
        const dx = centerX - (this.lastTouchCenter.x - rect.left);
        const dy = centerY - (this.lastTouchCenter.y - rect.top);
        this.transform = this.transform.pan(dx, dy);
      }

      this.lastTouchDist = newDist;
      this.lastTouchCenter = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };
      this.callbacks.onTransformChange(this.transform);
    } else if (e.touches.length === 1 && this.panState) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const dx = x - this.panState.startX;
      const dy = y - this.panState.startY;
      this.transform = this.transform.pan(dx, dy);
      this.panState = { startX: x, startY: y };
      this.callbacks.onTransformChange(this.transform);
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      // Tap-select
      if (this.mousedownNodeId && !this.panState) {
        this.handleNodeClick(this.mousedownNodeId, false);
      } else if (!this.mousedownNodeId && this.panState) {
        // Background tap: clear selection
        this.selectedIds.clear();
        this.callbacks.onSelectionChange([]);
      }

      this.panState = null;
      this.mousedownNodeId = null;
      this.lastTouchDist = null;
      this.lastTouchCenter = null;
    }
  }
}
