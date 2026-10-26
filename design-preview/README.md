# Lumina Pulse 2.0 – Design Preview
**ForgeLabs · BeatScope Edition** · `2.0.0-preview.1`

Ez a projekt a Lumina Pulse 2.0 teljes, kattintható **dizájnprototípusa**, nem audio-/AI-/VJ-éles alkalmazás.

## Biztonság és hatókör
- A Lumina Pulse weboldal fekete, elektromos ciánkék, döntött, szögletes stílusát követi. A referenciaweboldal forrásában Space Grotesk / Inter látható; a Design Preview offline működése miatt rendszerbetűtípusokkal helyettesítjük ezeket.
- **Nincs** aktív AI-generálás, hangfeldolgozás, rendszerhang-felvétel, Core-kapcsolat, felhőszolgáltatás, frissítés, telepítés vagy publikálás.
- Minden még nem megvalósított művelet üzenete: **„Ez a funkció még nem működik – fejlesztés alatt.”**
- 14 nyitható modul és minden SRS szerinti almenüpont, külön 30 vizuálkoncepció, három AI-tervező munkafolyamat.
- A központi előnézet **animált, hang nélkül működő demó**. A Simple / Pro nézet, visszalépés, keresés, kategóriaszűrés, AI-fülek és demócsúszkák kattinthatók.
- A BeatScope v0.4.0 forráskódját és funkcióit összevetési alapként használja, **de még nem tartalmazza az eredeti BeatScope audio- és vizualizációs motorját**. A BeatScope Modules panel ennek a későbbi integrációnak az előnézete.
- A ForgeLabs Core továbbra is külön, **offline demópanel**. Bejelentkezés, token és API-kérés nincs.

## Windows EXE
Kimeneti fájlnév:
`Lumina-Pulse-2.0-Design-Preview-x64.exe`

A hordozható EXE felhasználói jogosultsággal indítható Windows 10/11 x64 alatt, ha az eszköz rendszerszabályzatai engedik. Nem igényel telepítői adminjogot. Digitálisan nincs aláírva, ezért SmartScreen / vállalati házirend figyelmeztethet.

A forrás **különálló**: az eredeti ForgeLabs BeatScope EXE nem szükséges az elindításhoz. A Design Preview modern Electron + HTML/CSS/JavaScript felületet használ, nem natív Win32 listboxokat.

## Helyi build
```bash
cd design-preview
npm install
npm run check
npm start
npm run dist:win
```
Windows alatt a `dist/` mappában megjelenik a Portable EXE.

A forráskód bármely operációs rendszeren szerkeszthető; macOS/Linux csomagokat csak későbbi fázisban építünk. Az OS-függő ablakkezelés külön `src/main.cjs` adapterben van.

## Modulok
1. Dashboard
2. Simple Mode
3. Pro VJ Studio
4. Visual Library
5. Visual Designer
6. AI Visual Creator (Text to Visual, Image to Visual, AI Remix)
7. Audio Engine
8. Effects & Mixer
9. Live Output
10. Preset Manager
11. Core Control Center
12. Settings
13. BeatScope Modules
14. Statistics & Performance

A modulok részletes alfunkciói a `src/modules.js` fájlban, adatalapon szerepelnek, ezért a további fázisokban egyenként működő komponenssé fejleszthetők.

## Build és teszt
A `.github/workflows/lumina-design-preview.yml` csak a `feature/lumina-2-design-preview` fejlesztési ágra készít Windows EXE-t, nincs production módosítás, Vercel deploy vagy automatikus nyilvános GitHub Release.

A CI:
1. ellenőrzi a JavaScript-forrásokat és az SRS adatkészletét;
2. valódi Windows Electronban indítja el a programot;
3. megnyitja mind a 14 modult, ellenőrzi minden funkció megjelenését;
4. ellenőrzi a 30 vizuálkártyát, keresést és a 3 AI-módot;
5. teszteli a Simple/Pro váltást, navigációt, a figyelmeztetést és az animált előnézetet;
6. Portable EXE-t épít, méretét és SHA256 értékét ellenőrzi.

Az eredmény `test-results.json`, `preview-screenshot.png` és EXE formában GitHub Actions artefaktumként érhető el.

**Ez Design Preview: nem bizonyítja, hogy a teljes Lumina Pulse 2.0 összes működő funkciója elkészült.**
