/* CRYING BOWL — 띵샤와 대형 오카리나 추가 v1.0.0
 * index.html의 마지막 </body> 바로 위에 다음 한 줄을 추가합니다.
 * <script src="./extra-instruments.js?v=1"></script>
 * 이 파일을 index.html과 같은 폴더에 두세요.
 * 소리 조절: EXTRA_SOUND / 형태 조절: ExtraVisuals / 연결: ExtraController
 * 외부 라이브러리·음원 다운로드 없이 기존 WebGL과 Web Audio를 사용합니다.
 */
(() => {
'use strict';
if (window.CryingBowlExtra) return;

/* 새 악기 소리 조절: 이 표만 바꾸면 소리 길이·크기·거칠기를 조절할 수 있습니다. */
const EXTRA_SOUND = Object.freeze({
  screamSeconds: 5.65,     // 비명이 남는 시간
  screamVolume: .62,       // 띵샤 비명 크기
  screamRoughness: .31,    // 목소리가 갈라지는 정도 (0~1)
  screamBreath: .34,       // 비명에 섞이는 바람 소리
  metalVolume: .095,       // 테두리가 닿는 첫 금속음
  sighSeconds: 7.2,        // 들숨부터 마지막 날숨까지
  sighVolume: .78,         // 한숨 크기
  sighPitch: 119,          // 낮게 내려앉는 한숨의 기본 성대음
  roomSend: .12,           // 기존 잔향 설정으로 보내는 양
  maxScreams: 2            // 연타 시 겹칠 수 있는 비명 수
});

class ExtraAudio {
  constructor(engine) {
    this.engine = engine;
    this.voices = [];
    this._seed = 7391381;
    this._buffers = { scream: [null, null], sigh: null };
    this._screamIndex = 0;
    this._warming = null;
  }
  _random() {
    this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
  _clamp(x, min = 0, max = 1) { return Math.max(min, Math.min(max, x)); }
  _smooth(x) { x = this._clamp(x); return x * x * (3 - 2 * x); }
  _point(t, points) {
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const a = points[i - 1], b = points[i];
        return a[1] + (b[1] - a[1]) * this._smooth((t - a[0]) / (b[0] - a[0]));
      }
    }
    return points[points.length - 1][1];
  }
  /* RBJ band-pass. A fresh small state is allocated per voice, never per sample. */
  _band(f, q, rate) {
    const w = 2 * Math.PI * Math.min(f, rate * .44) / rate;
    const a = Math.sin(w) / (2 * q), inv = 1 / (1 + a);
    return { b: a * inv, a1: -2 * Math.cos(w) * inv, a2: (1 - a) * inv,
      x1: 0, x2: 0, y1: 0, y2: 0 };
  }
  _filter(s, x) {
    const y = s.b * (x - s.x2) - s.a1 * s.y1 - s.a2 * s.y2;
    s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
    return y;
  }
  _screamEnvelope(t, strength = 1) {
    const d = EXTRA_SOUND.screamSeconds;
    if (t < 0 || t >= d) return 0;
    return this._smooth(t / .095) * Math.pow(this._smooth((d - t) / 1.25), .7)
      * (.79 + .14 * Math.sin(t * 5.7) + .07 * Math.sin(t * 13.9)) * strength;
  }
  _sighEnvelope(t) {
    if (t < 1.02 || t >= EXTRA_SOUND.sighSeconds) return 0;
    return this._smooth((t - 1.02) / .3) * Math.pow(this._smooth((EXTRA_SOUND.sighSeconds - t) / (EXTRA_SOUND.sighSeconds * 3.8 / 7.2)), .72);
  }
  _inhaleEnvelope(t) {
    return t < 0 || t > .92 ? 0 : Math.pow(Math.sin(Math.PI * t / .92), 1.3);
  }
  _makeBuffer(kind, strength) {
    const c = this.engine.ctx, rate = c.sampleRate;
    const duration = kind === 'scream' ? EXTRA_SOUND.screamSeconds : EXTRA_SOUND.sighSeconds;
    const buffer = c.createBuffer(1, Math.ceil(rate * duration), rate);
    const data = buffer.getChannelData(0);
    const scream = kind === 'scream';
    const formants = scream
      ? [this._band(890, 3.5, rate), this._band(1390, 5, rate), this._band(2650, 5, rate), this._band(3650, 6, rate)]
      : [this._band(510, 2.9, rate), this._band(1040, 4.5, rate), this._band(2380, 4.2, rate)];
    const airLow = this._band(scream ? 870 : 610, .48, rate);
    const airHigh = this._band(scream ? 3000 : 1850, .8, rate);
    let phase = 0, cycle = 0, jitter = 1, shimmer = 1, pink = 0, dc = 0;
    const pitchPoints = [[0, 240], [.13, 390], [.65, 455], [1.8, 525], [2.6, 430], [3.75, 458], [4.7, 315], [5.65, 155]];
    for (let i = 0; i < data.length; i++) {
      const t = i / rate, random = this._random() * 2 - 1;
      pink = pink * .86 + random * .14;
      let f0 = scream ? this._point(t, pitchPoints) * (.9 + strength * .13)
        : EXTRA_SOUND.sighPitch * (1.28 - .46 * this._clamp((t - 1.04) / 5.1));
      f0 *= jitter * (1 + (scream ? .027 : .016) * Math.sin(t * 2 * Math.PI * 5.1));
      phase += f0 / rate;
      if (phase >= 1) {
        phase -= 1; cycle++;
        jitter = 1 + (this._random() * 2 - 1) * (scream ? .037 : .025);
        shimmer = .84 + this._random() * .3;
      }
      /* Asymmetric opening/closure pulses excite vowel resonances, with irregular
       * cycles and subharmonics to avoid a smooth electronic sine whistle. */
      let glottis = phase < .42 ? .65 * Math.sin(Math.PI * phase / .42)
        : phase < .60 ? -1.1 * Math.sin(Math.PI * (phase - .42) / .18) : 0;
      const rough = scream ? EXTRA_SOUND.screamRoughness : .12 + .23 * this._clamp((t - 4) / 2);
      glottis *= shimmer * (cycle % 2 ? 1 : 1 - rough)
        * (1 - rough * .28 + rough * .28 * Math.sin(t * 2 * Math.PI * 37.3));
      glottis += pink * (scream ? .07 : .022);
      let vowel = this._filter(formants[0], glottis) * (scream ? 2.2 : 1.9)
        + this._filter(formants[1], glottis) * (scream ? 1.35 : .9)
        + this._filter(formants[2], glottis) * (scream ? .62 : .32);
      if (scream) vowel += this._filter(formants[3], glottis) * .25;
      const air = this._filter(airLow, random) * .85 + this._filter(airHigh, random) * .36;
      let sample;
      if (scream) {
        const env = this._screamEnvelope(t, strength);
        const crack = 1 - .20 * Math.pow(Math.max(0, Math.sin(t * 17.1 + Math.sin(t * 3))), 12);
        sample = (vowel * crack + air * EXTRA_SOUND.screamBreath * (.6 + .4 * this._clamp(t / 4)))
          * env * EXTRA_SOUND.screamVolume;
        // A brief rim contact, followed by freely ringing metal (no cymbal crash).
        sample += EXTRA_SOUND.metalVolume * strength * (
          Math.sin(t * 2 * Math.PI * 2472) * Math.exp(-t * 2.45)
          + .37 * Math.sin(t * 2 * Math.PI * 3849) * Math.exp(-t * 4.5)
          + .18 * Math.sin(t * 2 * Math.PI * 6217) * Math.exp(-t * 8))
          * this._smooth(t / .0017);
        sample += random * .034 * strength * Math.exp(-t * 230) * this._smooth(t / .0005);
      } else {
        const inhale = this._inhaleEnvelope(t), exhale = this._sighEnvelope(t);
        // The chest voice gives way to air; the final breath has no pitched tail.
        const voiced = (1 - this._smooth((t - 4.35) / 1.35)) * exhale;
        const ceramic = Math.sin(phase * Math.PI * 2) * .055 * voiced;
        sample = (vowel * voiced * .8 + ceramic + air * (inhale * .36 + exhale * .56)) * EXTRA_SOUND.sighVolume;
      }
      // DC removal and soft saturation, leaving headroom for the existing bowls.
      dc = dc * .999 + sample * .001;
      data[i] = Math.tanh((sample - dc) * 1.3) * .74;
    }
    return buffer;
  }
  _buffer(kind, index = 0) {
    if (kind === 'sigh') return this._buffers.sigh || (this._buffers.sigh = this._makeBuffer(kind, 1));
    return this._buffers.scream[index] || (this._buffers.scream[index] = this._makeBuffer(kind, .9));
  }
  /* Call when an instrument is selected. Three small jobs yield to the UI;
   * subsequent strikes only schedule cached audio and allocate three nodes. */
  warmup() {
    if (!this.engine.ctx) return Promise.resolve(false);
    if (this._warming) return this._warming;
    this._warming = (async () => {
      for (const [kind, index] of [['scream', 0], ['sigh', 0], ['scream', 1]]) {
        await new Promise(resolve => setTimeout(resolve, 15));
        if (this.engine.ctx.state === 'closed') return false;
        this._buffer(kind, index);
      }
      return true;
    })();
    return this._warming;
  }
  _cleanup(voice) {
    if (voice.cleaned) return;
    voice.cleaned = true;
    for (const node of [voice.source, voice.gain, voice.send]) {
      try { node.disconnect(); } catch (_) { /* already disconnected */ }
    }
    voice.source.buffer = null;
    this.voices = this.voices.filter(v => v !== voice);
  }
  _fade(voice) {
    if (voice.cancelled || voice.cleaned) return;
    voice.cancelled = true;
    const t = this.engine.ctx.currentTime, g = voice.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + .055);
    try { voice.source.stop(t + .065); } catch (_) { this._cleanup(voice); }
  }
  _play(kind, strength, delay) {
    const e = this.engine, c = e.ctx;
    if (!c || !e.bus || c.state === 'closed') return false;
    this.voices.filter(v => !v.cancelled && c.currentTime >= v.end).forEach(v => this._cleanup(v));
    const live = this.voices.filter(v => !v.cancelled && v.kind === kind);
    if (kind === 'sigh' && live.length) return false;
    if (kind === 'scream' && live.length >= EXTRA_SOUND.maxScreams) this._fade(live[0]);
    const requestedStart = c.currentTime + Math.max(0, delay);
    const index = kind === 'scream' ? this._screamIndex++ % 2 : 0;
    const buffer = this._buffer(kind, index);
    const source = c.createBufferSource(), gain = c.createGain(), send = c.createGain();
    source.buffer = buffer; gain.gain.value = kind === 'scream' ? strength / .9 : 1; send.gain.value = EXTRA_SOUND.roomSend;
    source.connect(gain); gain.connect(e.bus);
    if (e.convolver) { gain.connect(send); send.connect(e.convolver); }
    const start = Math.max(c.currentTime, requestedStart);
    const voice = { kind, strength, source, gain, send, start, end: start + buffer.duration,
      cancelled: false, cleaned: false };
    source.onended = () => this._cleanup(voice);
    this.voices.push(voice); source.start(start);
    return true;
  }
  scream(strength = .8, delay = .18) {
    return this._play('scream', this._clamp(Number.isFinite(strength) ? strength : .8, .25, 1),
      Number.isFinite(delay) ? delay : .18);
  }
  sigh() { return this._play('sigh', 1, .025); }
  stop() { this.voices.slice().forEach(v => this._fade(v)); }
  state() {
    const result = { scream: 0, sigh: 0, inhale: 0, impact: 0, busy: false };
    if (!this.engine.ctx) return result;
    const now = this.engine.ctx.currentTime;
    for (const v of this.voices) {
      if (v.cancelled || v.cleaned || now >= v.end) continue;
      result.busy = true;
      const t = now - v.start;
      if (v.kind === 'scream') {
        result.scream = Math.max(result.scream, this._screamEnvelope(t, v.strength));
        result.impact = Math.max(result.impact, t < 0 ? 0 : Math.exp(-t * 17) * v.strength);
      } else {
        result.sigh = Math.max(result.sigh, this._sighEnvelope(t));
        result.inhale = Math.max(result.inhale, this._inhaleEnvelope(t));
      }
    }
    return result;
  }
}


