/**
 * Minimal stand-in for `three`, enough for the 3D adapter's object graph.
 *
 * happy-dom has no WebGL, so the real library cannot run in the test env. The
 * fake keeps the shapes the adapter actually reads (geometry `parameters`,
 * material `color`/`opacity`, the `Object3D` parent chain and `userData`) and
 * records every allocation and disposal, which is how the disposal tests assert
 * that `destroy()` leaves nothing behind.
 */

/** Every geometry/material/texture the adapter has allocated and disposed. */
export const allocations = {
  created: new Set<Disposable>(),
  disposed: new Set<Disposable>(),
};

export function resetAllocations(): void {
  allocations.created.clear();
  allocations.disposed.clear();
}

interface Disposable {
  dispose(): void;
}

function track<T extends Disposable>(obj: T): T {
  allocations.created.add(obj);
  return obj;
}

export class Vector2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
}

export class Vector3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}
  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

export class Color {
  value: string;
  constructor(value?: string | number) {
    this.value = String(value ?? '');
  }
  set(value: string | number): this {
    this.value = String(value);
    return this;
  }
}

export class Object3D {
  type = 'Object3D';
  parent: Object3D | null = null;
  children: Object3D[] = [];
  userData: Record<string, unknown> = {};
  position = new Vector3();
  scale = new Vector3(1, 1, 1);
  visible = true;
  renderOrder = 0;
  raycast(): void {}
  add(child: Object3D): this {
    child.parent = this;
    this.children.push(child);
    return this;
  }
  lookAt(): void {}
}

export class Group extends Object3D {
  type = 'Group';
}

export class Material {
  color: Color;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  type = 'Material';
  constructor(params: Record<string, unknown> = {}) {
    this.color = new Color(params.color as string);
    this.opacity = (params.opacity as number) ?? 1;
    this.transparent = Boolean(params.transparent);
    this.depthWrite = params.depthWrite !== false;
    track(this);
  }
  dispose(): void {
    allocations.disposed.add(this);
  }
}

export class MeshLambertMaterial extends Material {
  type = 'MeshLambertMaterial';
}
export class LineBasicMaterial extends Material {
  type = 'LineBasicMaterial';
}
export class LineDashedMaterial extends Material {
  dashSize: number;
  gapSize: number;
  type = 'LineDashedMaterial';
  constructor(params: Record<string, unknown> = {}) {
    super(params);
    this.dashSize = (params.dashSize as number) ?? 3;
    this.gapSize = (params.gapSize as number) ?? 1;
  }
}

export class BufferAttribute {
  needsUpdate = false;
  constructor(
    public array: Float32Array,
    public itemSize: number,
  ) {}
}

export class BufferGeometry {
  type = 'BufferGeometry';
  parameters: Record<string, number> = {};
  private attributes = new Map<string, BufferAttribute>();
  constructor() {
    track(this);
  }
  setAttribute(name: string, attr: BufferAttribute): this {
    this.attributes.set(name, attr);
    return this;
  }
  getAttribute(name: string): BufferAttribute | undefined {
    return this.attributes.get(name);
  }
  computeBoundingSphere(): void {}
  applyMatrix4(): this {
    return this;
  }
  dispose(): void {
    allocations.disposed.add(this);
  }
}

export class SphereGeometry extends BufferGeometry {
  type = 'SphereGeometry';
  constructor(radius = 1, widthSegments = 8, heightSegments = 8) {
    super();
    this.parameters = { radius, widthSegments, heightSegments };
  }
}

export class CylinderGeometry extends BufferGeometry {
  type = 'CylinderGeometry';
  constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 8) {
    super();
    this.parameters = { radiusTop, radiusBottom, height, radialSegments };
  }
}

export class Mesh extends Object3D {
  type = 'Mesh';
  constructor(
    public geometry: BufferGeometry = new BufferGeometry(),
    public material: Material = new Material(),
  ) {
    super();
  }
}

export class Line extends Object3D {
  type = 'Line';
  lineDistancesComputed = 0;
  constructor(
    public geometry: BufferGeometry = new BufferGeometry(),
    public material: Material = new Material(),
  ) {
    super();
  }
  computeLineDistances(): void {
    this.lineDistancesComputed++;
  }
}

export class Sprite extends Object3D {
  type = 'Sprite';
  material: Material & { map: { dispose(): void } };
  constructor() {
    super();
    const map = {
      dispose(): void {
        allocations.disposed.add(map as unknown as Disposable);
      },
    };
    track(map as unknown as Disposable);
    this.material = Object.assign(new Material(), { map });
  }
}

export class Matrix4 {
  makeTranslation(): this {
    return this;
  }
  makeRotationX(): this {
    return this;
  }
}

/** Every raycaster the adapter has constructed, so tests can plant hits. */
export const raycasters: Raycaster[] = [];

export class Raycaster {
  private hits: Object3D[] = [];
  constructor() {
    raycasters.push(this);
  }
  /** Test hook: what the next `intersectObjects` call should report. */
  setHits(objects: Object3D[]): void {
    this.hits = objects;
  }
  setFromCamera(): void {}
  intersectObjects(objects: Object3D[]): Array<{ object: Object3D }> {
    const wanted = new Set(this.hits);
    const out: Array<{ object: Object3D }> = [];
    const walk = (o: Object3D): void => {
      if (wanted.has(o)) out.push({ object: o });
      for (const c of o.children) walk(c);
    };
    for (const o of objects) walk(o);
    return out;
  }
}
