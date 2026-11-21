/**
 * The demo gate: a tiny script BaseLayout inlines in the head, so it runs before
 * first paint. It marks the page as one where scripts are expected
 * (`DEMO_PAGE_ATTR.gate`), which lets demo.css close code blocks and hold back
 * static charts that will enter, and it applies the reader's remembered code
 * choice (`DEMO_PAGE_ATTR.codeDefault`) so a restored open block never animates
 * or moves the page. If demos.ts has not started (`DEMO_PAGE_ATTR.ready`) within
 * GATE_TIMEOUT_MS, the gate lifts and the page shows what it shows without
 * JavaScript: every static chart and all the code.
 */
import { DEMO_PAGE_ATTR } from "./markup";

/** The sessionStorage key holding "open" or "closed", written by scripts/demo-code-toggle.ts. */
export const CODE_OPEN_STORAGE_KEY = "openchart:demo-code";

const GATE_TIMEOUT_MS = 4000;

/** The gate's source, for `<script is:inline set:html={demoGateScript} />` in the head. */
export const demoGateScript = `(function(){var d=document.documentElement,o=null;try{o=sessionStorage.getItem(${JSON.stringify(CODE_OPEN_STORAGE_KEY)})}catch(e){}d.setAttribute("${DEMO_PAGE_ATTR.gate}","");d.setAttribute("${DEMO_PAGE_ATTR.codeDefault}",o==="open"?"open":"closed");setTimeout(function(){if(!d.hasAttribute("${DEMO_PAGE_ATTR.ready}")){d.removeAttribute("${DEMO_PAGE_ATTR.gate}");d.removeAttribute("${DEMO_PAGE_ATTR.codeDefault}")}},${GATE_TIMEOUT_MS})})();`;
