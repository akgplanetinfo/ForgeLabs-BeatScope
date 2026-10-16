'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Lumina Pulse branding is integrated into the actual BeatScope renderer',()=>{
 const html=read('index.html'),theme=read('src/lumina-theme.css');
 assert.match(html,/<title>Lumina Pulse \| BeatScope Edition<\/title>/);
 assert.match(html,/LUMINA <span>PULSE<\/span>/);
 assert.match(html,/href="src\/lumina-theme.css"/);
 assert.match(theme,/#00d3f2/i);
 assert.match(theme,/Space Grotesk/);
 for(const id of ['visualizer','clip-grid','window-close','open-output','vj-import-media'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
test('Backward compatibility keeps original project, media and user-data identifiers',()=>{
 const pkg=JSON.parse(read('package.json'));const main=read('src/main.cjs');
 assert.equal(pkg.build.appId,'team.forgelabs.beatscope');
 assert.equal(pkg.build.nsis.perMachine,false);
 assert.match(main,/preferences\.json/);
 assert.match(main,/beatscope-media/);
});