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

## v0.4.0-alpha.3 — 3. rész: vizuálforrások és klipparaméterek

További **6 új, önálló generátor**: Hex Matrix, Digital Rain, Ribbon Flow, Mandala Bloom, Firefly Cloud és Electric Arcs. Így a korábbi forrásokkal együtt 16 választható generátor működik.

A **KLIP PARAMÉTEREK** panel az aktív réteg aktív klipjéhez tartozik: Speed 0,1–4×, Scale 40–200%, Rotation −180°–180° és Audio Reactivity 0–200%. A paraméterek **klipenként külön** vannak tárolva és az Electron-felhasználói beállításokba mentve; egy másik klip beállítása nem írja felül őket. A forgatás/méret a teljes klipre, a sebesség a belső animáció időalapjára, az érzékenység a hangvezérelt paraméterekre hat. Természetesen a Spectrum Bars vagy Waveform pillanatnyi megjelenését a sebesség nem gyorsítja, mert ezeknek nincs önálló időalapú animációja.

A frissített Windowsos Electron grafikus teszt új forrásokat renderel, kipróbálja a kliprács indítását, valamint a paraméterek megőrzését, mentését és visszaállítását.

## v0.4.0-alpha.4 — 4. rész: Scene Launch és klipkezelés

A 8×8 kliprács felett minden oszlophoz egy **Scene Launch** gomb tartozik. A gomb az oszlopban lévő klipeket az összes érintett rétegen egyszerre indítja. Az üres oszlophelyek nem állítják le az addig futó klipeket.

**Klipkezelés:** bal kattintás indítja és kiválasztja a klipet, jobb kattintás a helyi szerkesztőmenüt nyitja. A kiválasztott klip másolható, kivágható, beilleszthető, duplikálható a következő üres helyre és törölhető. A szerkesztősávon is megtalálhatók ezek a gombok. A szerkesztő gyorsbillentyűi: Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Delete (amikor nem egy szövegbeviteli mező aktív). A foglalt klip húzással másik helyre tehető; foglalt célpont esetén helyet cserélnek. Az effekt-/generátorparaméterek a klippel együtt másolódnak.

A v0.4 Alpha 4 továbbra is **részkiadás**. A videóimport, deckváltás, klipenkénti FX és profi időzítési lehetőségek későbbi fejlesztési feladatok. Az automatizált Windows-tesztek a klipkezelést és a mentés visszaolvasását is ellenőrzik.

## v0.4.0-alpha.5 — 5. rész: klipenkénti FX-lánc

Az aktív/kiemelt kliphez külön FX-lánc rendelhető a CLIP FX CHAIN panelen. A 120 eddigi GPU-effekt közül választhatsz; klipenként legfeljebb 3 aktív effekt fér a láncba ebben az első részkiadásban, egyedi Dry/Wet és Strength paraméterekkel, be-/kikapcsolással, sorrendmozgatással, törléssel és teljes klip-FX Bypass-szal. Az effektlánc **a klippel együtt másolódik, duplikálódik és mozgatható**. A program minden klip beállítását és FX-láncát tartósan menti; a v0.4 Alpha 4 adatai automatikusan kompatibilisek.

A hatás renderelése **rétegenként**, a kompozícióba keverés előtt történik, igény szerint létrehozott WebGL2 processzorral. A teljes kompozíció korábbi globális FX-lánca külön megmarad és utána fut. A GPU-feldolgozás hibájánál a réteg nyers vizuálját próbálja megjeleníteni. A klip FX-lánca egyelőre három effektig bővíthető, és minden réteg számára legfeljebb egy WebGL-feldolgozót tart fenn.

Ez részkiadás; az egymástól független több deck, clip/Layer/Composition FX-könyvtár egyablakos vezérlése, videófájl-import és tetszőleges hosszúságú láncok később érkeznek.

## v0.4.0-alpha.6 — 6. rész: Layer FX (rétegenkénti effektláncok)

A kiválasztott réteg a CLIP DECK területén külön **LAYER FX CHAIN** panelt kapott. 120 effektváltozat közül választható legfeljebb 3 effekt a mostani részkiadásban; Dry/Wet, Strength, sorrend, be-/kikapcsolás, eltávolítás és Bypass állítható, mind tartósan mentve. A réteg effektei **minden rajta lejátszott klipre** érvényesek, és nem másolódnak át másik rétegbe klipáthelyezéskor.

Feldolgozási sorrend: **Clip FX → Layer FX → Composition FX**. A réteg FX a klip saját GPU-feldolgozása után, de a többi réteggel való keverés előtt fut. A GPU processzorokat igény szerint hozza létre; nem aktív FX esetén az eddigi rajzolási út működik. Az előző verziók klipjei és rétegei automatikusan üres layer FX lánccal töltődnek vissza.

