/**
 * Minimal ambient types for the optional `gifenc` peer dependency, which ships
 * no type declarations. Only the surface `export-gif.ts` uses is declared.
 */
declare module 'gifenc' {
  export interface GifencWriteFrameOptions {
    palette?: number[][];
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
    first?: boolean;
  }

  export interface GifencEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifencWriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean }): GifencEncoder;

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string },
  ): number[][];

  // export-gif.ts calls quantize/applyPalette with the default format only
  // (1-byte palette indices). The `format` coupling between the two (rgb565 /
  // rgba4444 change the index width) isn't modeled here because the code never
  // varies it; add it if a caller ever passes a non-default format.
  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
