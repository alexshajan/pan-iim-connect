import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { RotateCw } from "lucide-react";
import { ribbon } from "@/lib/phase";

export function passUrl(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://paniim.planos.in";
  return `${origin}/c/${code}?m=qr`;
}

/** Shareable profile link — view only, never records a handshake. */
export function profileUrl(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://paniim.planos.in";
  return `${origin}/id/${code}`;
}

export function DelegatePass({
  name,
  organization,
  code,
  roles,
  test,
}: {
  name: string;
  organization: string | null;
  code: string;
  roles: string[];
  test?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const status = useQuery({
    queryKey: ["card_status", code],
    queryFn: async () => (await supabase.rpc("card_status", { _code: code })).data as { active?: boolean } | null,
    refetchInterval: (q) => (q.state.data?.active ? false : 15000),
  });
  const active = status.data?.active ?? true;
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (status.data?.active !== true) return;
    const k = `pass.revealed.${code}`;
    if (localStorage.getItem(`pass.pending.${code}`) && !localStorage.getItem(k)) {
      localStorage.setItem(k, "1");
      setReveal(true);
      navigator.vibrate?.([40, 60, 40, 60, 80]);
    }
  }, [status.data?.active, code]);
  useEffect(() => { if (status.data && status.data.active === false) localStorage.setItem(`pass.pending.${code}`, "1"); }, [status.data, code]);
  const [qr, setQr] = useState<string | null>(null);
  const r = ribbon(roles);

  useEffect(() => {
    QRCode.toDataURL(passUrl(code), { margin: 1, width: 360, color: { dark: "#1d3a2e", light: "#00000000" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  if (!active)
    return (
      <div className="pass relative overflow-hidden px-5 py-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold"><span className="size-2 animate-pulse rounded-full bg-primary" /> Not checked in at the conference</span>
        <div className="mx-auto mt-3 max-w-[15rem] opacity-50 grayscale"><p className="text-display text-lg leading-tight">{name}</p>{organization ? <p className="text-xs text-muted-foreground">{organization}</p> : null}</div>
        {qr ? <img src={qr} alt={`Check-in QR for ${code}`} className="mx-auto mt-4 aspect-square w-44" /> : <div className="skeleton mx-auto mt-4 size-44" />}
        <p className="mt-2 text-sm font-semibold tabular-nums">{code}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Show this to a volunteer at the registration desk. Your card unlocks the moment they scan it.</p>
      </div>
    );

  return (
    <>
    {reveal ? (
      <div role="dialog" aria-modal="true" onClick={() => setReveal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-sm">
        <div className="pass-reveal pass w-full max-w-sm px-6 py-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Checked in</p>
          <p className="text-display mt-2 text-3xl leading-tight">Welcome to IIM Shillong, {name.split(" ")[0]}</p>
          <p className="mt-2 text-sm text-muted-foreground">Your card is live. Tap it on other cards to swap contacts.</p>
          <button className="tap mt-6 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Show my card</button>
        </div>
      </div>
    ) : null}
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-label={flipped ? "Show pass front" : "Show pass QR code"}
      className="press block w-full text-left [perspective:1400px]"
    >
      <div
        className="relative aspect-[1.58/1] w-full transition-transform duration-700 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        {/* Front */}
        <div className="pass absolute inset-0 flex flex-col overflow-hidden [backface-visibility:hidden]">
          <div className="flex items-center justify-between bg-primary px-5 py-2.5 text-primary-foreground">
            <span className="text-[0.62rem] font-semibold tracking-[0.2em] uppercase">11th Pan-IIM WMC</span>
            <span className="text-[0.62rem] font-semibold tracking-[0.12em] opacity-80">IIM SHILLONG · 2026</span>
          </div>
          <div className="flex flex-1 flex-col justify-between px-5 py-4">
            <div>
              <h2 className="text-display text-[1.55rem] leading-[1.05]">{name}</h2>
              {organization ? <p className="mt-1 text-sm text-muted-foreground">{organization}</p> : null}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="inline-block -rotate-2 rounded-md border-2 border-primary px-2.5 py-1 text-xs font-bold tracking-[0.14em] text-primary uppercase">
                  {r.main}
                </span>
                {r.extra.length ? (
                  <p className="mt-1.5 text-[0.68rem] text-muted-foreground">also {r.extra.join(" · ")}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums tracking-[0.08em]">{code}</p>
                {test ? <p className="text-[0.62rem] font-bold text-destructive">TEST</p> : null}
              </div>
            </div>
          </div>
          <RotateCw className="absolute right-3 bottom-[42%] h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2} />
        </div>
        {/* Back */}
        <div className="pass absolute inset-0 flex items-center gap-5 px-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {qr ? <img src={qr} alt={`QR code for ${code}`} className="aspect-square h-[78%]" /> : null}
          <div className="min-w-0">
            <p className="text-display text-lg leading-tight">Scan to connect</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Opens your profile, same as tapping your NFC card.
            </p>
            <p className="mt-3 text-xs font-semibold tabular-nums tracking-[0.08em]">{code}</p>
          </div>
        </div>
      </div>
    </button>
    </>
  );
}
