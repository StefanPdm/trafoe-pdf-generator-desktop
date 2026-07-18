import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { app, BrowserWindow, ipcMain, shell } from 'electron';

// Must be set before requiring './scrape' or './pdf' — both pull in
// 'playwright', which reads this env var when ITS module first loads, not
// lazily inside launch() as a now-corrected comment here used to claim.
// Setting it after those imports (even though still "before createWindow")
// was too late: playwright had already cached the default global browsers
// path (%LOCALAPPDATA%\ms-playwright) by then, so the packaged app silently
// ignored its own bundled resources\ms-playwright and only worked by
// accident on machines that already had a browser cached globally.
const browsersPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ms-playwright')
  : path.join(app.getAppPath(), 'ms-playwright');
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

import { scrapeOffers } from './scrape';
import { buildCatalogPdf } from './pdf';
import brand from './brand.config.json';
import type { Offer } from './types';

const CACHE_PATH = path.join(app.getPath('userData'), 'offers-cache.json');
const OUTPUT_DIR = path.join(app.getPath('documents'), 'TRAFÖ Kataloge');
const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'logos', 'Trafoe-Logo-small.png');
const VERSION_PATH = path.join(__dirname, '..', '..', 'VERSION');
const appVersion = readFileSync(VERSION_PATH, 'utf-8').trim();

type PriceListKey = 'haendler' | 'kunde';
type BrandFilterKey = 'all' | 'linde' | 'baoli';

interface BuildOptions {
  priceList: PriceListKey;
  discountPercent?: number;
  brandFilter: BrandFilterKey;
  useCache: boolean;
}

const DEFAULT_DISCOUNT_PERCENT = 10;

const PRICE_LIST_LABELS: Record<PriceListKey, string> = {
  haendler: 'Händlerpreisliste',
  kunde: 'Kundenpreisliste',
};

const PRICE_LIST_FILE_SEGMENT: Record<PriceListKey, string> = {
  haendler: 'Händler',
  kunde: 'Kunden',
};

const BRAND_FILTER_LABELS: Record<BrandFilterKey, string> = {
  all: 'Linde und Baoli',
  linde: 'Nur Linde',
  baoli: 'Nur Baoli',
};

const BRAND_FILTER_HERO_LABEL: Record<BrandFilterKey, string | null> = {
  all: null,
  linde: 'Linde',
  baoli: 'Baoli',
};

const BRAND_FILTER_FILE_SEGMENT: Record<BrandFilterKey, string> = {
  all: 'Gesamt',
  linde: 'Linde',
  baoli: 'Baoli',
};

function filterOffersByBrand(offers: Offer[], filter: BrandFilterKey): Offer[] {
  if (filter === 'all') return offers;
  return offers.filter((offer) => offer.title.trim().toLowerCase().startsWith(filter));
}

function applyDiscount(offers: Offer[], percent: number): Offer[] {
  const factor = 1 - percent / 100;
  return offers.map((offer) => ({
    ...offer,
    priceNetEuro: offer.priceNetEuro === null ? null : Math.round(offer.priceNetEuro * factor * 100) / 100,
  }));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 720,
    height: 830,
    useContentSize: true,
    resizable: false,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('catalog:build', async (event, options: BuildOptions) => {
  const send = (msg: string) => event.sender.send('catalog:progress', msg);

  let offers: Offer[];
  if (options.useCache) {
    send('Verwende zwischengespeicherte Daten...');
    offers = JSON.parse(await fs.readFile(CACHE_PATH, 'utf-8'));
  } else {
    send('Scrape Angebote von stapler.trafoe.de...');
    offers = await scrapeOffers(send);
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(offers, null, 2), 'utf-8');
  }

  offers = filterOffersByBrand(offers, options.brandFilter);
  send(`Marken: ${BRAND_FILTER_LABELS[options.brandFilter]} (${offers.length} Angebote)`);

  let priceListLabel = PRICE_LIST_LABELS[options.priceList];
  let discount: number | undefined;
  if (options.priceList === 'haendler') {
    discount = options.discountPercent ?? DEFAULT_DISCOUNT_PERCENT;
    discount = Math.min(100, Math.max(0, discount));
    offers = applyDiscount(offers, discount);
    priceListLabel = `${priceListLabel} - ${discount}`;
    send(`Preisabschlag: ${discount}%`);
  }

  send(`Erstelle PDF-Katalog mit ${offers.length} Geräten...`);
  const pdfBuffer = await buildCatalogPdf(offers, brand, priceListLabel, send, BRAND_FILTER_HERO_LABEL[options.brandFilter]);

  const dateStr = new Date().toISOString().slice(0, 10);
  const priceSegment =
    options.priceList === 'haendler' ? `${PRICE_LIST_FILE_SEGMENT.haendler}-${discount}` : PRICE_LIST_FILE_SEGMENT.kunde;
  const fileName = `Trafö-Gebrauchtgeräte-${priceSegment}-${BRAND_FILTER_FILE_SEGMENT[options.brandFilter]}-${dateStr}.pdf`;
  const outPath = path.join(OUTPUT_DIR, fileName);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, pdfBuffer);
  send(`Fertig: ${offers.length} Geräte gespeichert unter ${outPath}`);

  return { outPath, offerCount: offers.length };
});

ipcMain.handle('shell:showItemInFolder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('app:getVersion', () => appVersion);
