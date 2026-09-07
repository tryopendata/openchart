/**
 * Camera framing math for the 3D renderer.
 *
 * Split out of `mount.ts` because it is pure vector arithmetic over positions
 * the mount already has: no three.js, no library instance, no DOM. The mount
 * reads the camera and hands the numbers in.
 */

/** A point or direction in scene space. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A node as the fit sees it: a position and the radius to keep in frame. */
export interface FitPoint {
  x: number;
  y: number;
  z: number;
  radius: number;
}

/** Where the camera should sit, and what it should look at. */
export interface FitResult {
  center: Vec3;
  /** Unit vector from `center` towards the camera. */
  dir: Vec3;
  distance: number;
}

/** Inputs the mount reads off the live camera and shell. */
export interface FitView {
  cameraPos: Vec3;
  /** Vertical field of view, in degrees. */
  fovDeg: number;
  /** Viewport width / height. */
  aspect: number;
  /** Viewport height in pixels, used to turn pixel padding into a ratio. */
  viewportHeight: number;
  /** Breathing room around the cloud, in pixels of viewport height. */
  paddingPx: number;
}

/** Floor on the fit distance so a single-node graph does not sit on the camera. */
const MIN_FIT_DISTANCE = 60;

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  // A degenerate direction (camera sitting on its target) falls back to +z,
  // the library's own default framing axis.
  if (!(len > 1e-6)) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Camera placement that frames every point from the current viewing angle.
 *
 * Deliberately not `graph.zoomToFit()`: three-render-objects computes its
 * distance as `maxBoxSide / Math.atan(fov)` where the geometry calls for
 * `maxBoxSide / (2 * Math.tan(fov / 2))`, so it lands the camera about twice as
 * far out as it needs to be, and it frames the bbox as a cube centred on the
 * world origin, so depth inflates the height and an off-centre layout drifts
 * out of frame. This measures the cloud in the camera's own basis instead: how
 * wide and tall it actually appears, plus how much of it sits in front.
 *
 * Returns null for an empty or non-finite cloud.
 */
export function computeFit(points: FitPoint[], view: FitView): FitResult | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  // All six extents, not just minX: an empty cloud leaves every one at its
  // sentinel, but a single NaN or Infinity coordinate poisons only the extents
  // it touches, and any one of them would carry through into center/distance.
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY) ||
    !Number.isFinite(maxZ)
  ) {
    return null;
  }

  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  // Keep the viewing angle the viewer already chose; only the distance moves.
  const dir = normalize({
    x: view.cameraPos.x - center.x,
    y: view.cameraPos.y - center.y,
    z: view.cameraPos.z - center.z,
  });
  // Screen right/up for that direction. World +y is the camera's up axis unless
  // the view is looking straight down it, where +z takes over.
  const worldUp = Math.abs(dir.y) > 0.999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = normalize(cross(worldUp, dir));
  const up = cross(dir, right);

  let halfRight = 0;
  let halfUp = 0;
  let nearDepth = 0;
  for (const p of points) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const dz = p.z - center.z;
    halfRight = Math.max(
      halfRight,
      Math.abs(dx * right.x + dy * right.y + dz * right.z) + p.radius,
    );
    halfUp = Math.max(halfUp, Math.abs(dx * up.x + dy * up.y + dz * up.z) + p.radius);
    // Only depth towards the camera pushes it back; the far side is free.
    nearDepth = Math.max(nearDepth, dx * dir.x + dy * dir.y + dz * dir.z + p.radius);
  }

  const vFov = (view.fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * view.aspect);
  // Padding is quoted in pixels; express it as a share of the viewport so the
  // margin holds at any canvas size.
  const slack = 1 + Math.min(0.5, (2 * view.paddingPx) / (view.viewportHeight || 1));
  const distance =
    Math.max(
      (halfUp * slack) / Math.tan(vFov / 2),
      (halfRight * slack) / Math.tan(hFov / 2),
      MIN_FIT_DISTANCE,
    ) + Math.max(0, nearDepth);
  return { center, dir, distance };
}
