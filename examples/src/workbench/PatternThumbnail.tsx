/** Compact, code-native composition diagrams; never substituted for data previews. */
export function PatternThumbnail({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 120 42" aria-hidden="true" className="studio-thumbnail">
      {kind === 'ranking' || kind === 'table' ? (
        [0, 1, 2, 3].map((i) => (
          <rect
            key={`dot-${(i * 23) % 107}-${(i * 7) % 27}`}
            x="2"
            y={i * 10 + 2}
            width={kind === 'table' ? 112 : 112 - i * 23}
            height={kind === 'table' ? 2 : 6}
            rx="1"
            opacity={i === 0 ? 1 : 0.35}
          />
        ))
      ) : kind === 'distribution' ? (
        Array.from({ length: 22 }, (_, i) => (
          <circle
            key={`dot-${(i * 23) % 107}-${(i * 7) % 27}`}
            cx={8 + ((i * 23) % 107)}
            cy={9 + ((i * 7) % 27)}
            r="2.5"
            opacity={0.3 + (i % 3) * 0.3}
          />
        ))
      ) : kind === 'map' ? (
        <path
          d="M5 8L24 4L39 13L31 25L20 20L15 35L8 30ZM52 9L63 2L76 9L93 7L116 17L107 28L87 23L76 35L58 31L49 19Z"
          opacity=".6"
        />
      ) : kind === 'change' ? (
        [0, 1, 2].map((i) => (
          <g key={`dot-${(i * 23) % 107}-${(i * 7) % 27}`}>
            <path
              d={`M${8 + i * 9} ${8 + i * 13}H${104 - i * 16}`}
              stroke="currentColor"
              strokeWidth="2"
              opacity=".35"
            />
            <circle cx={8 + i * 9} cy={8 + i * 13} r="3" opacity=".4" />
            <circle cx={104 - i * 16} cy={8 + i * 13} r="3" />
          </g>
        ))
      ) : (
        <>
          <path
            d="M3 35L24 29L45 30L65 16L87 13L117 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M3 34L25 31L46 23L67 28L87 24L117 18"
            fill={kind === 'composition' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            opacity=".3"
          />
        </>
      )}
    </svg>
  );
}
