/**
 * Per-node three.js objects.
 *
 * 3d-force-graph's built-in node rendering is a shared sphere material cached
 * by color string, and `nodeOpacity` is a single global number. Highlight, dim,
 * hover and entrance all need PER-NODE opacity, so every node gets its own
 * `MeshLambertMaterial` here. That is also the only way to get always-on labels:
 * `nodeLabel` is hover-only in the library.
 *
 * Everything allocated in this module is owned by the mount and disposed in
 * `destroy()` — three.js geometries, materials and canvas-backed sprite
 * textures are all outside the GC's reach.
 */

import type { CompiledGraphNode } from '@opendata-ai/openchart-engine';
import { Group, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import SpriteText from 'three-spritetext';

/** Sphere tessellation. 12 is the library's default and reads smooth at our radii. */
const SPHERE_SEGMENTS = 12;
/** Sprite cap height in world units, before the screen-size correction. */
export const LABEL_TEXT_HEIGHT = 4;
/** Gap between the sphere surface and the label baseline, in world units. */
const LABEL_GAP = 2;

/** A node's scene object plus the resources the mount must dispose. */
export interface NodeObject3D {
  group: Group;
  mesh: Mesh;
  geometry: SphereGeometry;
  material: MeshLambertMaterial;
  /** Null until {@link ensureLabelSprite} builds it, and for unlabelled nodes. */
  sprite: SpriteText | null;
  /** Compiled label text, or null when the node has none. */
  labelText: string | null;
  /** Resolved label colour, applied when the sprite is built. */
  labelColor: string;
  /** Sprite offset above the node centre, in world units. */
  labelOffset: number;
  /**
   * The sprite's scale at {@link LABEL_TEXT_HEIGHT}, captured because
   * `three-spritetext` only writes `scale` when it regenerates its texture, so
   * the perspective correction in the mount can multiply it every re-rank
   * without paying for a canvas redraw.
   */
  labelBaseScale: { x: number; y: number } | null;
}

/**
 * Build the scene object for one compiled node: a `Group` holding a sphere
 * `Mesh`. The label sprite is NOT built here — see {@link ensureLabelSprite}.
 */
export function createNodeObject(node: CompiledGraphNode, labelColor: string): NodeObject3D {
  const geometry = new SphereGeometry(node.radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
  const material = new MeshLambertMaterial({
    color: node.fill,
    transparent: true,
    opacity: node.opacity,
  });
  const mesh = new Mesh(geometry, material);

  const group = new Group();
  group.add(mesh);

  return {
    group,
    mesh,
    geometry,
    material,
    sprite: null,
    labelBaseScale: null,
    labelText: node.label ?? null,
    labelColor,
    labelOffset: node.radius + LABEL_GAP,
  };
}

/**
 * Build this node's label sprite on first use, or return the existing one.
 *
 * Sprites are created lazily because they are not free to keep around: a
 * 3,000-node graph that eagerly built one sprite per node ran at 22fps against
 * 32fps with no sprites at all, even though at most 40 are ever visible — three
 * still walks every one of them per frame. Only the labels that win a slot in
 * the declutter pass ever exist.
 *
 * The sprite's `raycast` is stubbed to a no-op so a label never intercepts a
 * hover or click meant for the node behind it: the library raycasts the whole
 * subtree of the node object.
 */
export function ensureLabelSprite(obj: NodeObject3D): SpriteText | null {
  if (obj.sprite) return obj.sprite;
  if (!obj.labelText) return null;
  const sprite = new SpriteText(obj.labelText, LABEL_TEXT_HEIGHT, obj.labelColor);
  sprite.position.y = obj.labelOffset;
  sprite.raycast = () => {};
  sprite.visible = false;
  obj.group.add(sprite);
  obj.sprite = sprite;
  obj.labelBaseScale = { x: sprite.scale.x, y: sprite.scale.y };
  return sprite;
}

/**
 * Re-apply compiled visuals to an existing node object. Used by the
 * visual-only update path, which must not touch `graphData()` (that would
 * restart the layout).
 */
export function applyNodeVisuals(
  obj: NodeObject3D,
  node: CompiledGraphNode,
  labelColor: string,
): void {
  obj.material.color.set(node.fill);
  if (obj.geometry.parameters.radius !== node.radius) {
    const next = new SphereGeometry(node.radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    obj.mesh.geometry = next;
    obj.geometry.dispose();
    obj.geometry = next;
  }
  obj.labelText = node.label ?? null;
  obj.labelColor = labelColor;
  obj.labelOffset = node.radius + LABEL_GAP;
  if (obj.sprite) {
    const regenerates =
      (node.label && obj.sprite.text !== node.label) || obj.sprite.color !== labelColor;
    if (node.label && obj.sprite.text !== node.label) obj.sprite.text = node.label;
    obj.sprite.color = labelColor;
    obj.sprite.position.y = obj.labelOffset;
    // A regenerated texture resets `scale`, so the captured base has to follow.
    if (regenerates) obj.labelBaseScale = { x: obj.sprite.scale.x, y: obj.sprite.scale.y };
  }
}

/** Dispose every GPU resource this node object owns. */
export function disposeNodeObject(obj: NodeObject3D): void {
  obj.geometry.dispose();
  obj.material.dispose();
  if (obj.sprite) {
    // SpriteText paints into a canvas-backed texture; disposing the material
    // alone leaks that texture.
    const mat = obj.sprite.material as { map?: { dispose(): void }; dispose(): void };
    mat.map?.dispose();
    mat.dispose();
  }
}
