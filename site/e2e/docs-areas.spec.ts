import { expect, type Page, test } from "@playwright/test";
import { docsPages } from "../tests/docs-pages";
import { pageViolations } from "./axe";

// The first page of each phase 4 section stands in for the section.
const pages = Object.entries(docsPages).map(
  ([section, list]) => `/docs/${section}/${list[0].slug}/`,
);

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

for (const path of pages) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${path} in ${scheme} passes axe and mounts its first demo`, async ({ page }) => {
      const errors = collectErrors(page);
      // Under reduced motion every static chart shows, so axe checks each demo finished.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      const stage = page.locator("[data-demo-stage]").first();
      if ((await stage.count()) > 0) {
        await stage.scrollIntoViewIfNeeded();
        await expect(stage).toHaveAttribute("data-demo-live", "");
      }
      expect(await pageViolations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
