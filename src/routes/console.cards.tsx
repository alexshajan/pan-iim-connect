import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileDown, ImageUp, Minus, Plus, QrCode, Trash2, Layers, Save, History } from "lucide-react";
import { peopleQuery, type Person } from "@/lib/registry-data";
import { cardQrSvg, cardUrl, downloadBlob, plainQrSvg, svgToPng } from "@/lib/card-qr";
import {
  clampField, FIELD_LABELS, FONTS, fieldValue, fieldWeight, fitLines, fitSize, fontFile, newField, personPreset, presetLayout,
  PRESETS, QR_STYLES, STOCK_LABELS, stockFor, templateUrl, vendorSheets, lanyardUrl,
  type CardField, type CardLayout, type FieldKey, type FontKey, type Preset, type QrStyle, type Stock,
} from "@/lib/id-cards";
import { cn } from "@/lib/utils";
import { PageHead, useConsoleAccess } from "./console";

export const Route = createFileRoute("/console/cards")({
  head: () => ({ meta: [{ title: "ID card studio | 11th Pan-IIM WMC" }, { name: "description", content: "Print-ready ID cards by role." }] }),
  component: CardStudio,
});

const LS_LAYOUTS = "idcard.layouts.v5";
const LS_VERSIONS = "idcard.versions.v1";
const LS_TPL = (id: string) => `idcard.template.v2.${id}`;
const CSS_FONT: Record<FontKey, string> = { jakarta: "'Plus Jakarta Sans', sans-serif", montserrat: "Montserrat, sans-serif", helvetica: "Helvetica, Arial, sans-serif" };
const NAME_LH = 1.08;
type Version = { id: string; name: string; at: string; layout: CardLayout };

function qrFor(code: string, style: QrStyle) { return style === "brand" ? cardQrSvg(code) : plainQrSvg(code, style); }
// Saved layouts may predate the logo/art layers or hold an empty back; always restore the official layers that are missing.
const withBack = (l: CardLayout, pr: Preset): CardLayout => {
  const d = presetLayout(pr);
  const has = (fs: CardField[], src?: string) => fs.some((f) => f.key === "image" && f.src === src);
  const fields = [...d.fields.filter((f) => f.key === "image" && !has(l.fields, f.src)), ...l.fields];
  const back0 = l.back ?? [];
  const back = [...(d.back ?? []).filter((f) => !has(back0, f.src)), ...back0];
  return { ...l, fields, back };
};

/** What the studio should warn about for a card category: nameless cards and unassigned seats. */
function namelessNote(pr: Preset, count: number) {
  if (pr.blank) return `${pr.label} cards are nameless: no printed name or QR. Print the quantity you need; NFC links are written after delivery.`;
  if (pr.unassigned) return `${pr.unassigned} ${pr.label} card has no name or profile yet. It is added to the PDF as a nameless card after the ${count} named ones.`;
  return null;
}

