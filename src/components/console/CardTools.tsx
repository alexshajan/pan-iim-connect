import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Nfc } from "lucide-react";
import { db, type Person } from "@/lib/registry-data";
import { toCsv } from "@/lib/csv";
import { roleOnCard } from "@/lib/id-cards";
import { cardQrSvg, cardUrl, downloadBlob, qrFileName, svgToPng } from "@/lib/card-qr";

export const cardRole = (p: Person) => roleOnCard(p);

export async function downloadQr(p: Person, ext: "png" | "svg") {
  const svg = cardQrSvg(p.delegate_code);
  downloadBlob(qrFileName(p.delegate_code, ext), ext === "svg" ? new Blob([svg], { type: "image/svg+xml" }) : await svgToPng(svg));
}

export async function exportVendorZip(rows: Person[]) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const sheet = rows.map((p, i) => ({
    "S.No": i + 1, Name: p.full_name, Role: cardRole(p), "Submission ID": p.submission_ref ?? "",
    Code: p.delegate_code, NFC_URL: cardUrl(p.delegate_code, "nfc"), QR_URL: cardUrl(p.delegate_code, "qr"),
    QR_File: `qr/${qrFileName(p.delegate_code, "png")}`,
  }));
  files["nfc-vendor-sheet.csv"] = strToU8(toCsv(sheet));
  for (const p of rows) {
    const svg = cardQrSvg(p.delegate_code);
    files[`qr/${qrFileName(p.delegate_code, "svg")}`] = strToU8(svg);
    files[`qr/${qrFileName(p.delegate_code, "png")}`] = new Uint8Array(await (await svgToPng(svg)).arrayBuffer());
  }
  downloadBlob("pan-iim-nfc-cards.zip", new Blob([zipSync(files)], { type: "application/zip" }));
}

export function NewPersonForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", card_role: "Attendee", submission_ref: "", organization: "IIM Shillong", email: "" });
  async function save() {
    if (!f.full_name.trim()) { toast.error("Name is needed"); return; }
    const email = f.email.trim() || `card-${Date.now()}@cards.paniim.local`;
    const { error } = await db.from("people").insert({
      full_name: f.full_name.trim(), card_role: f.card_role.trim() || null,
      submission_ref: f.submission_ref.trim() || null, organization: f.organization.trim() || null, email,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Profile added");
    qc.invalidateQueries({ queryKey: ["registry"] });
    onDone();
  }
  const inp = (k: keyof typeof f, label: string, ph = "") => (
    <label className="block text-sm"><span className="text-xs text-muted-foreground">{label}</span>
      <input value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2" /></label>
  );
  return (
    <div className="space-y-3">
      <p className="text-display text-xl">New profile</p>
      {inp("full_name", "Name")}
      {inp("card_role", "Role on card", "Presenter, Volunteer, Track Chair…")}
      {inp("submission_ref", "Submission ID", "Leave blank if none")}
      {inp("organization", "Institution")}
      {inp("email", "Email", "Optional")}
      <button onClick={save} className="tap w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground">Add profile</button>
    </div>
  );
}

export function CardPreview({ p }: { p: Person }) {
  const svg = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(cardQrSvg(p.delegate_code))}`, [p.delegate_code]);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex aspect-[54/86] flex-col overflow-hidden rounded-xl border border-border bg-card text-center">
        <div className="bg-primary px-2 py-2 text-[0.55rem] font-semibold leading-tight text-primary-foreground">IIM SHILLONG<br />11th Pan-IIM WMC 2026</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2">
          <p className="text-display text-base leading-tight">{p.full_name}</p>
          <span className="-rotate-2 rounded border-2 border-primary px-1.5 text-[0.55rem] font-bold text-primary">{cardRole(p)}</span>
          <p className="text-[0.55rem] text-muted-foreground">{p.submission_ref ? `Submission ${p.submission_ref}` : "\u00a0"}</p>
        </div>
        <div className="flex items-end justify-between px-2 pb-2"><img src={svg} alt="" className="w-12" /><Nfc className="size-4 text-primary" /></div>
      </div>
      <div className="flex aspect-[54/86] flex-col items-center justify-between rounded-xl border border-border bg-card p-2 text-center">
        <p className="text-[0.55rem] font-semibold text-primary">Scan or tap to connect</p>
        <img src={svg} alt={`QR for ${p.delegate_code}`} className="w-full" />
        <div className="w-full space-y-0.5 text-left text-[0.5rem] text-muted-foreground">
          <p>Emergency: ________</p><p>Medical: ________</p><p>Help desk: ________</p>
        </div>
      </div>
    </div>
  );
}