/* Geometry and motion for the two additional instruments. This class is joined
 * to the extra-instruments IIFE, where the original renderer helpers are shared. */
class ExtraVisuals{
 constructor(scene){
  this.scene=scene;this.R=scene.renderer;this.mode='tingsha';this.hitAt=-100;this.hitStrength=.8;
  this.state={scream:0,sigh:0,inhale:0,impact:0};this.frame=0;this.ripples=new Float32Array(32);
  this.sphere=this.R.mesh(sphereData(28,18));
  this.buildTingsha();this.buildOcarina();this.update(0,0,this.state);
 }
 setMode(mode){if(mode!==this.mode){this.mode=mode;this.stop();}this.update(this.now||0,0,this.state);}
 stop(){this.hitAt=-100;this.state={scream:0,sigh:0,inhale:0,impact:0};}
 strike(t,strength=.8){this.hitAt=t;this.hitStrength=clamp(strength,.15,1.2);}
 part(mesh,mat,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0]){return {mesh,mat,pos,scale,rot};}
 buildTingsha(){
  const R=this.R;
  const bronze={kind:1,color:[.48,.285,.093],metal:.93,rough:.29};
  const edge={kind:6,color:[.60,.385,.145],metal:.94,rough:.25};
  const engraving={kind:0,color:[.22,.113,.038],metal:.88,rough:.34};
  const dark={kind:9,color:[.007,.004,.001],metal:0,rough:.96};
  const leather={kind:0,color:[.055,.021,.009],metal:0,rough:.88};
  const shell=R.mesh(lathe([[.001,.48],[.10,.48],[.145,.445],[.17,.365],[.30,.275],[.48,.195],[.72,.115],[.99,.064],[1.12,.052],[1.17,.062],[1.185,.039],[1.185,-.040],[1.17,-.072],[1.11,-.085],[.96,-.055],[.72,-.005],[.45,.078],[.25,.145],[.11,.172],[.001,.175]],96));
  const trim=R.mesh(combineData([
   transformData(torusData(1.151,.019,96,8),M.model([0,.067,0],1,[Math.PI/2,0,0])),
   transformData(torusData(.982,.010,88,6),M.model([0,.076,0],1,[Math.PI/2,0,0])),
   transformData(torusData(.209,.012,48,6),M.model([0,.327,0],1,[Math.PI/2,0,0]))
  ]));
  const ornamental=[];
  for(let k=0;k<8;k++){
   const pts=[];for(let j=0;j<=18;j++){const a=(k+(j/18)*.84+.08)/8*TAU,r=.82+.060*Math.sin(j/18*Math.PI);pts.push([Math.sin(a)*r,.089+.031*(1-j/18)*Math.sin(j/18*Math.PI),Math.cos(a)*r]);}
   ornamental.push(tubePath(pts,.007,5));
  }
  const ornament=R.mesh(combineData(ornamental));
  this.bells=[];
  for(const side of [-1,1]){
   const parts=[this.part(shell,bronze),this.part(trim,edge),this.part(ornament,engraving)];
   // Both top surfaces face upwards. The central leather attachments never turn
   // either disc face towards the other disc, as a pair of orchestral cymbals would.
   parts.push(this.part(R.mesh(torusData(.082,.023,36,8)),edge,[0,.493,0],[1,1,1],[0,0,Math.PI/2]));
   const eyes=[];for(const e of [-1,1]){
    const eye=this.part(this.sphere,dark,[e*.265,.242,.355],[.062,.012,.036]);parts.push(eye);eyes.push(eye);
   }
   const mouth={mesh:R.mesh(gridMesh(40,8,(u,v)=>[Math.cos(u*TAU)*v,0,Math.sin(u*TAU)*v]),true),mat:dark};parts.push(mouth);
   this.bells.push({side,parts,eyes,mouth,matrix:M.identity(),center:[side*1.52,1.18,0]});
  }
  this.cordMesh=R.mesh(tubePath(Array.from({length:39},(_,i)=>[lerp(-1.52,1.52,i/38),1.70+1.13*Math.sin(i/38*Math.PI),-.015-.20*Math.sin(i/38*Math.PI)]),.025,7),true);
  this.cord=this.part(this.cordMesh,leather);
 }
 bodyPoint(u,v){
  const s=v*2-1,a=u*TAU,r=Math.pow(Math.max(.0000001,1-s*s),.53),fat=.89+.11*v;
  return [3.05*s,1.155+1.12*r*Math.cos(a),1.70*r*fat*Math.sin(a)];
 }
 bodyNormal(u,v){
  const e=.00008;return V.norm(V.cross(V.sub(this.bodyPoint(u+e,v),this.bodyPoint(u-e,v)),V.sub(this.bodyPoint(u,Math.min(.999999,v+e)),this.bodyPoint(u,Math.max(.000001,v-e)))));
 }
 buildOcarina(){
  const R=this.R,clay={kind:0,color:[.078,.235,.222],metal:.035,rough:.24},lip={kind:0,color:[.24,.19,.115],metal:0,rough:.46},inside={kind:9,color:[.0035,.005,.0045],metal:0,rough:1};
  const nu=128,nv=100,holes=[];
  for(let row=0;row<2;row++)for(let k=0;k<4;k++){
   const iu=row?20:7,iv=32+k*12;holes.push({u:iu/nu,v:iv/nv,u0:(iu-3)/nu,u1:(iu+3)/nu,v0:(iv-4)/nv,v1:(iv+4)/nv,ru:(row?.0155:.0175)*(k===0?.90:1),rv:.027*(k===3?.90:1)});
  }
  const data=gridMesh(nu,nv,(u,v)=>this.bodyPoint(u,v)),indices=[];
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
   const u=(i+.5)/nu,v=(j+.5)/nv;if(holes.some(h=>u>h.u0&&u<h.u1&&v>h.v0&&v<h.v1))continue;
   const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,b,c,b,d,c);
  }
  data.indices=indices;this.ocarinaParts=[this.part(R.mesh(data),clay)];
  const bridges=[],walls=[],bottoms=[];
  // Replace each rectangular cutout with a circular ring stitched to the exact
  // original grid vertices. The openings are real holes with recessed interiors.
  for(const h of holes){
   const bounds=[];for(let k=0;k<6;k++)bounds.push([h.u0+k/nu,h.v0]);for(let k=0;k<8;k++)bounds.push([h.u1,h.v0+k/nv]);for(let k=0;k<6;k++)bounds.push([h.u1-k/nu,h.v1]);for(let k=0;k<8;k++)bounds.push([h.u0,h.v1-k/nv]);bounds.push(bounds[0]);
   const ring=bounds.map(q=>{const a=Math.atan2((q[1]-h.v)/(.04),(q[0]-h.u)/(3/nu));return [h.u+h.ru*Math.cos(a),h.v+h.rv*Math.sin(a)];});
   const verts=[],ix=[];for(let j=0;j<4;j++)for(let k=0;k<bounds.length;k++){
    const f=j/3,u=lerp(bounds[k][0],ring[k][0],f),v=lerp(bounds[k][1],ring[k][1],f),p=this.bodyPoint(u,v),n=this.bodyNormal(u,v);verts.push(...p,...n,k/(bounds.length-1),f);
   }
   const nc=bounds.length;for(let j=0;j<3;j++)for(let k=0;k<nc-1;k++){const a=j*nc+k,b=a+1,c=a+nc,d=c+1;ix.push(a,c,b,b,c,d);}bridges.push({vertices:verts,indices:ix});
   const wv=[],wi=[],bv=[],bi=[];let center=[0,0,0];const coords=ring.map(q=>{const p=this.bodyPoint(...q),n=this.bodyNormal(...q);return {p,n,b:V.sub(p,V.mul(n,.24))};});
   for(let j=0;j<3;j++)for(let k=0;k<nc;k++){
    const c=coords[k],f=j/2,p=V.add(c.p,V.mul(c.n,-.24*f)),across=V.norm(V.sub(this.bodyPoint(h.u,h.v),c.p));wv.push(...p,...across,k/(nc-1),f);
   }
   for(let j=0;j<2;j++)for(let k=0;k<nc-1;k++){const a=j*nc+k,b=a+1,c=a+nc,d=c+1;wi.push(a,b,c,b,d,c);}
   for(const c of coords)center=V.add(center,V.mul(c.b,1/nc));bv.push(...center,...this.bodyNormal(h.u,h.v),.5,.5);
   for(let k=0;k<nc;k++){const c=coords[k];bv.push(...c.b,...c.n,k/(nc-1),1);if(k<nc-1)bi.push(0,k+1,k+2);}
   walls.push({vertices:wv,indices:wi});bottoms.push({vertices:bv,indices:bi});
  }
  this.ocarinaParts.push(this.part(R.mesh(combineData(bridges)),clay),this.part(R.mesh(combineData(walls)),{...clay,color:[.027,.067,.059],rough:.65}),this.part(R.mesh(combineData(bottoms)),inside));
  // A thick integral windway grows from the back shoulder; its flattened oval
  // cross-section and black slit distinguish the instrument from a toy whistle.
  const root=[1.10,1.73,-.90],tip=[2.13,2.70,-2.36],dir=V.norm(V.sub(tip,root)),side=V.norm(V.cross(dir,[0,1,0])),up=V.norm(V.cross(side,dir));
  const mouthPoint=(u,v,scale=1,offset=0)=>{
   const a=u*TAU,c=Math.cos(a),s=Math.sin(a),p=V.add(root,V.mul(V.sub(tip,root),v)),w=lerp(.50,.32,v),h=lerp(.27,.155,v);
   return V.add(V.add(V.add(p,V.mul(side,Math.sign(c)*Math.pow(Math.abs(c),.62)*w*scale)),V.mul(up,Math.sign(s)*Math.pow(Math.abs(s),.62)*h*scale)),V.mul(dir,offset));
  };
  this.ocarinaParts.push(this.part(R.mesh(gridMesh(48,20,(u,v)=>mouthPoint(u,v))),clay));
  const windRim=gridMesh(48,5,(u,v)=>mouthPoint(u,1,lerp(1,.66,v),-.012*Math.sin(v*Math.PI)));
  this.ocarinaParts.push(this.part(R.mesh(windRim),lip));
  this.ocarinaParts.push(this.part(R.mesh(gridMesh(48,4,(u,v)=>mouthPoint(u,1,.66,-v*.23))),inside));
  this.ocarinaParts.push(this.part(R.mesh(gridMesh(48,7,(u,v)=>mouthPoint(u,1,.66*v,-.235))),inside));
  // Keep the upper glazed surface plain so the actual finger holes read clearly.
  this.ocarinaEyes=[];for(const e of [-1,1]){
   const p=this.bodyPoint(.205,(e*.31/3.05+1)/2),n=this.bodyNormal(.205,(e*.31/3.05+1)/2),eye=this.part(this.sphere,inside,V.add(p,V.mul(n,.007)),[.066,.027,.008],[.22,0,e*-.08]);
   this.ocarinaParts.push(eye);this.ocarinaEyes.push(eye);
  }
  this.ocarinaMouth=this.part(this.sphere,inside,[0,1.19,1.643],[.15,.015,.013]);this.ocarinaParts.push(this.ocarinaMouth);
  this.ocarinaMatrix=M.identity();
 }
 update(t,dt,state){
  this.now=t;this.state=state||this.state;const S=this.state,scene=this.scene,a=scene.width/scene.height,c=scene.camera;
  const portrait=a<.83,short=scene.height<500,top=short?60:97,bottom=short?97:(portrait?190:175),room=Math.max(.37,1-(top+bottom)/scene.height);
  c.fov=(portrait?43:37)*Math.PI/180;c.offset=(bottom-top)/scene.height;
  const target=this.mode==='tingsha'?[0,1.35,0]:[0,1.37,-.20],radius=this.mode==='tingsha'?3.08:3.36,tan=Math.tan(c.fov/2),dist=Math.max(10.0,radius/(tan*a*.88),2.05/(tan*room*.9));
  const direction=this.mode==='tingsha'?V.norm([.03,.78,1]):V.norm([.30,.69,1]);c.eye=V.add(target,V.mul(direction,dist));c.target=target;c.reye=[c.eye[0],-c.eye[1]-.26,c.eye[2]];
  const proj=M.perspective(c.fov,a,.1,150);proj[9]=-c.offset;c.vp=M.mul(proj,M.look(c.eye,target));c.rvp=M.mul(proj,M.look(c.reye,[target[0],-target[1]-.26,target[2]],[0,-1,0]));
  c.forward=V.norm(V.sub(target,c.eye));c.right=V.norm(V.cross(c.forward,[0,1,0]));c.up=V.norm(V.cross(c.right,c.forward));
  const scream=clamp(S.scream||0),sigh=clamp(S.sigh||0),inhale=clamp(S.inhale||0),age=t-this.hitAt,reduced=scene.reduced?.18:1;
  let spread=1.52,shake=0;
  if(age>=0&&age<.05)spread=lerp(1.52,1.67,smooth(0,.05,age));
  else if(age>=.05&&age<.18)spread=lerp(1.67,1.185,smooth(.05,.18,age));
  else if(age>=.18&&age<1.4){spread=1.52-.335*Math.exp(-(age-.18)*8)*Math.cos((age-.18)*9);shake=Math.exp(-(age-.18)*7)*this.hitStrength;}
  const cordPoints=[];
  for(const b of this.bells){
   const trem=(shake*.018+scream*.003)*reduced,tilt=b.side*trem*Math.sin(t*67),y=1.12+trem*Math.sin(t*83+b.side);
   b.center=[b.side*spread,y,0];b.matrix=M.model(b.center,1,[trem*Math.sin(t*71),0,tilt]);
   for(const p of b.parts){p.model=M.mul(b.matrix,M.model(p.pos,p.scale,p.rot));p.energy=0;}
   const w=.055+.080*scream,h=.025+.150*scream,mesh=b.mouth.mesh;
   for(let j=0;j<=8;j++)for(let k=0;k<=40;k++){
    const angle=k/40*TAU,r=j/8,x=Math.cos(angle)*w*r,z=.595+Math.sin(angle)*h*r,rr=Math.hypot(x,z),yy=rr<.48?lerp(.275,.195,(rr-.30)/.18):rr<.72?lerp(.195,.115,(rr-.48)/.24):lerp(.115,.064,(rr-.72)/.27),i=(j*41+k)*8;
    mesh.verts.set([x,yy+.006,z,0,1,0],i);
   }
   this.R.updateMesh(mesh);b.mouth.model=b.matrix;
   for(const eye of b.eyes){eye.scale[2]=.024+.012*(1-scream);eye.rot[1]=b.side*.06*scream;eye.model=M.mul(b.matrix,M.model(eye.pos,eye.scale,eye.rot));}
  }
  for(let i=0;i<=38;i++){
   const f=i/38;cordPoints.push([lerp(-spread,spread,f),1.61+1.05*Math.sin(f*Math.PI)+shake*.025*Math.sin(f*13+t*11),-.018-.18*Math.sin(f*Math.PI)]);
  }
  const cd=tubePath(cordPoints,.025,7);this.cordMesh.verts.set(cd.vertices);this.R.updateMesh(this.cordMesh);
  const breath=inhale*.012-sigh*.008,heave=(sigh*.006*Math.sin(t*3.1)+inhale*.003)*reduced;
  this.ocarinaMatrix=M.model([0,heave,0],[1+breath,1+breath*.5,1+breath],[-sigh*.012*reduced,0,0]);
  for(const p of this.ocarinaParts)p.model=M.mul(this.ocarinaMatrix,M.model(p.pos,p.scale,p.rot));
  this.ocarinaMouth.scale=[.14+sigh*.018,.013+sigh*.055,.015];this.ocarinaMouth.model=M.mul(this.ocarinaMatrix,M.model(this.ocarinaMouth.pos,this.ocarinaMouth.scale));
  this.ripples.fill(0);this.ripples[0]=0;this.ripples[1]=0;this.ripples[2]=this.mode==='tingsha'?Math.max(.004,scream*.20+shake*.12):.004+sigh*.09;this.ripples[3]=1.5;
 }
 render(t){
  const R=this.R,parts=this.mode==='tingsha'?this.bells.flatMap(b=>b.parts).concat([this.cord]):this.ocarinaParts;
  const mirrorDue=(this.frame++%2===0);for(const mirror of mirrorDue?[true,false]:[false]){
   R.begin(this.scene.camera,t,this.ripples,mirror);if(!mirror)R.draw(this.scene.floor);
   for(const p of parts)R.draw(p);
  }
 }
 contains(x,y){
  const scene=this.scene,project=p=>{const q=M.point(scene.camera.vp,p);return [(q[0]/q[3]*.5+.5)*scene.width,(.5-q[1]/q[3]*.5)*scene.height];};
  if(this.mode==='tingsha'){
   for(const b of this.bells){const c=project(b.center),e=project(V.add(b.center,[1.23,0,0])),f=project(V.add(b.center,[0,0,1.25])),rx=Math.max(32,Math.hypot(e[0]-c[0],e[1]-c[1])),ry=Math.max(29,Math.hypot(f[0]-c[0],f[1]-c[1]));if(Math.pow((x-c[0])/rx,2)+Math.pow((y-c[1])/ry,2)<1.35)return true;}
   return false;
  }
  const c=project([0,1.30,0]),e=project([3.15,1.3,0]),f=project([0,2.55,1.70]),rx=Math.max(40,Math.hypot(e[0]-c[0],e[1]-c[1])),ry=Math.max(50,Math.hypot(f[0]-c[0],f[1]-c[1]));
  return Math.pow((x-c[0])/rx,2)+Math.pow((y-c[1])/ry,2)<1.28||(()=>{const p=project([1.75,2.35,-1.8]);return Math.hypot(x-p[0],y-p[1])<Math.max(38,ry*.6);})();
 }
}


