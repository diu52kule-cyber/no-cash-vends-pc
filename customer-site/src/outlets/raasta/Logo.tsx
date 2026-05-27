/**
 * Raasta Nagpur logo — refined v2.
 * Crest-style: dark warm disc, palm fronds, big serif R, rasta-stripe banner.
 * All inline SVG so it scales perfectly and matches the dark theme.
 */
export function RaastaLogo({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Raasta Nagpur"
      role="img"
    >
      <defs>
        {/* Disc gradient — warm dark with subtle sheen */}
        <radialGradient id="ras-disc" cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#2a1d14" />
          <stop offset="0.55" stopColor="#13100c" />
          <stop offset="1" stopColor="#0a0807" />
        </radialGradient>
        {/* Gold ring gradient */}
        <linearGradient id="ras-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4C430" />
          <stop offset="0.5" stopColor="#d4a020" />
          <stop offset="1" stopColor="#8b6914" />
        </linearGradient>
        {/* R fill gradient — warm cream with depth */}
        <linearGradient id="ras-R" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF8EC" />
          <stop offset="1" stopColor="#d4c9a8" />
        </linearGradient>
        {/* Stripe gradients */}
        <linearGradient id="ras-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2A9D4A" />
          <stop offset="1" stopColor="#1a6a30" />
        </linearGradient>
        <linearGradient id="ras-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F4C430" />
          <stop offset="1" stopColor="#c89b22" />
        </linearGradient>
        <linearGradient id="ras-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E63946" />
          <stop offset="1" stopColor="#a8222e" />
        </linearGradient>
        {/* Soft shadow on R */}
        <filter id="ras-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dx="0" dy="1" />
          <feComponentTransfer><feFuncA type="linear" slope="0.7" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Inner glow on disc */}
        <filter id="ras-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      {/* Outer disc + gold ring */}
      <circle cx="70" cy="70" r="67" fill="url(#ras-disc)" stroke="url(#ras-ring)" strokeWidth="2.5" />
      <circle cx="70" cy="70" r="64" fill="none" stroke="rgba(244,196,48,0.15)" strokeWidth="0.6" />

      {/* Top-left palm frond */}
      <g transform="translate(20 18) rotate(-22)" opacity="0.85">
        <path d="M0 38 Q14 -4 38 2 Q18 4 6 36 Z" fill="#2A9D4A" />
        <path d="M4 36 Q20 8 40 14 Q22 14 10 38 Z" fill="#2A9D4A" opacity="0.55" />
        <path d="M-4 30 Q8 6 28 0 Q12 8 4 32 Z" fill="#1a6a30" opacity="0.7" />
      </g>

      {/* Top-right palm frond — mirrored */}
      <g transform="translate(120 18) rotate(22) scale(-1 1)" opacity="0.7">
        <path d="M0 38 Q14 -4 38 2 Q18 4 6 36 Z" fill="#1f7338" />
        <path d="M4 36 Q20 8 40 14 Q22 14 10 38 Z" fill="#1a6a30" opacity="0.6" />
      </g>

      {/* Bottom rasta-stripe banner — curved */}
      <g>
        <path d="M 8 92 Q 70 116 132 92 L 132 100 Q 70 124 8 100 Z" fill="url(#ras-green)" />
        <path d="M 8 100 Q 70 124 132 100 L 132 108 Q 70 132 8 108 Z" fill="url(#ras-gold)" />
        <path d="M 8 108 Q 70 132 132 108 L 132 116 Q 70 140 8 116 Z" fill="url(#ras-red)" />
        {/* Stripe sheen */}
        <path d="M 8 92 Q 70 116 132 92 L 132 94 Q 70 118 8 94 Z" fill="rgba(255,255,255,0.18)" />
      </g>

      {/* Big serif R — centered, with shadow and warm gradient */}
      <text
        x="70"
        y="86"
        fontFamily="'Fraunces', 'Playfair Display', Georgia, serif"
        fontSize="78"
        fontWeight="700"
        fill="url(#ras-R)"
        textAnchor="middle"
        letterSpacing="-2"
        filter="url(#ras-shadow)"
      >
        R
      </text>

      {/* Tiny "NAGPUR" wordmark under the R, above stripes */}
      <text
        x="70"
        y="84"
        fontFamily="'Inter', sans-serif"
        fontSize="5.5"
        fontWeight="600"
        fill="rgba(244,196,48,0.7)"
        textAnchor="middle"
        letterSpacing="2.8"
        style={{ textTransform: 'uppercase' }}
      >
        N · A · G · P · U · R
      </text>

      {/* Inner light arc — fakes glass reflection on disc */}
      <path
        d="M 22 50 Q 35 28 70 24"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
