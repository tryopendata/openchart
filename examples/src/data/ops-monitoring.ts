/**
 * Service-health telemetry for a fictional API tier, used by the ops /
 * monitoring dashboard layout on the Dashboards page.
 *
 * Four 48-hour hourly series (p95 latency, request throughput, CPU
 * utilization, error rate) plus a three-row service-status rollup. The error
 * series carries a deliberate two-hour incident spike above the 1% SLO so the
 * hero chart has something to annotate.
 *
 * The values came from seeded biased random walks and were then frozen to
 * static arrays, so the module carries no runtime randomness. They are not a
 * capture from a real system — hence 'Illustrative data' and no source URL.
 */

type Point = { time: string; value: number };

const HOURS: string[] = (() => {
  const out: string[] = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(Date.UTC(2026, 1, 9, 0, 0, 0) + i * 3_600_000);
    // Keep the ISO 'T' separator: the engine parses temporal fields with bare
    // new Date(string), and space-separated datetimes are not spec-guaranteed
    // (older WebKit returns Invalid Date).
    out.push(d.toISOString().slice(0, 16));
  }
  return out;
})();

function toSeries(values: readonly number[]): Point[] {
  return values.map((value, i) => ({ time: HOURS[i], value }));
}

/** p95 response time, milliseconds. */
const LATENCY_MS = [
  135.2, 130.2, 127.8, 118.4, 126.9, 137.7, 127.4, 134.8, 125.4, 119.9, 130.1, 125.5, 123.9, 122.3,
  125.1, 130.8, 129.4, 130.3, 136.1, 134.2, 125.4, 133.5, 141.6, 129.6, 126, 118.1, 123, 113.6,
  113.4, 127.8, 137.5, 144, 155.9, 142.5, 138.8, 146.4, 133.7, 127.2, 138.4, 130.4, 126.1, 137.7,
  144.7, 155.8, 160, 148.9, 147.1, 148.9,
];

/** Requests per second across the tier. */
const THROUGHPUT_RPS = [
  1774, 1746, 1775, 1788, 1850, 1931, 1857, 1910, 1826, 1933, 1852, 1847, 1738, 1822, 1761, 1702,
  1648, 1713, 1664, 1566, 1578, 1606, 1716, 1834, 1890, 1865, 1932, 1857, 1746, 1713, 1821, 1847,
  1853, 1806, 1714, 1820, 1773, 1671, 1728, 1855, 1742, 1766, 1766, 1805, 1932, 1829, 1759, 1768,
];

/** Mean CPU utilization across the fleet, percent. */
const CPU_PCT = [
  43.7, 40.3, 36.9, 40.8, 37.4, 41.1, 43.5, 39.7, 38.5, 38.1, 42.3, 47, 50.4, 48.9, 44.8, 49.1,
  48.4, 50.6, 51.3, 47.4, 51.3, 55, 51.1, 50.2, 51, 54.6, 54.1, 52.2, 52, 49.2, 49.3, 51.9, 48.8,
  45.5, 43.9, 41.7, 39.2, 41.4, 44.9, 41.5, 45.9, 47.4, 51.2, 46.7, 49.4, 45.7, 44.9, 44.4,
];

/** 5xx share of all responses, percent. Hours 30-33 are the incident. */
const ERROR_PCT = [
  0.38, 0.47, 0.53, 0.46, 0.5, 0.45, 0.36, 0.31, 0.3, 0.39, 0.38, 0.44, 0.47, 0.54, 0.5, 0.51, 0.59,
  0.65, 0.64, 0.53, 0.58, 0.58, 0.63, 0.55, 0.59, 0.55, 0.54, 0.45, 0.47, 0.61, 1.34, 2.08, 1.72,
  0.98, 0.63, 0.39, 0.43, 0.5, 0.54, 0.54, 0.48, 0.49, 0.49, 0.5, 0.55, 0.47, 0.44, 0.5,
];

export const opsMonitoring = {
  source: 'Illustrative data',
  /** ISO-ish timestamp of the incident peak, for annotating the hero chart. */
  incidentPeak: HOURS[31],
  latency: toSeries(LATENCY_MS),
  throughput: toSeries(THROUGHPUT_RPS),
  cpu: toSeries(CPU_PCT),
  errorRate: ERROR_PCT.map((value, i) => ({ time: HOURS[i], errorRate: value })),
  serviceStatus: [
    // Keep every slice above the pie compiler's 3% "Other" bucket threshold so
    // the pinned Healthy/Degraded/Down color domain stays intact.
    { status: 'Healthy', services: 41 },
    { status: 'Degraded', services: 4 },
    { status: 'Down', services: 3 },
  ],
} as const;
