# ForgeLabs BeatScope – 0.1.0

Valódi **Windowsra telepíthető Electron + Chromium alkalmazás**, nem honlap és nem PWA. Zenefájlból vagy mikrofonból valós idejű frekvenciaelemzést és vizualizációt készít, helyben a gépen. Nem igényel Base44-et, Vercelt, fiókot, felhőt vagy fizetős API-t.

## Telepítés adminjog nélkül

1. Csomagold ki a ZIP-et a **Letöltések** vagy **Dokumentumok** mappába.
2. A `ForgeLabs-BeatScope` mappában kattints duplán a **`Build-And-Install-Current-User.cmd`** fájlra.
3. A telepítő megpróbálja újrahasználni a ForgeLabs Browser által már letöltött Node.js v24.11.1 verziót innen: `%LOCALAPPDATA%\ForgeLabs\BrowserTools\node-v24.11.1-win-x64`.
4. Első alkalommal internet kell az Electron és az electron-builder csomagok letöltéséhez. A későbbi futtatáshoz nem kell Node.js és internet.
5. A build ellenőrzi a forráskódot és a teszteket, majd NSIS telepítőt és hordozható EXE-t készít a `dist` mappába.
6. A program a **saját Windows-felhasználói fiókod** számára települ (`%LOCALAPPDATA%\Programs\ForgeLabs BeatScope`). A gépházirend okozta esetleges tiltásokat nem kerülheti meg.

**Fontos:** A ZIP fejlesztői forrást és telepítőkészítő scriptet tartalmaz, nem előre lefordított exe-t. A Windowsos végső telepítőt a saját gépeden állítja elő.

## Használat

- Kattints a **Zenefájl** gombra, vagy húzz egy MP3/WAV/OGG/FLAC/M4A hangfájlt az ablakba. A Chromium által ténylegesen dekódolható formátumok támogatottak.
- Kattints a **Mikrofon** gombra az élő hangbemenethez. Csak a gombnyomás után kér mikrofonengedélyt; az alkalmazás nem rögzíti és nem tölti fel a hangot.
- Négy megjelenítés közül választhatsz: Spectrum Bars, Waveform, Orbit Pulse, Particles.
- Bal oldalt állíthatod a színpalettát, érzékenységet, simítást és a spektrum oszlopainak számát.
- Kép mentése: PNG-fájl a vizualizáció aktuális képkockájáról.
- A beállításokat a saját `%APPDATA%\forgelabs-beatscope` alkalmazásadat-mappába menti.
- **Nem** használja automatikusan a Windows rendszerhangját / más alkalmazások hangját; az első verzió zenefájlokra és mikrofonra korlátozódik.

## Billentyűk

| Billentyű | Funkció |
|---|---|
| Ctrl+O | Hangfájl megnyitása |
| Space | Lejátszás / szünet |
| 1 / 2 / 3 / 4 | Módváltás |
| F11 | Teljes képernyő |

## Biztonság és adatkezelés

A Web Audio API a gépen dolgozza fel a bemenetet. Nincs analitika vagy adatfeltöltés. Electron: context isolation, sandbox, nodeIntegration=false. A felület hálózati hozzáférése tiltva. A mikrofon streamje a kikapcsoláskor és az ablak bezárásakor leáll. A PNG-képet a felhasználó által választott helyre mentjük. A mikrofon engedélyezhetőségét befolyásolhatják a Windows adatvédelmi és rendszergazdai beállításai.

## Ellenőrzés / hibakeresés

A helyi forráskódhoz használhatod: `npm install`, `npm run check`, `npm start`. Az adminjog nélküli Windows build indítójában ezek automatikusan futnak. Ha az Electron telepítése sikertelen, másold ki a piros hibaüzenetet. A Node.js újratelepítése nem szükséges, ha a ForgeLabs Browser cache-e működik. A sárga `npm warn deprecated` üzenetek önmagukban nem végzetes hibák.

## Első kiadás korlátai

- Nem végez rendszerhang-loopback felvételt.
- Nincs automatikus BPM-felismerés és videóexport.
- A mikrofonhoz Windows vagy böngészőmotor-szintű engedély kellhet.
- Az alkalmazás tényleges Windowsos futtatása/telepítése a felhasználó Windows-gépén tesztelendő.

## GitHub Actions: kész Windows EXE közvetlen letöltéssel

A `.github/workflows/windows-exe.yml` workflow **GitHub Windows gépen** telepíti az Electron-függőségeket, lefuttatja a teszteket, elkészíti a Windows x64 NSIS telepítőt és egy portable EXE-t. A kiadott fájlok:

- `ForgeLabs-BeatScope-Setup-0.1.0-x64.exe` – telepítő, kizárólag az aktuális Windows-felhasználóhoz (`perMachine=false`, `allowElevation=false`), adminjog nélkül. A célmappa a normál felhasználói programtelepítési hely.
- `ForgeLabs-BeatScope-Portable-0.1.0-x64.exe` – hordozható alkalmazás, telepítés nélkül.