function CardStudio() {
  const { canEdit } = useConsoleAccess();
  const { data: people = [] } = useQuery({ ...peopleQuery, enabled: canEdit });
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const [layouts, setLayouts] = useState<Record<string, CardLayout>>({});
  const [versions, setVersions] = useState<Record<string, Version[]>>({});
  const [tpl, setTpl] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [stock, setStock] = useState<"all" | Stock>("all");
  const [campus, setCampus] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Live export progress: cards drawn so far out of the whole run (all files), with start time for the ETA.
  const [prog, setProg] = useState<{ done: number; total: number; t0: number; file: string } | null>(null);
  const progRef = useRef({ done: 0, total: 0, t0: 0 });
  function startProgress(total: number) { progRef.current = { done: 0, total, t0: Date.now() }; setProg({ done: 0, total, t0: progRef.current.t0, file: "" }); }

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const layout = withBack(layouts[presetId] ?? presetLayout(preset), preset);
  const setLayout = (fn: (l: CardLayout) => CardLayout) => setLayouts((all) => ({ ...all, [presetId]: fn(withBack(all[presetId] ?? presetLayout(preset), preset)) }));

  useEffect(() => {
    try { const l = localStorage.getItem(LS_LAYOUTS); if (l) setLayouts(JSON.parse(l)); } catch { /* ignore */ }
    try { const v = localStorage.getItem(LS_VERSIONS); if (v) setVersions(JSON.parse(v)); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_LAYOUTS, JSON.stringify(layouts)); } catch { /* full */ } }, [layouts]);
  useEffect(() => { try { setTpl(localStorage.getItem(LS_TPL(presetId)) ?? templateUrl(presetId, "front")); } catch { setTpl(templateUrl(presetId, "front")); } setActive(null); }, [presetId]);

  function readImage(file: File, done: (url: string) => void) {
    if (!/image\/(png|jpe?g)/.test(file.type)) { toast.error("Use a PNG or JPG, exported at 300 dpi."); return; }
    const r = new FileReader(); r.onload = () => done(r.result as string); r.readAsDataURL(file);
  }
  function upload(file: File) {
    readImage(file, (url) => { setTpl(url); try { localStorage.setItem(LS_TPL(presetId), url); } catch { toast("Artwork is large, it won't be remembered after reload."); } });
  }

  const aspect = layout.widthMm / layout.heightMm;
  const mapAll = (l: CardLayout, fn: (f: CardField) => CardField) => ({ ...l, fields: l.fields.map(fn), back: (l.back ?? []).map(fn) });
  const update = (id: string, patch: Partial<CardField>) => setLayout((l) => mapAll(l, (f) => (f.id === id ? clampField({ ...f, ...patch }, aspect) : f)));
  const remove = (id: string) => { setLayout((l) => ({ ...l, fields: l.fields.filter((f) => f.id !== id), back: (l.back ?? []).filter((f) => f.id !== id) })); setActive(null); };
  const addField = (k: FieldKey) => { const f = newField(k); setLayout((l) => ({ ...l, fields: [...l.fields, f] })); setActive(f.id); };
  function addImage(side: "front" | "back", file: File) {
    readImage(file, (src) => {
      const img = new Image();
      img.onload = () => {
        const f: CardField = { ...newField("image"), x: 0.3, y: 0.3, w: 0.4, src, ar: img.naturalHeight / img.naturalWidth, label: file.name.replace(/\.\w+$/, ""), size: 0 };
        setLayout((l) => side === "front" ? { ...l, fields: [...l.fields, f] } : { ...l, back: [...(l.back ?? []), f] });
        setActive(f.id);
      };
      img.src = src;
    });
  }
  const af = [...layout.fields, ...(layout.back ?? [])].find((f) => f.id === active) ?? null;

  // Version history: "Save" keeps the current layout as a new numbered version; older ones stay retrievable.
  const myVersions = versions[presetId] ?? [];
  function saveVersion() {
    const v: Version = { id: crypto.randomUUID(), name: `${preset.label} v${myVersions.length + 1}`, at: new Date().toISOString(), layout: { ...layout, fields: layout.fields.map((f) => ({ ...f })) } };
    const next = { ...versions, [presetId]: [...myVersions, v] };
    setVersions(next);
    try { localStorage.setItem(LS_VERSIONS, JSON.stringify(next)); toast.success(`Saved as ${v.name}`); } catch { toast.error("This device is out of space for saved versions. Remove an uploaded image and try again."); }
  }
  function loadVersion(id: string) {
    if (id === "preset") { setLayouts((a) => { const n = { ...a }; delete n[presetId]; return n; }); toast("Back to the original template"); return; }
    const v = myVersions.find((x) => x.id === id); if (!v) return;
    setLayouts((a) => ({ ...a, [presetId]: v.layout })); setActive(null); toast(`Loaded ${v.name}`);
  }

  const rows = people.filter((p) => {
    const s = q.toLowerCase();
    return (!s || [p.full_name, p.delegate_code, p.organization, p.email].some((v) => v?.toLowerCase().includes(s)))
      && (!cats.length || cats.includes(personPreset(p).id))
      && (stock === "all" || stockFor(p) === stock)
      && (!campus || p.attendance_mode !== "remote" || !!p.card_role);
  });
  // Cards are for people physically on campus, with or without a paper; online-only people are left out unless switched off.
  const inPreset = (id: string) => people.filter((p) => personPreset(p).id === id && (!campus || p.attendance_mode !== "remote" || !!p.card_role));
  // Category chips toggle: several roles can be picked at once, each adding or removing its people.
  function pickCategory(id: string) {
    if (id === "all") { setCats([]); return; }
    if (id === "*") {
      setCats(PRESETS.map((p) => p.id));
      setSel((s) => [...new Set([...s, ...PRESETS.flatMap((p) => inPreset(p.id).map((x) => x.id))])]);
      toast("Every card category selected"); return;
    }
    if (id === "-") { setCats([]); setSel([]); toast("All categories cleared"); return; }
    const list = inPreset(id), ids = new Set(list.map((p) => p.id));
    if (cats.includes(id)) {
      setCats((c) => c.filter((x) => x !== id));
      setSel((s) => s.filter((x) => !ids.has(x)));
      return;
    }
    setCats((c) => [...c, id]);
    setPresetId(id);
    setSel((s) => [...new Set([...s, ...ids])]);
    const pr = PRESETS.find((p) => p.id === id)!;
    const note = namelessNote(pr, list.length);
    toast(`${list.length} ${pr.label} profile${list.length === 1 ? "" : "s"} selected`, note ? { description: note } : undefined);
  }

  const [copies, setCopies] = useState(1);
  // Nameless copies per template (blank designs and unassigned seats), typed in the studio.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const namelessFor = (pr: Preset) => Math.max(0, Math.min(1000, Math.floor(counts[pr.id] ?? (pr.blank ? copies : pr.unassigned ?? 0)) || 0));
  const chosen = people.filter((p) => sel.includes(p.id));
  const sample: Person | undefined = chosen.find((p) => personPreset(p).id === presetId) ?? rows.find((p) => personPreset(p).id === presetId) ?? chosen[0] ?? rows[0];
  const chosenGroups = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of chosen) { const id = personPreset(p).id; m.set(id, (m.get(id) ?? 0) + 1); }
    return PRESETS.filter((p) => m.has(p.id)).map((p) => ({ pr: p, n: m.get(p.id)!, note: namelessNote(p, m.get(p.id)!) }));
  }, [chosen]);

  async function buildPdf(list: Person[], pid: string, name: string, extra?: number) {
    return buildBulk([{ pid, list, extra }], name);
  }

  /** One PDF for any mix of templates: segments print in order, each person front + back. */
  async function buildBulk(segs: { pid: string; list: Person[]; extra?: number | undefined }[], name: string, single = false) {
    const PART = single ? Infinity : PART_SIZE;
    const { jsPDF } = await import("jspdf");
    type Item = { p: Person; pr: Preset; lay: CardLayout; W: number; H: number; pid: string; image: string | null; backImage: string | null };
    const all: Item[] = [];
    let blankCount = 0;
    for (const sg of segs) {
      const pid = sg.pid, list = sg.list, extra = sg.extra;
      const pr = PRESETS.find((p) => p.id === pid)!;
      const lay = withBack(layouts[pid] ?? presetLayout(pr), pr);
      const custom = pid === presetId ? tpl : localStorage.getItem(LS_TPL(pid));
      const image = (custom ? await toDataUrl(custom) : null) ?? await toDataUrl(templateUrl(pid, "front"), true);
      const backImage = await toDataUrl(templateUrl(pid, "back"), true);
      if (!image || !backImage) throw new Error(`Could not load the ${pr.label} card artwork. Check the connection and try again.`);
      // Unassigned seats (e.g. one keynote without a name) print as nameless cards after the named ones.
      const blanks: Person[] = Array.from({ length: extra ?? pr.unassigned ?? 0 }, () => ({ ...(list[0] ?? {}), id: "blank", full_name: "", delegate_code: "", card_role: pr.label, category: null } as unknown as Person));
      blankCount += blanks.length;
      for (const p of [...list, ...blanks]) all.push({ p, pr, lay, W: lay.widthMm, H: lay.heightMm, pid, image, backImage });
    }
    if (!all.length) throw new Error("Nothing to print");
    let doc = new jsPDF({ unit: "mm", format: [all[0]!.W, all[0]!.H], orientation: all[0]!.W > all[0]!.H ? "landscape" : "portrait", compress: true });
    const loaded = new Set<string>();
    async function useFont(f: CardField) {
      const font = f.font ?? "helvetica", w = fieldWeight(f), file = fontFile(font, w);
      if (!file) { doc.setFont("helvetica", w >= 700 ? "bold" : "normal"); return; }
      const nm = `${font}-${w}`;
      if (!loaded.has(nm)) {
        const buf = new Uint8Array(await (await fetch(file)).arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        doc.addFileToVFS(`${nm}.ttf`, btoa(bin)); doc.addFont(`${nm}.ttf`, nm, "normal"); loaded.add(nm);
      }
      doc.setFont(nm, "normal");
    }
    const imgCache = new Map<string, string | null>();
    async function drawImages(fs: CardField[], W: number, H: number) {
      for (const f of fs) {
        if (f.key !== "image" || !f.src) continue;
        if (!imgCache.has(f.src)) imgCache.set(f.src, await toDataUrl(f.src, true));
        const url = imgCache.get(f.src);
        if (!url) throw new Error(`Could not load card layer ${f.label ?? f.src}. Try the export again.`);
        doc.addImage(url, url.startsWith("data:image/png") ? "PNG" : "JPEG", f.x * W, f.y * H, f.w * W, f.w * W * (f.ar ?? 1), `img-${f.src.length}-${f.src.slice(-24)}`, "FAST");
      }
    }
    // Big runs are split into parts so the browser tab never holds one giant PDF in memory.
    const parts = Math.ceil(all.length / PART) || 1;
    const partName = (k: number) => parts === 1 ? name : name.replace(/\.pdf$/, `-part${k}of${parts}.pdf`);
    if (!progRef.current.total) startProgress(all.length);
    for (let i = 0; i < all.length; i++) {
      const { p, pr, lay, W, H, pid, image, backImage } = all[i]!;
      const fmt = image?.startsWith("data:image/png") ? "PNG" : "JPEG";
      if (i && i % PART === 0) {
        doc.save(partName(i / PART));
        doc = new jsPDF({ unit: "mm", format: [W, H], orientation: W > H ? "landscape" : "portrait", compress: true });
        loaded.clear();
      } else if (i) doc.addPage([W, H], W > H ? "landscape" : "portrait");
      if (image) doc.addImage(image, fmt, 0, 0, W, H, `tpl-${pid}`, "FAST");
      await drawImages(lay.fields, W, H);
      for (const f of lay.fields) {
        if (f.key === "image") continue;
        if (f.key === "qr") {
          if (pr.blank || !p.delegate_code) continue;
          const style = lay.qrStyle ?? "print";
          const url = await blobUrl(await svgToPng(qrFor(p.delegate_code, style), 2400));
          const side = f.w * W;
          doc.addImage(url, "PNG", f.x * W, f.y * H, side, style === "brand" ? side * QR_RATIO : side);
          continue;
        }
        let v = f.key === "role" ? fieldValue({ ...p, full_name: p.full_name || "x" }, "role") : fieldValue(p, f.key);
        if (!v) continue;
        if (f.upper) v = v.toUpperCase();
        await useFont(f);
        if (f.pill) {
          const size = fitSize(v, f.w * W - 6, f.size, 0.55);
          doc.setFontSize(size);
          const h = 6.6, y = f.y * H;
          doc.setFillColor(f.pill); doc.roundedRect(f.x * W, y, f.w * W, h, h / 2, h / 2, "F");
          doc.setTextColor(f.pillText ?? f.color);
          doc.text(v, (f.x + f.w / 2) * W, y + h / 2, { align: "center", baseline: "middle" });
          continue;
        }
        const { size, lines } = fitLines(v, f.w * W, f.size, f.key === "full_name" ? 2 : 3, Math.min(8, f.size));
        doc.setFontSize(size);
        doc.setTextColor(f.color);
        const x = f.align === "left" ? f.x * W : f.align === "right" ? (f.x + f.w) * W : (f.x + f.w / 2) * W;
        // Extra lines grow upward so the name never runs into the pill below it.
        const lh = size * 0.3528 * NAME_LH, top = f.y * H - (lines.length - 1) * lh;
        lines.forEach((ln, k) => doc.text(ln, x, top + k * lh, { align: f.align, baseline: "top" }));
      }
      // Every card is two pages, front then back, so double-sided printing never shifts.
      doc.addPage([W, H], W > H ? "landscape" : "portrait");
      if (backImage) doc.addImage(backImage, "PNG", 0, 0, W, H, `back-${pid}`, "FAST");
      await drawImages(lay.back ?? [], W, H);
      const pg = progRef.current; pg.done++;
      setProg({ done: pg.done, total: pg.total, t0: pg.t0, file: partName(Math.floor(i / PART) + 1) });
      // Yield so the page stays responsive and the progress bar repaints.
      await new Promise((ok) => setTimeout(ok, 0));
    }
    doc.save(partName(parts));
    return blankCount;
  }

  async function exportPdf(): Promise<void> {
    if (!chosen.length) {
      const n = Math.max(1, Math.min(500, Math.floor(copies) || 1));
      setBusy("pdf"); startProgress(n);
      try {
        await buildPdf([], presetId, `pan-iim-${presetId}-blank-${n}.pdf`, n);
        toast.success(`${n} nameless ${preset.label} cards exported, front + back`);
      } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); setProg(null); progRef.current.total = 0; }
      return;
    }
    if (new Set([...cats, ...chosen.map((p) => personPreset(p).id)]).size > 1) return exportByGroup();
    setBusy("pdf"); startProgress(chosen.length + (preset.unassigned ?? 0));
    try {
      const b = await buildPdf(chosen, presetId, `pan-iim-${presetId}-${chosen.length}.pdf`);
      toast.success(`${chosen.length} cards exported with the ${preset.label} template${b ? `, plus ${b} nameless` : ""}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); setProg(null); progRef.current.total = 0; }
  }

  async function exportByGroup(): Promise<void> {
    const groups = new Map<string, Person[]>();
    for (const p of chosen) { const id = personPreset(p).id; groups.set(id, [...(groups.get(id) ?? []), p]); }
    // Picked roles with nobody in them (nameless-only cards) still get their own file.
    for (const id of cats) if (!groups.has(id)) groups.set(id, []);
    if (!groups.size) return exportPdf();
    setBusy("groups");
    startProgress([...groups].reduce((n, [id, l]) => { const pr = PRESETS.find((x) => x.id === id)!; return n + (l.length ? l.length + (pr.unassigned ?? 0) : Math.max(pr.unassigned ?? 0, Math.floor(copies) || 1)); }, 0));
    try {
      let i = 0;
      for (const [id, list] of groups) {
        const pr = PRESETS.find((x) => x.id === id)!;
        const extra = list.length ? undefined : Math.max(pr.unassigned ?? 0, Math.floor(copies) || 1);
        await buildPdf(list, id, `${String(++i).padStart(2, "0")}-${pr.stock}-${id}-${list.length || extra}.pdf`, extra);
      }
      toast.success(`${groups.size} PDFs, one per role`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); setProg(null); progRef.current.total = 0; }
  }

  /** Selected templates in print order, with named people then the nameless copies asked for. */
  function bulkSegments() {
    const ids = new Set([...cats, ...chosen.map((p) => personPreset(p).id)]);
    return PRESETS.filter((pr) => ids.has(pr.id)).map((pr) => ({ pr, pid: pr.id, list: chosen.filter((p) => personPreset(p).id === pr.id), extra: namelessFor(pr) }))
      .filter((s) => s.list.length + s.extra > 0);
  }
  async function exportBulkPdf() {
    const segs = bulkSegments();
    if (!segs.length) { toast.error("Select people or a card category first"); return; }
    const n = segs.reduce((k, s) => k + s.list.length + s.extra, 0);
    setBusy("bulk"); startProgress(n);
    try {
      await buildBulk(segs, `pan-iim-all-cards-${n}.pdf`, true);
      toast.success(`${n} cards in one PDF`, { description: "Same order as the Bulk Excel sheet" });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); setProg(null); progRef.current.total = 0; }
  }
  async function exportBulkXlsx() {
    const segs = bulkSegments();
    if (!segs.length) { toast.error("Select people or a card category first"); return; }
    const XLSX = await import("xlsx");
    const host = window.location.origin.includes("localhost") ? undefined : window.location.origin;
    const rows: (string | number)[][] = [];
    let k = 0;
    for (const s of segs) {
      const lan = lanyardUrl(s.pid, host);
      const role = (p?: Person) => p ? fieldValue(p, "role") : s.pr.bare ? "" : s.pr.label;
      for (const p of s.list) { k++; rows.push([k, `${2 * k - 1}–${2 * k}`, s.pr.label, p.full_name, role(p), p.delegate_code.toUpperCase(), STOCK_LABELS[s.pr.stock], p.organization ?? "", cardUrl(p.delegate_code, "nfc"), lan]); }
      for (let j = 1; j <= s.extra; j++) { k++; rows.push([k, `${2 * k - 1}–${2 * k}`, s.pr.label, `(nameless ${j} of ${s.extra})`, role(), "", STOCK_LABELS[s.pr.stock], "", "Write after delivery", lan]); }
    }
    const ws = XLSX.utils.aoa_to_sheet([["Card #", "PDF pages", "Template", "Name", "Role on Card", "WMC Code", "Card Stock", "Institution", "NFC URL", "Lanyard ribbon"], ...rows]);
    rows.forEach((r, i) => { const c = ws[`J${i + 2}`]; if (c) c.l = { Target: String(r[9]) }; });
    ws["!cols"] = [{ wch: 7 }, { wch: 10 }, { wch: 20 }, { wch: 32 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 46 }, { wch: 46 }];
    ws["!autofilter"] = { ref: `A1:J${rows.length + 1}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Print sequence");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    downloadBlob(`pan-iim-all-cards-${k}.xlsx`, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    toast.success(`${k} rows, card 1 = PDF pages 1–2`);
  }

  async function exportXlsx() {
    if (!chosen.length && !cats.length) { toast.error("Select people or a card category first"); return; }
    setBusy("xlsx");
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const g of vendorSheets(chosen, window.location.origin.includes("localhost") ? undefined : window.location.origin)) {
      const pr = PRESETS.find((p) => p.id === g.presetId);
      const extra = Array.from({ length: pr?.unassigned ?? 0 }, () => ["(nameless card)", pr?.bare ? "" : (pr?.label ?? ""), "", "Write after delivery"]);
      const ws = XLSX.utils.aoa_to_sheet([["Role on card", pr?.bare ? "None (blank card)" : (pr?.label ?? g.sheet)], ["Lanyard ribbon", g.lanyard], [], ["Name", "Role on Card", "WMC Code", "NFC URL"], ...g.rows.map((r) => [r.Name, r["Role on Card"], r["WMC Code"], r["NFC URL"]]), ...extra]);
      ws["B2"].l = { Target: g.lanyard };
      ws["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 52 }];
      XLSX.utils.book_append_sheet(wb, ws, g.sheet);
    }
    // No-name cards: green ribbon for extras/buffer, blue ribbon for volunteers. Vendor quantities are agreed separately.
    const host = window.location.origin.includes("localhost") ? undefined : window.location.origin;
    const greenLanyard = lanyardUrl("blank", host);
    const blueLanyard = lanyardUrl("volunteer", host);
    const orangeLanyard = lanyardUrl("purva", host);
    const bs = XLSX.utils.aoa_to_sheet([
      ["Role on card", "None (blank cards)"],
      ["Lanyard ribbon: extras / buffer (green)", greenLanyard],
      ["Lanyard ribbon: volunteers (blue)", blueLanyard],
      ["Lanyard ribbon: PURVA participants (orange)", orangeLanyard],
      [],
      ["Card", "Front artwork", "Back artwork", "Stock", "NFC", "Lanyard"],
      ["Blank extras / buffer", "Green waves, no name or role", "Standard campus back", STOCK_LABELS.pvc, "Unwritten tag, written on site", "Green, no role"],
      ["Volunteer", "Volunteer card, name written on site", "Standard campus back", STOCK_LABELS.pvc, "Unwritten tag, written on site", "Blue, VOLUNTEER"],
      ["PURVA Participant", "PURVA card, name written on site", "PURVA back", STOCK_LABELS.pvc, "Unwritten tag, written on site", "Orange, PURVA PARTICIPANT"],
    ]);
    bs["B2"].l = { Target: greenLanyard };
    bs["B3"].l = { Target: blueLanyard };
    bs["B4"].l = { Target: orangeLanyard };
    bs["!cols"] = [{ wch: 40 }, { wch: 36 }, { wch: 24 }, { wch: 16 }, { wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, bs, "No-name cards");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    downloadBlob(`pan-iim-id-cards-${chosen.length || "blank"}.xlsx`, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    setBusy(null);
  }

  if (!canEdit) return <p className="text-sm text-muted-foreground">Only organizers and editors can produce ID cards.</p>;

  const metalCount = people.filter((p) => stockFor(p) !== "pvc" && p.card_role).length;
  const presetNote = namelessNote(preset, inPreset(presetId).length);
  const btn = "tap inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <>
      <PageHead eyebrow={`${chosen.length} selected`} title="ID card studio">
        <div className="flex flex-wrap gap-2">
          <button onClick={exportBulkPdf} disabled={!!busy} className="tap inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><FileDown className="h-4 w-4" /> {busy === "bulk" ? "Building…" : "Bulk PDF (one file)"}</button>
          <button onClick={exportBulkXlsx} disabled={!!busy} className={btn}><FileSpreadsheet className="h-4 w-4" /> Bulk Excel</button>
          <button onClick={exportXlsx} disabled={!!busy} className={btn}><FileSpreadsheet className="h-4 w-4" /> Excel by category</button>
          <button onClick={exportByGroup} disabled={!!busy} className={btn}><Layers className="h-4 w-4" /> {busy === "groups" ? "Building…" : `Export by role${cats.length + chosenGroups.length ? ` (${new Set([...cats, ...chosenGroups.map((g) => g.pr.id)]).size})` : ""}`}</button>
          {(!chosen.length || cats.some((c) => PRESETS.find((p) => p.id === c)?.blank)) && (
            <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
              Nameless copies
              <input type="number" min={1} max={500} value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="w-16 bg-transparent text-right tabular-nums outline-none" />
            </label>
          )}
          <button onClick={exportPdf} disabled={!!busy} className={btn}><FileDown className="h-4 w-4" /> {busy === "pdf" ? "Building PDF…" : "Print PDF"}</button>
        </div>
      </PageHead>
      {prog && <ExportProgress {...prog} />}

      {chosenGroups.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
          {chosenGroups.map(({ pr, n, note }) => (
            <span key={pr.id} title={note ?? undefined} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
              <i className="h-2 w-2 rounded-sm" style={{ background: pr.pill }} />{pr.label} <b className="tabular-nums">{n}</b>
              {pr.blank && <span className="text-muted-foreground">nameless</span>}
              {pr.unassigned ? <span className="text-muted-foreground">+ {pr.unassigned} nameless</span> : null}
            </span>
          ))}
        </div>
      )}

      {PRESETS.some((p) => (p.blank || p.unassigned) && cats.includes(p.id)) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">Nameless copies in Bulk PDF</span>
          {PRESETS.filter((p) => (p.blank || p.unassigned) && cats.includes(p.id)).map((p) => (
            <label key={p.id} className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1">
              <i className="h-2 w-2 rounded-sm" style={{ background: p.pill }} />{p.label}
              <input type="number" min={0} max={1000} value={namelessFor(p)} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: Number(e.target.value) }))} className="w-14 bg-transparent text-right tabular-nums outline-none" />
            </label>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{cats.length} of {PRESETS.length} categories</span>
            <button onClick={() => pickCategory("*")} className="tap font-medium text-primary">Select all</button>
            <button onClick={() => pickCategory("-")} className="tap text-muted-foreground">Deselect all</button>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Blank designs (no name, no QR)</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PRESETS.filter((p) => p.blank).map((p) => (
                <button key={p.id} onClick={() => pickCategory(p.id)} aria-pressed={cats.includes(p.id)}
                  className={cn("tap relative flex w-24 shrink-0 flex-col items-center gap-1 rounded-md border p-1.5 text-[0.7rem] font-medium transition", cats.includes(p.id) ? "border-foreground bg-secondary ring-1 ring-foreground" : presetId === p.id ? "border-foreground/40" : "border-border hover:border-foreground/40")}>
                  {cats.includes(p.id) && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-sm bg-foreground text-[0.6rem] text-background">✓</span>}
                  <img src={templateUrl(p.id, "front")} alt="" className="aspect-[57/89] w-full rounded-sm object-cover" loading="lazy" />
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Named cards</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.filter((p) => !p.blank).map((p) => (
              <button key={p.id} onClick={() => pickCategory(p.id)}
                className={cn("tap inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium", cats.includes(p.id) ? "border-foreground bg-secondary" : presetId === p.id ? "border-foreground/40" : "border-border")} aria-pressed={cats.includes(p.id)}>
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: p.pill }} />{p.label}
                <span className="tabular-nums text-muted-foreground">{inPreset(p.id).length}{p.unassigned ? `+${p.unassigned}` : ""}</span>
                {p.stock !== "pvc" && <span className="text-[0.6rem] text-muted-foreground">{p.stock === "metal-gold" ? "Gold" : "Silver"}</span>}
                {(p.blank || p.unassigned) && <span className="text-[0.6rem] text-muted-foreground">Nameless</span>}
              </button>
            ))}
          </div>

          {presetNote && <p className="rounded-md border-l-2 border-primary bg-secondary px-3 py-2 text-xs">{presetNote}</p>}

          <div className="flex flex-wrap items-end gap-3">
            <label className="tap inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium">
              <ImageUp className="h-4 w-4" /> Replace front artwork
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            <label className="text-xs text-muted-foreground">QR style
              <select value={layout.qrStyle ?? "print"} onChange={(e) => setLayout((l) => ({ ...l, qrStyle: e.target.value as QrStyle }))} className="mt-1 block rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground">
                {(Object.keys(QR_STYLES) as QrStyle[]).map((k) => <option key={k} value={k}>{QR_STYLES[k]}</option>)}
              </select></label>
            <button onClick={saveVersion} className={btn}><Save className="h-4 w-4" /> Save as new version</button>
            <label className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><History className="h-3.5 w-3.5" /> Versions</span>
              <select value="" onChange={(e) => e.target.value && loadVersion(e.target.value)} className="mt-1 block rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground">
                <option value="">{myVersions.length ? `${myVersions.length} saved` : "None saved yet"}</option>
                <option value="preset">Original template</option>
                {[...myVersions].reverse().map((v) => <option key={v.id} value={v.id}>{v.name}, {new Date(v.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</option>)}
              </select></label>
          </div>
          <p className="text-xs text-muted-foreground">
            {STOCK_LABELS[preset.stock]}. Design size 57 × 89 mm, cut 54 × 86 mm, keep text inside the 50 × 82 mm safe area. Long names wrap to two lines and shrink to fit, the same way in the PDF.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Canvas side="Front" layout={layout} fields={layout.fields} tpl={tpl} sample={sample} blank={!!preset.blank} active={active} setActive={setActive} onMove={update} />
              <AddImage onFile={(f) => addImage("front", f)} />
            </div>
            <div>
              <Canvas side="Back" layout={layout} fields={layout.back ?? []} tpl={templateUrl(presetId, "back")} sample={sample} blank active={active} setActive={setActive} onMove={update} />
              <AddImage onFile={(f) => addImage("back", f)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs text-muted-foreground">Add field:</span>
            {(Object.keys(FIELD_LABELS) as FieldKey[]).filter((k) => k !== "image").map((k) => (
              <button key={k} onClick={() => addField(k)} className="tap inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                {k === "qr" ? <QrCode className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {FIELD_LABELS[k]}
              </button>
            ))}
          </div>

          {af ? (
            <div className="card-surface grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
              <p className="col-span-full flex items-center justify-between font-medium">
                {af.key === "image" ? af.label ?? "Image" : FIELD_LABELS[af.key]}
                <button onClick={() => remove(af.id)} className="inline-flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              </p>
              <Num label="Width %" value={Math.round(af.w * 1000) / 10} onChange={(v) => update(af.id, { w: v / 100 })} />
              <Num label="Left mm" value={Math.round(af.x * layout.widthMm * 10) / 10} onChange={(v) => update(af.id, { x: v / layout.widthMm })} />
              <Num label="Top mm" value={Math.round(af.y * layout.heightMm * 10) / 10} onChange={(v) => update(af.id, { y: v / layout.heightMm })} />
              {af.key === "image" && (
                <>
                  <button onClick={() => update(af.id, { x: (1 - af.w) / 2 })} className={cn(btn, "self-end justify-center")}>Centre</button>
                  <label className={cn(btn, "col-span-2 cursor-pointer justify-center")}><ImageUp className="h-4 w-4" /> Replace image
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (src) => { const i = new Image(); i.onload = () => update(af.id, { src, ar: i.naturalHeight / i.naturalWidth }); i.src = src; }); }} />
                  </label>
                </>
              )}
              {af.key !== "qr" && af.key !== "image" && (
                <>
                  <label className="text-xs text-muted-foreground">Font
                    <select value={af.font ?? "helvetica"} onChange={(e) => { const font = e.target.value as FontKey; update(af.id, { font, weight: FONTS[font].weights.includes(fieldWeight(af)) ? fieldWeight(af) : (FONTS[font].weights.at(-1) as CardField["weight"]) }); }} className="mt-1 block w-full rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground">
                      {(Object.keys(FONTS) as FontKey[]).map((k) => <option key={k} value={k}>{FONTS[k].label}</option>)}
                    </select></label>
                  <label className="text-xs text-muted-foreground">Weight
                    <select value={fieldWeight(af)} onChange={(e) => update(af.id, { weight: Number(e.target.value) as CardField["weight"] })} className="mt-1 block w-full rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground">
                      {FONTS[af.font ?? "helvetica"].weights.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select></label>
                  <div className="text-xs text-muted-foreground">Largest size pt
                    <div className="mt-1 flex items-center gap-1">
                      <button onClick={() => update(af.id, { size: Math.max(5, af.size - 0.5) })} className="tap rounded-md border border-border p-2" aria-label="Smaller"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-10 text-center text-sm tabular-nums text-foreground">{af.size}</span>
                      <button onClick={() => update(af.id, { size: Math.min(40, af.size + 0.5) })} className="tap rounded-md border border-border p-2" aria-label="Larger"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <label className="text-xs text-muted-foreground">Text colour<input type="color" value={af.color} onChange={(e) => update(af.id, { color: e.target.value, pillText: af.pill ? e.target.value : af.pillText })} className="mt-1 block h-9 w-full rounded" /></label>
                  <label className="text-xs text-muted-foreground">Pill
                    <div className="mt-1 flex items-center gap-2">
                      <input type="checkbox" checked={!!af.pill} onChange={(e) => update(af.id, { pill: e.target.checked ? preset.pill : null, color: e.target.checked ? preset.pillText : preset.ink, pillText: preset.pillText })} />
                      {af.pill && <input type="color" value={af.pill} onChange={(e) => update(af.id, { pill: e.target.value })} className="h-9 w-full rounded" />}
                    </div></label>
                  {!af.pill && <label className="text-xs text-muted-foreground">Align
                    <select value={af.align} onChange={(e) => update(af.id, { align: e.target.value as CardField["align"] })} className="mt-1 block w-full rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground">
                      <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
                    </select></label>}
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={af.upper} onChange={(e) => update(af.id, { upper: e.target.checked })} /> Capitals</label>
                </>
              )}
              <p className="col-span-full text-xs text-muted-foreground">Drag on the card to move. Changes stay on this device; use Save as new version to keep a copy you can return to.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Tap a name, pill, QR, logo or picture on either side to edit it, or drag to move.</p>
          )}
        </section>

        <aside className="space-y-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, institution" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={stock} onChange={(e) => setStock(e.target.value as typeof stock)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <option value="all">All card stock</option>
              {(Object.keys(STOCK_LABELS) as Stock[]).map((s) => <option key={s} value={s}>{STOCK_LABELS[s]}</option>)}
            </select>
            <select value={cats.length === 1 ? cats[0] : "all"} onChange={(e) => { setCats(e.target.value === "all" ? [] : [e.target.value]); if (e.target.value !== "all") setPresetId(e.target.value); }} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <option value="all">All card categories</option>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={campus} onChange={(e) => setCampus(e.target.checked)} />
            Only people coming to campus ({people.filter((p) => p.attendance_mode !== "remote").length} of {people.length})
          </label>
          <div className="flex justify-between text-xs">
            <button onClick={() => setSel([...new Set([...sel, ...rows.map((r) => r.id)])])} className="font-medium text-primary">Select all {rows.length}</button>
            <span className="text-muted-foreground">{metalCount} metal cardholders</span>
            <button onClick={() => { setSel([]); setCats([]); }} className="text-muted-foreground">Clear</button>
          </div>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {rows.map((p) => {
              const pr = personPreset(p);
              return (
                <li key={p.id}>
                  <label className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary", sel.includes(p.id) && "bg-secondary")}>
                    <input type="checkbox" checked={sel.includes(p.id)} onChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
                    <i className="h-2 w-2 shrink-0 rounded-sm" style={{ background: pr.pill }} title={pr.label} />
                    <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                    {pr.stock !== "pvc" && <span className="text-[0.6rem] text-muted-foreground">Metal</span>}
                    <span className="text-[0.65rem] tabular-nums text-muted-foreground">{p.delegate_code}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </>
  );
}

// Branded QR artwork is taller than wide because of the code pill under it.
const QR_RATIO = (() => { const m = cardQrSvg("WMC-XXXX").match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/); return m ? Number(m[2]) / Number(m[1]) : 1.1; })();

async function toDataUrl(src: string | null, required = false): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src.length > 64 ? src : null;
  // Retry a few times: one dropped fetch used to silently leave artwork out of the PDF.
  for (let i = 0; i < (required ? 4 : 2); i++) {
    try { const r = await fetch(src, { cache: i ? "reload" : "default" }); if (r.ok) { const b = await r.blob(); if (b.size && b.type.startsWith("image/")) return await blobUrl(b); } } catch { /* retry */ }
    await new Promise((ok) => setTimeout(ok, 300 * (i + 1)));
  }
  return null;
}

function blobUrl(b: Blob): Promise<string> {
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(b); });
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs text-muted-foreground">{label}
      <input type="number" value={value} step="0.1" onChange={(e) => { const v = Number(e.target.value); if (v >= 0) onChange(v); }} className="mt-1 block w-24 rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground" />
    </label>
  );
}

function AddImage({ onFile }: { onFile: (f: File) => void }) {
  return (
    <label className="tap mx-auto mt-2 flex w-fit cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
      <ImageUp className="h-3.5 w-3.5" /> Add image
      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

function Canvas({ side, layout, fields, tpl, sample, blank, active, setActive, onMove }: {
  side: string; layout: CardLayout; fields: CardField[]; tpl: string | null; sample: Person | undefined; blank: boolean; active: string | null;
  setActive: (id: string) => void; onMove: (id: string, p: Partial<CardField>) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(320);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setPx(el.clientWidth)); ro.observe(el); return () => ro.disconnect();
  }, []);
  const mmToPx = px / layout.widthMm;
  const style = layout.qrStyle ?? "print";
  const qrSvg = useMemo(() => qrFor(sample?.delegate_code ?? "WMC-XXXX", style), [sample, style]);

  function drag(e: RPE, f: CardField) {
    e.preventDefault(); setActive(f.id);
    const r = box.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = f.x, oy = f.y;
    const move = (ev: PointerEvent) => onMove(f.id, { x: ox + (ev.clientX - sx) / r.width, y: oy + (ev.clientY - sy) / r.height });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  const W = layout.widthMm, H = layout.heightMm;

  return (
    <div className="mx-auto w-full max-w-xs">
      <p className="mb-1 text-center text-xs font-medium text-muted-foreground">{side}</p>
      <div ref={box} className="relative w-full touch-none overflow-hidden rounded-md border border-border bg-card shadow-sm" style={{ aspectRatio: `${W} / ${H}` }}>
        {tpl ? <img src={tpl} alt={`${side} artwork`} className="absolute inset-0 h-full w-full object-fill" draggable={false} /> : null}
        <div className="pointer-events-none absolute border border-dashed border-destructive/40" style={{ left: `${(1.5 / W) * 100}%`, right: `${(1.5 / W) * 100}%`, top: `${(1.5 / H) * 100}%`, bottom: `${(1.5 / H) * 100}%` }} />
        <div className="pointer-events-none absolute border border-dashed border-primary/30" style={{ left: `${(3.5 / W) * 100}%`, right: `${(3.5 / W) * 100}%`, top: `${(3.5 / H) * 100}%`, bottom: `${(3.5 / H) * 100}%` }} />
        {fields.map((f) => {
          const pos = { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%` };
          const ring = active === f.id ? "outline outline-2 outline-primary" : "outline outline-1 outline-dashed outline-primary/30";
          if (f.key === "image")
            return f.src ? <img key={f.id} src={f.src} alt={f.label ?? "Image"} draggable={false} onPointerDown={(e) => drag(e, f)} className={cn("absolute cursor-move", ring)} style={{ ...pos, height: f.w * W * (f.ar ?? 1) * mmToPx }} /> : null;
          if (f.key === "qr") {
            if (blank) return null;
            return <div key={f.id} onPointerDown={(e) => drag(e, f)} className={cn("absolute cursor-move", ring)} style={pos} dangerouslySetInnerHTML={{ __html: qrSvg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ') }} />;
          }
          let v = sample ? fieldValue(sample, f.key) : FIELD_LABELS[f.key];
          if (!v) v = `‹${FIELD_LABELS[f.key]}›`;
          if (f.upper) v = v.toUpperCase();
          const font = { fontWeight: fieldWeight(f), fontFamily: CSS_FONT[f.font ?? "helvetica"] };
          if (f.pill) {
            const size = fitSize(v, f.w * W - 6, f.size, 0.55);
            return (
              <div key={f.id} onPointerDown={(e) => drag(e, f)} className={cn("absolute flex cursor-move items-center justify-center whitespace-nowrap", ring)}
                style={{ ...pos, ...font, fontSize: size * 0.3528 * mmToPx, height: 6.6 * mmToPx, borderRadius: 3.3 * mmToPx, background: f.pill, color: f.pillText ?? f.color }}>{v}</div>
            );
          }
          const { size, lines } = fitLines(v, f.w * W, f.size, f.key === "full_name" ? 2 : 3, Math.min(8, f.size));
          return (
            <div key={f.id} onPointerDown={(e) => drag(e, f)} className={cn("absolute cursor-move whitespace-nowrap", ring)}
              style={{ ...pos, top: `${(f.y - ((lines.length - 1) * size * 0.3528 * NAME_LH) / H) * 100}%`, ...font, fontSize: size * 0.3528 * mmToPx, lineHeight: NAME_LH, color: f.color, textAlign: f.align }}>
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PART_SIZE = 150;

function ExportProgress({ done, total, t0, file }: { done: number; total: number; t0: number; file: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, []);
  const pct = total ? Math.min(100, (done / total) * 100) : 0;
  const elapsed = (Date.now() - t0) / 1000;
  const left = done ? Math.max(0, (elapsed / done) * (total - done)) : null;
  const fmt = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`;
  return (
    <div role="status" aria-live="polite" className="sticky top-16 z-20 mb-4 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums">Card {done} of {total}</span>
        <span className="tabular-nums text-muted-foreground">{left === null ? "Estimating…" : `about ${fmt(left)} left`} · {fmt(elapsed)} so far</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{file || "Preparing template…"} · keep this tab open; files over {PART_SIZE} cards save in parts</p>
    </div>
  );
}
