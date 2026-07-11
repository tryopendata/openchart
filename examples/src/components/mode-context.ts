/**
 * Resolved light/dark mode context.
 *
 * The Ladle provider computes the resolved mode (via the corrected dark
 * bridge) and publishes it here. GalleryPage reads it to stamp
 * `[data-oc-mode]` on its root wrapper, which crosses into the width-addon
 * iframe (React context does) so gallery-content CSS follows dark mode there
 * (constraint C3).
 */
import { createContext, useContext } from 'react';

export type OcMode = 'light' | 'dark';

export const OcModeContext = createContext<OcMode>('light');

export function useOcMode(): OcMode {
  return useContext(OcModeContext);
}
