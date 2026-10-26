# Lumina Pulse 2.0 – Tesztterv és átadási jelentés

## Követelmény → ellenőrzés
| SRS | Teszt / bizonyíték |
|---|---|
| 1. Windows EXE indul | `npm run dist:win` és Windows Electron smoke test |
| 2. Arculat | Fekete/cián, döntött logó/tipográfia; képernyőmentés |
| 3–5. 14 modul és almenük | Adatmodell-teszt és minden menü megnyitása |
| 6. Fejlesztés alatti üzenet | Pontos magyar szöveg ellenőrzése |
| 7. Simple/Pro VJ | Valódi kattintási teszt |
| 8. Animált előnézet | Canvas méret és képernyőmentés ellenőrzése |
| 9. Navigáció | Vissza és 14 modulra váltás |
| 10. Indítási hiba nélkül | Natív Electron Windows smoke; nincs SetTextColor-hívás |
| 11. Windows UI-teszt | `test-results.json` |
| 12. Demó megjelölése | Állandó DESIGN PREVIEW figyelmeztetés |

## Kiértékelés
A tényleges **PASS/FAIL eredményeket a Windows GitHub Actions** generálja és `test-results.json` fájlba írja. A puszta forráskód létrehozása **nem** jelenti az EXE-átadás teljesítését. Csak sikeres CI-build után nevezhető ellenőrzöttnek.

## Tudatos korlátozások
- A 30 Visual Library elem dizájnkoncepció; nem 30 külön videó- vagy generátormotor.
- A három AI-útvonal megnyitható, de nem generál.
- A Core- és BeatScope-panel még nem valós kapcsolat.
- Az animált háttér nem mikrofon- vagy rendszerhang-reaktív.
- A weboldali arculatból származó távbetűtípusok nincsnek letöltve.
- Kódaláírás nélkül a Windows jelezhet ismeretlen kiadót.
