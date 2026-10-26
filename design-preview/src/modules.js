(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;if(root)root.LuminaModules=data;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const feature=(name,kind='action')=>({name,kind});
const M=[
{id:'dashboard',name:'Dashboard',icon:'▦',tag:'OVERVIEW',description:'Aktív munkaterület, rendszerállapot és gyorsműveletek',features:['Áttekintés','Aktív projekt','Utolsó preset','Gyorsműveletek','Rendszerállapot','Legutóbbi tevékenységek']},
{id:'simple',name:'Simple Mode',icon:'◈',tag:'QUICK PLAY',description:'Egyszerű zenére reagáló vizuálélmény – tervezett vezérlők',features:['Vizualizáció kiválasztása','Automatikus indítás','Egyszerű színbeállítások','Teljes képernyős nézet','Automatikus effektváltás']},
{id:'studio',name:'Pro VJ Studio',icon:'▥',tag:'LIVE WORKSPACE',description:'Professzionális réteges élővizuál-szerkesztő előnézete',features:['Többrétegű effektkeverés','Rétegek sorrendezése','Áttűnések és átmenetek','Élő vezérlés','Jelenetek','Effektek paraméterezése','Előnézeti és kimeneti monitor']},
{id:'library',name:'Visual Library',icon:'◫',tag:'VISUAL ASSETS',description:'Harminc tervezett vizuálkártya, kategóriák és keresés',features:['Legalább 30 beépített vizualizáció','2D/3D effektek','Kategóriák és keresés','Kedvencek','Saját vizualizációk','Importálás és exportálás','Effektcsomagok']},
{id:'designer',name:'Visual Designer',icon:'✳',tag:'CREATE',description:'Vizuálépítő munkafolyamat – tervezett funkciók',features:['Saját vizualizáció létrehozása','Rétegek','Színek','Animációk','Sebesség','Intenzitás','Audio-reakciók','Élő előnézet','Mentés és duplikálás','Saját vizualizációk hozzáadása']},
{id:'ai',name:'AI Visual Creator',icon:'✧',tag:'GENERATIVE LAB',description:'Három külön AI-generálási munkafolyamat kattintható terve',features:['Text to Visual','Image to Visual','AI Remix','AI-generálás','Előnézet','Módosítás','Mentés','PNG/JPG/WebP képfeltöltés','Zenei reaktivitás','Újragenerálás','Verziók kezelése']},
{id:'audio',name:'Audio Engine',icon:'≋',tag:'AUDIO INPUTS',description:'Hangforrások, analizátorok és ütemérzékelés terve',features:['Mikrofon','Rendszerhang','Hangfájl','BPM-felismerés','Basszus- és frekvenciaelemzés','Ütemérzékelés','Bemeneti érzékenység']},
{id:'mixer',name:'Effects & Mixer',icon:'⌘',tag:'FX CHAIN',description:'Effektláncok, keverés és automatizmusok terve',features:['Effektlista','Effektlánc','Rétegkeverés','Átmenetek','Automatikus effektváltás','AI-alapú effektválasztás','Kézi vezérlés']},
{id:'output',name:'Live Output',icon:'▣',tag:'MONITOR ROUTING',description:'Külön kimeneti és előnézeti képernyők vezérlőinek terve',features:['Fullscreen','Második monitor','Projektor','Kimeneti felbontás','FPS-beállítás','Előnézet','Kimenet indítása/leállítása']},
{id:'presets',name:'Preset Manager',icon:'▤',tag:'LIBRARY',description:'Később menthető profilok, presetek és visszaállítások',features:['Preset mentése','Betöltés','Import/export','Profilok','Kedvencek','Biztonsági mentések']},
{id:'core',name:'Core Control Center',icon:'◇',tag:'FORGELABS CORE',description:'A Core integráció arculathű, még nem aktív felülete',features:['ForgeLabs Core kapcsolat','Projektazonosítás','Jogosultságkezelés','Verziókövetés','Rendszerállapot','Naplók','Frissítések','Biztonsági beállítások']},
{id:'settings',name:'Settings',icon:'⚙',tag:'PREFERENCES',description:'Asztali beállítások és adapterek terve',features:['Általános beállítások','Nyelv','Megjelenés','Hang','Teljesítmény','Gyorsbillentyűk','Fájlkezelés','Automatikus indítás','Frissítések']},
{id:'beatscope',name:'BeatScope Modules',icon:'◉',tag:'COMPATIBILITY',description:'BeatScope-funkciók hivatkozási listája – a Preview-ba még nincsenek beépítve',features:['Az eredeti BeatScope összes funkciója','Meglévő effektek','Vizualizációs motor','BeatScope-beállítások','Kompatibilis presetek','Meglévő funkciók megőrzése']},
{id:'stats',name:'Statistics & Performance',icon:'▥',tag:'TELEMETRY',description:'A későbbi mérés és diagnosztika képernyői',features:['FPS','CPU- és GPU-terhelés','Hangelemzési adatok','Aktív effektek','Teljesítményfigyelés','Hibajelentések']}
];
const VISUALS=[
['Neon Tunnel','3D'],['Plasma Flow','Abstract'],['Pulse Rings','2D'],['Perspective Grid','3D'],['Laser Fan','Light'],['Warp Starfield','3D'],
['Spectrum Bars','Audio'],['Waveform','Audio'],['Orbit Pulse','Abstract'],['Particles','2D'],['Hex Matrix','2D'],['Digital Rain','2D'],
['Ribbon Flow','3D'],['Mandala Bloom','Abstract'],['Firefly Cloud','Nature'],['Electric Arcs','Light'],['Aurora Waves','Nature'],['Fractal Bloom','Abstract'],
['Wireframe Terrain','3D'],['Chromatic Echo','Abstract'],['Liquid Metal','3D'],['Glitch City','2D'],['Vortex Mirror','3D'],['Prism Sparks','Light'],
['Neon Typography','2D'],['Crystal Field','3D'],['Solar Flare','Nature'],['Audio Nebula','Audio'],['Kaleido Flux','Abstract'],['Strobe Matrix','Light']
].map(([name,category],index)=>({id:'visual-'+String(index+1).padStart(2,'0'),name,category,planned:true}));
const AI_WORKFLOWS=[
{name:'Text to Visual',description:'Prompt → generálás → előnézet → módosítás → mentés',fields:['Szöveges utasítás','Stílus','Animáció sebessége'],actions:['AI-generálás','Előnézet','Módosítás','Mentés']},
{name:'Image to Visual',description:'Kép → AI-animáció → zenereaktivitás → mentés',fields:['PNG / JPG / WebP feltöltés','Animáció módja','Audio-reakció'],actions:['Képfeltöltés','AI-animáció készítése','Előnézet','Mentés']},
{name:'AI Remix',description:'Meglévő vizualizáció → szöveges módosítás → verziók',fields:['Forrásvizuál','Szöveges módosítás','Remix intenzitás'],actions:['Újragenerálás','Verziók kezelése','Előnézet','Mentés']}
];
return Object.freeze({modules:Object.freeze(M),visuals:Object.freeze(VISUALS),aiWorkflows:Object.freeze(AI_WORKFLOWS),PLACEHOLDER:'Ez a funkció még nem működik – fejlesztés alatt.'});
});