/* 연결부: 원본 index.html의 클래스는 그대로 두고 새 악기만 덧붙입니다. */
const originalInit = App.prototype.init;
const originalAppendix = App.prototype.appendix;
const originalDamp = App.prototype.damp;
const originalPlayTick = App.prototype.playTick;
const originalSceneTick = Scene.prototype.tick;
const originalSceneRender = Scene.prototype.render;
const originalToggle = App.prototype.updateModeToggle;

const EXTRA_ICONS = {
  tingsha: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 24Q18 5 32 9Q47 5 47 24" fill="none" stroke="#725135" stroke-width="3"/><path d="M4 31Q17 20 30 31L29 36Q17 44 5 36Z M34 31Q47 20 60 31L59 36Q47 44 35 36Z" fill="#b98a48" stroke="#ead1a2" stroke-width="1.5"/><ellipse cx="17" cy="28" rx="5" ry="4" fill="#b98a48"/><ellipse cx="47" cy="28" rx="5" ry="4" fill="#b98a48"/><path d="M12 33l4 2m7-2-3 2m22-2 4 2m7-2-3 2" stroke="#39291d" stroke-width="2" stroke-linecap="round"/><path d="M30 19l2-5 2 5" stroke="#dfc294" stroke-width="1.5" fill="none"/></svg>`,
  ocarina: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 24 8 13l9-5 12 12C48 14 61 26 59 42 57 55 40 60 24 55 10 51 4 43 7 34Z" fill="#698b80" stroke="#b6c2a5" stroke-width="1.5"/><path d="M8 38Q29 52 56 39" fill="none" stroke="#47695f" stroke-width="2"/><g fill="#132620"><ellipse cx="24" cy="29" rx="3" ry="2.5"/><ellipse cx="35" cy="27" rx="3" ry="2.5"/><ellipse cx="45" cy="30" rx="3" ry="2.5"/><ellipse cx="19" cy="39" rx="3" ry="2.5"/><ellipse cx="31" cy="38" rx="3" ry="2.5"/><ellipse cx="43" cy="40" rx="3" ry="2.5"/></g></svg>`
};

