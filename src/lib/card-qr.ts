import QRCode from "qrcode";

export const CARD_BASE = "https://paniim.planos.in";
export const PINE = "#1f4d3a";
export const PAPER = "#fbf7ee";

export const cardUrl = (code: string, m: "nfc" | "qr") => `${CARD_BASE}/c/${code.trim().toUpperCase()}?m=${m}`;
export const qrFileName = (code: string, ext: "png" | "svg") => `${code.trim().toUpperCase()}.${ext}`;

/** Themed QR: rounded pine dots, soft corner eyes, pine-cone mark, code pill below. */
export function cardQrSvg(code: string): string {
  const qr = QRCode.create(cardUrl(code, "qr"), { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const cell = 10, pad = 30, size = n * cell + pad * 2, pillH = 54;
  const H = size + pillH;
  const eye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const mid = n / 2, clear = n * 0.13;
  let dots = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || eye(r, c)) continue;
      if (Math.abs(r + 0.5 - mid) < clear && Math.abs(c + 0.5 - mid) < clear) continue;
      dots += `<rect x="${pad + c * cell}" y="${pad + r * cell}" width="10" height="10" rx="3.2"/>`;
    }
  const eyes = [[0, 0], [0, n - 7], [n - 7, 0]].map(([r, c]) => {
    const x = pad + c! * cell, y = pad + r! * cell;
    return `<rect x="${x + 5}" y="${y + 5}" width="60" height="60" rx="20" fill="none" stroke="${PINE}" stroke-width="10"/><rect x="${x + 20}" y="${y + 20}" width="30" height="30" rx="10" fill="${PINE}"/>`;
  }).join("");
  const cx = size / 2, cy = pad + mid * cell, R = clear * cell;
  const cone = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${PAPER}" stroke="${PINE}" stroke-width="4"/>
<path d="M${cx} ${cy - R * 0.62} L${cx + R * 0.38} ${cy + R * 0.35} L${cx - R * 0.38} ${cy + R * 0.35} Z" fill="${PINE}"/>
<rect x="${cx - R * 0.07}" y="${cy + R * 0.35}" width="${R * 0.14}" height="${R * 0.22}" fill="${PINE}"/>`;
  const label = code.trim().toUpperCase();
  const pw = label.length * 15 + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${H}" width="${size}" height="${H}">
<rect width="${size}" height="${H}" rx="36" fill="${PAPER}"/>
<g fill="${PINE}">${dots}</g>${eyes}${cone}
<rect x="${(size - pw) / 2}" y="${size - 6}" width="${pw}" height="40" rx="20" fill="${PINE}"/>
<text x="${size / 2}" y="${size + 21}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${PAPER}">${label}</text>
</svg>`;
}

/** Square QR as printed on the final cards: dark ink on white, rounded square or plain square modules. */
export function plainQrSvg(code: string, style: "print" | "square" = "print", ink = "#1d1d1b"): string {
  const qr = QRCode.create(cardUrl(code, "qr"), { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let dots = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c))
        dots += style === "print"
          ? `<rect x="${c + 0.06}" y="${r + 0.06}" width=".88" height=".88" rx=".22"/>`
          : `<rect x="${c}" y="${r}" width="1.02" height="1.02"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n + 2} ${n + 2}" width="${(n + 2) * 20}" height="${(n + 2) * 20}"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><g fill="${ink}">${dots}</g></svg>`;
}

/** Browser only: render the SVG to a print-quality PNG. */
export async function svgToPng(svg: string, width = 1200): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
  const ratio = img.naturalHeight / img.naturalWidth;
  const c = Object.assign(document.createElement("canvas"), { width, height: Math.round(width * ratio) });
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((ok) => c.toBlob((b) => ok(b!), "image/png"));
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
