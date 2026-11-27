/**
 * The InstallTabs island (client:visible): React, Vue, Svelte and Vanilla tabs,
 * each with its install command and the usage sample for one spec. Built on the
 * @steamfield/ui tabs, so every panel is in the server HTML and the tabs work as
 * links without JavaScript. The selection is the docs demo tabs' stored choice
 * (`openchart:framework`), written on every pick.
 *
 * The stored choice is shown before hydration: Start.astro's inline script
 * moves the panel's `data-default` to it before paint, and this island's first
 * render reads the same choice, so hydration finds matching markup and the
 * section never swaps from React to the stored tab as it scrolls in.
 */
import "@steamfield/ui/tabs/styles.css";
import { Tab, TabList, TabPanel, Tabs } from "@steamfield/ui/react/tabs";
import { useState } from "react";
import { readFrameworkChoice, writeFrameworkChoice } from "../../../lib/demo/framework-choice";
import { CopyText } from "../../shared/CopyText";
import type { FrameworkPanel } from "./framework-panels";
import {
  DEFAULT_LANDING_FRAMEWORK,
  isLandingFramework,
  type LandingFramework,
  landingTabFor,
} from "./framework-tabs";

/** The tabs' id prefix: panel `n` is `${INSTALL_TABS_ID}-${n}`, which the pre-paint script relies on. */
export const INSTALL_TABS_ID = "framework-install";

/** One panel as the island receives it: the sample already highlighted at build time. */
export type InstallPanel = Omit<FrameworkPanel, "shown" | "lang"> & { html: string };

type InstallTabsProps = { panels: InstallPanel[] };

/** The tab to show first: the stored choice in the browser, the default on the server. */
function initialTab(): LandingFramework {
  if (typeof window === "undefined") return DEFAULT_LANDING_FRAMEWORK;
  return landingTabFor(readFrameworkChoice());
}

export function InstallTabs({ panels }: InstallTabsProps) {
  const [selected, setSelected] = useState<LandingFramework>(initialTab);
  // Set once the reader picks a tab; only then does a new panel animate in.
  const [picked, setPicked] = useState(false);

  const pick = (value: string) => {
    if (!isLandingFramework(value)) return;
    setSelected(value);
    setPicked(true);
    writeFrameworkChoice(value);
  };

  return (
    <div className="install-tabs-root" data-picked={picked ? "" : undefined}>
      <Tabs id={INSTALL_TABS_ID} value={selected} onValueChange={pick} className="install-tabs">
        <TabList aria-label="Framework" className="install-tablist">
          {panels.map((panel) => (
            <Tab key={panel.id} value={panel.id} className="install-tab">
              {panel.label}
            </Tab>
          ))}
        </TabList>
        {panels.map((panel) => (
          <TabPanel key={panel.id} value={panel.id} className="install-tab-panel">
            <div
              className="install-tab-command"
              data-install-manager="npm"
              data-install-framework={panel.id}
            >
              <code>
                <span className="install-tab-prompt" aria-hidden="true">
                  ${" "}
                </span>
                {panel.install}
              </code>
              <CopyText
                text={panel.install}
                label={`Copy the ${panel.label} install command`}
                className="copy-button"
              />
            </div>
            <div className="install-tab-code">
              <div className="install-tab-code-head">
                <span>{panel.file}</span>
                <CopyText
                  text={panel.code}
                  label={`Copy the ${panel.label} sample`}
                  className="copy-button"
                />
              </div>
              {/* Highlighted by Shiki at build time from the generated sample. */}
              <div
                className="install-tab-code-body"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time Shiki output of our own generated code
                dangerouslySetInnerHTML={{ __html: panel.html }}
              />
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
