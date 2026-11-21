/**
 * The resize frame through its slider, as a keyboard or pointer user drives it:
 * the value, the frame's width and the breakpoint label move together, a drag
 * ends cleanly however the pointer lets go, and the width follows a track that
 * shrinks. happy-dom has no layout, so the track's width and its ResizeObserver
 * are stubbed: they are the browser, not the code under test.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResizeFrame } from "./ResizeFrame";

/** The track's width in px, as the stubbed layout reports it; the chart's box is 2px less. */
let trackWidth = 0;
const observers: Array<() => void> = [];

beforeEach(() => {
  trackWidth = 902;
  observers.length = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const width = this.classList.contains("resize-track") ? trackWidth : 0;
    return DOMRect.fromRect({ x: 0, y: 0, width, height: 0 });
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {
        observers.push(() => this.callback());
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderFrame() {
  const view = render(<ResizeFrame />);
  const frame = view.container.querySelector<HTMLElement>("[data-resize-frame]");
  const slider = () => screen.getByRole("slider", { name: "Chart width" });
  const label = () => view.container.querySelector("[data-resize-breakpoint]");
  return { frame, slider, label };
}

const widthNow = (slider: HTMLElement) => Number(slider.getAttribute("aria-valuenow"));
const press = (slider: HTMLElement, key: string, times = 1) => {
  for (let count = 0; count < times; count += 1) fireEvent.keyDown(slider, { key });
};

describe("ResizeFrame", () => {
  it("offers no slider or readout until it has measured its track", () => {
    trackWidth = 0;
    const view = render(<ResizeFrame />);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(view.container.querySelector("[data-resize-breakpoint]")).toBeNull();
    expect(view.container.querySelector<HTMLElement>("[data-resize-frame]")?.style.width).toBe("");
  });

  it("starts at the chart's full width inside the frame's border", () => {
    const { slider, frame, label } = renderFrame();
    expect(widthNow(slider())).toBe(900);
    expect(slider()).toHaveAttribute("aria-valuemax", "900");
    expect(frame?.style.width).toBe("900px");
    expect(label()).toHaveTextContent(/^full$/);
  });

  it("moves 20px per arrow key and names the breakpoint the library would pick", () => {
    const { slider, frame, label } = renderFrame();
    press(slider(), "ArrowLeft");
    expect(widthNow(slider())).toBe(880);
    press(slider(), "ArrowRight");
    expect(widthNow(slider())).toBe(900);

    press(slider(), "PageDown", 2);
    expect(widthNow(slider())).toBe(700);
    expect(label()).toHaveTextContent(/^medium$/);
    press(slider(), "ArrowRight");
    expect(label()).toHaveTextContent(/^full$/);

    press(slider(), "Home");
    expect(widthNow(slider())).toBe(280);
    expect(label()).toHaveTextContent(/^compact$/);
    expect(frame?.style.width).toBe("280px");
    expect(slider()).toHaveAttribute("aria-valuetext", "280 px, compact layout");
  });

  it("follows a primary-button drag and stops dragging when the pointer lets go", () => {
    const { slider, frame, label } = renderFrame();
    fireEvent.pointerDown(slider(), { pointerId: 1, clientX: 900, button: 0, isPrimary: true });
    expect(frame?.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(slider(), { pointerId: 1, clientX: 350 });
    expect(widthNow(slider())).toBe(350);
    expect(label()).toHaveTextContent(/^compact$/);
    fireEvent.pointerUp(slider(), { pointerId: 1 });
    expect(frame?.hasAttribute("data-dragging")).toBe(false);
    fireEvent.pointerMove(slider(), { pointerId: 1, clientX: 900 });
    expect(widthNow(slider())).toBe(350);
  });

  it.each([
    ["pointercancel", (target: HTMLElement) => fireEvent.pointerCancel(target, { pointerId: 1 })],
    [
      "lostpointercapture",
      (target: HTMLElement) => fireEvent.lostPointerCapture(target, { pointerId: 1 }),
    ],
  ])("ends the drag on %s", (_name, letGo) => {
    const { slider, frame } = renderFrame();
    fireEvent.pointerDown(slider(), { pointerId: 1, clientX: 900, button: 0, isPrimary: true });
    letGo(slider());
    expect(frame?.hasAttribute("data-dragging")).toBe(false);
    fireEvent.pointerMove(slider(), { pointerId: 1, clientX: 400 });
    expect(widthNow(slider())).toBe(900);
  });

  it("ignores a secondary button and moves without a drag", () => {
    const { slider, frame } = renderFrame();
    fireEvent.pointerDown(slider(), { pointerId: 1, clientX: 900, button: 2, isPrimary: true });
    expect(frame?.hasAttribute("data-dragging")).toBe(false);
    fireEvent.pointerMove(slider(), { pointerId: 1, clientX: 400 });
    expect(widthNow(slider())).toBe(900);
  });

  it("narrows the chart when its track shrinks below the chosen width", () => {
    const { slider, frame } = renderFrame();
    press(slider(), "ArrowLeft", 5);
    expect(widthNow(slider())).toBe(800);
    trackWidth = 602;
    act(() => {
      for (const notify of observers) notify();
    });
    expect(widthNow(slider())).toBe(600);
    expect(slider()).toHaveAttribute("aria-valuemax", "600");
    expect(frame?.style.width).toBe("600px");
  });
});
