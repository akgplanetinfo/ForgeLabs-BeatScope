'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createManifest } = require('../scripts/release-candidate.cjs');
function fixture(dir, name) {
  const file = path.join(dir, name);
  const b = Buffer.alloc(4096, 0);
  b.write('MZ'); b.writeUInt32LE(0x100, 0x3c); b.write('PE\u0000\u0000', 0x100);
  fs.writeFileSync(file, b); return file;
}
function dir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'forgelabs-release-test-')); }
test('Lumina prerelease creates disabled candidate', t => {
  const root=dir(); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const exe=fixture(root,'ForgeLabs-BeatScope-Setup-0.4.0-alpha.17-x64.exe');
  const manifest=createManifest({appId:'lumina',version:'0.4.0-alpha.17',channel:'beta',files:[exe],output:path.join(root,'manifest.json')});
  assert.equal(manifest.distributionEnabled,false);
  assert.equal(manifest.installerVerifiedPerUser,false);
  assert.equal(manifest.packages[0].sha256.length,64);
  assert.equal(manifest.packages[0].kind,'installer-unverified');
});
test('M32R build creates disabled candidate',t => {
  const root=dir(); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const exe=fixture(root,'ForgeLabs-M32R-Live-Recall-Setup-3.5.0.exe');
  const manifest=createManifest({appId:'m32r',version:'3.5.0',channel:'beta',files:[exe],output:path.join(root,'manifest.json')});
  assert.equal(manifest.packages.length,1);
  assert.equal(manifest.status,'candidate-only');
});
test('stable cannot contain prerelease version', t => {
  const root=dir(); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  assert.throws(()=>createManifest({appId:'lumina',version:'0.4.0-alpha.17',channel:'stable',files:[fixture(root,'Setup.exe')],output:path.join(root,'m.json')}),/Prerelease/);
});
test('invalid PE rejected with no report', t => {
  const root=dir(); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const p=path.join(root,'bad.exe'); fs.writeFileSync(p,Buffer.alloc(4096));
  const out=path.join(root,'manifest.json');
  assert.throws(()=>createManifest({appId:'m32r',version:'3.5.0',channel:'beta',files:[p],output:out}),/MZ/);
  assert.equal(fs.existsSync(out),false);
});
test('non EXE rejected', t => {
  const root=dir(); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const p=path.join(root,'file.txt'); fs.writeFileSync(p,'hello');
  assert.throws(()=>createManifest({appId:'m32r',version:'3.5.0',channel:'beta',files:[p],output:path.join(root,'m.json')}),/Only EXE/);
});
