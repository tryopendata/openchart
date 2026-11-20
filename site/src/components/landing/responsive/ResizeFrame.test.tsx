/**
 * The resize frame through its slider, as a keyboard or pointer user drives it:
 * the value, the frame's width and the breakpoint label move together.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizeFrame } from "./ResizeFrame";

function renderFrame() {
  const view = render(<ResizeFrame />);
  const slider = screen.getByRole("slider", { name: "Chart width" });
  const frame = view.container.querySelector<HTMLElement>("[data-resize-frame]");
  const label = view.container.querySelector("[data-resize-breakpoint]");
  return { slider, frame, label };
}

const widthNow = (slider: HTMLElement) => Number(slider.getAttribute("aria-valuenow"));

describe("ResizeFrame", () => {
  it("moves 20px per arrow key and names the breakpoint it lands in", () => {
    const { slider, frame, label } = renderFrame();
    const start = widthNow(slider);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(widthNow(slider)).toBe(start - 20);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(widthNow(slider)).toBe(start);

    fireEvent.keyDown(slider, { key: "Home" });
    expect(widthNow(slider)).toBe(Number(slider.getAttribute("aria-valuemin")));
    expect(label).toHaveTextContent(/^compact$/);
    expect(frame?.style.width).toBe(`${widthNow(slider)}px`);
    expect(slider).toHaveAttribute("aria-valuetext", `${widthNow(slider)} px, compact layout`);
  });

  it("follows a pointer drag on the handle", () => {
    const { slider, label } = renderFrame();
    const start = widthNow(slider);
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 500 - (start - 350) });
    fireEvent.pointerUp(slider, { pointerId: 1 });
    expect(widthNow(slider)).toBe(350);
    expect(label).toHaveTextContent(/^compact$/);
  });

  it("ignores pointer moves when no drag has started", () => {
    const { slider } = renderFrame();
    const start = widthNow(slider);
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 10 });
    expect(widthNow(slider)).toBe(start);
  });
});
