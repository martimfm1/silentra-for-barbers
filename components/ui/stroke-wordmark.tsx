'use client';

import { useId, type CSSProperties } from 'react';

type StrokeWordmarkProps = {
  accentColor: string;
  compact?: boolean;
};

const LETTERS = Array.from('SILENTRA');

export function StrokeWordmark({
  accentColor,
  compact = false,
}: StrokeWordmarkProps) {
  const fillId = 'silentra-stroke-fill-' + useId().replace(/:/g, '');
  const fontSize = compact ? 76 : 110;
  const letterSpacing = compact ? 8 : 12;

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 760 150"
        className={
          compact
            ? 'mx-auto block h-auto w-[min(340px,82vw)] overflow-visible'
            : 'mx-auto block h-auto w-[min(620px,84vw)] overflow-visible'
        }
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={fillId} clipPathUnits="userSpaceOnUse">
            <rect
              className="silentra-stroke-fill-wipe"
              x="0"
              y="0"
              width="0"
              height="150"
            />
          </clipPath>
        </defs>

        <text
          x="380"
          y="105"
          textAnchor="middle"
          dominantBaseline="alphabetic"
          fontFamily="var(--font-heading), monospace"
          fontSize={fontSize}
          fontWeight="800"
          letterSpacing={letterSpacing}
          fill="none"
          stroke={accentColor}
          strokeWidth={compact ? 2 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {LETTERS.map((letter, index) => (
            <tspan
              key={letter + index}
              className="silentra-stroke-char"
              style={
                { '--stroke-index': index } as CSSProperties
              }
            >
              {letter}
            </tspan>
          ))}
        </text>

        <text
          x="380"
          y="105"
          textAnchor="middle"
          dominantBaseline="alphabetic"
          fontFamily="var(--font-heading), monospace"
          fontSize={fontSize}
          fontWeight="800"
          letterSpacing={letterSpacing}
          fill="rgba(250,250,250,0.94)"
          clipPath={'url(#' + fillId + ')'}
        >
          {LETTERS.map((letter, index) => (
            <tspan key={letter + index}>{letter}</tspan>
          ))}
        </text>
      </svg>
      <span className="sr-only">Silentra</span>
    </div>
  );
}
