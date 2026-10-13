(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeatFX=api;})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
// 20 shader families with 6 artistically different profiles = 120 selectable effect looks.
const FAMILIES=[
 ['Színek','Hue Rotate',['Sunrise','Aurora','Chromaflow','Spectrum Storm','Deep Space','Spectrum Drift']],
 ['Színek','RGB Split',['Ghost','Iris','Drift','Stereo','Spectrum Echo','Chromatic Crash']],
 ['Geometria','Kaleidoscope',['Triangle','Mirror Six','Octa','Crystal','Starburst','Mandala']],
 ['Geometria','Reflection',['Left-Right','Top-Bottom','Quad','Split Double','Prism Fold','Infinite Mirror']],
 ['Torzítás','Vortex',['Gentle Twist','Slow Spin','Spiral','Hypnotic','Whirlpool','Twister']],
 ['Torzítás','Wave Warp',['Soft Wave','Cross Waves','Waterline','Double Helix','Sine Storm','Liquid']],
 ['Torzítás','Ripples',['Pond','Echo Rings','Bass Wave','Ripple Field','Shockwave','Tide']],
 ['Torzítás','Lens Warp',['Soft Lens','Bulge','Pinch','Fish Eye','Orbital Lens','Warp Core']],
 ['Stílus','Pixelation',['Mosaic Fine','Mosaic','Retro','Big Blocks','Pixel Meltdown','Pixel Pulse']],
 ['Stílus','Halftone',['Dot Print','Color Newspaper','Cross Dots','Screen Tone','Big Dots','Pop Art']],
 ['Fény','Edge Glow',['White Outline','Electric Blue','Glowing Edges','Neon Detail','Cyber Trace','Outline Storm']],
 ['Retro','CRT Scan',['Thin Scan','Analog TV','Old Monitor','RGB Raster','CRT Deep','VHS Night']],
 ['Glitch','Datamosh',['Tiny Jitter','Line Glitch','Digital Tear','Signal Loss','Static Drift','Bad Transmission']],
 ['Glitch','Film Grain',['Soft Grain','Dust','Snow','Blue Noise','Pixel Noise','Dither Storm']],
 ['Fény','Radial Bloom',['Light Rays','Halo','Light Burst','Star Rays','Bass Bloom','Radiance']],
 ['Fény','Motion Smear',['Ghost Blur','Horizontal Blur','Vertical Blur','Directional','Soft Trail','Speed Lines']],
 ['Színek','Prism',['Warm Prism','Spectral Prism','Vivid Crystal','Double Dispersion','Iridescent','Hyperspectral']],
 ['Geometria','Tunnel',['Corridor','Deep Tunnel','Warp Gate','Psychedelic','Zoom Flux','Infinity']],
 ['Minták','Grid Overlay',['Checker','Fine Grid','Pixel Wire','Circular Grid','Laser Matrix','Pulse Lattice']],
 ['Mozgás','Feedback Echo',['Soft Echo','Long Exposure','Color Trails','Delay Blur','Digital Ghost','Infinite Trails']]
];
const LIBRARY=Object.freeze(FAMILIES.flatMap((f,family)=>f[2].map((variantName,variant)=>Object.freeze({id:'fx-'+String(family*6+variant+1).padStart(3,'0'),family,variant,category:f[0],name:f[1]+' · '+variantName,description:f[1]+' – '+variantName+'; hangvezérelt intenzitás'}))));
function byId(id){return LIBRARY.find(f=>f.id===id)||null;}
function recommend(features,excluded=[],seed=0){const a=Math.max(0,features?.bass||0),m=Math.max(0,features?.mids||0),h=Math.max(0,features?.highs||0);const candidates=a>.44?[2,6,14,17,19,4]:h>.34?[1,10,12,16,9,13]:m>.24?[3,5,8,11,15,18]:[0,7,9,10,14,19];const selected=candidates.map((f,i)=>LIBRARY[f*6+((seed+i*3)%6)]).filter(f=>!excluded.includes(f.id));return selected[seed%Math.max(1,selected.length)]||LIBRARY[(seed*13+47)%LIBRARY.length];}
const VERT=`#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FRAG=`#version 300 es
precision highp float;precision highp int;
in vec2 uv;out vec4 frag;
uniform sampler2D tex;uniform sampler2D prevTex;
uniform vec2 res;uniform vec4 snd;uniform float tm;uniform float strength;uniform float wet;uniform int family;uniform int variant;
#define PI 3.141592653589793
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 sampleAt(vec2 p){return texture(tex,clamp(p,vec2(.001),vec2(.999))).rgb;}
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
void main(){
 float v=float(variant);vec2 p=uv-.5;float ar=res.x/max(1.,res.y);float a=clamp(strength,0.,2.);float beat=clamp(snd.x*1.6+snd.w*.6,0.,1.);vec2 q=uv;
 vec3 c=sampleAt(uv);vec3 outc=c;
 if(family==0){vec3 hsv=rgb2hsv(c);hsv.x=fract(hsv.x+(.09+.11*v)*a+sin(tm*(.12+v*.09))*.12*beat);hsv.y=clamp(hsv.y*(.88+v*.11),0.,1.);outc=hsv2rgb(hsv);}
 else if(family==1){float shift=(.0015+.0016*v)*a*(1.+beat*2.);vec2 o=vec2(cos(v*1.04+tm*.3),sin(v*1.04+tm*.3))*shift;outc=vec3(sampleAt(q+o).r,sampleAt(q).g,sampleAt(q-o).b);}
 else if(family==2){vec2 d=vec2(p.x*ar,p.y);float r=length(d);float side=2.*PI/(3.+v*2.);float angle=abs(mod(atan(d.y,d.x)+tm*.035*(1.+v),side)-side*.5);vec2 pos=vec2(cos(angle),sin(angle))*r;q=vec2(pos.x/ar,pos.y)+.5;outc=sampleAt(q);}
 else if(family==3){if(variant==0)q.x=abs(p.x)+.5;if(variant==1)q.y=abs(p.y)+.5;if(variant==2)q=abs(p)+.5;if(variant==3)q=1.-abs(p*2.);if(variant==4)q=fract(abs(p*3.))*2.-.5;if(variant==5)q=.5+abs(sin(p*6.+tm*.2))*.45;outc=sampleAt(q);}
 else if(family==4){float r=length(p*vec2(ar,1.));float angle=atan(p.y,p.x)+a*(.35+v*.35)*exp(-r*3.)*(1.+beat*.7);q=.5+vec2(cos(angle),sin(angle))*length(p);outc=sampleAt(q);}
 else if(family==5){float k=5.+v*3.;if(variant==0)q.x+=sin(uv.y*k+tm*2.)*.02*a;if(variant==1)q.y+=sin(uv.x*k+tm*1.7)*.025*a;if(variant==2)q+=vec2(sin(uv.y*k+tm),cos(uv.x*k-tm))*.017*a;if(variant==3)q.x+=sin(uv.y*k+sin(uv.y*7.+tm))*.04*a;if(variant==4)q+=vec2(sin(uv.y*k+tm*4.),sin(uv.x*k-tm*3.))*.027*a;if(variant==5)q+=vec2(sin(uv.y*k+tm)+cos(uv.x*11.-tm*2.),sin(uv.x*k+tm))*.024*a;outc=sampleAt(q);}
 else if(family==6){float r=length(vec2(p.x*ar,p.y));float phase=r*(18.+v*11.)-tm*(2.+v*.6);float ripple=sin(phase)*(.009+.002*v)*a*(.4+beat);q+=normalize(p+vec2(.0001))*ripple;outc=sampleAt(q);}
 else if(family==7){float r=length(p);float distortion=(v<2.?1.:-1.)*(.25+v*.17)*a;q=.5+p*(1.+distortion*(r*r-.17));if(variant==5)q=.5+p*(1.+sin(tm*.7)*distortion*r*r);outc=sampleAt(q);}
 else if(family==8){float blocks=160./(1.+v*1.7);blocks/=(.7+a*.3);if(variant==4)blocks*=.65+beat*.4;q=(floor(uv*vec2(blocks,blocks/ar))+.5)/vec2(blocks,blocks/ar);outc=sampleAt(q);}
 else if(family==9){float cells=clamp(75.-v*8.,10.,100.);vec2 cell=vec2(cells,cells/ar);vec2 id=floor(uv*cell),fp=fract(uv*cell)-.5;vec3 col=sampleAt((id+.5)/cell);float l=dot(col,vec3(.2126,.7152,.0722));float pattern=variant==2?max(abs(fp.x),abs(fp.y)):length(fp);float ink=1.-smoothstep(sqrt(max(.01,1.-l))*.37,sqrt(max(.01,1.-l))*.37+.07,pattern);if(variant==1||variant==5)outc=mix(vec3(1.),col,ink);else outc=mix(vec3(.055),vec3(1.-l),ink);if(variant==4)outc*=vec3(1.,.68,.4);}
 else if(family==10){vec2 d=vec2(1.)/res*(1.+v*.45);vec3 dx=sampleAt(q+vec2(d.x,0.))-sampleAt(q-vec2(d.x,0.));vec3 dy=sampleAt(q+vec2(0.,d.y))-sampleAt(q-vec2(0.,d.y));float edge=length(dx)+length(dy);vec3 glow=variant==0?vec3(1.):(variant==1?vec3(.1,.65,1.):(variant==2?vec3(.04,1.,.6):vec3(1.,.22,.7)));outc=clamp((variant==0?vec3(0.):c*.45)+edge*(1.7+v*.3)*a*glow,0.,1.);}
 else if(family==11){float row=sin(uv.y*res.y*(.8+v*.12));float mask=.87+.13*row;float curvature=dot(p,p)*(.06+v*.018)*a;q=.5+p*(1.+curvature);vec3 col=sampleAt(q);outc=col*mask;if(variant==2||variant==4)outc.r*=.78+.22*sin(q.x*res.x*.48);if(variant==3||variant==5)outc*=1.-smoothstep(.2,.75,length(p))*.65;}
 else if(family==12){float band=floor(uv.y*(12.+v*8.));float jitter=hash(vec2(band,floor(tm*(3.+v*.8))))-.5;float gate=step(.73,hash(vec2(floor(tm*(1.2+v)),band*.6)));q.x+=jitter*gate*(.05+v*.006)*a*(.3+beat);outc=sampleAt(q);if(variant==4||variant==5)outc=vec3(sampleAt(q+vec2(.008,0.)).r,outc.g,sampleAt(q-vec2(.008,0.)).b);}
 else if(family==13){float n=hash(floor(uv*res/(1.+v*.8))+floor(tm*(8.+v*3.)));float amount=(.025+v*.02)*a;outc=clamp(c+(n-.5)*amount*3.,0.,1.);if(variant==5)outc=floor(outc*6.+n)/6.;if(variant==2)outc*=vec3(1.1,.94,.7);}
 else if(family==14){vec2 delta=(q-.5)*(.009+v*.006)*a*(1.+beat);outc=c*.25;for(int i=1;i<=5;i++)outc+=sampleAt(q+delta*float(i))*.15;if(variant==0||variant==5)outc=clamp(outc*(1.05+.14*beat),0.,1.);}
 else if(family==15){vec2 direction=vec2(cos(v*PI/3.),sin(v*PI/3.))*(.003+.0025*v)*a;outc=c*.3;for(int i=1;i<=7;i++)outc+=sampleAt(q-direction*float(i))*.1;outc=clamp(outc,0.,1.);}
 else if(family==16){float phase=tm*.15+v*PI/4.;vec2 offset=vec2(sin(phase),cos(phase))*(.004+.003*v)*a*(1.+beat);vec3 chroma=vec3(sampleAt(q+offset).r,sampleAt(q+offset*.2).g,sampleAt(q-offset).b);vec3 color=hsv2rgb(vec3(fract(v*.13+tm*.015),.75,.95));outc=mix(chroma,chroma*color*(1.2+beat*.5),.15+.07*v);}
 else if(family==17){vec2 d=p*vec2(ar,1.);float r=max(length(d),.04);float theta=atan(d.y,d.x);q=.5+vec2(cos(theta+sin(tm*.2+v)*.2),sin(theta+sin(tm*.2+v)*.2))*(.05+.16/r)*(.8+.04*v);q=fract(q);outc=sampleAt(q)*(.95+beat*.15);}
 else if(family==18){float grid=8.+v*4.;vec2 cell=fract(uv*grid);float lines=1.-step(.028+.009*v,min(min(cell.x,cell.y),min(1.-cell.x,1.-cell.y)));if(variant==3||variant==4){vec2 dots=abs(cell-.5);lines=1.-smoothstep(.15,.2,length(dots));}if(variant==5)lines*=.5+.5*sin(tm*3.+uv.x*grid);vec3 overlay=variant==2?vec3(.7,.1,.95):vec3(.1,.78,.95);outc=clamp(c+lines*overlay*(.18+.05*v)*a*(1.+beat*.4),0.,1.);}
 else if(family==19){vec2 shift=vec2(sin(v*1.2),cos(v*1.2))*(.003+.002*v)*a;vec3 history=texture(prevTex,clamp(q+shift,vec2(0.),vec2(1.))).rgb;float decay=clamp(.32+v*.075,.32,.8);outc=mix(c,history,decay);if(variant==2||variant==5)outc=vec3(c.r,history.g,history.b);}
 frag=vec4(mix(c,clamp(outc,0.,1.),clamp(wet,0.,1.)),1.);
}`;
function shader(gl,type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw new Error('Shader error: '+error);}return sh;}
function renderer(canvas,{debug=false}={}){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)return null;
 const program=gl.createProgram(),vs=shader(gl,gl.VERTEX_SHADER,VERT),fs=shader(gl,gl.FRAGMENT_SHADER,FRAG);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link: '+gl.getProgramInfoLog(program));
 const uni=Object.fromEntries(['tex','prevTex','res','snd','tm','strength','wet','family','variant'].map(k=>[k,gl.getUniformLocation(program,k)]));gl.useProgram(program);gl.uniform1i(uni.tex,0);gl.uniform1i(uni.prevTex,1);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 const mkTex=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
 const input=mkTex(),buffers=[mkTex(),mkTex()],history=mkTex(),fb=gl.createFramebuffer();let w=0,h=0;
 const check=phase=>{if(debug){const code=gl.getError();if(code!==gl.NO_ERROR)throw new Error('WebGL '+phase+' error '+code);}};
 function allocate(width,height){if(width===w&&height===h)return;w=width;h=height;canvas.width=w;canvas.height=h;for(const t of [...buffers,history]){gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}}
 function draw(source,stack,time,features,amount=1){if(!stack?.length)return false;allocate(source.width,source.height);check('allocation');gl.viewport(0,0,w,h);gl.useProgram(program);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);check('upload');
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,history);gl.uniform2f(uni.res,w,h);gl.uniform1f(uni.tm,time/1000);gl.uniform4f(uni.snd,features.bass||0,features.mids||0,features.highs||0,features.rms||0);
 let previous=input;gl.disable(gl.BLEND);
 for(let i=0;i<stack.length;i++){const entry=stack[i],def=byId(entry.id);if(!def)continue;const last=i===stack.length-1;gl.bindFramebuffer(gl.FRAMEBUFFER,last?null:fb);if(!last)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,buffers[i%2],0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,previous);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,history);gl.uniform1i(uni.family,def.family);gl.uniform1i(uni.variant,def.variant);gl.uniform1f(uni.strength,entry.strength??1);gl.uniform1f(uni.wet,(entry.wet??1)*amount);gl.drawArrays(gl.TRIANGLES,0,3);check('draw '+def.id);if(!last)previous=buffers[i%2];}
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,history);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h);check('copy-history');return true;}
 return {draw,gl};}
return {LIBRARY,FAMILIES,byId,recommend,renderer};
});