/**
 * Wires every InstallCommand under a root: the package-manager choice becomes
 * ARIA tabs (`@steamfield/ui/tabs`), each panel's Copy is activated
 * (`@steamfield/ui/copy`), and switching managers clears any copy result left
 * on screen, so a "Copy failed" never sits under a command it was not about.
 */
import { enhanceCopyButtons } from "@steamfield/ui/copy";
import { createTabs } from "@steamfield/ui/tabs";

/** Clears the copy result text and state in every panel of one install command. */
function clearCopyResults(root: HTMLElement) {
  for (const node of root.querySelectorAll<HTMLElement>(
    "[data-copy-result], [data-copy-command]",
  )) {
    delete node.dataset.state;
    if (node.hasAttribute("data-copy-result")) node.textContent = "";
  }
}

/** Activates the install commands under `scope`. Returns a function that removes what it set up. */
export function wireInstallCommands(scope: ParentNode): () => void {
  const teardowns = [...scope.querySelectorAll<HTMLElement>("[data-install-command]")].flatMap(
    (root) => [
      createTabs(root, { onValueChange: () => clearCopyResults(root) }),
      enhanceCopyButtons(root),
    ],
  );
  return () => {
    for (const teardown of teardowns) teardown();
  };
}
