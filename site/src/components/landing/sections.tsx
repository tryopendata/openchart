// Static landing sections. They render to HTML at build time and ship no
// JavaScript; only components listed in site.islands may take a client: directive.
// Each optional section returns null when its config is empty.
import { useId } from "react";
import type { DemoLine, Feature, Link, Logo } from "../../config";

export function ReleaseBanner({ announcement }: { announcement: Link | null }) {
  if (!announcement) return null;
  return (
    <p className="bg-panel border-line border-b px-6 py-2 text-center text-sm">
      <a className="text-accent font-medium" href={announcement.href}>
        {announcement.label}
      </a>
    </p>
  );
}

export function Hero({ tagline, description }: { tagline: string; description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{tagline}</h1>
      <p className="text-muted max-w-2xl text-lg">{description}</p>
    </div>
  );
}

export function Demo({ title, lines }: { title: string; lines: DemoLine[] }) {
  const captionId = useId();
  if (lines.length === 0) return null;
  return (
    <figure
      aria-labelledby={captionId}
      className="border-line bg-panel overflow-hidden rounded-lg border"
    >
      <figcaption id={captionId} className="border-line text-muted border-b px-4 py-2 text-sm">
        {title}
      </figcaption>
      {/* Lines wrap rather than scroll: axe requires a scrolling region to be focusable. */}
      <pre className="p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
        <code>
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the demo lines are a fixed script that never reorders
            <span className="block" key={index}>
              {line.prompt && (
                <span aria-hidden="true" className="text-accent select-none">
                  ${" "}
                </span>
              )}
              {line.text}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export function Features({ features }: { features: Feature[] }) {
  if (features.length === 0) return null;
  return (
    <section aria-labelledby="features-title">
      <h2 id="features-title" className="sr-only">
        Features
      </h2>
      <ul className="grid gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title} className="border-line rounded-lg border p-5">
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-muted mt-2">{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LogoList({ logos }: { logos: Logo[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-8">
      {logos.map((logo) => (
        <li key={logo.name}>
          <a href={logo.href}>
            <img src={logo.logo} alt={logo.name} className="h-8 w-auto" loading="lazy" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function UsedBy({ logos }: { logos: Logo[] }) {
  if (logos.length === 0) return null;
  return (
    <section aria-labelledby="used-by-title" className="text-center">
      <h2 id="used-by-title" className="text-muted mb-6 text-sm font-medium">
        Used by
      </h2>
      <LogoList logos={logos} />
    </section>
  );
}

export function Sponsors({ href, logos }: { href: string; logos: Logo[] }) {
  if (logos.length === 0) return null;
  return (
    <section aria-labelledby="sponsors-title" className="text-center">
      <h2 id="sponsors-title" className="mb-6 text-2xl font-semibold">
        Sponsors
      </h2>
      <LogoList logos={logos} />
      <a className="text-accent mt-6 inline-block font-medium" href={href}>
        Become a sponsor
      </a>
    </section>
  );
}
