/** Inline SVG logo for Raasta Nagpur — rasta stripes + stylized "R" + palm leaf */
export function RaastaLogo({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-label="Raasta Nagpur">
      <defs>
        <linearGradient id="ras-glow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFF8EC" stopOpacity="0.2" />
          <stop offset="1" stopColor="#FFF8EC" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* outer ring */}
      <circle cx="60" cy="60" r="56" fill="#0B1F1A" stroke="#F4C430" strokeWidth="2" />
      <circle cx="60" cy="60" r="56" fill="url(#ras-glow)" />

      {/* three rasta stripes across bottom arc */}
      <path d="M 14 84 Q 60 100 106 84 L 106 92 Q 60 108 14 92 Z" fill="#2A9D4A" />
      <path d="M 14 92 Q 60 108 106 92 L 106 100 Q 60 116 14 100 Z" fill="#F4C430" />
      <path d="M 14 100 Q 60 116 106 100 L 106 108 Q 60 124 14 108 Z" fill="#E63946" />

      {/* palm frond on the left */}
      <g transform="translate(20 22) rotate(-18)">
        <path d="M0 30 Q 12 0 30 4 Q 12 8 4 30 Z" fill="#2A9D4A" opacity="0.85" />
        <path d="M4 30 Q 16 6 32 14 Q 16 16 8 32 Z" fill="#2A9D4A" opacity="0.6" />
      </g>

      {/* big serif R */}
      <text
        x="60"
        y="74"
        fontFamily="'Fraunces', 'Playfair Display', serif"
        fontSize="64"
        fontWeight="700"
        fill="#FFF8EC"
        textAnchor="middle"
        letterSpacing="-2"
      >
        R
      </text>
    </svg>
  );
}
