/**
 * The analytics consent decision this site shares with every steamfield.io site:
 * one `sf-consent` cookie on `.steamfield.io`, asked for by the Steamfield banner.
 * This module only configures @steamfield/ui/consent; analytics.ts reacts to it.
 */

import { type ConsentStore, createConsentStore, mountConsentBanner } from "@steamfield/ui/consent";

/** The cookie domain, privacy page and banner text that every Steamfield site uses. */
export function consentOptions(): {
  domain: "steamfield.io";
  privacyHref: "https://steamfield.io/privacy";
  message: string;
} {
  return {
    domain: "steamfield.io",
    privacyHref: "https://steamfield.io/privacy",
    message:
      "The OpenChart site counts visits with PostHog. Accept lets it set a cookie so a repeat visit counts once; one answer covers every steamfield.io site.",
  };
}

/** Reads the shared decision from its cookie. Create one per page and keep it. */
export function createSiteConsent(): ConsentStore {
  return createConsentStore({ domain: consentOptions().domain });
}

/**
 * Shows the banner while the visitor is undecided and returns a function that removes it.
 * @throws LibraryError when called before `document.body` exists.
 */
export function showConsentBanner(store: ConsentStore): () => void {
  const { message, privacyHref } = consentOptions();
  return mountConsentBanner(store, { message, privacyHref });
}
