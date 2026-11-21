/**
 * The keyboard shortcuts that open site search, as pure rules over a key event:
 * Meta+K on macOS and Ctrl+K elsewhere toggle the dialog, and "/" opens it unless
 * the reader is typing somewhere. The eager search script imports this module,
 * so it stays small and imports nothing.
 */

/** What a key press asks search to do, or null when it is not a search shortcut. */
export type ShortcutAction = "toggle" | "open" | null;

/** The parts of a KeyboardEvent the rules read. */
export type ShortcutKey = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing"
>;

/** Where focus is when the key goes down: in a field that takes text, or not. */
export type ShortcutContext = { mac: boolean; typing: boolean };

/**
 * The action a key press maps to. Only the exact chords count: on macOS Meta+K and
 * not Ctrl+K (a text field's "delete to end of line" there), elsewhere Ctrl+K and
 * not Meta+K, and nothing with Alt or Shift added. "/" may carry Shift, because
 * some keyboard layouts need it to type a slash, but no other modifier. Nothing
 * fires during IME composition, where the keys belong to the composition.
 */
export function shortcutAction(key: ShortcutKey, context: ShortcutContext): ShortcutAction {
  if (key.isComposing || key.altKey) return null;
  if (key.key.toLowerCase() === "k") {
    const command = context.mac ? key.metaKey && !key.ctrlKey : key.ctrlKey && !key.metaKey;
    return command && !key.shiftKey ? "toggle" : null;
  }
  if (key.key === "/" && !key.metaKey && !key.ctrlKey && !context.typing) return "open";
  return null;
}

/** True when `target` takes typed text: an input, textarea, select or contenteditable element. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

/** True on Apple platforms, where the command key is Meta. */
export function isApplePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** The hint the trigger shows for the toggle shortcut. */
export function shortcutHint(mac: boolean): string {
  return mac ? "⌘K" : "Ctrl K";
}
