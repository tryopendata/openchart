import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Demo, Features, Hero, ReleaseBanner, Sponsors, UsedBy } from "./sections";

const logo = { name: "Example Co", href: "https://example.org", logo: "/logos/example.svg" };

describe("landing sections", () => {
  it("links the announcement and renders nothing without one", () => {
    const { container, rerender } = render(
      <ReleaseBanner announcement={{ label: "v1 is out", href: "/releases" }} />,
    );
    expect(screen.getByRole("link", { name: "v1 is out" })).toHaveAttribute("href", "/releases");
    rerender(<ReleaseBanner announcement={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("puts the tagline in the page heading", () => {
    render(<Hero tagline="Search your notes" description="From the terminal." />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search your notes");
  });

  it("renders the demo as real text, with prompts hidden from screen readers", () => {
    render(<Demo title="Demo" lines={[{ prompt: true, text: "acme index" }, { text: "done" }]} />);
    const code = screen.getByRole("figure", { name: "Demo" });
    expect(code).toHaveTextContent("$ acme index");
    expect(code.querySelector("[aria-hidden=true]")).toHaveTextContent("$");
  });

  it("lists features under a heading", () => {
    render(<Features features={[{ title: "Fast", body: "Under a second." }]} />);
    expect(screen.getByRole("heading", { name: "Fast" })).toBeInTheDocument();
  });

  it("hides used-by and sponsors until they have logos", () => {
    const { container } = render(
      <>
        <UsedBy logos={[]} />
        <Sponsors href="/sponsor" logos={[]} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows sponsor logos with a link to sponsor", () => {
    render(<Sponsors href="/sponsor" logos={[logo]} />);
    expect(screen.getByRole("img", { name: "Example Co" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Become a sponsor" })).toHaveAttribute(
      "href",
      "/sponsor",
    );
  });
});
