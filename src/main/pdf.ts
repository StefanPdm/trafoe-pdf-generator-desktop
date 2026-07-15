import { chromium } from 'playwright';
import { PDFDocument, PDFHexString, PDFName, PDFRef } from 'pdf-lib';
import type { BrandConfig, Offer } from './types.js';
import {
  CARDS_PER_PAGE,
  PAGE_HEIGHT_MM,
  chunk,
  renderCategoryPageHtml,
  renderCoverHtml,
  TOC_LEFT_MM,
  TOC_ROW_HEIGHT_MM,
  TOC_START_MM,
  TOC_WIDTH_MM,
} from './template.js';

const MM_TO_PT = 72 / 25.4;
const mmToPt = (mm: number) => mm * MM_TO_PT;

function groupByCategory(offers: Offer[]): Map<string, Offer[]> {
  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    const key = offer.category || 'Sonstige';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(offer);
  }
  return groups;
}

function addOutline(pdfDoc: PDFDocument, items: { title: string; pageRef: PDFRef }[]) {
  const context = pdfDoc.context;
  const outlineRef = context.nextRef();
  const itemRefs = items.map(() => context.nextRef());

  items.forEach((item, i) => {
    const dict = context.obj({
      Title: PDFHexString.fromText(item.title),
      Parent: outlineRef,
      Dest: [item.pageRef, 'Fit'],
      ...(i > 0 ? { Prev: itemRefs[i - 1] } : {}),
      ...(i < items.length - 1 ? { Next: itemRefs[i + 1] } : {}),
    });
    context.assign(itemRefs[i], dict);
  });

  context.assign(
    outlineRef,
    context.obj({
      Type: 'Outlines',
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: items.length,
    }),
  );

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef);
  pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

function addLinkAnnotation(
  pdfDoc: PDFDocument,
  page: import('pdf-lib').PDFPage,
  rect: [number, number, number, number],
  targetPageRef: PDFRef,
) {
  const context = pdfDoc.context;
  const annotRef = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: rect,
      Border: [0, 0, 0],
      Dest: [targetPageRef, 'Fit'],
    }),
  );
  const existing = page.node.lookup(PDFName.of('Annots'));
  const existingRefs = existing ? (existing as any).asArray() : [];
  const annots = context.obj([...existingRefs, annotRef]);
  page.node.set(PDFName.of('Annots'), annots);
}

async function renderPdfBuffer(browser: import('playwright').Browser, html: string): Promise<Buffer> {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await page.close();
  return buffer;
}

export async function buildCatalogPdf(
  offers: Offer[],
  brand: BrandConfig,
  priceListLabel: string,
  onProgress: (msg: string) => void = () => {},
  brandFilterLabel: string | null = null,
): Promise<Buffer> {
  const browser = await chromium.launch();
  const groups = [...groupByCategory(offers).entries()].sort((a, b) => b[1].length - a[1].length);
  const totalPages = groups.reduce((sum, [, list]) => sum + chunk(list, CARDS_PER_PAGE).length, 0);

  const generatedOn = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
  const coverHtml = renderCoverHtml(
    brand,
    generatedOn,
    groups.map(([name, list]) => ({ name, count: list.length })),
    priceListLabel,
    brandFilterLabel,
  );

  // Each page is its own Playwright print job (see renderCategoryPageHtml),
  // so a category with >9 offers produces multiple single-page buffers here
  // rather than one multi-page buffer.
  let coverBuf: Buffer;
  const categoryPageBuffers: { category: string; buf: Buffer }[] = [];
  try {
    onProgress('Rendere Deckblatt...');
    coverBuf = await renderPdfBuffer(browser, coverHtml);
    let pageCounter = 0;
    for (const [category, list] of groups) {
      const pages = chunk(list, CARDS_PER_PAGE);
      for (let i = 0; i < pages.length; i++) {
        pageCounter++;
        onProgress(`Rendere Seite ${pageCounter}/${totalPages}: ${category}`);
        const html = renderCategoryPageHtml(brand, category, list.length, pages[i], priceListLabel, i === 0);
        const buf = await renderPdfBuffer(browser, html);
        categoryPageBuffers.push({ category, buf });
      }
    }
  } finally {
    await browser.close();
  }

  const finalDoc = await PDFDocument.create();

  const coverSrc = await PDFDocument.load(coverBuf);
  const [coverPage] = await finalDoc.copyPages(coverSrc, [0]);
  finalDoc.addPage(coverPage);

  const sectionStart: { category: string; pageRef: PDFRef }[] = [];
  const seenCategories = new Set<string>();
  for (const { category, buf } of categoryPageBuffers) {
    const srcDoc = await PDFDocument.load(buf);
    const copiedPages = await finalDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    const firstPageRef = copiedPages[0].ref;
    for (const p of copiedPages) finalDoc.addPage(p);
    if (!seenCategories.has(category)) {
      seenCategories.add(category);
      sectionStart.push({ category, pageRef: firstPageRef });
    }
  }

  addOutline(
    finalDoc,
    sectionStart.map((s) => ({ title: s.category, pageRef: s.pageRef })),
  );

  const pageHeightPt = mmToPt(PAGE_HEIGHT_MM);
  sectionStart.forEach((section, i) => {
    const topMm = TOC_START_MM + i * TOC_ROW_HEIGHT_MM;
    const bottomMm = topMm + TOC_ROW_HEIGHT_MM;
    const rect: [number, number, number, number] = [
      mmToPt(TOC_LEFT_MM - 12),
      pageHeightPt - mmToPt(bottomMm),
      mmToPt(TOC_LEFT_MM - 12 + TOC_WIDTH_MM),
      pageHeightPt - mmToPt(topMm),
    ];
    addLinkAnnotation(finalDoc, coverPage, rect, section.pageRef);
  });

  return Buffer.from(await finalDoc.save());
}
