'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
test('valódi Windows Electron app',()=>{assert.match(pkg.main,/main\.cjs/);assert.ok(pkg.devDependencies.electron);assert.match(pkg.scripts['dist:win'],/--win nsis portable --x64/);});
test('telepítő egyetlen saját felhasználónak, rendszergazda nélkül',()=>{assert.equal(pkg.build.nsis.perMachine,false);assert.equal(pkg.build.nsis.allowElevation,false);assert.equal(pkg.build.nsis.packElevateHelper,false);});
test('a korábban letöltött Node.js cache felhasználása',()=>{let p=read('Build-Windows.ps1');assert.match(p,/ForgeLabs\\BrowserTools/);assert.match(p,/npm-cli\.js/);assert.match(p,/Test-NodeInstallation/);assert.match(p,/Get-Command/);});
test('alapvető Electron biztonsági beállítások',()=>{const c=read('src/main.cjs');assert.match(c,/contextIsolation:true/);assert.match(c,/nodeIntegration:false/);assert.match(c,/sandbox:true/);assert.match(c,/setWindowOpenHandler/);});
test('hangfeldolgozás helyben, nincs beépített hálózati endpoint',()=>{const c=read('index.html');assert.match(c,/connect-src 'none'/);assert.ok(!c.includes('https://'));});
test('négy vizuális mód létezik',()=>{const html=read('index.html');for(const name of ['bars','wave','orbit','particles'])assert.match(html,new RegExp('data-mode="'+name+'"'));});
test('zenefájl és mikrofon gomb bekötve',()=>{const html=read('index.html'),ui=read('src/ui.js');assert.ok(html.includes('id="audio-file"'));assert.match(ui,/getUserMedia/);assert.match(ui,/URL\.createObjectURL/);});
test('file + mic audio erőforrások takarítása',()=>{const ui=read('src/ui.js');assert.match(ui,/getTracks\(\)/);assert.match(ui,/track\.stop\(\)/);assert.match(ui,/URL\.revokeObjectURL/);});
test('kötelező kezelőszervek kötve vannak',()=>{const ui=read('src/ui.js');for(const id of ['open-file','play-pause','microphone','seek','volume','fullscreen','save-image','window-close'])assert.ok(ui.includes(id),id);});
test('magyar nyelv, helyi beállítások és PNG export',()=>{const html=read('index.html'),c=read('src/main.cjs');assert.match(html,/lang="hu"/);assert.match(c,/preferences\.json/);assert.match(c,/showSaveDialog/);});

test('audio initializálás csatlakoztatja a vizualizáló analizátort',()=>{const ui=read('src/ui.js');assert.match(ui,/refreshAnalyser\(\);\s*return audioCtx/);});