Ez még mindig részleges VJ-rendszer, nem teljes Resolume-helyettesítő; a hosszabb effektsorok, médiaimport, csoportok, blend mode és deckek későbbi mérföldkövek.

## v0.4.0-alpha.7 — 7. rész: Blend Modes és rétegsorrend

A kiválasztott réteg **LAYER MIXER** panelen 8 valódi Canvas 2D keverési módot kap: Screen, Normal, Add, Multiply, Overlay, Difference, Lighten és Darken. Külön réteg-Opacity csúszka látható (szinkronizálva a CLIP DECK rétegsor csúszkájával), valamint Feljebb/Lejjebb gombokkal átrendezhető a teljes réteg.

Keverési módok Canvas-megfeleltetése: Normal → source-over, Add → lighter, a további hat mód a megfelelő natív Canvas operation. A történelmi **Screen** az alapértelmezett, ezért régi munkamenetek változatlanul nyílnak. A rétegek sorrendje a klipjeikkel, aktív lejátszásukkal, klip- és réteg-FX láncukkal együtt mozog; a GPU-visszacsatolás réteghez tartozó gyorsítótára szintén helyet cserél. A műveleteket és beállításokat a meglévő preferenciafájl menti.

A keverési mód **a réteg aktuális vizuálforrására**, illetve az abból képzett klip+réteg GPU-effektes képére hat, mielőtt a globális kompozíció FX fut. A teszt a nyolc keverési mód különböző képpont-eredményét, a UI-változtatásokat, a mentést és a tényleges rajzolási útvonalat ellenőrzi.

Ez egy lezárt alpha-részkiadás; a médiaklipek, deckek és projektszintű kompozíciómentés további lépések.

## v0.4.0-alpha.8 — 8. rész: importált kép- és videoklipek

A **CLIP DECK** panelen új **+ Kép / videó** gomb található. A felhasználó által kiválasztott fájlt az Electron a helyi felhasználói adatok mappájának **beatscope-media** almappájába másolja, és egy biztonságosan ellenőrzött azonosítóval látja el. A fájl nem kerül felhőbe. A klip a kiválasztott réteg következő üres helyére kerül; a program sosem ír felül automatikusan meglévő klipet. A képek és videók a Scene Launch és klipkezelés részei, és a meglévő klip- és réteg-FX láncokon, réteg-Opacity, Blend Mode, méret és forgatás beállításokon keresztül jelennek meg.

**Képek:** PNG, JPG/JPEG, WebP, GIF. A képet a program a rendelkezésre álló területre középre illeszti, a képarány megtartásával és szükség esetén levágással (cover). **Videók:** MP4, WebM, M4V, MOV, csak a Windows Electron/Chromium által ténylegesen dekódolható kodekekkel. A videók némítva, ismétléssel indulnak, lejátszási sebességük a klip Speed paramétere; külön hangsáv-import vagy videó-hangkeverés még nincs. Nem támogatott kodek esetén a program hibát jelez. A videódekódolás és a 60 FPS nem garantálható minden formátumon és GPU-n.

Az új médiaklip a korábbi beállításfájlba menti a fájl biztonságos azonosítóját és megjelenített nevét, így az alkalmazás újraindítása után is használható. A klipek copy/paste és duplikálás esetén ugyanarra a helyi importált médiafájlra hivatkoznak, nem többszörözik meg a lemezen. A régi 16 generátor változatlanul megmarad. A régi projektek migrációja nem veszít adatot; a médiafájlok fizikai áthelyezését külön későbbi médiakezelő modul oldhatja meg.

Az import a natív Windows fájlválasztóval működik. A rendszer csak előre engedélyezett kiterjesztéseket és legfeljebb 2 GB-os helyi fájlokat fogad el. A renderer nem kap tetszőleges Windows fájlútvonalat, a helyi médiaprotokoll csak a saját médiakönyvtárban található érvényes azonosítókat szolgálja ki. A média importálása offline is működik. Ez a részkiadás még nem tudja a videók In/Out pontjait, visszafelé lejátszását, media relinkinget vagy külső kimenetre exportálását.

A Windowsos teszt az importált PNG-t a valódi Electron fájlválasztó-IPC-n keresztül hozza be, ellenőrzi a tartós fájlt, kirajzolást, klipsorban indítást, másolást és beállítások mentését. A videóformátumok MIME- és adatmodell-ellenőrzést kapnak; eltérő kodekek dekódolási kompatibilitását továbbra is külön gépen szükséges ellenőrizni.

## v0.4.0-alpha.9 — 9. rész: VIDEO TRANSPORT – Loop, In/Out, Speed, Seek

