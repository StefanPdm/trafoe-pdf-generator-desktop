import fs from 'node:fs';
import path from 'node:path';
import type { BrandConfig, Offer } from './types.js';

const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');

// Local assets are inlined as data URIs: Playwright's page.setContent() runs
// pages at the about:blank origin, which Chromium does not grant file://
// read access to, so file:// src/href references silently fail to load.
function dataUri(relPath: string, mime: string): string {
  const bytes = fs.readFileSync(path.join(ASSETS_DIR, relPath));
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

const FONT_REGULAR = dataUri('fonts/daxlinewebpro.woff', 'font/woff');
const FONT_BOLD = dataUri('fonts/daxlinewebpro_bold.woff', 'font/woff');
const LOGO_TRAFOE = dataUri('logos/Trafoe_Logo_color.svg', 'image/svg+xml');
const LOGO_PARTNER = dataUri('logos/Linde-Trafoe_Logo.svg', 'image/svg+xml');

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const HEADER_HEIGHT_MM = 26;
export const FOOTER_HEIGHT_MM = 21;
// Chromium's print fragmentation across a multi-row flex-wrap container is
// unreliable: it sometimes clips a row's content instead of moving it to a
// new page rather than always paginating cleanly. So CARDS_PER_PAGE must be
// sized so that this many cards — even in the worst case (every card at max
// stats-wrapping height) — always fits within a single page's height with
// margin to spare, verified empirically, never relying on mid-chunk
// fragmentation happening correctly.
export const CARDS_PER_PAGE = 6;

export const TOC_START_MM = 120;
export const TOC_ROW_HEIGHT_MM = 11;
export const TOC_LEFT_MM = 25;
export const TOC_WIDTH_MM = PAGE_WIDTH_MM - TOC_LEFT_MM * 2;

function formatPrice(value: number | null): string {
  if (value === null) return 'auf Anfrage';
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (zzgl. MwSt)`;
}

// -webkit-line-clamp doesn't reliably clip overflow during Chromium's print
// rendering (empirically: a partial extra line can leak past the fixed-
// height box despite overflow: hidden), so truncation happens on the string
// itself instead. 190 chars is a safety margin under the empirically
// measured ~201-char limit for the .equipment-note box's fixed height/width.
const EQUIPMENT_NOTE_MAX_CHARS = 190;

function truncateDescription(text: string): string {
  if (text.length <= EQUIPMENT_NOTE_MAX_CHARS) return text;
  const cut = text.slice(0, EQUIPMENT_NOTE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

function sharedStyles(brand: BrandConfig): string {
  return `
  @font-face {
    font-family: 'DaxLine';
    src: url('${FONT_REGULAR}') format('woff');
    font-weight: 400;
  }
  @font-face {
    font-family: 'DaxLine';
    src: url('${FONT_BOLD}') format('woff');
    font-weight: 700;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'DaxLine', Arial, sans-serif;
    color: #262626;
  }
  .page-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: ${HEADER_HEIGHT_MM}mm;
    padding: 6mm 12mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid ${brand.primaryColor};
    background: white;
  }
  .page-header img { height: 12mm; }
  .page-header .doc-title { text-align: right; }
  .page-header .doc-title .pricelist-badge {
    display: inline-block; font-size: 7pt; font-weight: 700; letter-spacing: 0.5px;
    text-transform: uppercase; color: white; background: ${brand.primaryColor};
    padding: 1mm 2mm 0.5mm 2mm; border-radius: 1mm; margin-bottom: 1mm;
  }
  .page-header .doc-title h1 { font-size: 13pt; margin: 0; color: ${brand.primaryColor}; }
  .page-header .doc-title p { font-size: 8pt; margin: 1mm 0 0; color: #666; }
  .page-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: ${FOOTER_HEIGHT_MM}mm;
    padding: 2mm 12mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1mm;
    border-top: 1px solid #ddd;
    background: white;
    font-size: 7.5pt;
    color: #555;
  }
  .page-footer .footer-row { display: flex; justify-content: space-between; }
  .page-footer .footer-left { display: flex; flex-direction: column; gap: 0.3mm; }
  .page-footer .contact-person { text-align: right; font-weight: 700; color: ${brand.primaryColor}; }
  .page-footer .contact-person div:last-child { font-weight: 400; margin-top: 0.3mm; }
  .page-footer .locations { color: #999; font-size: 7pt; }
  .content {
    padding: ${HEADER_HEIGHT_MM + 1.5}mm 12mm ${FOOTER_HEIGHT_MM + 1.5}mm 12mm;
  }
`;
}

function headerFooterHtml(brand: BrandConfig, docTitle: string, priceListLabel: string): string {
  return `
  <div class="page-header">
    <img src="${LOGO_TRAFOE}" alt="${brand.companyName}">
    <div class="doc-title">
      <span class="pricelist-badge">${priceListLabel}</span>
      <h1>${docTitle}</h1>
      <p>Gebrauchtgeräte-Katalog · ${brand.website.replace('https://', '')}</p>
    </div>
  </div>
  <div class="page-footer">
    <div class="footer-row">
      <div class="footer-left">
        <span>${brand.companyName} · Tel. ${brand.phone} · ${brand.email}</span>
        <span class="locations">${brand.locations.join(' · ')} · Deutschland</span>
      </div>
      <div class="contact-person">
        <div>Ansprechpartner: ${brand.contactPerson.name} · Tel. ${brand.contactPerson.phone}</div>
        <div>Mobil: ${brand.contactPerson.mobile} · ${brand.contactPerson.email}</div>
      </div>
    </div>
  </div>`;
}

function pageChrome(
  brand: BrandConfig,
  docTitle: string,
  priceListLabel: string,
  bodyHtml: string,
): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>${sharedStyles(brand)}</style>
</head>
<body>
  ${headerFooterHtml(brand, docTitle, priceListLabel)}
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

const STAT_ICONS: Record<string, string> = {
  capacity: '⚖',
  lift: '↕',
  volt: '⚡',
  hours: '⏱',
};

function statItem(icon: string, value: string | null, unit: string): string {
  if (value === null) return '';
  return `<div class="stat"><span class="stat-icon">${icon}</span><span>${value} ${unit}</span></div>`;
}

function renderCard(offer: Offer): string {
  const mainImage = offer.images[0] ?? '';
  const photoCount = offer.images.length;

  return `
  <div class="card">
    <div class="card-image">
      <img src="${mainImage}" alt="${offer.title}">
      ${photoCount ? `<span class="photo-badge">📷 ${photoCount}</span>` : ''}
    </div>
    <div class="card-body">
      <span class="subtitle">${offer.category}</span>
      <h3>${offer.title}</h3>
      <p class="side-notes">ID: ${offer.id}${offer.year ? ` · Baujahr: ${offer.year}` : ''}</p>
      <div class="stats">
        ${statItem(STAT_ICONS.capacity, offer.capacityKg?.toLocaleString('de-DE') ?? null, 'kg')}
        ${statItem(STAT_ICONS.lift, offer.liftHeightMm?.toLocaleString('de-DE') ?? null, 'mm')}
        ${statItem(STAT_ICONS.volt, offer.voltageV?.toString() ?? null, 'V')}
        ${statItem(STAT_ICONS.hours, offer.operatingHours?.toLocaleString('de-DE') ?? null, 'h')}
      </div>
      <p class="equipment-note">${offer.specialEquipmentDescription ? truncateDescription(offer.specialEquipmentDescription) : ''}</p>
      <p class="price">${formatPrice(offer.priceNetEuro)}</p>
      <a class="cta" href="${offer.detailUrl}">mehr Details</a>
    </div>
  </div>`;
}

function cardStyles(brand: BrandConfig): string {
  return `
  <style>
    .category-heading { font-size: 14pt; color: ${brand.primaryColor}; margin: 0 0 1.5mm; }
    /* CARDS_PER_PAGE is capped at exactly one row's worth of cards, so this
       flex-wrap container never actually needs to fragment across pages —
       Chromium's print fragmentation of multi-row flex content is unreliable
       (empirically: it sometimes clips a row instead of moving it to a new
       page rather than always paginating cleanly), so the reliable fix is to
       never ask it to. */
    .grid { display: flex; flex-wrap: wrap; gap: 4mm; }
    .card {
      width: calc((100% - 8mm) / 3);
      border: 1px solid #ddd;
      border-radius: 2mm;
      overflow: hidden;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
    }
    .card-image { position: relative; height: 75mm; background: #f2f2f2; }
    .card-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-badge {
      position: absolute; top: 2mm; right: 2mm;
      background: rgba(0,0,0,0.55); color: white;
      font-size: 6.5pt; padding: 0.5mm 1.5mm; border-radius: 1mm;
    }
    .card-body { padding: 1.5mm 2.5mm; flex: 1; display: flex; flex-direction: column; }
    .subtitle { font-size: 6.5pt; text-transform: uppercase; color: #999; letter-spacing: 0.3px; }
    .card-body h3 { font-size: 10pt; margin: 0.5mm 0; }
    .side-notes { font-size: 6.5pt; color: #777; margin: 0 0 1mm; }
    .stats {
      display: flex; flex-wrap: wrap; gap: 1mm 2mm;
      background: #f7f7f7; border-radius: 1.5mm;
      padding: 1mm; margin-bottom: 1mm; font-size: 7pt;
    }
    .stat { display: flex; align-items: center; gap: 1mm; }
    .stat-icon { color: ${brand.primaryColor}; }
    .equipment-note {
      /* Fixed height (not max-height) so it reserves the same space whether
         the offer has a long description, a short one, or none at all —
         combined with .cta's margin-top: auto below, this keeps "mehr
         Details" at an identical distance from the card's bottom border on
         every card, regardless of description length or stats wrapping.
         Truncation happens on the string itself (see truncateDescription) —
         -webkit-line-clamp doesn't reliably clip overflow during Chromium's
         print rendering, so overflow: hidden here is just a backstop. */
      font-size: 6pt; color: #777; line-height: 1.15; margin: 0 0 1mm;
      height: 10mm;
      overflow: hidden;
    }
    .price { font-size: 9pt; font-weight: 700; margin: 0 0 1mm; text-align: center; }
    .cta {
      display: block; text-align: center; text-decoration: none;
      background: ${brand.primaryColor}; color: white; font-weight: 700;
      font-size: 7.5pt; padding: 1.3mm; border-radius: 1mm;
      margin-top: auto;
    }
  </style>
`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Renders exactly one physical page (at most CARDS_PER_PAGE cards). Each
// page is rendered as its own standalone Playwright PDF print job rather
// than relying on Chromium's page-break-after to fragment one long
// document — position: fixed headers/footers do not reliably repeat past a
// manually forced page break within a single print job, only across
// organic content-overflow breaks, so a "page per call" architecture is
// what actually guarantees the header/footer on every page.
export function renderCategoryPageHtml(
  brand: BrandConfig,
  category: string,
  totalCount: number,
  offers: Offer[],
  priceListLabel: string,
  showHeading: boolean,
): string {
  const cards = offers.map(renderCard).join('\n');
  const body = `
    ${cardStyles(brand)}
    ${showHeading ? `<h2 class="category-heading">${category} (${totalCount})</h2>` : ''}
    <div class="grid">${cards}</div>
  `;
  return pageChrome(brand, category, priceListLabel, body);
}

export function renderCoverHtml(
  brand: BrandConfig,
  generatedOn: string,
  categories: { name: string; count: number }[],
  priceListLabel: string,
  brandFilterLabel: string | null,
): string {
  // TOC rows are positioned absolutely from the page's top-left origin (not
  // nested in any offset container) so pdf-lib can compute matching link
  // annotation rects in PDF point-space after rendering.
  const tocRows = categories
    .map(
      (c, i) => `
      <div class="toc-row" style="top: ${TOC_START_MM + i * TOC_ROW_HEIGHT_MM}mm;">
        <span class="toc-name">${c.name}</span>
        <span class="toc-dots"></span>
        <span class="toc-count">${c.count} Gerät${c.count === 1 ? '' : 'e'}</span>
        <span class="toc-chevron">&#8250;</span>
      </div>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  ${sharedStyles(brand)}
  .page-canvas { position: relative; width: ${PAGE_WIDTH_MM}mm; height: ${PAGE_HEIGHT_MM}mm; }
  .cover-hero { position: absolute; top: 40mm; left: 0; right: 0; text-align: center; }
  .cover-hero img { height: 22mm; margin-bottom: 8mm; }
  .cover-hero h1 { font-size: 24pt; color: ${brand.primaryColor}; margin: 0; }
  .cover-hero p { font-size: 11pt; color: #666; margin: 3mm 0 0; }
  .toc-heading {
    position: absolute; top: ${TOC_START_MM - 12}mm; left: ${TOC_LEFT_MM - 12}mm;
    font-size: 12pt; color: ${brand.primaryColor}; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .toc-hint {
    position: absolute; top: ${TOC_START_MM - 6.5}mm; left: ${TOC_LEFT_MM - 12}mm;
    font-size: 8pt; font-style: italic; color: #999;
  }
  .toc-row {
    position: absolute; left: ${TOC_LEFT_MM - 12}mm; width: ${TOC_WIDTH_MM}mm; height: ${TOC_ROW_HEIGHT_MM}mm;
    display: flex; align-items: center; font-size: 11pt;
  }
  .toc-name { white-space: nowrap; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #ccc; margin: 0 2mm; height: 1px; align-self: flex-end; margin-bottom: 1.5mm; }
  .toc-count { color: #777; font-size: 9.5pt; white-space: nowrap; }
  .toc-chevron { color: ${brand.primaryColor}; font-size: 12pt; font-weight: 700; margin-left: 2mm; }
</style>
</head>
<body>
  ${headerFooterHtml(brand, 'Übersicht', priceListLabel)}
  <div class="page-canvas">
    <div class="cover-hero">
      <img src="${LOGO_PARTNER}" alt="${brand.companyName}">
      <h1>Gebrauchtstapler-Katalog${brandFilterLabel ? ` (${brandFilterLabel})` : ''}</h1>
      <p>Stand: ${generatedOn} · ${brand.locations.join(' · ')} · Deutschland</p>
    </div>
    <div class="toc-heading">Inhalt</div>
    <div class="toc-hint">*Interaktives Verzeichnis: Bitte klicken Sie auf eine Kategorie, um direkt zur Seite zu springen.</div>
    ${tocRows}
  </div>
</body>
</html>`;
}
