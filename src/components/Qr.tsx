import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

/** Renders `text` as a QR code image. */
export function QrCode({ text, size = 240 }: { text: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(text, { width: size, margin: 2, errorCorrectionLevel: 'M' }).then(setUrl);
  }, [text, size]);
  return url ? <img src={url} width={size} height={size} alt="Sync QR code" className="qr" /> : null;
}

/**
 * Camera QR scanner (works in Safari on iPad/iPhone, Chrome on Android, Edge on Windows).
 * Needs HTTPS (GitHub Pages) or localhost for camera access.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      const v = video.current;
      const c = canvas.current;
      if (!v || !c || done.current) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
        const scale = Math.min(1, 640 / v.videoWidth);
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            done.current = true;
            onResultRef.current(code.data);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access (needs HTTPS).');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled || !video.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.current.srcObject = s;
        video.current.setAttribute('playsinline', 'true'); // iOS: don't go fullscreen
        await video.current.play();
        if (!cancelled) raf = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access for this app and try again.' : (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal scanner" onClick={(e) => e.stopPropagation()}>
        <h3>Scan the sync QR code</h3>
        <p className="muted small">On your other device: Settings → Sync → Show QR code.</p>
        {error ? <p className="neg">{error}</p> : <video ref={video} muted playsInline className="scanner-video" />}
        <canvas ref={canvas} hidden />
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
