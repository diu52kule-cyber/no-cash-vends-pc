/**
 * Raasta pennant logo — vertical banner with rasta peace badge.
 * Top: pinked white header strip
 * Body: black with "RAASTA" wordmark, peace circle, two chevrons
 * Bottom: V-tail
 */
export function RaastaLogo({ size = 120 }: { size?: number }) {
  // Slight aspect ratio for the pennant
  const w = size, h = size * 1.35;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 140"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Raasta Nagpur"
      role="img"
      style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))' }}
    >
      <defs>
        <linearGradient id="rl-yellow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F4C430" />
          <stop offset="1" stopColor="#dab120" />
        </linearGradient>
        <linearGradient id="rl-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E63946" />
          <stop offset="1" stopColor="#c92638" />
        </linearGradient>
      </defs>

      {/* Banner body (black) with V-cut bottom, starts after pinking */}
      <path
        d="M 0,7 L 100,7 L 100,118 L 50,140 L 0,118 Z"
        fill="#0a0807"
      />

      {/* White pinked top strip — saw-tooth bottom edge */}
      <path
        d="M 0,0
           L 100,0
           L 100,3
           L 95,8 L 90,3 L 85,8 L 80,3 L 75,8 L 70,3 L 65,8 L 60,3
           L 55,8 L 50,3 L 45,8 L 40,3 L 35,8 L 30,3 L 25,8 L 20,3
           L 15,8 L 10,3 L 5,8 L 0,3 Z"
        fill="#FFF8EC"
      />

      {/* RAASTA wordmark */}
      <text
        x="50" y="22"
        fontFamily="'Inter', 'Arial Black', sans-serif"
        fontSize="11"
        fontWeight="900"
        fill="#FFF8EC"
        textAnchor="middle"
        letterSpacing="2.3"
      >
        RAASTA
      </text>

      {/* Peace circle — three rasta pie wedges + white peace symbol + star */}
      <g transform="translate(50 53)">
        {/* Green wedge (top) — from 12 o'clock CW to 4 o'clock */}
        <path d="M 0,0 L 0,-22 A 22,22 0 0,1 19.05,11 Z" fill="#2A9D4A" />
        {/* Yellow wedge (bottom-right) — 4 to 8 o'clock */}
        <path d="M 0,0 L 19.05,11 A 22,22 0 0,1 -19.05,11 Z" fill="#F4C430" />
        {/* Red wedge (bottom-left) — 8 to 12 o'clock */}
        <path d="M 0,0 L -19.05,11 A 22,22 0 0,1 0,-22 Z" fill="#E63946" />

        {/* White peace symbol on top */}
        <circle r="22" fill="none" stroke="#FFF8EC" strokeWidth="2.8" />
        <line x1="0" y1="-22" x2="0" y2="22" stroke="#FFF8EC" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="0" y1="0" x2="-15.55" y2="15.55" stroke="#FFF8EC" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="0" y1="0" x2="15.55" y2="15.55" stroke="#FFF8EC" strokeWidth="2.4" strokeLinecap="round" />

        {/* Center star */}
        <polygon
          points="0,-5.2 1.55,-1.6 5.2,-1.6 2.3,0.9 3.2,4.5 0,2.2 -3.2,4.5 -2.3,0.9 -5.2,-1.6 -1.55,-1.6"
          fill="#FFF8EC"
        />
      </g>

      {/* Yellow chevron band */}
      <polygon
        points="0,82 50,93 100,82 100,93 50,104 0,93"
        fill="url(#rl-yellow)"
      />

      {/* Red chevron band */}
      <polygon
        points="0,103 50,114 100,103 100,114 50,125 0,114"
        fill="url(#rl-red)"
      />
    </svg>
  );
}
