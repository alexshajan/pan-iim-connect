// Pure helpers for the ID card studio: field values, presets, card stock rules and the vendor sheet rows.
import { cardUrl } from "./card-qr";
import LAYERS from "./card-layers";

export type FieldKey = "full_name" | "role" | "organization" | "code" | "submission" | "email" | "qr" | "image";
export type FontKey = "jakarta" | "montserrat" | "helvetica";
export type QrStyle = "print" | "square" | "brand";
export type CardField = {
  id: string;
  key: FieldKey;
  /** Position/size as fractions of the card (0–1). For QR, w is the square side as a fraction of card width. */
  x: number;
  y: number;
  w: number;
  size: number; // font size in pt
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
  upper: boolean;
  font?: FontKey | undefined;
  weight?: 500 | 600 | 700 | 800 | undefined;
  /** Filled capsule behind the text (role pill). */
  pill?: string | null;
  pillText?: string | undefined;
  /** Image layers (logos, art): source URL or data URL, and height/width ratio in mm. */
  src?: string | undefined;
  ar?: number | undefined;
  label?: string | undefined;
};
export type CardLayout = { widthMm: number; heightMm: number; fields: CardField[]; back?: CardField[]; qrStyle?: QrStyle; preset?: string };

export const FIELD_LABELS: Record<FieldKey, string> = {
  full_name: "Full name", role: "Role on card", organization: "Institution", code: "Delegate code",
  submission: "Submission ID", email: "Email", qr: "QR code", image: "Image",
};

export const FONTS: Record<FontKey, { label: string; weights: number[] }> = {
  jakarta: { label: "Plus Jakarta Sans", weights: [500, 600, 700, 800] },
  montserrat: { label: "Montserrat", weights: [800] },
  helvetica: { label: "Helvetica", weights: [500, 700] },
};
/** Static TTF files served from /fonts for PDF embedding. */
export const fontFile = (f: FontKey, w: number) =>
  f === "montserrat" ? "/fonts/montserrat-800.ttf" : f === "jakarta" ? `/fonts/jakarta-${[500, 600, 700, 800].includes(w) ? w : 700}.ttf` : null;
export const fieldWeight = (f: CardField) => f.weight ?? (f.bold ? 700 : 500);

export const QR_STYLES: Record<QrStyle, string> = {
  print: "Print (rounded squares, dark ink)",
  square: "Plain squares",
  brand: "Branded with code label",
};

export type CardPerson = {
  delegate_code: string; full_name: string; organization: string | null; email: string;
  card_role?: string | null; category: string | null; submission_ref?: string | null;
};

/** Registration category (Faculty, Research Scholar...) is an internal record and never prints. */
export const roleOnCard = (p: CardPerson) => p.card_role || (p.submission_ref ? "Presenter" : "Delegate");

/** Approved role looks from the final templates: pill fill, pill text, name ink, card stock. */
export type Stock = "pvc" | "metal-gold" | "metal-silver";
/** `unassigned`: cards in this category that have no name or profile yet (printed nameless). */
export type Preset = { id: string; label: string; pill: string; pillText: string; ink: string; stock: Stock; blank?: boolean; bare?: boolean; layers?: string; unassigned?: number };
export const PRESETS: Preset[] = [
  { id: "participant", label: "Participant", pill: "#00613b", pillText: "#ffffff", ink: "#00613b", stock: "pvc" },
  { id: "blank", label: "Blank", pill: "#00613b", pillText: "#ffffff", ink: "#00613b", stock: "pvc", blank: true, bare: true, layers: "participant" },
  { id: "volunteer", label: "Volunteer", pill: "#1677a3", pillText: "#ffffff", ink: "#0f5a7c", stock: "pvc", blank: true },
  { id: "purva", label: "PURVA Participant", pill: "#d9772b", pillText: "#ffffff", ink: "#a4521a", stock: "pvc", blank: true },
  { id: "committee", label: "Committee Member", pill: "#2e2c2a", pillText: "#ffffff", ink: "#2e2c2a", stock: "pvc" },
  { id: "track-chair", label: "Track Chair", pill: "#ebc954", pillText: "#1d3a24", ink: "#6b5410", stock: "pvc" },
  { id: "faculty", label: "Faculty, IIM Shillong", pill: "#24467a", pillText: "#ffffff", ink: "#24467a", stock: "pvc" },
  { id: "director", label: "Director", pill: "#75334c", pillText: "#ffffff", ink: "#5a2338", stock: "metal-gold" },
  { id: "chair", label: "Conference Chair", pill: "#75334c", pillText: "#ffffff", ink: "#5a2338", stock: "metal-gold" },
  { id: "bog", label: "Member, BoG", pill: "#75334c", pillText: "#ffffff", ink: "#5a2338", stock: "metal-gold" },
  { id: "panelist", label: "Panelist", pill: "#75334c", pillText: "#ffffff", ink: "#5a2338", stock: "metal-gold" },
  { id: "keynote", label: "Keynote Speaker", pill: "#a0522d", pillText: "#ffffff", ink: "#7a3c1f", stock: "metal-silver", unassigned: 2 },
  { id: "purva-guest", label: "Distinguished Guest", pill: "#d9772b", pillText: "#ffffff", ink: "#a4521a", stock: "metal-silver" },
  { id: "coordinator", label: "Coordinator", pill: "#ebc954", pillText: "#1d3a24", ink: "#6b5410", stock: "metal-silver" },
  { id: "cao", label: "CAO, IIM Shillong", pill: "#ebc954", pillText: "#1d3a24", ink: "#6b5410", stock: "metal-silver", layers: "coordinator" },
];

