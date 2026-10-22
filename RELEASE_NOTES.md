# Lumina Pulse | BeatScope Edition v0.4.0

**Stabil Windows x64-kiadás – nem Alpha/Beta tesztverzió.** A program belső ForgeLabs BeatScope azonosítója a korábbi felhasználói adatok és telepítések kompatibilitásához megmarad.

## Kész Windows fájlok

- **ForgeLabs-BeatScope-Setup-0.4.0-x64.exe** – telepítő saját Windows-felhasználóhoz, adminjog-kérés nélkül.
- **ForgeLabs-BeatScope-Portable-0.4.0-x64.exe** – hordozható alkalmazás, telepítés nélkül.
- **SHA256SUMS.txt** – két EXE ellenőrizhető SHA-256 lenyomatai.

## Fő funkciók

Simple Mode, Pro VJ Studio, 16 vizuálgenerátor, 120 WebGL2 GPU-effekt, keresés és kedvencek, 8×8 kliprács, Scene Launch, kézi BPM/kvantálás, Auto Scene, kép- és videóimport, Clip/Layer/Composition FX, helyi .beatscope projektmentés, külön preview és VJ-kimenet.

## Korlátok

- Az opcionális **WebRTC-kimenet továbbra is béta**; az alapértelmezett kompatibilis átviteli mód JPEG.
- A 60 FPS nem garantált, a GPU-effektekhez WebGL2 szükséges; egyes kodekeket a Chromium nem dekódol.
- Nincs teljes Resolume-paritás, professzionális MIDI/Link-szinkron vagy rendszerhang-loopback.
- A .beatscope csomagba legfeljebb **128 MiB** importált média kerülhet.
- A binárisok **nincsenek kódaláírva**; SmartScreen vagy iskolai/vállalati házirend figyelmeztethet vagy blokkolhat.
- Az automatikus Windows-teszt nem garantálja a kompatibilitást minden felhasználói GPU-val, monitorral vagy hangrendszerrel.

A GitHub kiadás csak sikeres egységtesztek, valódi Electron/GPU-teszt, két EXE build- és ellenőrzés, valamint SHA-256 hashgenerálás után készül.
