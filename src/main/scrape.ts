import { chromium } from 'playwright';
import type { Offer } from './types.js';

const BASE_URL = 'https://stapler.trafoe.de';
const LISTING_URL = (page: number) =>
  `${BASE_URL}/index.asp?lng=de&b_id=&k_id=33734&subk_id=&typ=all_product&page=${page}&breadcrumb=Gebrauchtstapler`;

function parseGermanNumber(text: string): number | null {
  const match = text.replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

// The source site's own backend double-encodes some free-text fields
// (UTF-8 bytes re-interpreted as Latin-1 and re-saved as UTF-8), producing
// mojibake like "Ã¶" for "ö". Reversing that byte reinterpretation recovers
// the original text; only applied when the input actually looks affected
// and the round-trip doesn't produce replacement characters, so clean text
// is never touched.
function fixMojibake(text: string): string {
  if (!/Ã[\x80-\xBF]/.test(text)) return text;
  const repaired = Buffer.from(text, 'latin1').toString('utf8');
  return repaired.includes('�') ? text : repaired;
}

function extractIdFromUrl(url: string): string {
  // IDs are delimited by literal "--" but may themselves contain single
  // hyphens (e.g. "EP15-03"), so split on "--" rather than matching [^-]+.
  const slug = url.split('/').pop() ?? url;
  const segments = slug.split('--');
  if (segments.length >= 3 && segments[segments.length - 1] === 'kaufen') {
    return segments[segments.length - 2];
  }
  return url;
}

interface RawCard {
  title: string;
  category: string;
  sideNotes: string;
  detailHref: string;
  images: string[];
  specs: { className: string; text: string }[];
  priceText: string;
}

async function scrapePage(page: import('playwright').Page): Promise<RawCard[]> {
  return page.evaluate(() => {
    const columns = Array.from(document.querySelectorAll('.device-list > div')).filter((col) =>
      col.querySelector('.device-card'),
    );

    return columns.map((col) => {
      const card = col.querySelector('.device-card')!;
      const title = card.querySelector('.card-title a')?.textContent?.trim() ?? '';
      const category = card.querySelector('.subtitle')?.textContent?.trim() ?? '';
      const sideNotes = card.querySelector('.side-notes')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const detailHref = card.querySelector('.card-title a')?.getAttribute('href') ?? '';
      const images = Array.from(card.querySelectorAll('.device-images img')).map(
        (img) => img.getAttribute('src') ?? '',
      );
      const specs = Array.from(card.querySelectorAll('.product-spec-list li')).map((li) => ({
        className: li.className,
        text: li.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      }));
      const priceText = col.querySelector('.device-price .price')?.childNodes[0]?.textContent?.trim() ?? '';

      return { title, category, sideNotes, detailHref, images, specs, priceText };
    });
  });
}

function toOffer(raw: RawCard): Offer {
  const specMap = Object.fromEntries(raw.specs.map((s) => [s.className, s.text]));
  const yearMatch = raw.sideNotes.match(/Baujahr:\s*(\d{4})/);

  return {
    id: extractIdFromUrl(raw.detailHref),
    title: raw.title,
    category: raw.category,
    year: yearMatch ? Number(yearMatch[1]) : 0,
    capacityKg: specMap['load-weight'] ? parseGermanNumber(specMap['load-weight']) : null,
    liftHeightMm: specMap['lift-weight'] ? parseGermanNumber(specMap['lift-weight']) : null,
    voltageV: specMap['volt'] ? parseGermanNumber(specMap['volt']) : null,
    operatingHours: specMap['time'] ? parseGermanNumber(specMap['time']) : null,
    priceNetEuro: parseGermanNumber(raw.priceText),
    images: raw.images,
    detailUrl: new URL(raw.detailHref, BASE_URL).toString(),
    specialEquipmentDescription: null,
  };
}

// Only present on each offer's detail page (not the listing cards), so this
// requires a separate page visit per offer.
async function fetchSpecialEquipmentDescription(page: import('playwright').Page, detailUrl: string): Promise<string | null> {
  await page.goto(detailUrl, { waitUntil: 'networkidle' });
  const raw = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('td'));
    const label = cells.find((td) => td.textContent?.trim() === 'Sonderausstattung Beschreibung');
    const text = label?.nextElementSibling?.textContent ?? null;
    return text ? text.replace(/\s+/g, ' ').trim() : null;
  });
  return raw ? fixMojibake(raw) : null;
}

export async function scrapeOffers(onProgress: (msg: string) => void = () => {}): Promise<Offer[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const offers: Offer[] = [];

  try {
    await page.goto(LISTING_URL(1), { waitUntil: 'networkidle' });

    const maxPage = await page.evaluate(() => {
      const numbers = Array.from(document.querySelectorAll('.pagination .page-numbers'))
        .map((el) => Number(el.textContent?.trim()))
        .filter((n) => !Number.isNaN(n));
      return numbers.length ? Math.max(...numbers) : 1;
    });

    for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
      if (pageNum > 1) {
        await page.goto(LISTING_URL(pageNum), { waitUntil: 'networkidle' });
      }
      const rawCards = await scrapePage(page);
      offers.push(...rawCards.map(toOffer));
      onProgress(`Seite ${pageNum}/${maxPage} gescraped: ${rawCards.length} Angebote`);
    }

    for (let i = 0; i < offers.length; i++) {
      offers[i].specialEquipmentDescription = await fetchSpecialEquipmentDescription(page, offers[i].detailUrl);
      onProgress(`Detailseite ${i + 1}/${offers.length} geladen: ${offers[i].id}`);
    }
  } finally {
    await browser.close();
  }

  return offers;
}
