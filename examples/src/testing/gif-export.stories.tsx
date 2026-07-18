/**
 * Testing / GIF export correctness harness.
 *
 * Not an editorial demo — this story exists so the Playwright `gif` project can
 * exercise `exportGIF` in a real browser (happy-dom can't rasterize a canvas).
 * It mounts an animated bar chart, exports a GIF, decodes its frame structure,
 * and writes the result to `#gif-result` for the test to read.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { createChart } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef, useState } from 'react';

export default { title: 'Testing / Gif Export' };

const spec: ChartSpec = {
  animation: { enter: true },
  mark: { type: 'bar' },
  data: [
    { category: 'A', value: 30 },
    { category: 'B', value: 80 },
    { category: 'C', value: 45 },
    { category: 'D', value: 60 },
    { category: 'E', value: 20 },
  ],
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

/**
 * Walk a GIF byte stream, counting image-descriptor frames and fingerprinting
 * each frame's compressed data so we can prove frames differ. Does not fully
 * LZW-decode — byte inequality between frames is sufficient proof they aren't
 * identical (which a static GIF would be).
 */
function analyzeGif(bytes: Uint8Array): { frames: number; earlyDiffersFromLast: boolean } {
  const frameHashes: number[] = [];
  let i = 13; // header (6) + logical screen descriptor (7)
  const packed = bytes[10];
  if (packed & 0x80) i += 2 ** ((packed & 0x07) + 1) * 3; // global color table

  // Hash the FULL compressed payload of a frame (every sub-block byte), not just
  // block boundaries — otherwise two genuinely different frames could collide on
  // matching boundary bytes and let a static-GIF regression pass.
  const readSubBlocks = (start: number): { end: number; hash: number } => {
    let p = start;
    let hash = 2166136261; // FNV-1a
    while (bytes[p] !== 0 && p < bytes.length) {
      const size = bytes[p];
      for (let k = p + 1; k <= p + size && k < bytes.length; k++) {
        hash = (hash ^ bytes[k]) >>> 0;
        hash = (hash * 16777619) >>> 0;
      }
      p += size + 1;
    }
    return { end: p + 1, hash };
  };

  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 0x3b) break; // trailer
    if (b === 0x21) {
      i += 2; // extension introducer + label
      i = readSubBlocks(i).end;
    } else if (b === 0x2c) {
      let p = i + 10;
      const lct = bytes[i + 9];
      if (lct & 0x80) p += 2 ** ((lct & 0x07) + 1) * 3;
      p += 1; // LZW min code size
      const { end, hash } = readSubBlocks(p);
      frameHashes.push(hash);
      i = end;
    } else {
      i++;
    }
  }

  const early = frameHashes[Math.min(2, frameHashes.length - 1)];
  const last = frameHashes[frameHashes.length - 1];
  return { frames: frameHashes.length, earlyDiffersFromLast: early !== last };
}

export const GifCorrectness = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<string>('pending');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, spec);
    let cancelled = false;

    (async () => {
      // Let layout settle.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        const blob = await chart.export('gif', { fps: 20, dpi: 1, loop: false });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const analysis = analyzeGif(bytes);
        if (!cancelled) {
          setResult(JSON.stringify({ byteLength: bytes.length, ...analysis }));
        }
      } catch (err) {
        if (!cancelled) setResult(`error: ${(err as Error).message}`);
      }
    })();

    return () => {
      cancelled = true;
      chart.destroy();
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} style={{ width: 480, height: 320 }} />
      <pre id="gif-result" data-result={result}>
        {result}
      </pre>
    </div>
  );
};
