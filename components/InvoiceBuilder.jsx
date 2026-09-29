"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Copy,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Type,
  Image as ImageIcon,
  Minus,
  Square,
  Building2,
  User,
  FileText,
  Table2,
  Calculator,
  StickyNote,
  ScrollText,
  Upload,
  Check,
  LayoutTemplate,
  ArrowLeft,
  Pencil,
  Star,
  FilePlus2,
  Download,
  Menu,
  X,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Constants                                                               */
/* ---------------------------------------------------------------------- */

const PAGE_W = 794; // default A4 @ 96dpi — used as fallback / default component sizing
const PAGE_H = 1123;
const MIN_SIZE = 16;
const GRID_SIZE = 20; // matches the dot-grid drawn on the canvas background
const THUMB_W = 220;
const THUMB_SCALE = THUMB_W / PAGE_W;
const THUMB_H = PAGE_H * THUMB_SCALE;

const MM_TO_PX = 96 / 25.4;
const PAGE_SIZES_MM = { A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 } };
const mmToPt = (mm) => (mm * 72) / 25.4;

function pageSizeMm(page) {
  if (!page) return PAGE_SIZES_MM.A4;
  if (page.size === "Custom")
    return { w: page.customWidth || 210, h: page.customHeight || 297 };
  return PAGE_SIZES_MM[page.size] || PAGE_SIZES_MM.A4;
}
function pageSizePx(page) {
  const mm = pageSizeMm(page);
  return { w: Math.round(mm.w * MM_TO_PX), h: Math.round(mm.h * MM_TO_PX) };
}

const uid = () => "c_" + Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const snapTo = (v, grid) => Math.round(v / grid) * grid;

/* Simple responsive hook — treats <=768px viewport width as "mobile". */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [breakpoint]);
  return isMobile;
}

const DEFAULT_STYLE = {
  bg: "transparent",
  padding: 0,
  borderWidth: 0,
  borderColor: "#E8E8ED",
  radius: 0,
};

/* Persistence: talks to the Next.js /api/templates Route Handlers (backed by
   MongoDB). The JWT lives in an httpOnly cookie, so the browser sends it
   automatically — nothing to do here except include credentials.
   Mongo documents come back with `_id`; the rest of this file already uses
   `.id` everywhere, so that's normalized once, right here at the boundary. */
const withId = (doc) => (doc && doc._id ? { ...doc, id: doc._id } : doc);

const templatesApi = {
  async list() {
    const res = await fetch("/api/templates", { credentials: "include" });
    if (!res.ok) return [];
    const docs = await res.json();
    return docs.map(withId);
  },
  async create(payload) {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create template");
    return withId(await res.json());
  },
  async update(id, payload) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update template");
    return withId(await res.json());
  },
  async remove(id) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  },
};