/** Older card titles, kept readable until every profile carries the new one. */
const LEGACY_ROLE: Record<string, string> = {
  "chair, bog": "Chairperson, BoG", "board of governors": "Member, BoG", faculty: "Faculty, IIM Shillong", "purva guest": "Distinguished Guest",
  "padma shri panel": "Panelist", "corporate panel": "Panelist", "editor panel": "Panelist", "editors' panel": "Panelist", "journal editor": "Panelist",
};

/**
 * Which preset a card maps to. The printed title decides, except a person whose category is "PURVA Guest"
 * gets the PURVA-branded card whatever their title (Keynote Speaker Madan Mohanka).
 */
export function presetFor(role: string, category?: string | null): Preset {
  // Padma Shri, Editors' and Corporate panels are all one category: Panelist.
  if (category && /panel|journal editor/i.test(category.trim()) && !/director/i.test(role)) return PRESETS.find((p) => p.id === "panelist")!;
  if (category && /^purva guest$/i.test(category.trim())) return PRESETS.find((p) => p.id === "purva-guest")!;
  const r = printRole(role.trim());
  const id = /^director/i.test(r) ? "director" : /bog\b|board of governors/i.test(r) ? "bog" : /^faculty/i.test(r) ? "faculty" : null;
  return PRESETS.find((p) => p.id === id) ?? PRESETS.find((p) => p.label.toLowerCase() === r.toLowerCase()) ?? PRESETS[0]!;
}
export const personPreset = (p: CardPerson) => presetFor(roleOnCard(p), p.category);
export const stockFor = (p: CardPerson): Stock => personPreset(p).stock;
export const STOCK_LABELS: Record<Stock, string> = { pvc: "Normal (PVC)", "metal-gold": "Metal, gold", "metal-silver": "Metal, silver" };

/** Card titles as printed: "Director in charge" is shortened to "Director i/c". */
export const printRole = (role: string) => {
  const r = role.replace(/director[\s-]+in[\s-]+charge/i, "Director i/c");
  return LEGACY_ROLE[r.trim().toLowerCase()] ?? r;
};

export function fieldValue(p: CardPerson, key: FieldKey): string {
  switch (key) {
    case "full_name": return p.full_name;
    case "role": return printRole(roleOnCard(p));
    case "organization": return p.organization ?? "";
    case "code": return p.delegate_code.toUpperCase();
    case "submission": return p.submission_ref ?? "";
    case "email": return p.email.endsWith("@cards.paniim.local") ? "" : p.email;
    case "qr": return cardUrl(p.delegate_code, "qr");
    case "image": return "";
  }
}

let n = 0;
export function newField(key: FieldKey): CardField {
  n += 1;
  const qr = key === "qr";
  return { id: `${key}-${Date.now()}-${n}`, key, x: qr ? 0.35 : 0.1, y: qr ? 0.6 : 0.4, w: qr ? 0.3 : 0.8, size: key === "full_name" ? 16 : 10, color: "#1f4d3a", bold: key === "full_name", align: "center", upper: false, font: "jakarta", weight: key === "full_name" ? 800 : 600 };
}

/** Variable fields placed exactly where the final 57 × 89 mm templates put them. */
export function presetLayout(pr: Preset): CardLayout {
  const f = (k: FieldKey, o: Partial<CardField>): CardField => ({ ...newField(k), ...o });
  const fields: CardField[] = pr.bare
    ? []
    : pr.blank
    ? [f("role", { x: 0.1667, y: 0.5854, w: 0.6667, size: 10.5, weight: 700, color: pr.pillText, pill: pr.pill, pillText: pr.pillText })]
    : [
        f("full_name", { x: 0.0916, y: 0.364, w: 0.8168, size: 15.5, weight: 800, color: pr.ink }),
        f("role", { x: 0.1667, y: 0.4641, w: 0.6667, size: 10.5, weight: 700, color: pr.pillText, pill: pr.pill, pillText: pr.pillText }),
        f("qr", { x: 0.3508, y: 0.5764, w: 0.2983 }),
      ];
  const L = LAYERS[pr.layers ?? pr.id];
  const img = (l: { key: string; src: string; x: number; y: number; w: number; h: number }) =>
    f("image", { x: l.x, y: l.y, w: l.w, src: l.src, ar: (l.h * 89) / (l.w * 57), label: LAYER_LABELS[l.key] ?? l.key, size: 0 });
  return { widthMm: 57, heightMm: 89, fields: [...(L?.front ?? []).map(img), ...fields], back: (L?.back ?? []).map(img), qrStyle: "print", preset: pr.id };
}

