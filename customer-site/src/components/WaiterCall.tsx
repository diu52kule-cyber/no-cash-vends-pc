// Lazily-created shared AudioContext (first tap is the user gesture that unlocks it).
let audioCtx: AudioContext | null = null;

function playTing() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx ?? new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0.07; // low volume
    master.connect(ctx.destination);

    // Two bell-ish partials with a quick attack and gentle decay.
    [[1318.5, 1], [1976, 0.5]].forEach(([freq, level]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(level, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.connect(g); g.connect(master);
      osc.start(now);
      osc.stop(now + 0.65);
    });
  } catch { /* audio unsupported — silent */ }
}

export function WaiterCallBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="waiter-btn"
      onClick={() => { playTing(); onClick(); }}
      aria-label="Call waiter"
      title="Call waiter"
    >
      🛎
    </button>
  );
}
