/** Escape one RFC 6901 reference token: `~` becomes `~0`, then `/` becomes `~1`. */
export function encodePointerToken(token: string | number): string {
  return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Build a root-relative JSON Pointer from unescaped tokens. No tokens is the root, `''`. */
export function jsonPointer(...tokens: ReadonlyArray<string | number>): string {
  return tokens.map((token) => `/${encodePointerToken(token)}`).join('');
}
