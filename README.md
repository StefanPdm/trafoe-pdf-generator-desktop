# TRAFÖ Katalog Generator (Desktop)

Windows-Desktop-App mit Button-UI: scraped stapler.trafoe.de und erstellt den
PDF-Katalog. Läuft komplett eigenständig auf jedem Windows-Rechner, ganz ohne
vorinstalliertes Node.js — die App bringt Node (via Electron) und den
benötigten Chromium-Browser (via Playwright) selbst mit.

## Entwicklung

```sh
npm install
npm run install-browsers   # lädt Chromium einmalig nach ./ms-playwright
npm start                  # baut TypeScript und startet die App
```

In der App: Preisliste wählen (Händler/Kunde), optional "Zwischengespeicherte
Daten verwenden" für schnelle Testläufe ohne erneutes Scrapen, dann auf
"Katalog erstellen" klicken. Das PDF landet unter
`Dokumente\TRAFOE Kataloge\trafoe-katalog-<Datum>.pdf`.

## Build für Kollegen ohne Node.js

```sh
npm install
npm run install-browsers
npm run dist
```

Ergebnis: `release/TRAFOE-Katalog-Generator.zip`.

**Bewusst kein Installer/portable-.exe:** Ein einzelner selbstentpackender
Installer bzw. eine "portable" `.exe` muss den kompletten gebündelten
Chromium-Browser (hunderte Einzeldateien, ~400 MB) bei *jedem* Start bzw.
bei der Installation neu entpacken — das dauerte in Tests 90+ Sekunden
scheinbar tatenlosen Wartens (kurzer Spinner, dann lange nichts), selbst
ganz ohne aktiven Virenscanner. Das `dir`-Target umgeht das: die Zip-Datei
wird **einmal** ganz regulär per Windows-Explorer entpackt (mit sichtbarem
Fortschrittsbalken, ca. 20–30 s), und jeder weitere Start der `.exe` aus
dem entpackten Ordner dauert dann nur noch 2–4 Sekunden.

Weitergabe an den Kollegen:

1. `TRAFOE-Katalog-Generator.zip` kopieren.
2. Mit Rechtsklick → "Alle extrahieren..." entpacken — **an einen kurzen Pfad
   nah am Laufwerks-Root** (z. B. `C:\TRAFOE\`), nicht tief verschachtelt
   (z. B. nicht in `Dokumente\...\Downloads\...`). Electron bündelt intern
   einige eingebaute Chromium-Erweiterungen mit sehr langen, tief
   verschachtelten Ressourcen-Pfaden (z. B.
   `reading_mode_gdocs_helper\_locales\en\...`) — kombiniert mit einem langen
   Zielpfad überschreitet das Windows' 260-Zeichen-Pfadlimit, und der
   Explorer-Entpacker bricht mit "Pfad zu lang" (Fehler 0x80010135) ab. Nicht
   direkt aus dem Zip heraus starten.
3. Im entpackten Ordner `TRAFOE Katalog Generator` die Datei
   `TRAFOE Katalog Generator.exe` starten — keine Installation, keine
   Adminrechte nötig.

## Architektur

- `src/main/` — Electron-Main-Prozess plus die Scraping-/PDF-Logik
  (`scrape.ts`, `template.ts`, `pdf.ts`, `types.ts`), 1:1 übernommen aus dem
  CLI-Projekt `pdf-catalog-generator-cli` (siehe dort für Details zu den
  Chromium-Print-Eigenheiten, die die Seitenlayout-Architektur bestimmen).
- `src/renderer/` — einfache HTML/JS-Oberfläche (kein Build-Schritt nötig,
  wird beim `npm run build` unverändert nach `app/renderer` kopiert).
- Eigener TS-Build-Output liegt in `app/` (nicht `dist/`), damit er nicht mit
  electron-builders Ausgabeordner `release/` kollidiert.
- Ausgabe- und Cache-Pfade liegen bewusst außerhalb des Programmordners
  (`app.getPath('documents')` / `app.getPath('userData')`), da der entpackte
  Ordner z. B. unter "Programme" liegen und dort nicht beschreibbar sein kann.
- `npm run install-browsers` entfernt nach dem Download automatisch `ffmpeg`
  aus `ms-playwright/` — wird vom Code nicht verwendet (keine
  Videoaufzeichnung) und würde nur unnötig Größe/Dateianzahl erhöhen.
  `chromium-headless-shell` bleibt dagegen erhalten: Playwrights
  `chromium.launch()` ohne Optionen (headless, genau das, was der Code
  aufruft) lädt in aktuellen Playwright-Versionen diese Binary, nicht das
  reguläre Chromium — wurde sie entfernt, schlägt das Scraping/PDF-Rendering
  auf jedem Rechner ohne bereits gefüllten globalen Playwright-Cache fehl
  (genau das ist einem Kollegen mit einer frisch entpackten Version
  passiert).
- Fenster-/Taskleisten-Icon kommt aus `assets/logos/Trafoe-Logo-small.png`
  (per `icon`-Option beim `BrowserWindow`). Das Icon der `.exe`-Datei selbst
  (wie sie im Explorer angezeigt wird) bleibt das Standard-Electron-Icon:
  das Einbetten via `rcedit` erfordert electron-builders
  `signAndEditExecutable`, was wiederum ein `winCodeSign`-Archiv lädt, dessen
  Entpacken auf diesem Rechner an fehlenden Symlink-Rechten scheitert (siehe
  `signAndEditExecutable: false` in der `build.win`-Konfiguration).
