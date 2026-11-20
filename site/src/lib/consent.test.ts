/**
 * Checks the site's consent wiring against the real @steamfield/ui banner and store.
 * @vitest-environment happy-dom
 */

import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consentOptions, createSiteConsent, showConsentBanner } from "./consent";

const cleanups: (() => void)[] = [];

// Reduced motion shows the banner at once instead of after its 1.2s entrance delay.
beforeEach(() => {
  document.documentElement.dataset.sfMotion = "reduce";
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  // Clear the decision cookie so each case starts undecided.
  createSiteConsent().reset();
  delete document.documentElement.dataset.sfMotion;
});

describe("consentOptions", () => {
  it("shares the decision on steamfield.io and links the Steamfield privacy page", () => {
    expect(consentOptions()).toEqual({
      domain: "steamfield.io",
      privacyHref: "https://steamfield.io/privacy",
      message: expect.stringContaining("PostHog"),
    });
  });
});

describe("the banner", () => {
  it("shows the message and privacy link to an undecided visitor", () => {
    const store = createSiteConsent();
    cleanups.push(showConsentBanner(store));
    const banner = screen.getByRole("region", { name: "Analytics consent" });
    expect(banner).toHaveTextContent(consentOptions().message);
    expect(within(banner).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "https://steamfield.io/privacy",
    );
  });

  it("records Accept, closes, and stays closed for the next page's store", async () => {
    const store = createSiteConsent();
    cleanups.push(showConsentBanner(store));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(store.getState()).toBe("granted");
    expect(screen.queryByRole("region", { name: "Analytics consent" })).toBeNull();
    const nextPage = createSiteConsent();
    cleanups.push(showConsentBanner(nextPage));
    expect(nextPage.getState()).toBe("granted");
    expect(screen.queryByRole("region", { name: "Analytics consent" })).toBeNull();
  });
});
