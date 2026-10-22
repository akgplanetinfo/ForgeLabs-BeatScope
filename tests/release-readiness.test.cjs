'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const pkg=JSON.parse(read('package.json'));
test('stable version and backwards-compatible user-level packaging',()=>{
 assert.equal(pkg.version,'0.4.0');
 assert.equal(pkg.build.appId,'team.forgelabs.beatscope');
 assert.equal(pkg.build.productName,'ForgeLabs BeatScope');
 assert.equal(pkg.build.nsis.perMachine,false);
 assert.equal(pkg.build.nsis.allowElevation,false);
 assert.equal(pkg.build.nsis.packElevateHelper,false);
 assert.deepEqual(pkg.build.win.target,['nsis','portable']);
});
test('stable Lumina Pulse UI branding and version marker',()=>{
 assert.ok(read('index.html').includes('v0.4.0 · STABLE'));
 assert.ok(read('index.html').includes('Lumina Pulse | BeatScope Edition'));
 assert.ok(read('src/main.cjs').includes('Lumina Pulse | BeatScope Edition'));
});
test('release follows full tests, Windows build, checksum and main protection',()=>{
 const ci=read('.github/workflows/windows-exe.yml');
 const names=['Check source and run tests','Test real Electron UI and GPU shader rendering','Build Windows installer and portable application','Verify generated EXE files','Generate SHA256 checksums for verified binaries','Save EXE build as workflow artifact','Create GitHub Release with direct EXE downloads'];
 const ix=names.map(s=>ci.indexOf('name: '+s));
 assert.ok(ix.every(n=>n>=0)&&ix.every((n,i)=>i===0||n>ix[i-1]));
 assert.ok(ci.includes("if: github.ref == 'refs/heads/main'"));
 assert.ok(ci.includes('dist/SHA256SUMS.txt'));
 assert.ok(ci.includes('--notes-file RELEASE_NOTES.md'));
});
test('release notes include verified downloads and user caveats',()=>{
 const n=read('RELEASE_NOTES.md');
 for(const part of ['Setup-0.4.0-x64.exe','Portable-0.4.0-x64.exe','128 MiB','WebRTC-kimenet továbbra is béta','nincsenek kódaláírva'])assert.ok(n.includes(part),part);
 assert.ok(read('README.md').includes('releases/tag/v0.4.0'));
});
