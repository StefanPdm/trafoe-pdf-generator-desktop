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

Ergebnis: `release/TRAFOE-Katalog-Generator.exe` (portable, ~245 MB) plus
`release/Start-TRAFOE-Katalog-Generator.bat`.

**Portable-`.exe` statt Ordner/Zip — bewusste Kehrtwende.** Ursprünglich
wurde hier ein einfacher `dir`-Build (unkomprimierter Ordner, als Zip
weitergegeben) verwendet, weil eine selbstentpackende `.exe` naiv gebaut bei
*jedem* Start neu entpackt hätte. Der eigentliche Auslöser für den Wechsel
war aber ein anderes Problem: der `dir`-Build stürzt beim Start von einem
zentralen Netzlaufwerk zuverlässig ab (`STATUS_BREAKPOINT`/`0x80000003`) —
Chromiums Sandbox (für Electrons eigenes Fenster *und* für die von Playwright
gestarteten Scraping-/PDF-Render-Prozesse) verweigert das Laden von Images
von einem Netzwerkpfad aus Sicherheitsgründen, und zwar unabhängig davon, ob
das Netzlaufwerk als Laufwerksbuchstabe oder UNC-Pfad angesprochen wird.
`sandbox: false` hätte das umgangen, wäre aber ein echtes Sicherheitsrisiko
gewesen (zwei separate Chromium-Instanzen — Electron-Fenster und
Playwright-Browser — hätten ungeschützt auf die gescrapte Website
zugegriffen). Die sauberere Lösung: electron-builders `portable`-Target
(NSIS-basiert) entpackt sich beim Start selbst in ein **lokales**
Temp-Verzeichnis und läuft von dort aus — Sandbox bleibt für beide
Chromium-Instanzen vollständig intakt, und der Crash verschwindet komplett.
Das Entpacken passiert dabei nur beim *ersten* Start pro Build (nicht bei
jedem Start): `unpackDirName` ist standardmäßig ein Build-Hash, spätere
Starts derselben Version erkennen das bereits entpackte Verzeichnis wieder.

**Sichtbares Feedback beim ersten Start vom Netzlaufwerk.** Der NSIS-Splash
(`portable.splashImage`, `assets/splash.bmp`) zeigt einen Hinweis *während*
des Entpackens — kann aber selbst erst erscheinen, sobald die `.exe`
überhaupt anfängt zu laufen. Bei einer 245-MB-Datei auf einem Netzlaufwerk
braucht allein das (Netzwerk-Lesen + Viren-Scan der kompletten Datei, bevor
Windows sie überhaupt ausführen darf) mitunter 30+ Sekunden **ohne jede
Rückmeldung** — genug Zeit, dass jemand mehrfach doppelklickt.
`Start-TRAFOE-Katalog-Generator.bat` (wenige hundert Byte, dadurch quasi
ohne Scan-Verzögerung) zeigt sofort ein Konsolenfenster mit Hinweistext und
startet die eigentliche `.exe` erst danach im Hintergrund. Bei jedem Start
legt bzw. aktualisiert das Skript zusätzlich eine Desktop-Verknüpfung mit
korrektem lokalem Pfad an (eine `.lnk`-Datei speichert einen festen
absoluten Pfad, kann also nicht vorab mit ausgeliefert werden). Das Icon
dafür kommt bewusst aus der separaten, winzigen `Trafoe-Logo-small.ico` statt
aus der eingebetteten Ressource der `.exe` selbst — Icon-Extraktion aus der
245-MB-`.exe`, während die noch vom Netzlaufwerk gelesen/gescannt wird, hat
sich als unzuverlässig erwiesen (Verknüpfung wurde angelegt, blieb aber ohne
Icon).

Weitergabe an den Kollegen bzw. Ablage auf dem Netzlaufwerk:

1. Alle drei Dateien kopieren: `TRAFOE-Katalog-Generator.exe`,
   `Start-TRAFOE-Katalog-Generator.bat` **und** `Trafoe-Logo-small.ico`
   (müssen im selben Ordner liegen — das Batch-Skript findet beide anderen
   Dateien relativ zu seinem eigenen Pfad).
2. `Start-TRAFOE-Katalog-Generator.bat` starten (nicht direkt die `.exe`) —
   keine Installation, keine Adminrechte nötig.

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
  kommt aus `assets/logos/Trafoe-Logo-small.ico`, per `win.icon` in
  `package.json` — das lässt NSIS das Icon beim eigenen Kompilieren direkt
  einbetten, unabhängig von electron-builders `signAndEditExecutable`
  (bewusst `false`: das würde ein `winCodeSign`-Archiv laden, dessen
  Entpacken auf diesem Rechner an fehlenden Symlink-Rechten scheitert).
  **Wichtig:** den vendorten `scripts/vendor/rcedit-x64.exe` NICHT auf die
  fertige Portable-`.exe` anwenden — rcedit versteht NSIS' angehängten
  Payload-Bereich nicht und zerstört ihn (getestet: 257 MB → 64 KB).