A CLIP DECK-ben kiválasztott **videokliphez** megjelenik a VIDEO TRANSPORT panel, amely a következő funkciókat biztosítja:

- **Loop:** a kijelölt In/Out szakasz ismétlése, alapértelmezetten be. Kikapcsolva a videó az Out ponthoz érve szünetel, és az utolsó képkocka látható marad.
- **In és Out pontok:** másodpercben szerkeszthetők (0,1 másodperces lépésköz). A „← fej” gomb a videó aktuális pozícióját használja; reset visszaállítja a teljes videóhosszt. Az Out pont alapértelmezetten a fájl végpontja.
- **Timeline / Seek:** a videó pozícióját mutatja; a csúszkán kattintva a kijelölt szakaszon belül keres.
- **Speed:** 0,1–4×, ugyanaz az érték, mint a Klip Paraméterek panelen. A két szabályzó egymással szinkronban van.
- **Play / Pause és Restart:** a kiválasztott klip külön vezérelhető; a Restart az In ponttól indít.

A Loop, az In/Out és a Speed értékek klipenként külön tárolódnak az Electron helyi beállításfájljában. Klipek másolásakor, duplikálásakor és rétegek átrendezésekor megmaradnak; a régi v0.4-es médiaklipek automatikusan az alapértelmezett (teljes hossz, Loop be) értékeket kapják. A lejátszó a klip- és réteg-FX-ek előtt dolgozik, változatlanul helyi videofájlokkal.

**Korlátok:** a videó hangja jelenleg továbbra is némítva van. Egyes MOV/MP4 kodekeket a Chromium nem dekódol; a program csak a valóban támogatott kodekekkel használható. Nem támogatja a reverse playbacket és az idővonalvezérlés más videoklipekkel közös BPM-quantization funkcióját. A Loop pontos képkockára történő mintavétele hardvertől és kodektől függ.

A Windowsos teszt nemcsak az állapotlogikát ellenőrzi: egy **1,625 másodperces, valódi VP8 WebM videót** importál, dekódol, kirajzol a vászonra, megvizsgálja az In/Out-nál történő megállítást és a Loop újraindulását, majd ellenőrzi a vezérlőpanelt és az adatok tartós mentését.

## v0.4.0-alpha.10 — 10. rész: BPM-szinkronizált klip- és Scene Launch

A **BEAT SYNC** panel kézi BPM-beállítást (40–240), **Tap Tempo** gombot, ütemfázis-resetet, négy LED-es 4/4 ütemjelzőt és a kvantált indítás következő opcióit kínálja: **OFF**, **1/4 beat**, **1 beat**, **2 beat**, **4 beat / 1 bar**. A funkció offline működik; a Tap Tempo legalább három következetes koppintás alapján méri a tempót. A BPM kézi érték (vagy Tap Tempo eredmény), nem automatikusan megbecsült ütemrács vagy MIDI clock.

Kvantálás esetén a klipre vagy Scene Launch gombra kattintás **a következő ütemhatárra ütemez**. Addig az aktuális klipek játszanak tovább. A várakozó klipek/jelenetek sárgás szegélyt kapnak; egy rétegen az újonnan kiválasztott klip felülírja az ugyanarra a rétegre váró korábbit, a Scene Launch az összes rétegen közös ütemhatárt használ. A **Várakozás törlése** gomb minden várakozó indítást töröl. A STOP az érintett réteghez tartozó várakozást is visszavonja.

BPM-, kvantálás- vagy fázismódosításkor a program újraszámolja a sorban álló indítás időpontját. Az **OFF** visszaállítja az előző verziók azonnali működését, így nem változtatja meg a korábban megszokott klipkezelést. A BPM és kvantálás a felhasználói preferenciafájlba mentődik. A várakozó klipindítások csak futás közbeni állapotok, újraindítás után nem lesznek várakozó indítások.

A kvantálást a BeatScope saját, stabil `performance.now()` óraalapja vezérli, és a klipek a rajzolási ciklusban indulnak. A megjelenítés és a fájl-/videólejátszás időzítésének pontossága a Windows ütemezőjétől és a videó dekódolásától függ; professzionális MIDI/Link/DJ beatgrid szinkron, automatikus ritmusfelismerés és sample-pontos indítás még nincs. A meglévő 16 generátor, klipmédia-import, Loop/In/Out/Speed, Clip FX, Layer FX és globális FX továbbra is működik.

A tesztek validálják az ütemhatárok időszámítását, Tap Tempo becslést, a Windowsos Electron UI-n keresztül a sorba állított klip/jelenet késleltetett indítását, a várakozás törlését, a régi azonnali módot és a beállítások mentését.
