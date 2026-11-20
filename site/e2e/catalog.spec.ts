import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { catalogPages } from "../tests/catalog-pages";

// The first page of each section stands in for the section.
const pages = Object.entries(catalogPages).map(
  ([section, slugs]) => `/docs/${section}/${slugs[0]}/`,
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
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      const stage = page.locator("[data-demo-stage]").first();
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toHaveAttribute("data-demo-live", "");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // See site.spec.ts: the library labels mark groups without giving them a role.
        .exclude(".demo-live g[aria-label]:not([role])")
        .analyze();
      expect(results.violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
