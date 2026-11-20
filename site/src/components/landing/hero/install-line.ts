/**
 * The hero's install line: a package-manager choice (npm, bun, pnpm) and a Copy
 * button that writes the shown command to the clipboard and says "Copied" or
 * "Copy failed" for two seconds. The choice and the button ship hidden and this
 * script shows them, so without JavaScript there is no dead control; the npm
 * command shows and stays selectable either way.
 */

const FEEDBACK_MS = 2000;

/** Shows the command at `index` and marks its manager button pressed. */
function choose(root: HTMLElement, index: string) {
  for (const command of root.querySelectorAll<HTMLElement>("[data-hero-command]")) {
    command.hidden = command.dataset.heroCommand !== index;
  }
  for (const button of root.querySelectorAll<HTMLElement>("[data-hero-manager]")) {
    button.setAttribute("aria-pressed", String(button.dataset.heroManager === index));
  }
}

/** The text of the command on show, without the prompt. */
function shownCommand(root: HTMLElement): string {
  const command = root.querySelector<HTMLElement>("[data-hero-command]:not([hidden])");
  const prompt = command?.querySelector(".hero-install-prompt")?.textContent ?? "";
  return (command?.textContent ?? "").replace(prompt, "").trim();
}

function wireCopy(root: HTMLElement, button: HTMLButtonElement) {
  const label = button.textContent ?? "Copy";
  let reset: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener("click", async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(shownCommand(root));
      button.textContent = "Copied";
    } catch (error) {
      button.textContent = "Copy failed";
      console.warn("Copying the install command failed; it stays selectable.", error);
    }
    reset = setTimeout(() => {
      button.textContent = label;
    }, FEEDBACK_MS);
  });
  button.hidden = false;
}

function wireInstallLine(root: HTMLElement) {
  const managers = root.querySelector<HTMLElement>("[role='group']");
  if (managers) {
    managers.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLElement>("[data-hero-manager]");
      if (button?.dataset.heroManager) choose(root, button.dataset.heroManager);
    });
    managers.hidden = false;
  }
  const copy = root.querySelector<HTMLButtonElement>("[data-hero-copy]");
  if (copy) wireCopy(root, copy);
}

for (const root of document.querySelectorAll<HTMLElement>("[data-hero-install]")) {
  wireInstallLine(root);
}