### Indítás GitHubon

1. Új repository: `ForgeLabs-BeatScope`, alapértelmezett branch `main`.
2. Töltsd fel a teljes forrást a rejtett `.github/workflows/windows-exe.yml` fájllal együtt.
3. A GitHub **Actions** fülén fut a `ForgeLabs BeatScope Windows EXE` workflow; a `Run workflow` gombbal később kézzel is újraindítható.
4. A sikeres build után a GitHub **Releases** fülén közvetlen `.exe` letöltési linkek jelennek meg, vagy az Actions run alatt **Artifacts** ZIP is elérhető.

Nincs szükség Node.js telepítésére a Windows-számítógépen a kész alkalmazás használatához. A telepítő aláíratlan; a Windows SmartScreen figyelmeztethet, és vállalati eszközök szabályzata megakadályozhatja a futtatást. A projekt nem próbál ilyen korlátozásokat megkerülni.
## v0.3.0 — 120 GPU-effekt

Az FX Library 20 különböző GLSL shader-algoritmust és algoritmusonként 6 konfigurációt (összesen 120 külön választható látványt) kínál. Ez **nem** a Resolume teljes effektmotorjának vagy 120 egymástól független algoritmusának másolata. Az alapeffektek a BeatScope eredeti 4 hangvizualizációjára kerülnek rá, WebGL2 GPU-utófeldolgozásként.

- **FX könyvtár · 120**: keresés, kategóriák, kedvencek (Ctrl+E).
- Max. 3 egymásra rakható effekt; sorrend, ki-/bekapcsolás, törlés.
- Dry/Wet és Strength csúszka effektenként.
- **AI FX Autopilot**: aktív hangnál az energiasávok alapján választ új látványt; sebességét a meglévő AI Visual Director sebességbeállítása vezérli.
- GIF/video export még nincs; a PNG mentés az effektelt képet is tartalmazza.
- Minimum **WebGL2** szükséges az FX-réteghez. Ha nem érhető el, a korábbi audio-vizualizátor változatlanul működik, és erről hibaüzenet jelenik meg.
- A képszerkesztő / shader működéséhez nincs külső AI API vagy fiók.

### v0.3.1 – javítás
A v0.3.0 kiadás az FX-réteg létrehozásakor a UI-inicializálás előtt hivatkozott a kezelőfelületre, ezért a gombok nem működtek. Ezt javítottuk. A WebGL2 visszacsatolás hibás framebuffer-másolását GPU blit alapú megoldásra cseréltük. A kiadást immár a teljes Electron alkalmazás indításával, a kezelőfelület tényleges kattintásaival, 120 effekt WebGL2-rajzolásával és egy háromrétegű effektlánccal ellenőrzi a Windows GitHub Actions.

## v0.4.0-alpha.1: VJ rétegek és Clip Deck – 1. rész

Elkészült a 8 réteg × 8 kliphely (64 hely) kezelőfelülete és az alapvető élő kompozíció-renderelés. A kliphelyre kattintva az ott lévő generátor indul; üres helyre a legördülő listában kiválasztott generátor kerül. Minden réteg külön indítható, Mute és Solo állítható, Opacity csúszkával módosítható és a ■ gombbal leállítható. A meglévő FX-könyvtár, hangelemzés és AI megmarad. Az új rétegbeállítások a meglévő felhasználói beállításokkal együtt mentődnek.

**Az első rész határa:** a kliphelyek egyelőre a 4 már működő generátorra épülnek. Videóimport, további különálló források, drag-and-drop, keverési módok és klipenkénti FX-lánc későbbi részek. A mostani v0.4 build **alpha**, nem a teljes Resolve/Resolume-szerű kiadás.

## v0.4.0-alpha.2 — 2. rész: hat új vizuálgenerátor

Hat különálló Canvas2D-algoritmus: **Neon Tunnel, Plasma Flow, Pulse Rings, Perspective Grid, Laser Fan, Warp Starfield**. A korábbi négy generátor változatlan marad, összesen **10 különböző vizuálforrás** választható az „Új klip” menüből, majd indítható a 8×8-as kliprácsban. Minden új forrás animálódik hang nélkül is, hang esetén a basszus, közép és magas tartományra reagál, és ugyanúgy részt vesz a több rétegből álló kompozícióban és a meglévő GPU FX-láncban.

Az Alpha 2-ben még nincs új médiaimport, önálló klipszintű effektlánc vagy MIDI-kimenet. A Windows/Electron grafikus teszt megrajzolja mind a hat új generátort, összehasonlítja az eredményüket, és a kliprácsban is elindítja őket. Az Alpha 1 beállításai és rétegei kompatibilisek maradnak.
