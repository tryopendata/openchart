/**
 * Wires every InstallCommand on the page: shows the package-manager choice,
 * switches the command on show (and the Copy button's `aria-controls`, which is
 * what `@steamfield/ui/copy` copies), and activates Copy.
 */
import { enhanceCopyButtons } from "@steamfield/ui/copy";

/** Shows the command with id `target` in `root` and points Copy at it. */
function choose(root: HTMLElement, target: string) {
  for (const command of root.querySelectorAll<HTMLElement>(".install-command-text")) {
    command.hidden = command.id !== target;
  }
  for (const button of root.querySelectorAll<HTMLElement>("[data-install-target]")) {
    button.setAttribute("aria-pressed", String(button.dataset.installTarget === target));
  }
  root.querySelector("[data-copy-command]")?.setAttribute("aria-controls", target);
}

function wireChoice(root: HTMLElement) {
  const managers = root.querySelector<HTMLElement>(".install-command-managers");
  if (!managers) return;
  managers.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-install-target]");
    if (button?.dataset.installTarget) choose(root, button.dataset.installTarget);
  });
  managers.hidden = false;
}

/** Activates the install commands under `scope`. */
export function wireInstallCommands(scope: ParentNode) {
  for (const root of scope.querySelectorAll<HTMLElement>("[data-install-command]")) {
    wireChoice(root);
    enhanceCopyButtons(root);
  }
}