class ExtraController {
  constructor(app) {
    this.app = app;
    this.mode = null;
    this.request = 0;
    this.sound = null;
    this.visual = new ExtraVisuals(app.scene);
    app.scene.extraInstruments = this;
    const style = document.createElement('style');
    style.textContent = `
      #modeSwitch .extra-tab{display:grid;place-items:center;width:50px;height:50px;min-width:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;opacity:.36;filter:saturate(.45)}
      #modeSwitch .extra-tab.active{opacity:1;filter:none;background:rgba(125,94,48,.34)}
      #modeSwitch .extra-tab svg{width:36px;height:36px}
      #extraControls{display:none;align-items:center;justify-content:center;gap:10px}
      .extra-instrument #extraControls{display:flex}
      .extra-instrument #forceRow,.extra-instrument #quickControls{display:none!important}
      #extraControls button{min-height:44px;padding:9px 20px;border:1px solid rgba(194,166,117,.42);border-radius:999px;background:rgba(18,21,25,.88);color:#e5d4b9;font-size:12px;letter-spacing:.08em}
      #extraControls #extraStop{min-width:44px;padding:10px 13px;color:#b5a58d}
      #extraControls #extraStop svg{width:15px;height:15px;display:block}
      #extraHint{display:none;margin:12px 0 0;color:#b5ada3;font-size:11px;letter-spacing:.035em;text-shadow:0 2px 7px #000}
      .extra-instrument #extraHint{display:block}
      @media(max-width:700px){
        #modeSwitch{right:auto!important;left:50%!important;transform:translateX(-50%)!important;bottom:max(14px,env(safe-area-inset-bottom))!important}
        #modeSwitch .extra-tab{width:46px;height:46px}
        #modeSwitch .extra-tab svg{width:33px;height:33px}
        #dock{left:50%!important;width:calc(100vw - 24px)!important;bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
        #extraHint{font-size:10px}
      }
      @media(max-height:500px) and (min-width:701px){
        #modeSwitch{bottom:10px!important}
        #extraHint{margin-top:6px;font-size:10px}
      }
    `;
    document.head.append(style);
    const nav = $('#modeSwitch');
    for (const [mode, label] of [['tingsha', '띵샤'], ['ocarina', '오카리나']]) {
      const button = document.createElement('button');
      button.id = `show-${mode}`;
      button.className = 'extra-tab';
      button.type = 'button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = EXTRA_ICONS[mode];
      button.addEventListener('click', () => this.select(mode));
      nav.append(button);
    }
    const controls = document.createElement('div');
    controls.id = 'extraControls';
    controls.innerHTML = '<button id="extraAction" type="button">부딪히기</button><button id="extraStop" type="button" aria-label="멈춤" title="멈춤"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor"/></svg></button>';
    const hint = document.createElement('p');
    hint.id = 'extraHint';
    $('#dock').append(controls, hint);
    $('#extraAction').addEventListener('click', () => this.act());
    $('#extraStop').addEventListener('click', () => this.stop());
    const canvas = $('#stage');
    for (const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','wheel','contextmenu']) {
      canvas.addEventListener(type, event => {
        if (!this.mode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (type === 'pointermove') canvas.style.cursor = this.visual.contains(event.clientX,event.clientY) ? 'pointer' : 'default';
        if (type === 'pointerdown' && event.button !== 2 && event.isPrimary !== false) {
          canvas.focus({preventScroll:true});
          if (this.visual.contains(event.clientX,event.clientY)) this.act();
        }
      }, {capture:true, passive:false});
    }
    window.addEventListener('keydown', event => {
      if (!this.mode || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
      if (event.key === 'Escape') {event.preventDefault();event.stopImmediatePropagation();app.appendix(false);return;}
      if (event.code === 'Space') {event.preventDefault();event.stopImmediatePropagation();this.stop();return;}
      if (event.key === 'Enter' && document.activeElement === canvas) {event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)this.act();return;}
      if (/^Digit[1-8]$/.test(event.code) || ['ArrowLeft','ArrowRight'].includes(event.key) || 'asdfghjkr'.includes(event.key.toLowerCase())) event.stopImmediatePropagation();
    }, true);
    document.addEventListener('visibilitychange', () => {if(document.hidden)this.stop();});
    window.addEventListener('blur', () => this.stop());
  }
  async select(mode) {
    const request = ++this.request;
    await this.app.start();
    if (request !== this.request || !this.app.audio.ready) return;
    await originalAppendix.call(this.app, false);
    if (request !== this.request) return;
    this.stop();
    this.app.frogMode = 'stop';
    this.app.stopGroove();
    this.app.releaseAll();
    this.mode = mode;
    this.sound ||= new ExtraAudio(this.app.audio);
    this.sound.warmup?.();
    this.visual.setMode(mode);
    document.body.classList.add('extra-instrument');
    $('#extraAction').textContent = mode === 'tingsha' ? '부딪히기' : '불기';
    $('#extraHint').textContent = mode === 'tingsha' ? '띵샤를 눌러보세요' : '오카리나를 눌러보세요';
    $('#stage').setAttribute('aria-label', mode === 'tingsha' ? '띵샤 — 누르거나 Enter로 연주, Space로 멈춤' : '오카리나 — 누르거나 Enter로 연주, Space로 멈춤');
    this.updateTabs();
  }
  updateTabs() {
    if (this.mode) for (const id of ['#showBowls','#showFrog']) {$(id).classList.remove('active');$(id).setAttribute('aria-pressed','false');}
    for (const mode of ['tingsha','ocarina']) {const button=$(`#show-${mode}`);if(!button)continue;button.classList.toggle('active',this.mode===mode);button.setAttribute('aria-pressed',String(this.mode===mode));}
  }
  leave() {
    ++this.request;
    this.stop();
    this.mode = null;
    document.body.classList.remove('extra-instrument');
    $('#stage').setAttribute('aria-label','크라잉볼 — 악기를 눌러 연주');
    this.updateTabs();
  }
  async act() {
    const mode = this.mode;
    if (!mode || !this.app.audio.ready) return;
    if (this.app.audio.ctx.state === 'suspended') await this.app.audio.ctx.resume();
    if (this.mode !== mode) return;
    if (mode === 'tingsha') {
      if(this.lastStrike !== undefined && this.app.time-this.lastStrike<.32)return;
      this.lastStrike = this.app.time;
      this.sound.scream(.85,.18);
      this.visual.strike(this.app.time + this.app.audio.lag(), .85);
    } else this.sound.sigh();
  }
  stop() {this.sound?.stop();this.visual.stop?.();this.lastStrike=undefined;}
  tick(t,dt) {this.visual.update(t,dt,this.sound?.state() || {scream:0,sigh:0,inhale:0,impact:0,busy:false});}
}

App.prototype.init = async function(...args) {
  await originalInit.apply(this,args);
  if(this.ready && !this.extraInstruments)this.extraInstruments = new ExtraController(this);
};
App.prototype.appendix = async function(...args) {this.extraInstruments?.leave();return originalAppendix.apply(this,args);};
App.prototype.damp = function(...args) {this.extraInstruments?.stop();return originalDamp.apply(this,args);};
App.prototype.updateModeToggle = function(...args) {const value=originalToggle.apply(this,args);this.extraInstruments?.updateTabs();return value;};
App.prototype.playTick = function(...args) {if(this.extraInstruments?.mode)return;return originalPlayTick.apply(this,args);};
Scene.prototype.tick = function(t,dt,audio) {if(this.extraInstruments?.mode)return this.extraInstruments.tick(t,dt);return originalSceneTick.call(this,t,dt,audio);};
Scene.prototype.render = function(t) {if(this.extraInstruments?.mode)return this.extraInstruments.visual.render(t);return originalSceneRender.call(this,t);};
window.CryingBowlExtra = {version:'1.0.0', sound:EXTRA_SOUND};


})();