/* ---- hand-rolled single-image PDF writer (no external PDF library available in this sandbox) ---- */
function buildSimplePdf(jpegBytes, imgW, imgH, pageWmm, pageHmm) {
  const pageWpt = mmToPt(pageWmm).toFixed(2);
  const pageHpt = mmToPt(pageHmm).toFixed(2);
  const enc = new TextEncoder();
  const parts = [];
  let pos = 0;
  const offsets = {};
  const pushStr = (str) => {
    const b = enc.encode(str);
    parts.push(b);
    pos += b.length;
  };
  const pushBytes = (bytes) => {
    parts.push(bytes);
    pos += bytes.length;
  };

  pushStr("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
  offsets[1] = pos;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = pos;
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = pos;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWpt} ${pageHpt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  offsets[4] = pos;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr("\nendstream\nendobj\n");
  const contentStream = `q ${pageWpt} 0 0 ${pageHpt} 0 0 cm /Im0 Do Q`;
  offsets[5] = pos;
  pushStr(
    `5 0 obj\n<< /Length ${enc.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  );

  const xrefOffset = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++)
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pushStr(xref);
  pushStr(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return new Blob(parts, { type: "application/pdf" });
}

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
  INR: "\u20B9",
  AUD: "$",
  CAD: "$",
  JPY: "\u00A5",
};
const formatCurrency = (n, currency) => {
  const sym = CURRENCY_SYMBOLS[currency] || (currency ? currency + " " : "$");
  return sym + (Number(n) || 0).toFixed(2);
};
const lineAmounts = (it) => {
  const amt = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
  const disc = amt * ((Number(it.discount) || 0) / 100);
  const taxable = amt - disc;
  const tax = taxable * ((Number(it.tax) || 0) / 100);
  return { amt, disc, tax, lineTotal: taxable + tax };
};
const computeTotals = (items, shipping) => {
  let subtotal = 0,
    discount = 0,
    tax = 0;
  (items || []).forEach((it) => {
    const l = lineAmounts(it);
    subtotal += l.amt;
    discount += l.disc;
    tax += l.tax;
  });
  const ship = Number(shipping) || 0;
  return {
    subtotal,
    discount,
    tax,
    shipping: ship,
    total: subtotal - discount + tax + ship,
  };
};

/* ---------------------------------------------------------------------- */
/* Component definitions                                                   */
/* ---------------------------------------------------------------------- */

const COMPONENT_DEFS = {
  text: {
    label: "Text",
    icon: Type,
    w: 220,
    h: 28,
    props: {
      text: "Text goes here",
      fontSize: 14,
      fontWeight: 400,
      color: "#1D1D1F",
      align: "left",
      italic: false,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
  },
  image: {
    label: "Image",
    icon: ImageIcon,
    w: 140,
    h: 90,
    props: { src: "", borderRadius: 0, opacity: 1 },
  },
  divider: {
    label: "Divider",
    icon: Minus,
    w: 400,
    h: 12,
    props: { color: "#D1D5DB", thickness: 1, style: "solid" },
  },
  spacer: {
    label: "Spacer",
    icon: Square,
    w: 200,
    h: 32,
    props: {},
  },
  business: {
    label: "Business Details",
    icon: Building2,
    w: 260,
    h: 110,
    props: {
      fields: {
        name: true,
        address: true,
        email: true,
        phone: true,
        website: false,
        taxId: false,
      },
      fontSize: 12,
      color: "#3A3A3C",
      align: "left",
    },
  },
  customer: {
    label: "Customer Details",
    icon: User,
    w: 260,
    h: 110,
    props: {
      showLabel: true,
      fields: {
        name: true,
        company: true,
        address: true,
        email: true,
        phone: false,
        taxId: false,
      },
      fontSize: 12,
      color: "#3A3A3C",
      align: "left",
    },
  },
  invoiceDetails: {
    label: "Invoice Details",
    icon: FileText,
    w: 220,
    h: 110,
    props: {
      fields: {
        number: true,
        date: true,
        dueDate: true,
        terms: false,
        currency: false,
      },
      fontSize: 12,
      color: "#3A3A3C",
      align: "left",
    },
  },
  table: {
    label: "Invoice Items Table",
    icon: Table2,
    w: 700,
    h: 160,
    props: {
      columns: [
        { id: "item", label: "Item", width: 26, align: "left" },
        { id: "description", label: "Description", width: 28, align: "left" },
        { id: "qty", label: "Qty", width: 10, align: "center" },
        { id: "unitPrice", label: "Unit Price", width: 14, align: "right" },
        { id: "tax", label: "Tax", width: 10, align: "right" },
        { id: "amount", label: "Amount", width: 12, align: "right" },
      ],
      headerBg: "#4F46E5",
      headerColor: "#FFFFFF",
      rowBorder: "#E8E8ED",
      fontSize: 12,
    },
  },
  totals: {
    label: "Totals",
    icon: Calculator,
    w: 240,
    h: 130,
    props: {
      rows: {
        subtotal: true,
        discount: true,
        tax: true,
        shipping: false,
        total: true,
      },
      fontSize: 12,
      color: "#1D1D1F",
    },
  },
  notes: {
    label: "Notes",
    icon: StickyNote,
    w: 400,
    h: 50,
    props: {
      text: "Thank you for your business!",
      fontSize: 11,
      color: "#6E6E73",
    },
  },
  terms: {
    label: "Terms & Conditions",
    icon: ScrollText,
    w: 400,
    h: 50,
    props: {
      text: "Payment is due within 30 days of the invoice date.",
      fontSize: 11,
      color: "#6E6E73",
    },
  },
};

const SIDEBAR_ORDER = [
  "text",
  "image",
  "divider",
  "spacer",
  "business",
  "customer",
  "invoiceDetails",
  "table",
  "totals",
  "notes",
  "terms",
];

const emptyBusinessDefaults = () => ({
  name: "",
  address: "",
  email: "",
  phone: "",
  website: "",
  taxId: "",
});

const blankSchema = () => ({
  page: { size: "A4", margin: 32 },
  theme: { fontFamily: "Inter", primaryColor: "#4F46E5" },
  businessDefaults: emptyBusinessDefaults(),
  components: [],
});

/* ---- preset factory ---- */
function C(type, x, y, w, h, propsOverride = {}, styleOverride = {}) {
  return {
    id: uid(),
    type,
    x,
    y,
    width: w,
    height: h,
    locked: false,
    props: {
      ...JSON.parse(JSON.stringify(COMPONENT_DEFS[type].props)),
      ...propsOverride,
    },
    style: { ...DEFAULT_STYLE, ...styleOverride },
  };
}

function buildMinimal() {
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: "#1D1D1F" },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("text", 40, 40, 240, 32, {
        text: "INVOICE",
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 2,
        color: "#1D1D1F",
      }),
      C("business", 40, 92, 260, 100, {}),
      C("invoiceDetails", 494, 40, 260, 90, {
        align: "right",
        fields: {
          number: true,
          date: true,
          dueDate: true,
          terms: false,
          currency: false,
        },
      }),
      C("customer", 40, 212, 260, 100, {}),
      C("divider", 40, 332, 714, 4, { color: "#E8E8ED", thickness: 1 }),
      C("table", 40, 352, 714, 150, {
        headerBg: "#FFFFFF",
        headerColor: "#1D1D1F",
        rowBorder: "#1D1D1F",
      }),
      C("totals", 494, 522, 260, 120, { color: "#1D1D1F" }),
      C("notes", 40, 522, 380, 40, {
        text: "Thank you for your business.",
        color: "#6E6E73",
      }),
      C("terms", 40, 570, 380, 40, {
        text: "Payment due within 15 days.",
        color: "#6E6E73",
      }),
    ],
  };
}

function buildModern() {
  const accent = "#4F46E5";
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: accent },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("spacer", 0, 0, 794, 10, {}, { bg: accent }),
      C("text", 40, 40, 320, 42, {
        text: "Invoice",
        fontSize: 30,
        fontWeight: 800,
        color: accent,
      }),
      C("invoiceDetails", 494, 46, 260, 90, { align: "right" }),
      C("business", 40, 112, 340, 100, {}),
      C("customer", 420, 112, 334, 100, {}),
      C("table", 40, 242, 714, 150, {
        headerBg: accent,
        headerColor: "#FFFFFF",
        rowBorder: "#EEF0F3",
      }),
      C(
        "totals",
        494,
        412,
        260,
        130,
        {},
        { bg: "#F5F3FF", padding: 12, radius: 8 },
      ),
      C("notes", 40, 412, 400, 40, {}),
      C("terms", 40, 460, 400, 40, {}),
    ],
  };
}

function buildProfessional() {
  const navy = "#1E3A5F";
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: navy },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("text", 40, 40, 300, 34, {
        text: "INVOICE",
        fontSize: 24,
        fontWeight: 700,
        color: navy,
        letterSpacing: 1,
      }),
      C(
        "invoiceDetails",
        494,
        40,
        260,
        90,
        {
          fields: {
            number: true,
            date: true,
            dueDate: true,
            terms: true,
            currency: false,
          },
        },
        { bg: "#F3F4F6", padding: 10, radius: 6 },
      ),
      C("business", 40, 100, 300, 100, {}),
      C("customer", 40, 220, 300, 100, {}),
      C("divider", 40, 340, 714, 4, { color: navy, thickness: 2 }),
      C("table", 40, 360, 714, 150, {
        headerBg: navy,
        headerColor: "#FFFFFF",
        rowBorder: "#E8E8ED",
      }),
      C("totals", 494, 530, 260, 130, { color: navy }),
      C("notes", 40, 530, 400, 40, {}),
      C("terms", 40, 578, 400, 40, {}),
    ],
  };
}

function buildCorporate() {
  const dark = "#0F172A";
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: dark },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("spacer", 0, 0, 794, 90, {}, { bg: dark }),
      C("text", 40, 26, 320, 40, {
        text: "INVOICE",
        fontSize: 28,
        fontWeight: 800,
        color: "#FFFFFF",
        letterSpacing: 2,
      }),
      C("invoiceDetails", 494, 26, 260, 50, {
        align: "right",
        color: "#FFFFFF",
        fields: {
          number: true,
          date: true,
          dueDate: false,
          terms: false,
          currency: false,
        },
      }),
      C("business", 40, 120, 300, 100, {}),
      C("customer", 420, 120, 300, 100, {}),
      C("table", 40, 250, 714, 150, {
        headerBg: dark,
        headerColor: "#FFFFFF",
        rowBorder: "#E8E8ED",
      }),
      C(
        "totals",
        494,
        420,
        260,
        130,
        {},
        { bg: "#F1F5F9", padding: 10, radius: 6 },
      ),
      C("notes", 40, 420, 400, 40, {}),
      C("terms", 40, 468, 400, 40, {}),
    ],
  };
}

function buildClassic() {
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: "#1D1D1F" },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("text", 297, 40, 200, 34, {
        text: "INVOICE",
        align: "center",
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 3,
      }),
      C("divider", 40, 84, 714, 4, { color: "#1D1D1F", thickness: 2 }),
      C("divider", 40, 90, 714, 4, { color: "#1D1D1F", thickness: 1 }),
      C("business", 40, 110, 330, 100, {}),
      C("invoiceDetails", 424, 110, 330, 100, {
        align: "right",
        fields: {
          number: true,
          date: true,
          dueDate: true,
          terms: true,
          currency: false,
        },
      }),
      C("customer", 40, 230, 330, 100, {}),
      C("table", 40, 350, 714, 150, {
        headerBg: "#FFFFFF",
        headerColor: "#1D1D1F",
        rowBorder: "#1D1D1F",
      }),
      C("totals", 494, 520, 260, 130, {}),
      C("notes", 40, 520, 400, 40, {}),
      C("terms", 40, 568, 400, 40, {}),
    ],
  };
}

function buildFreelancer() {
  const accent = "#0D9488";
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: accent },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("image", 40, 40, 70, 70, { borderRadius: 35 }),
      C("text", 128, 56, 300, 40, {
        text: "Invoice",
        fontSize: 26,
        fontWeight: 700,
        color: accent,
      }),
      C(
        "invoiceDetails",
        494,
        40,
        260,
        90,
        { align: "right" },
        { bg: "#F0FDFA", padding: 10, radius: 10 },
      ),
      C("business", 40, 130, 300, 100, {}),
      C("customer", 420, 130, 300, 100, {}),
      C(
        "table",
        40,
        250,
        714,
        150,
        { headerBg: accent, headerColor: "#FFFFFF", rowBorder: "#E8E8ED" },
        { radius: 8 },
      ),
      C(
        "totals",
        494,
        420,
        260,
        130,
        {},
        { bg: "#F0FDFA", padding: 12, radius: 10 },
      ),
      C("notes", 40, 420, 400, 50, {
        text: "Thanks so much for choosing to work with me!",
        color: accent,
      }),
      C("terms", 40, 478, 400, 40, {}),
    ],
  };
}

function buildAgency() {
  const accent = "#EA580C";
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: accent },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("spacer", 0, 0, 10, 1123, {}, { bg: accent }),
      C("text", 50, 40, 400, 50, {
        text: "INVOICE",
        fontSize: 36,
        fontWeight: 800,
        letterSpacing: 1,
        color: "#1D1D1F",
      }),
      C("invoiceDetails", 494, 50, 260, 90, { align: "right" }),
      C("business", 50, 120, 300, 100, {}),
      C("customer", 50, 240, 300, 100, {}),
      C("table", 50, 370, 704, 150, {
        headerBg: "#1D1D1F",
        headerColor: "#FFFFFF",
        rowBorder: "#E8E8ED",
      }),
      C(
        "totals",
        494,
        540,
        260,
        130,
        { color: "#FFFFFF" },
        { bg: accent, padding: 12, radius: 8 },
      ),
      C("notes", 50, 540, 400, 40, {}),
      C("terms", 50, 588, 400, 40, {}),
    ],
  };
}

function buildBranded() {
  const accent = "#1D1D1F";
  return {
    page: { size: "A4", margin: 32 },
    theme: { fontFamily: "Inter", primaryColor: accent },
    businessDefaults: emptyBusinessDefaults(),
    components: [
      C("image", 40, 40, 150, 60, { borderRadius: 4 }),
      C("text", 206, 56, 320, 32, {
        text: "Your Company Name",
        fontSize: 18,
        fontWeight: 700,
        color: accent,
      }),
      C("invoiceDetails", 494, 40, 260, 90, { align: "right" }),
      C("divider", 40, 118, 714, 4, { color: "#E8E8ED", thickness: 1 }),
      C("business", 40, 140, 300, 100, {}),
      C("customer", 420, 140, 300, 100, {}),
      C("table", 40, 260, 714, 150, {
        headerBg: accent,
        headerColor: "#FFFFFF",
        rowBorder: "#E8E8ED",
      }),
      C("totals", 494, 430, 260, 130, {}),
      C("notes", 40, 430, 400, 40, { text: "Thank you for your business." }),
      C("terms", 40, 478, 400, 40, {}),
    ],
  };
}

const PRESETS = [
  { id: "minimal", name: "Minimal", accent: "#1D1D1F", build: buildMinimal },
  { id: "modern", name: "Modern", accent: "#4F46E5", build: buildModern },
  {
    id: "professional",
    name: "Professional",
    accent: "#1E3A5F",
    build: buildProfessional,
  },
  {
    id: "corporate",
    name: "Corporate",
    accent: "#0F172A",
    build: buildCorporate,
  },
  { id: "classic", name: "Classic", accent: "#1D1D1F", build: buildClassic },
  {
    id: "freelancer",
    name: "Freelancer",
    accent: "#0D9488",
    build: buildFreelancer,
  },
  { id: "agency", name: "Agency", accent: "#EA580C", build: buildAgency },
  {
    id: "branded",
    name: "Branded (with Logo)",
    accent: "#1D1D1F",
    build: buildBranded,
  },
];

/* ---------------------------------------------------------------------- */
/* Small UI primitives                                                     */
/* ---------------------------------------------------------------------- */

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#6E6E73",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

const inputBase = {
  width: "100%",
  fontSize: 12.5,
  padding: "6px 8px",
  border: "1px solid #E8E8ED",
  borderRadius: 7,
  outline: "none",
  color: "#1D1D1F",
  background: "#fff",
  boxSizing: "border-box",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};

function NumInput({ value, onChange, onCommit, min, max, style }) {
  return (
    <input
      type="number"
      value={Math.round(value * 100) / 100}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={onCommit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      style={{ ...inputBase, ...style }}
    />
  );
}
function TextInput({ value, onChange, onCommit, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      style={inputBase}
    />
  );
}
function TextAreaInput({ value, onChange, onCommit, rows = 2 }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      style={{ ...inputBase, resize: "vertical", fontFamily: "inherit" }}
    />
  );
}
function ColorInput({ value, onChange, onCommit }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid #E2E4E9",
        borderRadius: 6,
        padding: "4px 8px",
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        style={{
          width: 20,
          height: 20,
          border: "none",
          padding: 0,
          background: "none",
          cursor: "pointer",
        }}
      />
      <span style={{ fontSize: 12, color: "#6E6E73" }}>{value}</span>
    </div>
  );
}
function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputBase, cursor: "pointer" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
function CheckboxRow({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12.5,
        color: "#3A3A3C",
        padding: "4px 0",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#4F46E5", width: 14, height: 14 }}
      />
      {label}
    </label>
  );
}
function IconBtn({ icon: Icon, onClick, title, active, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "1px solid " + (active ? "#4F46E5" : "transparent"),
        background: active
          ? "#EEF2FF"
          : hovered && !disabled
            ? "#F0F0F2"
            : "transparent",
        color: disabled ? "#D1D5DB" : active ? "#4F46E5" : "#4B5563",
        cursor: disabled ? "default" : "pointer",
        transition: "background 150ms ease, color 150ms ease",
      }}
    >
      <Icon size={15} />
    </button>
  );
}
const ROW_GAP = { display: "flex", gap: 6 };

function wrapperStyle(comp) {
  const s = comp.style || DEFAULT_STYLE;
  return {
    background: s.bg && s.bg !== "transparent" ? s.bg : "transparent",
    padding: s.padding || 0,
    border: s.borderWidth
      ? `${s.borderWidth}px solid ${s.borderColor || "#E8E8ED"}`
      : "none",
    borderRadius: s.radius || 0,
    boxSizing: "border-box",
  };
}

/* ---------------------------------------------------------------------- */
/* Component renderer — design mode (tokens) or preview mode (real data)   */
/* ---------------------------------------------------------------------- */

function VarToken({ children }) {
  return (
    <span
      style={{
        background: "#EEF2FF",
        color: "#4F46E5",
        padding: "0 3px",
        borderRadius: 3,
        fontSize: "0.92em",
      }}
    >
      {children}
    </span>
  );
}
function FieldLine({ show, label, token, value, style }) {
  if (!show) return null;
  const content =
    value !== undefined ? value || "\u2014" : <VarToken>{token}</VarToken>;
  return (
    <div style={{ ...style, marginBottom: 2 }}>
      {label ? <span style={{ opacity: 0.65 }}>{label}: </span> : null}
      {content}
    </div>
  );
}
function CustomFieldLines({ customFields, style }) {
  if (!customFields || !customFields.length) return null;
  return customFields
    .filter((cf) => cf.label && cf.label.trim())
    .map((cf) => (
      <div key={cf.id} style={{ ...style, marginBottom: 2 }}>
        <span style={{ opacity: 0.65 }}>{cf.label}: </span>
        {cf.value || "\u2014"}
      </div>
    ));
}

function ComponentBody({ comp, editing, onEditChange, onEditCommit, data }) {
  const p = comp.props;
  const baseText = {
    fontSize: p?.fontSize ?? 12,
    color: p?.color ?? "black",
    lineHeight: 1.5,
  };

  switch (comp.type) {
    case "text": {
      if (editing) {
        return (
          <textarea
            autoFocus
            value={p.text}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              height: "100%",
              resize: "none",
              border: "1px dashed #4F46E5",
              outline: "none",
              fontSize: p.fontSize,
              fontWeight: p.fontWeight,
              color: p.color,
              textAlign: p.align,
              fontStyle: p.italic ? "italic" : "normal",
              lineHeight: p.lineHeight,
              letterSpacing: p.letterSpacing,
              fontFamily: "inherit",
              background: "#fff",
              padding: 2,
              boxSizing: "border-box",
            }}
          />
        );
      }
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            fontSize: p.fontSize,
            fontWeight: p.fontWeight,
            color: p.color,
            textAlign: p.align,
            fontStyle: p.italic ? "italic" : "normal",
            lineHeight: p.lineHeight,
            letterSpacing: p.letterSpacing,
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {p.text}
        </div>
      );
    }

    case "image":
      return p.src ? (
        <img
          src={p.src}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: p.borderRadius,
            opacity: p.opacity,
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "1.5px dashed #C7CAD1",
            borderRadius: p.borderRadius,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#86868B",
            fontSize: 11,
            gap: 4,
            background: "#FAFAFB",
          }}
        >
          <ImageIcon size={18} />
          <span>No image</span>
        </div>
      );

    case "divider":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              borderTop: `${p.thickness}px ${p.style} ${p.color}`,
            }}
          />
        </div>
      );

    case "spacer":
      return <div style={{ width: "100%", height: "100%" }} />;

    case "business":
      return (
        <div style={{ ...baseText, textAlign: p.align }}>
          {p.fields.name && (
            <div style={{ fontWeight: 700, marginBottom: 3 }}>
              {data ? (
                data.business.name || "\u2014"
              ) : (
                <VarToken>{"{{business.name}}"}</VarToken>
              )}
            </div>
          )}
          <FieldLine
            show={p.fields.address}
            token="{{business.address}}"
            value={data && data.business.address}
            style={baseText}
          />
          <FieldLine
            show={p.fields.email}
            token="{{business.email}}"
            value={data && data.business.email}
            style={baseText}
          />
          <FieldLine
            show={p.fields.phone}
            token="{{business.phone}}"
            value={data && data.business.phone}
            style={baseText}
          />
          <FieldLine
            show={p.fields.website}
            token="{{business.website}}"
            value={data && data.business.website}
            style={baseText}
          />
          <FieldLine
            show={p.fields.taxId}
            label="GSTIN"
            token="{{business.taxId}}"
            value={data && data.business.taxId}
            style={baseText}
          />
          {data && (
            <CustomFieldLines
              customFields={data.business.customFields}
              style={baseText}
            />
          )}
        </div>
      );

    case "customer":
      return (
        <div style={{ ...baseText, textAlign: p.align }}>
          {p.showLabel && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#86868B",
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              BILL TO
            </div>
          )}
          {p.fields.name && (
            <div style={{ fontWeight: 700, marginBottom: 3 }}>
              {data ? (
                data.customer.name || "\u2014"
              ) : (
                <VarToken>{"{{customer.name}}"}</VarToken>
              )}
            </div>
          )}
          <FieldLine
            show={p.fields.company}
            token="{{customer.company}}"
            value={data && data.customer.company}
            style={baseText}
          />
          <FieldLine
            show={p.fields.address}
            token="{{customer.address}}"
            value={data && data.customer.address}
            style={baseText}
          />
          <FieldLine
            show={p.fields.email}
            token="{{customer.email}}"
            value={data && data.customer.email}
            style={baseText}
          />
          <FieldLine
            show={p.fields.phone}
            token="{{customer.phone}}"
            value={data && data.customer.phone}
            style={baseText}
          />
          <FieldLine
            show={p.fields.taxId}
            label="GSTIN"
            token="{{customer.taxId}}"
            value={data && data.customer.taxId}
            style={baseText}
          />
          {data && (
            <CustomFieldLines
              customFields={data.customer.customFields}
              style={baseText}
            />
          )}
        </div>
      );

    case "invoiceDetails": {
      const rows = [
        ["number", "Invoice #", "{{invoice.number}}"],
        ["date", "Date", "{{invoice.date}}"],
        ["dueDate", "Due Date", "{{invoice.dueDate}}"],
        ["terms", "Terms", "{{invoice.terms}}"],
        ["currency", "Currency", "{{invoice.currency}}"],
      ];
      return (
        <div style={{ ...baseText, textAlign: p.align }}>
          {rows.map(([key, label, token]) => (
            <FieldLine
              key={key}
              show={p.fields[key]}
              label={label}
              token={token}
              value={data && data.invoice[key]}
              style={baseText}
            />
          ))}
          {data && (
            <CustomFieldLines
              customFields={data.invoice.customFields}
              style={baseText}
            />
          )}
        </div>
      );
    }

    case "table": {
      const valueFor = (colId, it) => {
        switch (colId) {
          case "item":
            return it.name || "";
          case "description":
            return it.description || "";
          case "qty":
            return String(it.quantity ?? "");
          case "unitPrice":
            return formatCurrency(it.unitPrice, data.invoice.currency);
          case "discount":
            return (Number(it.discount) || 0) + "%";
          case "tax":
            return (Number(it.tax) || 0) + "%";
          case "amount":
            return formatCurrency(
              lineAmounts(it).lineTotal,
              data.invoice.currency,
            );
          default:
            return it[colId] ?? "";
        }
      };
      return (
        <div
          style={{
            width: "100%",
            fontSize: p.fontSize,
            border: `1px solid ${p.rowBorder}`,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              background: p.headerBg,
              color: p.headerColor,
              fontWeight: 600,
            }}
          >
            {p.columns.map((c) => (
              <div
                key={c.id}
                style={{
                  width: c.width + "%",
                  padding: "6px 8px",
                  textAlign: c.align,
                  boxSizing: "border-box",
                }}
              >
                {c.label}
              </div>
            ))}
          </div>
          {!data && (
            <>
              <div
                style={{
                  display: "flex",
                  borderTop: `1px solid ${p.rowBorder}`,
                }}
              >
                {p.columns.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      width: c.width + "%",
                      padding: "6px 8px",
                      textAlign: c.align,
                      boxSizing: "border-box",
                      color: "#3A3A3C",
                    }}
                  >
                    <VarToken>{`{{item.${c.id}}}`}</VarToken>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: "5px 8px",
                  fontSize: 10.5,
                  color: "#86868B",
                  fontStyle: "italic",
                  borderTop: `1px solid ${p.rowBorder}`,
                }}
              >
                row repeats per invoice item
              </div>
            </>
          )}
          {data &&
            (data.items && data.items.length ? (
              data.items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    borderTop: `1px solid ${p.rowBorder}`,
                  }}
                >
                  {p.columns.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        width: c.width + "%",
                        padding: "6px 8px",
                        textAlign: c.align,
                        boxSizing: "border-box",
                        color: "#3A3A3C",
                      }}
                    >
                      {valueFor(c.id, it)}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: "8px",
                  fontSize: 11,
                  color: "#86868B",
                  fontStyle: "italic",
                  borderTop: `1px solid ${p.rowBorder}`,
                }}
              >
                No items added yet
              </div>
            ))}
        </div>
      );
    }

    case "totals": {
      const rows = [
        ["subtotal", "Subtotal", false],
        ["discount", "Discount", false],
        ["tax", "Tax", false],
        ["shipping", "Shipping", false],
        ["total", "Total", true],
      ];
      return (
        <div style={{ fontSize: p.fontSize, color: p.color }}>
          {rows.map(
            ([key, label, bold]) =>
              p.rows[key] && (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontWeight: bold ? 700 : 400,
                    fontSize: bold ? p.fontSize + 2 : p.fontSize,
                    borderTop: bold ? "1px solid rgba(0,0,0,0.12)" : "none",
                    marginTop: bold ? 4 : 0,
                  }}
                >
                  <span>{label}</span>
                  {data ? (
                    <span>
                      {formatCurrency(data.totals[key], data.invoice.currency)}
                    </span>
                  ) : (
                    <VarToken>{`{{${key}}}`}</VarToken>
                  )}
                </div>
              ),
          )}
        </div>
      );
    }

    case "notes":
    case "terms": {
      const overrideText = data
        ? comp.type === "notes"
          ? data.notesOverride
          : data.termsOverride
        : "";
      const finalText = overrideText ? overrideText : p.text;
      if (editing) {
        return (
          <textarea
            autoFocus
            value={p.text}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              height: "100%",
              resize: "none",
              border: "1px dashed #4F46E5",
              outline: "none",
              fontSize: p.fontSize,
              color: p.color,
              fontFamily: "inherit",
              padding: 2,
              boxSizing: "border-box",
            }}
          />
        );
      }
      return (
        <div>
          {comp.type === "terms" && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#86868B",
                letterSpacing: 0.5,
                marginBottom: 3,
              }}
            >
              TERMS & CONDITIONS
            </div>
          )}
          <div
            style={{
              fontSize: p.fontSize,
              color: p.color,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {finalText}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

/* Unscaled page content — the single source of truth used by the on-screen preview,
   template thumbnails, AND the PDF export, so they never drift apart. */
function InvoicePageContent({ schema, data, showGrid }) {
  const { w: pageW, h: pageH } = pageSizePx(schema.page);
  return (
    <div
      style={{
        width: pageW,
        height: pageH,
        position: "relative",
        background: "#fff",
        backgroundImage: showGrid
          ? "radial-gradient(#EEF0F3 1px, transparent 1px)"
          : "none",
        backgroundSize: "20px 20px",
        // Center the dots on the tile ORIGIN (0,0) rather than the tile
        // center (10,10) — a radial-gradient dot sits mid-tile by default,
        // which would otherwise land 10px off from where components snap.
        backgroundPosition: showGrid ? "-10px -10px" : "0 0",
      }}
    >
      {schema.components.map((comp) => (
        <div
          key={comp.id}
          style={{
            position: "absolute",
            left: comp.x,
            top: comp.y,
            width: comp.width,
            height: comp.height,
            overflow: "hidden",
            ...wrapperStyle(comp),
          }}
        >
          <ComponentBody comp={comp} editing={false} data={data} />
        </div>
      ))}
    </div>
  );
}

/* Read-only page renderer, used by thumbnails and invoice preview */
function PageCanvas({ schema, data, width, showGrid }) {
  const { w: pageW, h: pageH } = pageSizePx(schema.page);
  const scale = width / pageW;
  return (
    <div
      style={{
        width,
        height: pageH * scale,
        overflow: "hidden",
        position: "relative",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.08)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: pageW,
          height: pageH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <InvoicePageContent schema={schema} data={data} showGrid={showGrid} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Properties Panel                                                        */
/* ---------------------------------------------------------------------- */

function PropertiesPanel({ comp, updateLive, commit, actions, layerInfo }) {
  const [uploading, setUploading] = useState(false); // declared before the early return below (Rules of Hooks)

  if (!comp) {
    return (
      <div
        style={{
          padding: 20,
          color: "#86868B",
          fontSize: 13,
          textAlign: "center",
          marginTop: 40,
        }}
      >
        <LayoutTemplate size={28} style={{ marginBottom: 10, opacity: 0.6 }} />
        <div>Select a component on the canvas to edit its properties.</div>
      </div>
    );
  }

  const def = COMPONENT_DEFS[comp.type];
  const setProp = (key, val) =>
    updateLive((c) => ({ ...c, props: { ...c.props, [key]: val } }));
  const setPropField = (fieldsKey, key, val) =>
    updateLive((c) => ({
      ...c,
      props: { ...c.props, [fieldsKey]: { ...c.props[fieldsKey], [key]: val } },
    }));
  const setStyle = (key, val) =>
    updateLive((c) => ({
      ...c,
      style: { ...(c.style || DEFAULT_STYLE), [key]: val },
    }));
  const styleObj = comp.style || DEFAULT_STYLE;

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setProp("src", data.url);
      commit();
    } catch (err) {
      alert(err.message || "Could not upload the image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: "14px 14px 30px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1D1D1F",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <def.icon size={14} color="#4F46E5" /> {def.label}
        </div>
      </div>

      <div style={{ ...ROW_GAP, marginBottom: 14 }}>
        <IconBtn icon={Copy} title="Duplicate" onClick={actions.duplicate} />
        <IconBtn
          icon={comp.locked ? Lock : Unlock}
          title={comp.locked ? "Unlock" : "Lock"}
          active={comp.locked}
          onClick={actions.toggleLock}
        />
        <IconBtn
          icon={ChevronUp}
          title="Bring forward"
          onClick={actions.forward}
          disabled={layerInfo.isTop}
        />
        <IconBtn
          icon={ChevronDown}
          title="Send backward"
          onClick={actions.backward}
          disabled={layerInfo.isBottom}
        />
        <IconBtn icon={Trash2} title="Delete" onClick={actions.remove} />
      </div>

      <Field label="Position & Size">
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
        >
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              X
            </div>
            <NumInput
              value={comp.x}
              onChange={(v) => updateLive((c) => ({ ...c, x: v }))}
              onCommit={commit}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              Y
            </div>
            <NumInput
              value={comp.y}
              onChange={(v) => updateLive((c) => ({ ...c, y: v }))}
              onCommit={commit}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              W
            </div>
            <NumInput
              value={comp.width}
              min={MIN_SIZE}
              onChange={(v) =>
                updateLive((c) => ({ ...c, width: Math.max(MIN_SIZE, v) }))
              }
              onCommit={commit}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              H
            </div>
            <NumInput
              value={comp.height}
              min={MIN_SIZE}
              onChange={(v) =>
                updateLive((c) => ({ ...c, height: Math.max(MIN_SIZE, v) }))
              }
              onCommit={commit}
            />
          </div>
        </div>
      </Field>

      <Field label="Container">
        <CheckboxRow
          label="Background fill"
          checked={(styleObj.bg || "transparent") !== "transparent"}
          onChange={(v) => {
            setStyle("bg", v ? "#F3F4F6" : "transparent");
            commit();
          }}
        />
        {(styleObj.bg || "transparent") !== "transparent" && (
          <div style={{ marginTop: 6, marginBottom: 6 }}>
            <ColorInput
              value={styleObj.bg}
              onChange={(v) => setStyle("bg", v)}
              onCommit={commit}
            />
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginTop: 6,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              Padding
            </div>
            <NumInput
              value={styleObj.padding || 0}
              min={0}
              onChange={(v) => setStyle("padding", v)}
              onCommit={commit}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              Radius
            </div>
            <NumInput
              value={styleObj.radius || 0}
              min={0}
              onChange={(v) => setStyle("radius", v)}
              onCommit={commit}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              Border width
            </div>
            <NumInput
              value={styleObj.borderWidth || 0}
              min={0}
              onChange={(v) => setStyle("borderWidth", v)}
              onCommit={commit}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
              Border color
            </div>
            <ColorInput
              value={styleObj.borderColor || "#E8E8ED"}
              onChange={(v) => setStyle("borderColor", v)}
              onCommit={commit}
            />
          </div>
        </div>
      </Field>

      {comp.type === "text" && (
        <>
          <Field label="Text">
            <TextAreaInput
              value={comp.props.text}
              onChange={(v) => setProp("text", v)}
              onCommit={commit}
              rows={3}
            />
          </Field>
          <Field label="Font size">
            <NumInput
              value={comp.props.fontSize}
              min={6}
              onChange={(v) => setProp("fontSize", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Weight">
            <SelectInput
              value={String(comp.props.fontWeight)}
              onChange={(v) => {
                setProp("fontWeight", Number(v));
                commit();
              }}
              options={[
                { value: "400", label: "Regular" },
                { value: "500", label: "Medium" },
                { value: "600", label: "Semibold" },
                { value: "700", label: "Bold" },
                { value: "800", label: "Extra Bold" },
              ]}
            />
          </Field>
          <Field label="Align">
            <SelectInput
              value={comp.props.align}
              onChange={(v) => {
                setProp("align", v);
                commit();
              }}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>
          <Field label="Color">
            <ColorInput
              value={comp.props.color}
              onChange={(v) => setProp("color", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Italic">
            <CheckboxRow
              label="Italic text"
              checked={comp.props.italic}
              onChange={(v) => {
                setProp("italic", v);
                commit();
              }}
            />
          </Field>
          <Field label="Line height">
            <NumInput
              value={comp.props.lineHeight}
              onChange={(v) => setProp("lineHeight", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Letter spacing (px)">
            <NumInput
              value={comp.props.letterSpacing}
              onChange={(v) => setProp("letterSpacing", v)}
              onCommit={commit}
            />
          </Field>
        </>
      )}

      {comp.type === "image" && (
        <>
          {!comp.props.src && (
            <div
              style={{
                background: "#EEF2FF",
                color: "#4F46E5",
                fontSize: 11.5,
                padding: "9px 10px",
                borderRadius: 7,
                marginBottom: 12,
                lineHeight: 1.4,
              }}
            >
              Add your company logo here — it'll appear on every invoice made
              from this template.
            </div>
          )}
          <Field label="Image">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "center",
                padding: "8px",
                border: "1px dashed #C7CAD1",
                borderRadius: 6,
                cursor: uploading ? "default" : "pointer",
                fontSize: 12,
                color: uploading ? "#86868B" : "#4F46E5",
              }}
            >
              <Upload size={13} />{" "}
              {uploading ? "Uploading\u2026" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                style={{ display: "none" }}
                onChange={(e) => handleImageUpload(e.target.files[0])}
              />
            </label>
          </Field>
          <Field label="Border radius">
            <NumInput
              value={comp.props.borderRadius}
              min={0}
              onChange={(v) => setProp("borderRadius", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Opacity">
            <NumInput
              value={comp.props.opacity}
              min={0}
              max={1}
              onChange={(v) => setProp("opacity", clamp(v, 0, 1))}
              onCommit={commit}
            />
          </Field>
        </>
      )}

      {comp.type === "divider" && (
        <>
          <Field label="Color">
            <ColorInput
              value={comp.props.color}
              onChange={(v) => setProp("color", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Thickness (px)">
            <NumInput
              value={comp.props.thickness}
              min={1}
              onChange={(v) => setProp("thickness", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Style">
            <SelectInput
              value={comp.props.style}
              onChange={(v) => {
                setProp("style", v);
                commit();
              }}
              options={[
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dashed" },
                { value: "dotted", label: "Dotted" },
              ]}
            />
          </Field>
        </>
      )}

      {(comp.type === "business" ||
        comp.type === "customer" ||
        comp.type === "invoiceDetails") && (
        <>
          <Field label="Fields shown">
            {Object.keys(comp.props.fields).map((k) => (
              <CheckboxRow
                key={k}
                label={k.charAt(0).toUpperCase() + k.slice(1)}
                checked={comp.props.fields[k]}
                onChange={(v) => {
                  setPropField("fields", k, v);
                  commit();
                }}
              />
            ))}
          </Field>
          {comp.type === "customer" && (
            <Field label='Show "Bill To" label'>
              <CheckboxRow
                label="Show label"
                checked={comp.props.showLabel}
                onChange={(v) => {
                  setProp("showLabel", v);
                  commit();
                }}
              />
            </Field>
          )}
          <Field label="Align">
            <SelectInput
              value={comp.props.align}
              onChange={(v) => {
                setProp("align", v);
                commit();
              }}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>
          <Field label="Font size">
            <NumInput
              value={comp.props.fontSize}
              min={6}
              onChange={(v) => setProp("fontSize", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Text color">
            <ColorInput
              value={comp.props.color}
              onChange={(v) => setProp("color", v)}
              onCommit={commit}
            />
          </Field>
        </>
      )}

      {comp.type === "table" && (
        <>
          <Field label="Columns">
            {comp.props.columns.map((col, i) => (
              <div
                key={col.id}
                style={{
                  display: "flex",
                  gap: 4,
                  marginBottom: 5,
                  alignItems: "center",
                }}
              >
                <input
                  value={col.label}
                  onChange={(e) => {
                    const cols = comp.props.columns.map((c, ci) =>
                      ci === i ? { ...c, label: e.target.value } : c,
                    );
                    setProp("columns", cols);
                  }}
                  onBlur={commit}
                  style={{ ...inputBase, flex: 1 }}
                />
                <button
                  onClick={() => {
                    const cols = comp.props.columns.filter((_, ci) => ci !== i);
                    setProp("columns", cols);
                    commit();
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#86868B",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const cols = [
                  ...comp.props.columns,
                  { id: uid(), label: "New Column", width: 10, align: "left" },
                ];
                setProp("columns", cols);
                commit();
              }}
              style={{
                fontSize: 11.5,
                color: "#4F46E5",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Plus size={12} /> Add column
            </button>
          </Field>
          <Field label="Header background">
            <ColorInput
              value={comp.props.headerBg}
              onChange={(v) => setProp("headerBg", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Header text color">
            <ColorInput
              value={comp.props.headerColor}
              onChange={(v) => setProp("headerColor", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Row border">
            <ColorInput
              value={comp.props.rowBorder}
              onChange={(v) => setProp("rowBorder", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Font size">
            <NumInput
              value={comp.props.fontSize}
              min={6}
              onChange={(v) => setProp("fontSize", v)}
              onCommit={commit}
            />
          </Field>
        </>
      )}

      {comp.type === "totals" && (
        <>
          <Field label="Rows shown">
            {Object.keys(comp.props.rows).map((k) => (
              <CheckboxRow
                key={k}
                label={k.charAt(0).toUpperCase() + k.slice(1)}
                checked={comp.props.rows[k]}
                onChange={(v) => {
                  setPropField("rows", k, v);
                  commit();
                }}
              />
            ))}
          </Field>
          <Field label="Font size">
            <NumInput
              value={comp.props.fontSize}
              min={6}
              onChange={(v) => setProp("fontSize", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Text color">
            <ColorInput
              value={comp.props.color}
              onChange={(v) => setProp("color", v)}
              onCommit={commit}
            />
          </Field>
        </>
      )}

      {(comp.type === "notes" || comp.type === "terms") && (
        <>
          <Field label="Text">
            <TextAreaInput
              value={comp.props.text}
              onChange={(v) => setProp("text", v)}
              onCommit={commit}
              rows={3}
            />
          </Field>
          <Field label="Font size">
            <NumInput
              value={comp.props.fontSize}
              min={6}
              onChange={(v) => setProp("fontSize", v)}
              onCommit={commit}
            />
          </Field>
          <Field label="Text color">
            <ColorInput
              value={comp.props.color}
              onChange={(v) => setProp("color", v)}
              onCommit={commit}
            />
          </Field>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Templates Library                                                        */
/* ---------------------------------------------------------------------- */

/* ── Business Defaults Panel (shown in editor sidebar below components) ── */

function BusinessDefaultsPanel({ biz, onChange, onCommit }) {
  const [open, setOpen] = useState(false);
  const inp = { ...inputBase, marginBottom: 7 };
  const fields = [
    ["name", "Business name"],
    ["address", "Address"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["website", "Website"],
    ["taxId", "Tax ID / GSTIN"],
  ];
  const filled = Object.values(biz).some((v) => v && v.trim());
  return (
    <div
      style={{ marginTop: 16, borderTop: "1px solid #E8E8ED", paddingTop: 14 }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 8px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#86868B",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Business Details
          {filled && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#4F46E5",
                display: "inline-block",
              }}
            />
          )}
        </span>
        <span
          style={{
            color: "#86868B",
            display: "flex",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 180ms ease",
          }}
        >
          <ChevronDown size={13} />
        </span>
      </button>
      {open && (
        <div className="animate-fade-up">
          <div
            style={{
              fontSize: 11,
              color: "#86868B",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            Saved with this template — pre-fills every invoice you create from
            it.
          </div>
          {fields.map(([key, label]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: "#86868B", marginBottom: 2 }}>
                {label}
              </div>
              <input
                style={inp}
                value={biz[key] || ""}
                placeholder={label}
                onChange={(e) => onChange(key, e.target.value)}
                onBlur={onCommit}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  tpl,
  onEdit,
  onCreateInvoice,
  onDuplicate,
  onDelete,
  onSetDefault,
  onRename,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(tpl.name);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="animate-fade-up"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered
          ? "0 12px 32px rgba(0,0,0,0.10)"
          : "0 1px 2px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "all 220ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        style={{
          background: "#F5F5F7",
          display: "flex",
          justifyContent: "center",
          padding: 14,
          cursor: "pointer",
        }}
        onClick={onEdit}
        title="Click to edit"
      >
        <div style={{ cursor: "pointer" }}>
          <PageCanvas schema={tpl.schema} width={THUMB_W} />
        </div>
      </div>
      <div style={{ padding: "14px 14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          {editingName ? (
            <>
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setEditingName(false);
                    onRename(nameVal || tpl.name);
                  } else if (e.key === "Escape") {
                    setNameVal(tpl.name);
                    setEditingName(false);
                  }
                }}
                style={{ ...inputBase, fontWeight: 600, flex: 1 }}
              />
              <button
                onClick={() => {
                  setEditingName(false);
                  onRename(nameVal || tpl.name);
                }}
                title="Save"
                style={{
                  border: "none",
                  background: "none",
                  color: "#16A34A",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => {
                  setNameVal(tpl.name);
                  setEditingName(false);
                }}
                title="Cancel"
                style={{
                  border: "none",
                  background: "none",
                  color: "#86868B",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                letterSpacing: -0.1,
                color: "#1D1D1F",
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tpl.name}
              {tpl.isDefault && (
                <Star
                  size={12}
                  fill="#F59E0B"
                  color="#F59E0B"
                  style={{ flexShrink: 0 }}
                />
              )}
            </div>
          )}
          {!editingName && (
            <button
              onClick={() => setEditingName(true)}
              style={{
                border: "none",
                background: "none",
                color: "#86868B",
                cursor: "pointer",
                padding: 2,
                flexShrink: 0,
              }}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          <IconBtn
            icon={Star}
            title={tpl.isDefault ? "Default template" : "Set as default"}
            active={tpl.isDefault}
            onClick={onSetDefault}
          />
          <IconBtn icon={Copy} title="Duplicate" onClick={onDuplicate} />
          <IconBtn icon={Trash2} title="Delete" onClick={onDelete} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid #E8E8ED",
              background: "#fff",
              color: "#1D1D1F",
              borderRadius: 8,
              padding: "8px 0",
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            Edit
          </button>
          <button
            onClick={onCreateInvoice}
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              background: "#4F46E5",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 0",
              cursor: "pointer",
              transition: "background 150ms ease, transform 100ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#4338CA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#4F46E5")}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.97)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Create Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

function PresetTile({ onClick, label, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      style={{ cursor: "pointer" }}
    >
      <div
        style={{
          borderRadius: 10,
          overflow: "hidden",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          boxShadow: hovered
            ? "0 10px 28px rgba(0,0,0,0.10)"
            : "0 1px 2px rgba(0,0,0,0.04)",
          transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {children}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 12.5,
          fontWeight: 500,
          marginTop: 8,
          color: hovered ? "#1D1D1F" : "#6E6E73",
          transition: "color 150ms ease",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function PresetPicker({ onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="animate-fade"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(29,29,31,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
      onMouseDown={onClose}
    >
      <div
        className="animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 28,
          maxWidth: 880,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.20)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          title="Close"
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            border: "none",
            background: "#F5F5F7",
            color: "#6E6E73",
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#EBEBED")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#F5F5F7")}
        >
          <X size={15} />
        </button>
        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: -0.3,
            marginBottom: 5,
            color: "#1D1D1F",
          }}
        >
          Choose a starting point
        </div>
        <div style={{ fontSize: 13.5, color: "#6E6E73", marginBottom: 24 }}>
          Start blank or pick a preset — everything stays fully editable.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, ${THUMB_W}px)`,
            gap: 20,
            justifyContent: "start",
          }}
        >
          <PresetTile onClick={() => onPick(null)} label="Blank">
            <div
              style={{
                width: THUMB_W,
                height: THUMB_H,
                border: "1.5px dashed #D2D2D7",
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#86868B",
                gap: 6,
                background: "#FBFBFD",
              }}
            >
              <FilePlus2 size={22} />
              <span style={{ fontSize: 12 }}>Blank</span>
            </div>
          </PresetTile>
          {PRESETS.map((p) => (
            <PresetTile key={p.id} onClick={() => onPick(p)} label={p.name}>
              <PageCanvas schema={p.build()} width={THUMB_W} />
            </PresetTile>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatesLibrary({
  templates,
  onEdit,
  onCreateInvoice,
  onDuplicate,
  onDelete,
  onSetDefault,
  onRename,
  onNew,
}) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "40px 40px 60px",
        background: "#FBFBFD",
      }}
    >
      <div
        className="animate-fade-up"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 36,
          flexWrap: "wrap",
          gap: 14,
          maxWidth: 1200,
          margin: "0 auto 36px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: -0.5,
              color: "#1D1D1F",
            }}
          >
            Templates
          </div>
          <div style={{ fontSize: 14.5, color: "#6E6E73", marginTop: 4 }}>
            Design, duplicate, and manage your invoice templates.
          </div>
        </div>
        <button
          onClick={onNew}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            background: "#1D1D1F",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 18px",
            cursor: "pointer",
            transition: "transform 120ms ease, background 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#000")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1D1D1F")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div
          className="animate-fade-up"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            textAlign: "center",
            padding: "80px 20px",
            color: "#6E6E73",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#F5F5F7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <LayoutTemplate size={24} color="#86868B" />
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "#1D1D1F",
              marginBottom: 6,
            }}
          >
            No templates yet
          </div>
          <div style={{ fontSize: 14, marginBottom: 22 }}>
            Create your first invoice template to get started.
          </div>
          <button
            onClick={onNew}
            style={{
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              background: "#4F46E5",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 20px",
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#4338CA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#4F46E5")}
          >
            New Template
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, ${THUMB_W}px)`,
            gap: 24,
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              onEdit={() => onEdit(tpl.id)}
              onCreateInvoice={() => onCreateInvoice(tpl.id)}
              onDuplicate={() => onDuplicate(tpl.id)}
              onDelete={() => onDelete(tpl.id)}
              onSetDefault={() => onSetDefault(tpl.id)}
              onRename={(name) => onRename(tpl.id, name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Create Invoice view                                                      */
/* ---------------------------------------------------------------------- */

const emptyItem = () => ({
  id: uid(),
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  tax: 0,
});
const emptyInvoiceData = () => ({
  business: {
    name: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    taxId: "",
    customFields: [],
  },
  customer: {
    name: "",
    company: "",
    address: "",
    email: "",
    phone: "",
    taxId: "",
    customFields: [],
  },
  invoice: {
    number: "INV-0001",
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    terms: "",
    currency: "USD",
    customFields: [],
  },
  items: [emptyItem()],
  shipping: 0,
  notesOverride: "",
  termsOverride: "",
});

function FormSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        marginBottom: 4,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #E8E8ED",
        background: "#fff",
        marginBottom: 10,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: open ? "#fff" : "#FBFBFD",
          border: "none",
          cursor: "pointer",
          padding: "11px 14px",
          transition: "background 150ms ease",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#1D1D1F",
            letterSpacing: 0.2,
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <span
          style={{
            color: "#86868B",
            transition: "transform 200ms ease",
            display: "flex",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          <ChevronDown size={14} />
        </span>
      </button>
      {open && <div style={{ padding: "2px 14px 14px" }}>{children}</div>}
    </div>
  );
}
function Grid2({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
function Labeled({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "#86868B", marginBottom: 3 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function CustomFieldsBlock({ fields, onAdd, onUpdate, onRemove, itemInput }) {
  return (
    <div style={{ marginTop: 2 }}>
      {fields.map((cf) => (
        <div
          key={cf.id}
          style={{
            display: "flex",
            gap: 5,
            marginBottom: 5,
            alignItems: "center",
          }}
        >
          <input
            style={{ ...itemInput, flex: 1 }}
            placeholder="Field name (e.g. Username)"
            value={cf.label}
            onChange={(e) => onUpdate(cf.id, "label", e.target.value)}
          />
          <input
            style={{ ...itemInput, flex: 1 }}
            placeholder="Value"
            value={cf.value}
            onChange={(e) => onUpdate(cf.id, "value", e.target.value)}
          />
          <button
            onClick={() => onRemove(cf.id)}
            style={{
              border: "none",
              background: "none",
              color: "#86868B",
              cursor: "pointer",
              padding: 2,
              flexShrink: 0,
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          fontSize: 11.5,
          color: "#4F46E5",
          background: "#F0EFFE",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          padding: "6px 8px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          transition: "background 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#E5E1FC")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#F0EFFE")}
      >
        <Plus size={12} /> Add custom field
      </button>
    </div>
  );
}

function InvoiceView({ template, onBack }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(() => {
    const d = emptyInvoiceData();
    const biz = template.schema.businessDefaults;
    if (biz) d.business = { ...d.business, ...biz };
    return d;
  });
  const [zoom, setZoom] = useState(0.72);

  const setField = (section, key, val) =>
    setData((d) => ({ ...d, [section]: { ...d[section], [key]: val } }));
  const setItem = (id, key, val) =>
    setData((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, [key]: val } : it)),
    }));
  const addItem = () =>
    setData((d) => ({ ...d, items: [...d.items, emptyItem()] }));
  const removeItem = (id) =>
    setData((d) => ({
      ...d,
      items:
        d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items,
    }));

  const addCustomField = (section) =>
    setData((d) => ({
      ...d,
      [section]: {
        ...d[section],
        customFields: [
          ...(d[section].customFields || []),
          { id: uid(), label: "", value: "" },
        ],
      },
    }));
  const updateCustomField = (section, id, key, val) =>
    setData((d) => ({
      ...d,
      [section]: {
        ...d[section],
        customFields: d[section].customFields.map((cf) =>
          cf.id === id ? { ...cf, [key]: val } : cf,
        ),
      },
    }));
  const removeCustomField = (section, id) =>
    setData((d) => ({
      ...d,
      [section]: {
        ...d[section],
        customFields: d[section].customFields.filter((cf) => cf.id !== id),
      },
    }));

  const previewData = useMemo(
    () => ({
      business: data.business,
      customer: data.customer,
      invoice: data.invoice,
      items: data.items,
      totals: computeTotals(data.items, data.shipping),
      notesOverride: data.notesOverride,
      termsOverride: data.termsOverride,
    }),
    [data],
  );

  const itemInput = { ...inputBase, padding: "5px 6px", fontSize: 12 };
  const printRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const { w: pageW, h: pageH } = pageSizePx(template.schema.page);
  const pageMm = pageSizeMm(template.schema.page);

  const exportPDF = () => {
    const node = printRef.current?.firstElementChild;

    if (!node) {
      alert("Invoice preview is not available.");
      return;
    }

    const frame = document.createElement("iframe");

    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";

    document.body.appendChild(frame);

    const doc = frame.contentDocument;

    if (!doc) {
      document.body.removeChild(frame);
      alert("Could not prepare the invoice for printing.");
      return;
    }

    doc.open();

    doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${data.invoice.number || "invoice"}</title>

        <style>
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
          }

          * {
            box-sizing: border-box;
          }
        </style>
      </head>

      <body>
        ${node.outerHTML}
      </body>
    </html>
  `);

    doc.close();

    // Give the iframe time to render before printing
    setTimeout(() => {
      if (frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }

      // Remove iframe after the print dialog has opened
      setTimeout(() => {
        if (document.body.contains(frame)) {
          document.body.removeChild(frame);
        }
      }, 1000);
    }, 300);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: 0,
        overflowY: isMobile ? "auto" : "visible",
      }}
    >
      <div
        ref={printRef}
        style={{ position: "fixed", top: -100000, left: -100000 }}
      >
        <InvoicePageContent schema={template.schema} data={previewData} />
      </div>
      <div
        style={{
          width: isMobile ? "100%" : 380,
          flexShrink: 0,
          borderRight: isMobile ? "none" : "1px solid #E8E8ED",
          borderBottom: isMobile ? "1px solid #E8E8ED" : "none",
          background: "#fff",
          overflowY: isMobile ? "visible" : "auto",
          padding: "18px 18px 20px",
          boxSizing: "border-box",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "#4F46E5",
            border: "none",
            background: "none",
            cursor: "pointer",
            marginBottom: 14,
            padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back to Templates
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>
          Create Invoice
        </div>
        <div style={{ fontSize: 12, color: "#86868B", marginBottom: 18 }}>
          Using template: <b style={{ color: "#3A3A3C" }}>{template.name}</b>
        </div>

        <FormSection title="Business" defaultOpen={!isMobile}>
          <Grid2>
            <Labeled label="Business name">
              <input
                style={itemInput}
                value={data.business.name}
                onChange={(e) => setField("business", "name", e.target.value)}
              />
            </Labeled>
            <Labeled label="Email">
              <input
                style={itemInput}
                value={data.business.email}
                onChange={(e) => setField("business", "email", e.target.value)}
              />
            </Labeled>
          </Grid2>
          <Grid2>
            <Labeled label="Phone">
              <input
                style={itemInput}
                value={data.business.phone}
                onChange={(e) => setField("business", "phone", e.target.value)}
              />
            </Labeled>
            <Labeled label="Tax ID / GSTIN">
              <input
                style={itemInput}
                value={data.business.taxId}
                onChange={(e) => setField("business", "taxId", e.target.value)}
              />
            </Labeled>
          </Grid2>
          <Labeled label="Address">
            <textarea
              rows={2}
              style={{ ...itemInput, resize: "vertical" }}
              value={data.business.address}
              onChange={(e) => setField("business", "address", e.target.value)}
            />
          </Labeled>
          <CustomFieldsBlock
            fields={data.business.customFields}
            itemInput={itemInput}
            onAdd={() => addCustomField("business")}
            onUpdate={(id, k, v) => updateCustomField("business", id, k, v)}
            onRemove={(id) => removeCustomField("business", id)}
          />
        </FormSection>

        <FormSection title="Customer" defaultOpen={!isMobile}>
          <Grid2>
            <Labeled label="Customer name">
              <input
                style={itemInput}
                value={data.customer.name}
                onChange={(e) => setField("customer", "name", e.target.value)}
              />
            </Labeled>
            <Labeled label="Company">
              <input
                style={itemInput}
                value={data.customer.company}
                onChange={(e) =>
                  setField("customer", "company", e.target.value)
                }
              />
            </Labeled>
          </Grid2>
          <Grid2>
            <Labeled label="Email">
              <input
                style={itemInput}
                value={data.customer.email}
                onChange={(e) => setField("customer", "email", e.target.value)}
              />
            </Labeled>
            <Labeled label="Phone">
              <input
                style={itemInput}
                value={data.customer.phone}
                onChange={(e) => setField("customer", "phone", e.target.value)}
              />
            </Labeled>
          </Grid2>
          <Labeled label="Address">
            <textarea
              rows={2}
              style={{ ...itemInput, resize: "vertical" }}
              value={data.customer.address}
              onChange={(e) => setField("customer", "address", e.target.value)}
            />
          </Labeled>
          <CustomFieldsBlock
            fields={data.customer.customFields}
            itemInput={itemInput}
            onAdd={() => addCustomField("customer")}
            onUpdate={(id, k, v) => updateCustomField("customer", id, k, v)}
            onRemove={(id) => removeCustomField("customer", id)}
          />
        </FormSection>

        <FormSection title="Invoice" defaultOpen={!isMobile}>
          <Grid2>
            <Labeled label="Invoice number">
              <input
                style={itemInput}
                value={data.invoice.number}
                onChange={(e) => setField("invoice", "number", e.target.value)}
              />
            </Labeled>
            <Labeled label="Currency">
              <select
                style={itemInput}
                value={data.invoice.currency}
                onChange={(e) =>
                  setField("invoice", "currency", e.target.value)
                }
              >
                {Object.keys(CURRENCY_SYMBOLS).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Labeled>
          </Grid2>
          <Grid2>
            <Labeled label="Date">
              <input
                type="date"
                style={itemInput}
                value={data.invoice.date}
                onChange={(e) => setField("invoice", "date", e.target.value)}
              />
            </Labeled>
            <Labeled label="Due date">
              <input
                type="date"
                style={itemInput}
                value={data.invoice.dueDate}
                onChange={(e) => setField("invoice", "dueDate", e.target.value)}
              />
            </Labeled>
          </Grid2>
          <Labeled label="Payment terms">
            <input
              style={itemInput}
              placeholder="e.g. Net 30"
              value={data.invoice.terms}
              onChange={(e) => setField("invoice", "terms", e.target.value)}
            />
          </Labeled>
          <div style={{ marginTop: 8 }}>
            <CustomFieldsBlock
              fields={data.invoice.customFields}
              itemInput={itemInput}
              onAdd={() => addCustomField("invoice")}
              onUpdate={(id, k, v) => updateCustomField("invoice", id, k, v)}
              onRemove={(id) => removeCustomField("invoice", id)}
            />
          </div>
        </FormSection>

        <FormSection title="Items" defaultOpen={!isMobile}>
          {data.items.map((it) => (
            <div
              key={it.id}
              style={{
                border: "1px solid #EEF0F3",
                borderRadius: 8,
                padding: 8,
                marginBottom: 8,
                position: "relative",
                background: "#FAFAFB",
              }}
            >
              <button
                onClick={() => removeItem(it.id)}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  border: "none",
                  background: "none",
                  color: "#86868B",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} />
              </button>
              <input
                style={{ ...itemInput, marginBottom: 6, fontWeight: 600 }}
                placeholder="Item name"
                value={it.name}
                onChange={(e) => setItem(it.id, "name", e.target.value)}
              />
              <input
                style={{ ...itemInput, marginBottom: 6 }}
                placeholder="Description"
                value={it.description}
                onChange={(e) => setItem(it.id, "description", e.target.value)}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 5,
                }}
              >
                <Labeled label="Qty">
                  <input
                    type="number"
                    style={itemInput}
                    value={it.quantity}
                    onChange={(e) =>
                      setItem(it.id, "quantity", Number(e.target.value))
                    }
                  />
                </Labeled>
                <Labeled label="Unit price">
                  <input
                    type="number"
                    style={itemInput}
                    value={it.unitPrice}
                    onChange={(e) =>
                      setItem(it.id, "unitPrice", Number(e.target.value))
                    }
                  />
                </Labeled>
                <Labeled label="Disc %">
                  <input
                    type="number"
                    style={itemInput}
                    value={it.discount}
                    onChange={(e) =>
                      setItem(it.id, "discount", Number(e.target.value))
                    }
                  />
                </Labeled>
                <Labeled label="Tax %">
                  <input
                    type="number"
                    style={itemInput}
                    value={it.tax}
                    onChange={(e) =>
                      setItem(it.id, "tax", Number(e.target.value))
                    }
                  />
                </Labeled>
              </div>
            </div>
          ))}
          <button
            onClick={addItem}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#E5E1FC")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F0EFFE")}
            style={{
              fontSize: 12,
              color: "#4F46E5",
              background: "#F0EFFE",
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              padding: "7px 0",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              transition: "background 150ms ease",
            }}
          >
            <Plus size={13} /> Add item
          </button>
        </FormSection>

        <FormSection title="Additional" defaultOpen={!isMobile}>
          <Labeled label="Shipping">
            <input
              type="number"
              style={{ ...itemInput, marginBottom: 8 }}
              value={data.shipping}
              onChange={(e) =>
                setData((d) => ({ ...d, shipping: Number(e.target.value) }))
              }
            />
          </Labeled>
          <Labeled label="Notes (overrides template default)">
            <textarea
              rows={2}
              style={{ ...itemInput, resize: "vertical", marginBottom: 8 }}
              value={data.notesOverride}
              onChange={(e) =>
                setData((d) => ({ ...d, notesOverride: e.target.value }))
              }
            />
          </Labeled>
          <Labeled label="Terms (overrides template default)">
            <textarea
              rows={2}
              style={{ ...itemInput, resize: "vertical" }}
              value={data.termsOverride}
              onChange={(e) =>
                setData((d) => ({ ...d, termsOverride: e.target.value }))
              }
            />
          </Labeled>
        </FormSection>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#F5F5F7",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 0 6px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              border: "1px solid #E2E4E9",
              borderRadius: 8,
              padding: "3px 6px",
              background: "#fff",
            }}
          >
            <IconBtn
              icon={ZoomOut}
              title="Zoom out"
              onClick={() => setZoom((z) => clamp(z - 0.1, 0.4, 1.2))}
            />
            <span
              style={{
                fontSize: 12,
                width: 38,
                textAlign: "center",
                color: "#4B5563",
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <IconBtn
              icon={ZoomIn}
              title="Zoom in"
              onClick={() => setZoom((z) => clamp(z + 0.1, 0.4, 1.2))}
            />
          </div>
          <button
            onClick={exportPDF}
            disabled={exporting}
            title="Download this invoice as a PDF"
            onMouseEnter={(e) => {
              if (!exporting) e.currentTarget.style.background = "#4338CA";
            }}
            onMouseLeave={(e) => {
              if (!exporting) e.currentTarget.style.background = "#4F46E5";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              background: exporting ? "#A5A6F5" : "#4F46E5",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: exporting ? "default" : "pointer",
              transition: "background 150ms ease",
            }}
          >
            <Download size={14} />{" "}
            {exporting ? "Exporting\u2026" : "Export PDF"}
          </button>
        </div>
        <div style={{ padding: "10px 20px 40px" }}>
          <PageCanvas
            schema={template.schema}
            data={previewData}
            width={pageW * (isMobile ? Math.min(zoom, 0.5) : zoom)}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Editor view                                                              */
/* ---------------------------------------------------------------------- */

function EditorView({
  template,
  onBack,
  onSave,
  saveState,
  initialSelectedId,
}) {
  const isMobile = useIsMobile();
  const [present, setPresent] = useState(template.schema);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [name, setName] = useState(template.name);
  const [selectedId, setSelectedId] = useState(initialSelectedId || null);
  const [editingId, setEditingId] = useState(null);
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 768 ? 0.4 : 0.85,
  );
  const [showComponents, setShowComponents] = useState(false);
  const [editMode, setEditMode] = useState(() => !isMobile);
  const canEdit = !isMobile || editMode;
  const [snapEnabled, setSnapEnabled] = useState(true);
  const snapEnabledRef = useRef(snapEnabled);
  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);
  const snap = useCallback(
    (v) => (snapEnabledRef.current ? snapTo(v, GRID_SIZE) : v),
    [],
  );

  const canvasRef = useRef(null);
  const interactionRef = useRef(null);
  const snapshotRef = useRef(null);
  const clipboardRef = useRef(null);

  const { w: pageW, h: pageH } = pageSizePx(present.page);
  const pageDimsRef = useRef({ w: pageW, h: pageH });
  useEffect(() => {
    pageDimsRef.current = { w: pageW, h: pageH };
  });

  const commitFull = useCallback((newPresent, fromSnapshot) => {
    setPast((p) => [...p, fromSnapshot]);
    setFuture([]);
    setPresent(newPresent);
  }, []);
  const undo = useCallback(
    () =>
      setPast((p) => {
        if (!p.length) return p;
        const prev = p[p.length - 1];
        setFuture((f) => [present, ...f]);
        setPresent(prev);
        return p.slice(0, -1);
      }),
    [present],
  );
  const redo = useCallback(
    () =>
      setFuture((f) => {
        if (!f.length) return f;
        const next = f[0];
        setPast((p) => [...p, present]);
        setPresent(next);
        return f.slice(1);
      }),
    [present],
  );

  const updateLive = (mutator) =>
    setPresent((prev) => {
      if (snapshotRef.current === null) snapshotRef.current = prev;
      return {
        ...prev,
        components: prev.components.map((c) =>
          c.id === selectedId ? mutator(c) : c,
        ),
      };
    });
  const commitEdit = () => {
    if (snapshotRef.current !== null) {
      setPast((p) => [...p, snapshotRef.current]);
      setFuture([]);
      snapshotRef.current = null;
    }
  };

  const selected = present.components.find((c) => c.id === selectedId) || null;
  const selIndex = present.components.findIndex((c) => c.id === selectedId);

  const removeSelected = () => {
    if (!selectedId) return;
    commitFull(
      {
        ...present,
        components: present.components.filter((c) => c.id !== selectedId),
      },
      present,
    );
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const copy = {
      ...JSON.parse(JSON.stringify(selected)),
      id: uid(),
      x: selected.x + 16,
      y: selected.y + 16,
    };
    commitFull(
      { ...present, components: [...present.components, copy] },
      present,
    );
    setSelectedId(copy.id);
  };
  const toggleLockSelected = () => {
    if (!selected) return;
    commitFull(
      {
        ...present,
        components: present.components.map((c) =>
          c.id === selectedId ? { ...c, locked: !c.locked } : c,
        ),
      },
      present,
    );
  };
  const reorderSelected = (dir) => {
    if (!selected) return;
    const comps = [...present.components];
    const newIndex = clamp(selIndex + dir, 0, comps.length - 1);
    if (newIndex === selIndex) return;
    comps.splice(selIndex, 1);
    comps.splice(newIndex, 0, selected);
    commitFull({ ...present, components: comps }, present);
  };

  const setBusinessDefault = (key, val) => {
    setPresent((prev) => ({
      ...prev,
      businessDefaults: {
        ...(prev.businessDefaults || emptyBusinessDefaults()),
        [key]: val,
      },
    }));
  };
  // Uses functional setPast so it always captures the latest present, not a stale closure
  const commitBusinessDefault = () => {
    setPresent((current) => {
      setPast((p) => [...p, current]);
      setFuture([]);
      return current;
    });
  };

  const getClientXY = (e) => {
    const t =
      e.touches && e.touches.length
        ? e.touches[0]
        : e.changedTouches && e.changedTouches.length
          ? e.changedTouches[0]
          : e;
    return { x: t.clientX, y: t.clientY };
  };

  const canvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / pageW;
    const { x: cx, y: cy } = getClientXY(e);
    return {
      x: (cx - rect.left) / scale,
      y: (cy - rect.top) / scale,
    };
  };

  const addComponentAt = (type, x, y) => {
    const def = COMPONENT_DEFS[type];
    if (!def) return null;
    const newComp = {
      id: uid(),
      type,
      locked: false,
      x: clamp(snap(x - def.w / 2), 0, pageW - def.w),
      y: clamp(snap(y - def.h / 2), 0, pageH - def.h),
      width: def.w,
      height: def.h,
      props: JSON.parse(JSON.stringify(def.props)),
      style: { ...DEFAULT_STYLE },
    };
    commitFull(
      { ...present, components: [...present.components, newComp] },
      present,
    );
    setSelectedId(newComp.id);
    return newComp;
  };

  const addComponentFromSidebar = (type) => {
    // Used for tap-to-add (mobile, where native HTML5 drag-and-drop isn't available)
    // and as a click shortcut on desktop. Places the component near the top-center.
    addComponentAt(type, pageW / 2, 60 + present.components.length * 4);
    if (isMobile) setShowComponents(false);
  };

  const startMove = (e, comp) => {
    if (!canEdit) return;
    if (editingId === comp.id) return;
    e.stopPropagation();
    if (e.type === "touchstart" && e.cancelable) e.preventDefault();
    setSelectedId(comp.id);
    if (comp.locked) return;
    const { x, y } = getClientXY(e);
    interactionRef.current = {
      type: "move",
      compId: comp.id,
      startClient: { x, y },
      startComp: { x: comp.x, y: comp.y },
      snapshot: present,
    };
  };
  const startResize = (e, comp, handle) => {
    if (!canEdit) return;
    e.stopPropagation();
    if (e.type === "touchstart" && e.cancelable) e.preventDefault();
    if (comp.locked) return;
    const { x, y } = getClientXY(e);
    interactionRef.current = {
      type: "resize",
      compId: comp.id,
      handle,
      startClient: { x, y },
      startComp: {
        x: comp.x,
        y: comp.y,
        width: comp.width,
        height: comp.height,
      },
      snapshot: present,
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      const it = interactionRef.current;
      if (!it || !canvasRef.current) return;
      if (e.type === "touchmove" && e.cancelable) e.preventDefault();
      const { x: clientX, y: clientY } = getClientXY(e);
      const { w: pw, h: ph } = pageDimsRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      const scale = rect.width / pw;
      const dx = (clientX - it.startClient.x) / scale;
      const dy = (clientY - it.startClient.y) / scale;
      setPresent((prev) => ({
        ...prev,
        components: prev.components.map((c) => {
          if (c.id !== it.compId) return c;
          if (it.type === "move") {
            const x = clamp(snap(it.startComp.x + dx), 0, pw - c.width);
            const y = clamp(snap(it.startComp.y + dy), 0, ph - c.height);
            return { ...c, x, y };
          }
          let { x, y, width, height } = it.startComp;
          const h = it.handle;
          if (h.includes("e"))
            width = Math.max(MIN_SIZE, snap(it.startComp.width + dx));
          if (h.includes("s"))
            height = Math.max(MIN_SIZE, snap(it.startComp.height + dy));
          if (h.includes("w")) {
            width = Math.max(MIN_SIZE, snap(it.startComp.width - dx));
            x = snap(it.startComp.x + it.startComp.width - width);
          }
          if (h.includes("n")) {
            height = Math.max(MIN_SIZE, snap(it.startComp.height - dy));
            y = snap(it.startComp.y + it.startComp.height - height);
          }
          return { ...c, x, y, width, height };
        }),
      }));
    };
    const onUp = () => {
      const it = interactionRef.current;
      if (it) {
        setPast((p) => [...p, it.snapshot]);
        setFuture([]);
        interactionRef.current = null;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, []);

  const onCanvasDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("component-type");
    if (!type || !COMPONENT_DEFS[type]) return;
    const { x, y } = canvasCoords(e);
    addComponentAt(type, x, y);
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        mod &&
        ((e.key.toLowerCase() === "z" && e.shiftKey) ||
          e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        if (selected)
          clipboardRef.current = JSON.parse(JSON.stringify(selected));
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        if (clipboardRef.current) {
          const copy = {
            ...clipboardRef.current,
            id: uid(),
            x: clipboardRef.current.x + 16,
            y: clipboardRef.current.y + 16,
          };
          commitFull(
            { ...present, components: [...present.components, copy] },
            present,
          );
          setSelectedId(copy.id);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeSelected();
        return;
      }
      if (
        selectedId &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commitFull(
          {
            ...present,
            components: present.components.map((c) =>
              c.id === selectedId
                ? {
                    ...c,
                    x: clamp(c.x + dx, 0, pageW - c.width),
                    y: clamp(c.y + dy, 0, pageH - c.height),
                  }
                : c,
            ),
          },
          present,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, selectedId, selected]);

  const handles = ["nw", "ne", "sw", "se"];
  const cursorFor = {
    nw: "nwse-resize",
    se: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
  };

  const [sidebarTab, setSidebarTab] = useState("components"); // "components" | "business"

  const tabStyle = (tab) => ({
    flex: 1,
    fontSize: 12,
    fontWeight: 600,
    padding: "7px 0",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    background: sidebarTab === tab ? "#fff" : "transparent",
    color: sidebarTab === tab ? "#1D1D1F" : "#86868B",
    boxShadow: sidebarTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
    transition: "all 160ms ease",
  });

  const sidebarItems = (
    <>
      {/* Tab switcher */}
      <div
        style={{
          display: "flex",
          background: "#F0F0F2",
          borderRadius: 9,
          padding: 3,
          marginBottom: 14,
          gap: 2,
        }}
      >
        <button
          style={tabStyle("components")}
          onClick={() => setSidebarTab("components")}
        >
          Components
        </button>
        <button
          style={tabStyle("business")}
          onClick={() => setSidebarTab("business")}
        >
          Business
        </button>
      </div>

      {sidebarTab === "components" && (
        <>
          {SIDEBAR_ORDER.map((type) => {
            const def = COMPONENT_DEFS[type];
            const Icon = def.icon;
            return (
              <div
                key={type}
                draggable={!isMobile}
                onDragStart={(e) =>
                  e.dataTransfer.setData("component-type", type)
                }
                onClick={() => addComponentFromSidebar(type)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F0F0F2")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#FAFAFB")
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 10px",
                  marginBottom: 6,
                  border: "1px solid #ECEDF0",
                  borderRadius: 8,
                  cursor: isMobile ? "pointer" : "grab",
                  fontSize: 12.5,
                  background: "#FAFAFB",
                  color: "#3A3A3C",
                  userSelect: "none",
                  transition: "background 150ms ease",
                }}
              >
                <Icon size={15} color="#4F46E5" />
                {def.label}
              </div>
            );
          })}
          <div
            style={{
              fontSize: 11,
              color: "#86868B",
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            {isMobile
              ? "Tap to add."
              : "Drag onto the canvas, or click to add."}
          </div>
        </>
      )}

      {sidebarTab === "business" && (
        <div className="animate-fade-up">
          <div
            style={{
              fontSize: 11,
              color: "#86868B",
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            Saved with this template and pre-fills every invoice you create from
            it.
          </div>
          {[
            ["name", "Business name"],
            ["address", "Address"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["website", "Website"],
            ["taxId", "Tax ID / GSTIN"],
          ].map(([key, label]) => {
            const biz = present.businessDefaults || emptyBusinessDefaults();
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#86868B",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  {label}
                </div>
                {key === "address" ? (
                  <textarea
                    rows={2}
                    style={{
                      ...inputBase,
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                    value={biz[key] || ""}
                    placeholder={label}
                    onChange={(e) => setBusinessDefault(key, e.target.value)}
                    onBlur={commitBusinessDefault}
                  />
                ) : (
                  <input
                    style={inputBase}
                    value={biz[key] || ""}
                    placeholder={label}
                    type={key === "email" ? "email" : "text"}
                    onChange={(e) => setBusinessDefault(key, e.target.value)}
                    onBlur={commitBusinessDefault}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <>
      <div
        style={{
          height: 56,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid #E8E8ED",
          background: "#fff",
          gap: 12,
          overflowX: "auto",
        }}
      >
        {isMobile && (
          <button
            onClick={() => setEditMode((v) => !v)}
            title="Toggle edit mode"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid " + (editMode ? "#4F46E5" : "#E2E4E9"),
              background: editMode ? "#EEF2FF" : "#fff",
              color: editMode ? "#4F46E5" : "#6E6E73",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <Pencil size={13} /> {editMode ? "Editing" : "View"}
          </button>
        )}
        {isMobile && editMode && (
          <IconBtn
            icon={Menu}
            title="Components"
            onClick={() => setShowComponents(true)}
          />
        )}
        <button
          onClick={() => onSave(name, present)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "#4F46E5",
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: 0,
            whiteSpace: "nowrap",
          }}
        >
          <ArrowLeft size={14} /> Templates
        </button>
        <div style={{ width: 1, height: 24, background: "#E8E8ED" }} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            border: "1px solid transparent",
            fontSize: 13.5,
            fontWeight: 600,
            padding: "5px 8px",
            borderRadius: 6,
            width: isMobile ? 110 : 200,
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.border = "1px solid #E2E4E9")}
          onBlur={(e) => (e.target.style.border = "1px solid transparent")}
        />
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            border: "1px solid #E2E4E9",
            borderRadius: 8,
            padding: 3,
            flexShrink: 0,
          }}
        >
          <IconBtn
            icon={Undo2}
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!past.length}
          />
          <IconBtn
            icon={Redo2}
            title="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!future.length}
          />
        </div>
        {!isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #E2E4E9",
              borderRadius: 8,
              padding: "3px 6px",
              flexShrink: 0,
            }}
          >
            <IconBtn
              icon={ZoomOut}
              title="Zoom out"
              onClick={() => setZoom((z) => clamp(z - 0.1, 0.4, 1.5))}
            />
            <span
              style={{
                fontSize: 12,
                width: 38,
                textAlign: "center",
                color: "#4B5563",
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <IconBtn
              icon={ZoomIn}
              title="Zoom in"
              onClick={() => setZoom((z) => clamp(z + 0.1, 0.4, 1.5))}
            />
          </div>
        )}
        {!isMobile && (
          <button
            onClick={() => setSnapEnabled((v) => !v)}
            title="Snap components to the grid while dragging or resizing"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid " + (snapEnabled ? "#4F46E5" : "#E2E4E9"),
              background: snapEnabled ? "#EEF2FF" : "#fff",
              color: snapEnabled ? "#4F46E5" : "#6E6E73",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <Square size={13} /> Snap to grid
          </button>
        )}
        <button
          onClick={() => onSave(name, present)}
          onMouseEnter={(e) => {
            if (saveState === "idle")
              e.currentTarget.style.background = "#4338CA";
          }}
          onMouseLeave={(e) => {
            if (saveState === "idle")
              e.currentTarget.style.background = "#4F46E5";
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            border: "none",
            background: saveState === "saved" ? "#16A34A" : "#4F46E5",
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "background 150ms ease",
          }}
        >
          {saveState === "saved" ? <Check size={13} /> : null}
          {saveState === "saving"
            ? "Saving\u2026"
            : saveState === "saved"
              ? "Saved"
              : "Save"}
        </button>
      </div>

      <div
        style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}
      >
        {!isMobile && (
          <div
            style={{
              width: 190,
              flexShrink: 0,
              borderRight: "1px solid #E8E8ED",
              background: "#fff",
              overflowY: "auto",
              padding: 12,
            }}
          >
            {sidebarItems}
          </div>
        )}

        {isMobile && showComponents && (
          <>
            <div
              onClick={() => setShowComponents(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(17,24,39,0.4)",
                zIndex: 40,
              }}
            />
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: 240,
                maxWidth: "82vw",
                background: "#fff",
                zIndex: 41,
                overflowY: "auto",
                padding: 12,
                boxShadow: "2px 0 16px rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 4,
                }}
              >
                <button
                  onClick={() => setShowComponents(false)}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "#86868B",
                    padding: 4,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              {sidebarItems}
            </div>
          </>
        )}

        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: isMobile ? "16px 10px" : "36px 20px",
            background: "#F5F5F7",
          }}
        >
          {isMobile && !editMode && (
            <div
              style={{
                fontSize: 12,
                color: "#6E6E73",
                background: "#fff",
                border: "1px solid #E2E4E9",
                borderRadius: 8,
                padding: "6px 12px",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Viewing template — tap <b>View</b> above to start editing.
            </div>
          )}
          <div
            style={{ width: pageW * zoom, height: pageH * zoom, flexShrink: 0 }}
          >
            <div
              ref={canvasRef}
              onMouseDown={() => canEdit && setSelectedId(null)}
              onTouchStart={() => canEdit && setSelectedId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onCanvasDrop}
              style={{
                width: pageW,
                height: pageH,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                background: "#fff",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.08)",
                position: "relative",
                backgroundImage:
                  "radial-gradient(#EEF0F3 1px, transparent 1px)",
                backgroundSize: "20px 20px",
                backgroundPosition: "-10px -10px",
                touchAction: canEdit ? "none" : "auto",
              }}
            >
              {present.components.map((comp) => {
                const isSel = comp.id === selectedId;
                return (
                  <div
                    key={comp.id}
                    onMouseDown={(e) => startMove(e, comp)}
                    onTouchStart={(e) => startMove(e, comp)}
                    onDoubleClick={(e) => {
                      if (!canEdit) return;
                      e.stopPropagation();
                      if (
                        ["text", "notes", "terms"].includes(comp.type) &&
                        !comp.locked
                      )
                        setEditingId(comp.id);
                    }}
                    style={{
                      position: "absolute",
                      left: comp.x,
                      top: comp.y,
                      width: comp.width,
                      height: comp.height,
                      cursor: comp.locked ? "default" : "move",
                      outline: isSel
                        ? "1.5px solid #4F46E5"
                        : "1.5px solid transparent",
                      outlineOffset: 2,
                      ...wrapperStyle(comp),
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel)
                        e.currentTarget.style.outline = "1.5px solid #C7CAD1";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.outline =
                          "1.5px solid transparent";
                    }}
                  >
                    <ComponentBody
                      comp={comp}
                      editing={editingId === comp.id}
                      onEditChange={(val) =>
                        updateLive((c) => ({
                          ...c,
                          props: { ...c.props, text: val },
                        }))
                      }
                      onEditCommit={() => {
                        commitEdit();
                        setEditingId(null);
                      }}
                    />
                    {comp.locked && (
                      <div
                        style={{
                          position: "absolute",
                          top: -9,
                          right: -9,
                          background: "#fff",
                          border: "1px solid #E2E4E9",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Lock size={9} color="#86868B" />
                      </div>
                    )}
                    {isSel &&
                      !comp.locked &&
                      handles.map((h) => {
                        const handleSize = isMobile ? 20 : 9;
                        const offset = -(handleSize / 2);
                        return (
                          <div
                            key={h}
                            onMouseDown={(e) => startResize(e, comp, h)}
                            onTouchStart={(e) => startResize(e, comp, h)}
                            style={{
                              position: "absolute",
                              width: handleSize,
                              height: handleSize,
                              background: "#fff",
                              border: "1.5px solid #4F46E5",
                              borderRadius: isMobile ? "50%" : 2,
                              top: h.includes("n") ? offset : undefined,
                              bottom: h.includes("s") ? offset : undefined,
                              left: h.includes("w") ? offset : undefined,
                              right: h.includes("e") ? offset : undefined,
                              cursor: cursorFor[h],
                              zIndex: 5,
                              touchAction: "none",
                            }}
                          />
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!isMobile && (
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderLeft: "1px solid #E8E8ED",
              background: "#fff",
              overflowY: "auto",
            }}
          >
            <PropertiesPanel
              comp={selected}
              updateLive={updateLive}
              commit={commitEdit}
              layerInfo={{
                isTop: selIndex === present.components.length - 1,
                isBottom: selIndex === 0,
              }}
              actions={{
                duplicate: duplicateSelected,
                toggleLock: toggleLockSelected,
                forward: () => reorderSelected(1),
                backward: () => reorderSelected(-1),
                remove: removeSelected,
              }}
            />
          </div>
        )}

        {isMobile && selected && (
          <>
            <div
              onClick={() => setSelectedId(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(17,24,39,0.35)",
                zIndex: 40,
              }}
            />
            <div
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "68vh",
                background: "#fff",
                zIndex: 41,
                borderRadius: "16px 16px 0 0",
                boxShadow: "0 -6px 24px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "center",
                  padding: "8px 0 2px",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedId(null)}
              >
                <div
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    background: "#E2E4E9",
                  }}
                />
              </div>
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 14px 0",
                }}
              >
                <span style={{ fontSize: 12, color: "#86868B" }}>
                  Edit component
                </span>
                <button
                  onClick={() => setSelectedId(null)}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "#86868B",
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <PropertiesPanel
                  comp={selected}
                  updateLive={updateLive}
                  commit={commitEdit}
                  layerInfo={{
                    isTop: selIndex === present.components.length - 1,
                    isBottom: selIndex === 0,
                  }}
                  actions={{
                    duplicate: duplicateSelected,
                    toggleLock: toggleLockSelected,
                    forward: () => reorderSelected(1),
                    backward: () => reorderSelected(-1),
                    remove: removeSelected,
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Main App                                                                 */
/* ---------------------------------------------------------------------- */

export default function InvoiceBuilder({ headerActions }) {
  const [templates, setTemplates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library"); // library | editor | invoice
  const [activeId, setActiveId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  // Load the signed-in user's templates from the API on mount.
  useEffect(() => {
    (async () => {
      const docs = await templatesApi.list();
      setTemplates(docs);
      setLoaded(true);
    })();
  }, []);

  const openEditor = (id, focusComponentId) => {
    setActiveId(id);
    setFocusId(focusComponentId || null);
    setView("editor");
  };
  const openInvoice = (id) => {
    setActiveId(id);
    setView("invoice");
  };

  const handleSaveFromEditor = async (name, schema) => {
    setSaveState("saving");
    try {
      const updatedDoc = await templatesApi.update(activeId, { name, schema });
      setTemplates((prev) =>
        prev.map((t) => (t.id === activeId ? updatedDoc : t)),
      );
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      alert("Could not save the template. Please try again.");
      return;
    }
    setTimeout(() => setSaveState("idle"), 1200);
    setView("library");
  };

  const handleDuplicate = async (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    try {
      const copy = await templatesApi.create({
        name: t.name + " Copy",
        schema: JSON.parse(JSON.stringify(t.schema)),
        isDefault: false,
      });
      setTemplates((prev) => [...prev, copy]);
    } catch {
      alert("Could not duplicate the template. Please try again.");
    }
  };
  const handleDelete = async (id) => {
    if (templates.length === 1) return;
    const ok = await templatesApi.remove(id);
    if (ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  };
  const handleSetDefault = async (id) => {
    const previousDefault = templates.find((t) => t.isDefault && t.id !== id);
    setTemplates((prev) => prev.map((t) => ({ ...t, isDefault: t.id === id })));
    await Promise.all([
      templatesApi.update(id, { isDefault: true }),
      previousDefault
        ? templatesApi.update(previousDefault.id, { isDefault: false })
        : null,
    ]);
  };
  const handleRename = async (id, name) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    await templatesApi.update(id, { name });
  };

  const handlePickPreset = async (preset) => {
    try {
      const t = await templatesApi.create({
        name: preset ? preset.name : "Untitled Template",
        schema: preset ? preset.build() : blankSchema(),
        isDefault: false,
      });
      setTemplates((prev) => [...prev, t]);
      const logoComp = t.schema.components.find(
        (c) => c.type === "image" && !c.props.src,
      );
      setShowPicker(false);
      openEditor(t.id, logoComp ? logoComp.id : null);
    } catch {
      alert("Could not create the template. Please try again.");
    }
  };

  const activeTemplate = templates.find((t) => t.id === activeId);

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        height: "100%",
        minHeight: 640,
        display: "flex",
        flexDirection: "column",
        background: "#F5F5F7",
        color: "#1D1D1F",
      }}
    >
      {view === "library" && (
        <>
          <div
            style={{
              height: 60,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 24px",
              borderBottom: "1px solid #E8E8ED",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "saturate(180%) blur(16px)",
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
                fontSize: 14.5,
                letterSpacing: -0.1,
                color: "#1D1D1F",
              }}
            >
              <LayoutTemplate size={17} color="#4F46E5" /> Invoice Editor
            </div>
            {headerActions}
          </div>
          {!loaded ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, ${THUMB_W}px)`,
                gap: 24,
                maxWidth: 1200,
                margin: "40px auto 0",
                padding: "0 40px",
              }}
            >
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div
                    className="skeleton"
                    style={{
                      width: THUMB_W,
                      height: THUMB_H,
                      borderRadius: 14,
                    }}
                  />
                  <div
                    className="skeleton"
                    style={{
                      width: "60%",
                      height: 14,
                      borderRadius: 4,
                      marginTop: 12,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <TemplatesLibrary
              templates={templates}
              onEdit={openEditor}
              onCreateInvoice={openInvoice}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              onRename={handleRename}
              onNew={() => setShowPicker(true)}
            />
          )}
          {showPicker && (
            <PresetPicker
              onPick={handlePickPreset}
              onClose={() => setShowPicker(false)}
            />
          )}
        </>
      )}

      {view === "editor" && activeTemplate && (
        <EditorView
          template={activeTemplate}
          onBack={() => setView("library")}
          onSave={handleSaveFromEditor}
          saveState={saveState}
          initialSelectedId={focusId}
        />
      )}

      {view === "invoice" && activeTemplate && (
        <InvoiceView
          template={activeTemplate}
          onBack={() => setView("library")}
        />
      )}
    </div>
  );
}