const LAYER_LABELS: Record<string, string> = { lockup: "Logos", art: "Campus art" };

/**
 * Fit a name into the field: wrap on spaces into at most `maxLines` lines and shrink the size (never below `min`)
 * until every line fits the width. Same numbers drive the studio preview and the PDF, so bulk exports never overlap.
 */
export function fitLines(text: string, widthMm: number, base: number, maxLines = 2, min = 8, em = 0.6) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wrap = (size: number) => {
    const cap = widthMm / (size * em * 0.3528);
    const lines: string[] = [];
    for (const w of words) {
      const last = lines.at(-1);
      if (last !== undefined && (last + " " + w).length <= cap) lines[lines.length - 1] = last + " " + w;
      else lines.push(w);
    }
    return { lines, ok: lines.length <= maxLines && lines.every((l) => l.length <= cap) };
  };
  for (let size = base; size > min; size = Math.round((size - 0.25) * 100) / 100) {
    const r = wrap(size);
    if (r.ok) return { size, lines: r.lines };
  }
  const r = wrap(min);
  return { size: min, lines: r.lines.length <= maxLines ? r.lines : [...r.lines.slice(0, maxLines - 1), r.lines.slice(maxLines - 1).join(" ")] };
}

export const DEFAULT_LAYOUT: CardLayout = presetLayout(PRESETS[0]!);

/** Shrink text so one line fits the field width (approx. 0.58 em per character). */
export function fitSize(text: string, widthMm: number, base: number, em = 0.58) {
  return Math.min(base, widthMm / (Math.max(text.length, 1) * em * 0.3528));
}

/** Clamp a field so it stays on the card. */
export function clampField(f: CardField, aspect: number): CardField {
  const h = f.key === "qr" ? f.w * aspect : f.key === "image" ? f.w * aspect * (f.ar ?? 1) : 0;
  return { ...f, w: Math.min(Math.max(f.w, 0.05), 1), x: Math.min(Math.max(f.x, 0), 1 - Math.min(f.w, 1)), y: Math.min(Math.max(f.y, 0), 1 - h) };
}

/** One row per person for the print/NFC vendor workbook. */
export function sheetRows(people: CardPerson[]) {
  return people.map((p, i) => ({
    "S.No": i + 1,
    "Delegate Code": p.delegate_code.toUpperCase(),
    "Full Name": p.full_name,
    "Role on Card": printRole(roleOnCard(p)),
    "Card Stock": STOCK_LABELS[stockFor(p)],
    Institution: p.organization ?? "",
    "Submission ID": p.submission_ref ?? "",
    Email: fieldValue(p, "email"),
    "NFC URL (write to tag)": cardUrl(p.delegate_code, "nfc"),
    "QR URL (printed)": cardUrl(p.delegate_code, "qr"),
  }));
}

/** Preloaded approved artwork per preset (front has no variable fields; back is complete). */
export const templateUrl = (presetId: string, side: "front" | "back") => `/card-templates/${presetId}-${side}.png`;

/** Lanyard ribbon colour family for each preset; one print file per family. */
export const LANYARD_OF: Record<string, string> = {
  participant: "green", blank: "green", volunteer: "blue", purva: "orange", "purva-guest": "orange", committee: "charcoal",
  "track-chair": "yellow", coordinator: "yellow", cao: "yellow", faculty: "navy",
  director: "maroon", chair: "maroon", bog: "maroon", panelist: "maroon", keynote: "sienna", editor: "sienna",
};
export const lanyardUrl = (presetId: string, origin = "https://paniim.planos.in") =>
  `${origin}/lanyards/lanyard-${LANYARD_OF[presetId] ? presetId : "blank"}.pdf`;

/** Vendor workbook: one sheet per card category, each with its lanyard link and Name / WMC Code / NFC URL rows. */
export function vendorSheets(people: CardPerson[], origin?: string) {
  const groups = new Map<string, CardPerson[]>();
  for (const p of people) { const id = personPreset(p).id; groups.set(id, [...(groups.get(id) ?? []), p]); }
  return PRESETS.filter((pr) => groups.has(pr.id)).map((pr) => ({
    sheet: pr.label.slice(0, 31),
    presetId: pr.id,
    lanyard: lanyardUrl(pr.id, origin),
    rows: groups.get(pr.id)!.map((p) => ({ Name: p.full_name, "Role on Card": printRole(roleOnCard(p)), "WMC Code": p.delegate_code.toUpperCase(), "NFC URL": cardUrl(p.delegate_code, "nfc") })),
  }));
}
