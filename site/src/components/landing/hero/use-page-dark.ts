/**
 * Follows the page theme for the live chart: true while `<html>` carries the
 * `dark` class the theme toggle sets. Starts false so the server render and the
 * first client render agree; the effect reads the real value right after.
 */
import { useEffect, useState } from "react";

const isDarkPage = () => document.documentElement.classList.contains("dark");

/** Whether the page is in its dark theme, updated when the toggle flips it. */
export function usePageDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(isDarkPage());
    const observer = new MutationObserver(() => setDark(isDarkPage()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
