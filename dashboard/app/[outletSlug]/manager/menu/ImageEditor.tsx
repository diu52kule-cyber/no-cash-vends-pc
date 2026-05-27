'use client';
import { useEffect, useRef, useState } from 'react';

const OUTPUT_SIZE = 800;

/**
 * Square-crop + filter editor for menu item photos.
 * - Drag to pan
 * - Slider for zoom (0.5x – 3x)
 * - Brightness / contrast / saturation sliders
 * - Always exports an 800×800 JPEG blob
 */
export function ImageEditor({
  initialSrc, onCancel, onSave,
}: {
  initialSrc?: string | null;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(105);
  const [saturation, setSaturation] = useState(92);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Load initial src if provided
  useEffect(() => {
    if (!initialSrc) return;
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => { setImg(i); fit(i); };
    i.src = initialSrc;
  }, [initialSrc]);

  function fit(image: HTMLImageElement) {
    // Initial zoom: fill the preview
    const min = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height);
    setZoom(min);
    setPan({ x: 0, y: 0 });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); setImg(i); fit(i); };
    i.src = url;
  }

  // Redraw whenever inputs change
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext('2d')!;
    c.width = OUTPUT_SIZE; c.height = OUTPUT_SIZE;
    ctx.fillStyle = '#0a0807';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    const w = img.width * zoom;
    const h = img.height * zoom;
    const cx = (OUTPUT_SIZE - w) / 2 + pan.x;
    const cy = (OUTPUT_SIZE - h) / 2 + pan.y;
    ctx.drawImage(img, cx, cy, w, h);
    ctx.filter = 'none';
    // Bottom gradient overlay so all photos uniformly blend with the dark UI
    const grad = ctx.createLinearGradient(0, OUTPUT_SIZE * 0.5, 0, OUTPUT_SIZE);
    grad.addColorStop(0, 'rgba(10,8,7,0)');
    grad.addColorStop(1, 'rgba(10,8,7,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }, [img, zoom, pan, brightness, contrast, saturation]);

  // Drag to pan
  function onDown(e: React.PointerEvent) {
    if (!img) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y };
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = OUTPUT_SIZE / rect.width;
    setPan({ x: d.baseX + (e.clientX - d.startX) * scale, y: d.baseY + (e.clientY - d.startY) * scale });
  }
  function onUp() { dragRef.current = null; }

  async function save() {
    if (!img || !canvasRef.current) return;
    setBusy(true);
    canvasRef.current.toBlob(async (blob) => {
      if (blob) await onSave(blob);
      setBusy(false);
    }, 'image/jpeg', 0.86);
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="modal" style={{ width: 480, maxWidth: '95vw' }}>
        <h2>Edit image</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          Drag to position, sliders to adjust. We auto-blend with the dark theme so it looks at-home on the customer site.
        </p>

        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            width: '100%', aspectRatio: '1', borderRadius: 14, overflow: 'hidden',
            background: 'var(--bg3)', border: '1px solid var(--border)',
            cursor: img ? 'grab' : 'default', touchAction: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}
        >
          {img
            ? <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            : (
              <button
                className="btn btn-ghost"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                style={{ pointerEvents: 'auto' }}
              >
                📷 Pick an image
              </button>
            )
          }
          {img && (
            <button
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              style={{
                position: 'absolute', bottom: 10, right: 10,
                padding: '6px 12px', borderRadius: 999, fontSize: 11,
                background: 'rgba(0,0,0,0.65)', color: 'var(--text2)', backdropFilter: 'blur(4px)',
              }}
            >Change</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onPick} />

        {img && (
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <Slider label="Zoom"       value={zoom}       min={0.5} max={3}    step={0.05} onChange={setZoom}       fmt={v => v.toFixed(2) + '×'} />
            <Slider label="Brightness" value={brightness} min={60}  max={140}  step={1}    onChange={setBrightness} fmt={v => v + '%'} />
            <Slider label="Contrast"   value={contrast}   min={60}  max={140}  step={1}    onChange={setContrast}   fmt={v => v + '%'} />
            <Slider label="Saturation" value={saturation} min={40}  max={140}  step={1}    onChange={setSaturation} fmt={v => v + '%'} />
          </div>
        )}

        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!img || busy}>
            {busy ? 'Uploading…' : 'Save image'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.08 }}>
        <span>{label}</span><span style={{ color: 'var(--text2)' }}>{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', padding: 0, background: 'transparent', border: 'none', accentColor: 'var(--brand)' }}
      />
    </div>
  );
}
