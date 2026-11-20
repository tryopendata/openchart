/**
 * The InstallTabs island (client:visible): React, Vue, Svelte and Vanilla tabs,
 * each with its install command and the usage sample for one spec. Built on the
 * @steamfield/ui tabs, so every panel is in the server HTML and the tabs work as
 * links without JavaScript. The selection is the docs demo tabs' stored choice
 * (`openchart:framework`), read once hydrated and written on every pick.
 */
import "@steamfield/ui/tabs/styles.css";
import { Tab, TabList, TabPanel, Tabs } from "@steamfield/ui/react/tabs";
import { useEffect, useState } from "react";
import { readFrameworkChoice, writeFrameworkChoice } from "../../../lib/demo/framework-choice";
import { CopyText } from "./CopyText";
import type { FrameworkPanel } from "./framework-panels";
import {
  DEFAULT_LANDING_FRAMEWORK,
  isLandingFramework,
  type LandingFramework,
  landingTabFor,
} from "./framework-tabs";

/** One panel as the island receives it: the sample already highlighted at build time. */
export type InstallPanel = Omit<FrameworkPanel, "shown" | "lang"> & { html: string };

type InstallTabsProps = { panels: InstallPanel[] };

export function InstallTabs({ panels }: InstallTabsProps) {
  const [selected, setSelected] = useState<LandingFramework>(DEFAULT_LANDING_FRAMEWORK);
  // The server can't read storage, so the stored choice applies after hydration.
  useEffect(() => setSelected(landingTabFor(readFrameworkChoice())), []);

  const pick = (value: string) => {
    if (!isLandingFramework(value)) return;
    setSelected(value);
    writeFrameworkChoice(value);
  };

  return (
    <Tabs id="install" value={selected} onValueChange={pick} className="install-tabs">
      <TabList aria-label="Framework" className="install-tablist">
        {panels.map((panel) => (
          <Tab key={panel.id} value={panel.id} className="install-tab">
            {panel.label}
          </Tab>
        ))}
      </TabList>
      {panels.map((panel) => (
        <TabPanel key={panel.id} value={panel.id} className="install-panel">
          <div className="install-command">
            <code id={`install-${panel.id}-command`}>{panel.install}</code>
            <CopyText text={panel.install} label={`Copy the ${panel.label} install command`} />
          </div>
          <div className="install-code">
            <div className="install-code-head">
              <span className="install-file">{panel.file}</span>
              <CopyText text={panel.code} label={`Copy the ${panel.label} sample`} />
            </div>
            {/* Highlighted by Shiki at build time from the generated sample. */}
            {/** biome-ignore lint/security/noDangerouslySetInnerHtml: build-time Shiki output of our own generated code */}
            <div className="install-code-body" dangerouslySetInnerHTML={{ __html: panel.html }} />
          </div>
        </TabPanel>
      ))}
    </Tabs>
  );
}
