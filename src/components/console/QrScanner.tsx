import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Camera QR reader. Calls onCode once per distinct code (debounced 3s). */
export function QrScanner({ onCode, paused }: { onCode: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [err, setErr] = useState<string | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = () => {
          if (stop) return;
          const v = video.current, c = canvas.current;
          if (v && c && v.readyState >= 2 && !pausedRef.current) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, c.width, c.height);
              const hit = jsQR(img.data, img.width, img.height);
              const now = Date.now();
              if (hit?.data && (hit.data !== last.current.text || now - last.current.at > 3000)) {
                last.current = { text: hit.data, at: now };
                onCode(hit.data);
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErr("Camera unavailable. Allow camera access or type the code below.");
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-plate">
      {err ? (
        <p className="flex h-full items-center justify-center px-6 text-center text-sm text-plate-foreground">{err}</p>
      ) : (
        <>
          <video ref={video} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-primary-foreground/80" />
        </>
      )}
      <canvas ref={canvas} className="hidden" />
    </div>
  );
}
