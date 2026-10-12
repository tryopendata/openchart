import type { DataRow } from '@opendata-ai/openchart-core';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';

type Drafts = Record<string, unknown>;
const Context = createContext<{
  drafts: Drafts;
  setDrafts: Dispatch<SetStateAction<Drafts>>;
} | null>(null);

/** Both desktop and sheet inspectors edit the same unfinished, document-scoped choices. */
export function AuthoringDrafts({ source, children }: { source: DataRow[]; children: ReactNode }) {
  const [drafts, setDrafts] = useState<Drafts>({});
  // A replacement source invalidates pending roles and anchors from the old document.
  useEffect(() => {
    void source;
    setDrafts({});
  }, [source]);
  return <Context.Provider value={{ drafts, setDrafts }}>{children}</Context.Provider>;
}
export function useAuthoringDraft<T>(key: string, initial: T): [T, (next: T) => void] {
  const context = useContext(Context);
  if (!context) throw new Error('Authoring controls require a Studio document.');
  return [
    (context.drafts[key] as T | undefined) ?? initial,
    (next) => context.setDrafts((current) => ({ ...current, [key]: next })),
  ];
}
