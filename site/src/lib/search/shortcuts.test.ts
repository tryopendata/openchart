import { describe, expect, it } from "vitest";
import {
  currentPlatform,
  isApplePlatform,
  isTypingTarget,
  type ShortcutKey,
  shortcutAction,
  shortcutHint,
} from "./shortcuts";

const press = (key: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key,
  code: key === "/" ? "Slash" : `Key${key.toUpperCase()}`,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  repeat: false,
  ...modifiers,
});

const mac = { mac: true, typing: false };
const other = { mac: false, typing: false };

describe("shortcutAction", () => {
  it.each([
    ["Meta+K on macOS", press("k", { metaKey: true }), mac],
    ["Ctrl+K elsewhere", press("k", { ctrlKey: true }), other],
    ["Meta+K with Caps Lock on macOS", press("K", { metaKey: true }), mac],
    ["Ctrl+K while typing in a field", press("k", { ctrlKey: true }), { ...other, typing: true }],
    [
      "Ctrl+K on a Cyrillic layout, by its physical key",
      press("л", { ctrlKey: true, code: "KeyK" }),
      other,
    ],
  ])("toggles on %s", (_, key, context) => {
    expect(shortcutAction(key, context)).toBe("toggle");
  });

  it.each([
    ["/", press("/"), other],
    ["Shift+/ where the layout needs Shift for a slash", press("/", { shiftKey: true }), other],
  ])("opens on %s", (_, key, context) => {
    expect(shortcutAction(key, context)).toBe("open");
  });

  it.each([
    ["Ctrl+K on macOS", press("k", { ctrlKey: true }), mac],
    ["Meta+K off macOS", press("k", { metaKey: true }), other],
    ["Meta+Ctrl+K on macOS", press("k", { metaKey: true, ctrlKey: true }), mac],
    ["Shift+Meta+K on macOS", press("k", { metaKey: true, shiftKey: true }), mac],
    ["Alt+Ctrl+K", press("k", { ctrlKey: true, altKey: true }), other],
    ["K alone", press("k"), other],
    ["Ctrl+/", press("/", { ctrlKey: true }), other],
    ["Meta+/ on macOS", press("/", { metaKey: true }), mac],
    ["Alt+/", press("/", { altKey: true }), other],
    ["/ while typing in a field", press("/"), { ...other, typing: true }],
    ["/ during IME composition", press("/", { isComposing: true }), other],
    ["Ctrl+K during IME composition", press("k", { ctrlKey: true, isComposing: true }), other],
    ["a held Ctrl+K repeating", press("k", { ctrlKey: true, repeat: true }), other],
    ["a held Meta+K repeating on macOS", press("k", { metaKey: true, repeat: true }), mac],
    ["Ctrl+L on a Cyrillic layout", press("д", { ctrlKey: true, code: "KeyL" }), other],
  ])("ignores %s", (_, key, context) => {
    expect(shortcutAction(key, context)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const element = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild;
  };

  it.each([
    ["an input", "<input>"],
    ["a search input", '<input type="search">'],
    ["a textarea", "<textarea></textarea>"],
    ["a select", "<select></select>"],
    ["a contenteditable element", '<div contenteditable="true"></div>'],
  ])("is true for %s", (_, html) => {
    expect(isTypingTarget(element(html))).toBe(true);
  });

  it.each([
    ["a button", "<button>Search</button>"],
    ["a link", '<a href="/">Home</a>'],
    ["the page body", null],
  ])("is false for %s", (_, html) => {
    expect(isTypingTarget(html ? element(html) : document.body)).toBe(false);
  });
});

describe("platform and hint", () => {
  it.each([
    ["macOS", true],
    ["MacIntel", true],
    ["iPhone", true],
    ["iPad", true],
    ["Win32", false],
    ["Linux x86_64", false],
    ["", false],
  ])("reads %s as Apple: %s", (platform, apple) => {
    expect(isApplePlatform(platform)).toBe(apple);
  });

  it("reads the platform from userAgentData where the browser has it, else navigator.platform", () => {
    const withData = { platform: "MacIntel", userAgentData: { platform: "Windows" } };
    expect(currentPlatform(withData as unknown as Navigator)).toBe("Windows");
    const emptyData = { platform: "MacIntel", userAgentData: { platform: "" } };
    expect(currentPlatform(emptyData as unknown as Navigator)).toBe("MacIntel");
    expect(currentPlatform({ platform: "Linux x86_64" } as Navigator)).toBe("Linux x86_64");
  });

  it("shows the command key on macOS and Ctrl elsewhere", () => {
    expect(shortcutHint(true)).toBe("⌘K");
    expect(shortcutHint(false)).toBe("Ctrl K");
  });
});
