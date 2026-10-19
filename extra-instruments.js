/* CRYING BOWL — 띵샤와 오카리나 v3
 * index.html 맨 아래 </body> 바로 위의 한 줄:
 *   <script src="./extra-instruments.js?v=1"></script>
 * 이 파일은 index.html과 같은 폴더에 둡니다. 외부 라이브러리·녹음 파일 없이 기존 WebGL과 Web Audio만 씁니다.
 *
 * 띵샤: 두 장이 부딪치면 둘 다 "꺄아아앙악!" 하고 비명을 지릅니다. 연달아 치면 비명이 길고 거칠어집니다.
 *       얼굴은 개빡친 얼굴입니다. 쉴 때는 눈썹을 내리깔고 입을 꾹 다물고 있다가, 치면 눈썹이 V자로 내리꽂히고
 *       콧등이 구겨지며 입이 네모나게 찢어져 윗니·아랫니를 드러내고 악을 씁니다. 연달아 칠수록 더 일그러집니다.
 * 오카리나: 누르고 있는 동안 숨을 들이쉬며 몸통이 부풀고, 떼면 "하아아" / "후우우" 한숨을 쉬며 원래보다 홀쭉하게
 *           쪼그라들었다가(주름이 잡힌다) 천천히 돌아옵니다. 짧게 누르면 짧은 들숨 뒤 "후우", 길게 들이쉴수록 깊고 긴 "하아아".
 *
 * 소리와 부푸는 정도는 아래 TUNE 표의 숫자만 바꾸면 됩니다.
 */
(() => {
'use strict';
if (window.CryingBowlExtra) return;

const TUNE = {
  scream: {
    f0: [1260, 1340],          // 왼쪽·오른쪽 띵샤의 비명 높이(Hz). 반음쯤 어긋나서 둘이 같이 지르면 더 찢어진다
    gain: .62,                 // 비명 크기
    dur: [1.0, 1.4, 1.85],     // 단계별 길이(초): 한 번 / 연달아 / 계속 몰아칠 때
    level: [.08, .5, .92],     // 단계별 거칠기(0~1). 높을수록 목이 찢어지고 갈라진다
    chain: 2.4,                // 이 시간(초) 안에 다시 치면 한 단계 올라간다
    room: .16                  // 잔향으로 보내는 양
  },
  ting: { gain: .16, f: [2637.02, 2650.5] },   // 부딪치는 금속음 (UI 팅샤와 같은 음)
  sigh: {
    gain: .95,                 // 한숨 크기
    inhaleGain: .15,           // 들숨 크기 (날숨보다 한참 작게: 실제 한숨도 들숨은 거의 안 들린다)
    f0: [112, 126],            // '하아' / '후우' 목소리 높이
    room: .20
  },
  breath: {
    swell: .17,                // 끝까지 들이쉬었을 때 오카리나 몸통이 굵어지는 비율 (0.17 = 17%)
    shrink: .15,               // 깊은 한숨을 다 내쉬었을 때 원래보다 홀쭉해지는 비율. 짧은 한숨은 이보다 덜 쪼그라든다
    back: 1.6                  // 한숨이 끝난 뒤 원래 크기로 돌아오는 데 걸리는 시간(초)
  },
  drone: { idle: .65, voice: .42 }   // 이 두 악기에서는 바닥 베이스를 조금 낮춘다 (목소리가 묻히지 않게). 볼 화면으로 가면 원래대로
};

/* ================= 1. 셰이더: 띵샤 주물 청동(21), 오카리나 유약(22), 입·눈 속 어둠(23) ================= */
const FRAG_A = 'vec3 L=normalize(vec3(-.45,.86,.62)),L2=normalize(vec3(.7,.6,-.6));';
const FRAG_B = 'float alpha=uAlpha*vAlpha;';
const GLSL_A = `
 if(uKind>20.5&&uKind<21.5){
  float xr=length(vLocal.xz),xw=noise(vLocal*7.+uSeed);
  float xfw=fwidth(xr)*150.,xl=.5+.5*sin(xr*150.+xw*2.6)*(1.-smoothstep(.25,.75,xfw));
  float g1=(xr-1.071)/.0045,g2=(xr-1.097)/.004,g3=(xr-.170)/.006;
  float xg=-.010*exp(-g1*g1)-.008*exp(-g2*g2)-.004*exp(-g3*g3);
  float xh=(xl*.0009+xg)*vObjectScale;
  vec3 xdx=dFdx(vWorld),xdy=dFdy(vWorld),xa=cross(xdy,N),xb=cross(N,xdx);float xdet=dot(xdx,xa);
  N=normalize(abs(xdet)*N-sign(xdet)*(dFdx(xh)*xa+dFdy(xh)*xb));
  float xp=noise(vLocal*3.3+uSeed*2.);
  albedo*=.82+.26*xp+.05*xl;
  albedo=mix(albedo,albedo*vec3(.52,.60,.52),smoothstep(.72,.95,xp)*.22);
  rough=clamp(uRough+.07*(1.-xp),.12,.6);metal=uMetal;
 }
 if(uKind>21.5&&uKind<22.5){
  float gw=noise(vec3(vLocal.x*.42,vLocal.y*1.2,vLocal.z*1.2)+uSeed)*2.4;
  float gr=.5+.5*sin((vLocal.y*8.5+vLocal.z*4.5+gw)*3.2);
  float gf=noise(vec3(vLocal.x*1.1,vLocal.y*34.+gw*4.,vLocal.z*34.));
  float gs=noise(vec3(vLocal.x*.22,vLocal.y*2.6,vLocal.z*2.6)+3.1);
  albedo*=(.86+.17*gr)*(.90+.15*gf)*(.93+.12*gs);
  albedo=mix(albedo,albedo*vec3(.66,.52,.42),smoothstep(.58,.96,gf*.6+gr*.4)*.32);
  rough=uRough;metal=0.;
 }
`;
const GLSL_B = `
 if(uKind>21.5&&uKind<22.5){
  float cc=pow(max(dot(N,H),0.),240.)*3.4+pow(max(dot(N,H2),0.),170.)*1.5;
  light+=vec3(1.,.95,.86)*cc*.55+env(reflect(-V,N),.04)*(.03+.62*fres);
 }
 if(uKind>22.5&&uKind<23.5){
  float hd=smoothstep(0.,.46,vUV.y);
  light=mix(uColor*(.30+nl*.55),uColor*.010,hd)+uColor*spec*(1.-hd)*.6;
 }
`;
/* 오카리나 숨: 몸통 단면을 몸통 가운데 줄기(uSwAxis)에서 바깥으로 부풀리거나 오므린다.
 * 위치만 보고 옮기므로 몸통·얼굴·구멍·취구가 함께 움직이고 서로 떨어지지 않는다. 단면 밖(취구)은 몸통 아랫면과 같이 평행 이동한다 */
const VERT_DECL = 'void main(){\n vec3 p=aPosition,n=aNormal;', VERT_AT = 'vLocal=p;vUV=aUV;';
const VERT_A = 'uniform float uSwell;uniform vec4 uSwAxis[14];\n';
const VERT_B = `
 if(abs(uSwell)>1e-4){
  float sx=clamp((p.x+3.25)*2.,0.,12.999);int si=int(sx);vec4 ax=mix(uSwAxis[si],uSwAxis[si+1],sx-float(si));
  vec2 d=vec2(p.y-ax.x,p.z),lim=max(ax.yz,vec2(.05));float w=uSwell*ax.w;vec2 k=w*step(abs(d),lim);
  p.yz+=clamp(d,-lim,lim)*w;p.x+=(p.x+.3)*w*.10;
  n=normalize(vec3(n.x,n.yz/(1.+k)));
  if(uSwell<0.){
   vec2 dd=clamp(d,-lim,lim);float r=max(length(dd),.3),th=atan(dd.x,dd.y);vec2 u2=dd/r;
   float p1=p.x*6.+th*4.+1.3,p2=p.x*9.-th*3.;
   float fx=(p.x+1.62)/1.1,ft=th/.75;fx*=fx;ft*=ft;
   float a=-uSwell*.22*ax.w*step(abs(d.x),lim.x)*(1.-exp(-fx*fx-ft*ft));
   p.yz+=u2*a*(.6*sin(p1)+.4*sin(p2));
   n=normalize(n-vec3(a*(3.6*cos(p1)+3.6*cos(p2)),0.,0.)-vec3(0.,u2.y,-u2.x)*a*(2.4*cos(p1)-1.2*cos(p2))/r);
  }
 }
`;
{
  const compile0 = Renderer.prototype.compile;
  Renderer.prototype.compile = function (v, f) {
    if (typeof f === 'string' && f.includes(FRAG_A) && f.includes(FRAG_B) && !f.includes('uKind>20.5')) f = f.replace(FRAG_A, GLSL_A + FRAG_A).replace(FRAG_B, GLSL_B + FRAG_B);
    if (typeof v === 'string' && v.includes(VERT_DECL) && v.includes(VERT_AT) && !v.includes('uSwell')) v = v.replace(VERT_DECL, VERT_A + VERT_DECL).replace(VERT_AT, VERT_AT + VERT_B);
    return compile0.call(this, v, f);
  };
}

/* ================= 2. 목소리 합성 (Web Worker에서 돌림) =================
 * 성대 펄스(로젠버그 + 지수 복귀)와 성대 박자에 맞춰 뿜어지는 숨소리를 성도 공명(포먼트)에 통과시킨다.
 * 비명은 4배, 숨은 2배 오버샘플링해서 만든 뒤 줄인다. 한숨·들숨의 공명 위치와 폭, 시간 모양은
 * 실제 사람 한숨·들숨 녹음을 분석한 값(LPC 공명 0.9 / 1.4 / 2.6 / 3.6 / 4.4 / 5.4 kHz 등)을 따랐다.
 */
function voiceLib() {
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }; }
  function walk(r, hz) { let v = 0, target = r() * 2 - 1, t = 0; return dt => { t += dt * hz; if (t >= 1) { t -= 1; target = r() * 2 - 1; } v += (target - v) * Math.min(1, dt * hz * 3); return v; }; }
  class Reson { // Klatt resonator, unity gain at DC
    constructor() { this.a = 0; this.b = 0; this.c = 0; this.y1 = 0; this.y2 = 0; }
    set(F, B, T) { const r = Math.exp(-Math.PI * B * T); this.c = -r * r; this.b = 2 * r * Math.cos(TAU * F * T); this.a = 1 - this.b - this.c; }
    run(x) { const y = this.a * x + this.b * this.y1 + this.c * this.y2; this.y2 = this.y1; this.y1 = y; return y; }
  }
  class Band { // constant-peak bandpass
    constructor() { this.b0 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
    set(f, bw, R) { const w = TAU * Math.min(f, R * .45) / R, q = Math.max(.3, f / bw), al = Math.sin(w) / (2 * q), a0 = 1 + al; this.b0 = al / a0; this.a1 = -2 * Math.cos(w) / a0; this.a2 = (1 - al) / a0; }
    run(x) { const y = this.b0 * (x - this.x2) - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
  }
  function glottis(p, tp, tn, ta) {
    if (p < tp) return (Math.PI / (2 * tp)) * Math.sin(Math.PI * p / tp);
    const q = p - tp;
    if (q < tn) return -(Math.PI / (2 * tn)) * Math.sin(Math.PI * q / (2 * tn));
    return -(Math.PI / (2 * tn)) * Math.exp(-(q - tn) / ta);
  }
  function flow(p, tp, tn) { if (p < tp) return .5 * (1 - Math.cos(Math.PI * p / tp)); const q = p - tp; return q < tn ? Math.cos(Math.PI * q / (2 * tn)) : 0; }
  function decimate(x, os) {
    if (os === 1) return Float32Array.from(x);
    const half = 12 * os, taps = new Float32Array(2 * half + 1), fc = .45 / os; let sum = 0;
    for (let i = -half; i <= half; i++) { const w = .42 + .5 * Math.cos(Math.PI * i / (half + 1)) + .08 * Math.cos(2 * Math.PI * i / (half + 1)), s = i === 0 ? 2 * fc : Math.sin(TAU * fc * i) / (Math.PI * i); taps[i + half] = s * w; sum += s * w; }
    for (let i = 0; i < taps.length; i++) taps[i] /= sum;
    const n = Math.floor(x.length / os), y = new Float32Array(n);
    for (let k = 0; k < n; k++) { const c = k * os, lo = Math.max(0, c - half), hi = Math.min(x.length - 1, c + half); let acc = 0; for (let j = lo; j <= hi; j++) acc += x[j] * taps[j - c + half]; y[k] = acc; }
    return y;
  }
  function peakNormalize(y, peak) { let m = 0; for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i])); const g = m > 0 ? peak / m : 0; for (let i = 0; i < y.length; i++) y[i] *= g; return y; }
  function dcBlock(y, hz, R) { const k = Math.exp(-TAU * hz / R); let x1 = 0, y1 = 0; for (let i = 0; i < y.length; i++) { const x = y[i], v = x - x1 + k * y1; x1 = x; y1 = v; y[i] = v; } return y; }
  function hipass(y, hz, R) { const k = Math.exp(-TAU * hz / R); for (let pass = 0; pass < 2; pass++) { let x1 = 0, y1 = 0; for (let i = 0; i < y.length; i++) { const x = y[i], v = k * (y1 + x - x1); x1 = x; y1 = v; y[i] = v; } } return y; }
  function lopass(y, hz, R) { const k = Math.exp(-TAU * hz / R); for (let pass = 0; pass < 2; pass++) { let v = 0; for (let i = 0; i < y.length; i++) { v = v * k + y[i] * (1 - k); y[i] = v; } } return y; }
  function shelf(y, fc, g, R) { const k = Math.exp(-TAU * fc / R); let lp = 0; for (let i = 0; i < y.length; i++) { lp = lp * k + y[i] * (1 - k); y[i] += g * (y[i] - lp); } return y; }
  function rmsTrack(y, sr, rate = 100) {
    const hop = Math.round(sr / rate), n = Math.ceil(y.length / hop), out = new Float32Array(n);
    for (let k = 0; k < n; k++) { let s = 0, c = 0; for (let i = Math.max(0, k * hop - hop); i < Math.min(y.length, k * hop + hop); i++) { s += y[i] * y[i]; c++; } out[k] = Math.sqrt(s / Math.max(1, c)); }
    let m = 0; for (const v of out) m = Math.max(m, v); if (m > 0) for (let k = 0; k < n; k++) out[k] /= m; return out;
  }
  const FORM = 5;
  function mixF(out, a, b, t) { for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; }

  /* 비명: ㄲ 파열 → ㅑ에서 ㅏ로 미끄러짐 → 아아아(거칠게 갈라짐, 가끔 목소리가 뒤집힘) → 앙(코울림) → 악(목이 닫히며 뚝) */
  function scream(o) {
    const sr = o.sr, os = o.os || Math.max(1, Math.round(96000 / sr)), R = sr * os, T = 1 / R;
    const L = clamp(o.level ?? 0), dur = o.dur, r = rng(o.seed || 1);
    const N = Math.ceil((dur + .03) * R), y = new Float32Array(N);
    const t0 = .016 + r() * .006, tG = .085, tN = dur * (.66 + .06 * r()), tE = dur - (.045 + .015 * r()), tEnd = dur - .006;
    const J = [430, 2700, 3400, 4150, 5000], JB = [90, 160, 240, 300, 380];
    const A = [1180, 1950, 3080, 4150, 5150], AB = [300, 240, 260, 280, 360];
    const NA = [880, 1650, 2850, 3900, 4900], NB = [300, 260, 320, 380, 470];
    const K = [380, 2050, 2280, 3600, 4500], KB = [140, 160, 220, 320, 420];
    const F = new Float64Array(FORM), B = new Float64Array(FORM), tmpF = new Float64Array(FORM), tmpB = new Float64Array(FORM);
    const res = Array.from({ length: FORM }, () => new Reson()), nasal = new Reson(), burstR = new Reson(), burstR2 = new Reson();
    burstR.set(2950, 700, T); burstR2.set(4300, 1200, T);
    const drift = walk(r, 3.2), drift2 = walk(r, 9), ampWalk = walk(r, 4), formWalk = walk(r, 6), roughWalk = walk(r, 2.4), chaosWalk = walk(r, 5);
    const cracks = [], nCrack = (r() < .35 + .55 * L ? 1 : 0) + (r() < .35 * L ? 1 : 0);
    for (let k = 0; k < nCrack; k++) cracks.push({ at: lerp(t0 + .22, tN - .05, r()), len: .05 + .05 * r(), ratio: r() < .6 ? 1.335 : 1.5 });
    const sdBase = .26 + .30 * L, pdBase = .022 + .032 * L, rdBase = .18 + .24 * L, aspBase = .11 + .11 * L;
    const f0 = o.f0, tremHz = 5.8 + 1.4 * r(), tremPh = r() * TAU, archUp = .05 + .05 * r() + .03 * L, archDown = .02 + .05 * r();
    let phase = 0, parity = 0, cycAmp = 1, cycStretch = 1, jit = 1, noiseS = (o.seed * 7919) >>> 0 || 7, roughPh = r() * TAU, roughHz = 78;
    const nt = Math.ceil(dur * 100) + 2, track = { rate: 100, open: new Float32Array(nt), round: new Float32Array(nt), squeeze: new Float32Array(nt), shiver: new Float32Array(nt) };
    const step = Math.round(R / 100);
    for (let n = 0; n < N; n++) {
      const t = n * T;
      if ((n & 7) === 0) {
        const a = smooth(t0, t0 + tG, t), na = smooth(tN, tN + .14, t), kk = smooth(tE, tEnd - .004, t);
        mixF(tmpF, J, A, a); mixF(tmpB, JB, AB, a);
        for (let i = 0; i < FORM; i++) { tmpF[i] += (NA[i] - tmpF[i]) * na * .85; tmpB[i] += (NB[i] - tmpB[i]) * na * .85; tmpF[i] += (K[i] - tmpF[i]) * kk; tmpB[i] += (KB[i] - tmpB[i]) * kk; }
        const fw = 1 + .025 * formWalk(8 * T);
        for (let i = 0; i < FORM; i++) { F[i] = tmpF[i] * (i ? fw : 1); B[i] = tmpB[i]; }
        if (t > t0 + tG * .6 && kk < .5) F[0] = Math.max(F[0], Math.min(1700, 1.16 * f0 * (1 + .04 * L)));
        for (let i = 0; i < FORM; i++) res[i].set(Math.min(F[i], R * .45), B[i], T);
        nasal.set(290, 110, T);
      }
      let c = t < t0 ? .74 : lerp(.74, 1.0, 1 - Math.pow(1 - smooth(t0, t0 + .12, t), 1.5));
      c *= 1 + archUp * smooth(t0 + .06, t0 + .30, t) - (archUp + archDown) * smooth(t0 + .30, tN + .05, t);
      const na = smooth(tN, tN + .14, t);
      c *= 1 - .035 * na * Math.sin(Math.PI * clamp((t - tN) / Math.max(.05, tE - tN)));
      c *= 1 + .06 * smooth(tE - .02, tEnd, t);
      let crack = 1; for (const k of cracks) { const w = smooth(k.at, k.at + .007, t) * (1 - smooth(k.at + k.len, k.at + k.len + .009, t)); crack *= 1 + (k.ratio - 1) * w; }
      const fNow = f0 * c * crack * (1 + .042 * drift(T) + .008 * drift2(T)) * (1 + (.007 + .012 * L) * Math.sin(TAU * tremHz * t + tremPh));
      phase += fNow * T / (cycStretch * jit);
      if (phase >= 1) {
        phase -= 1; parity ^= 1;
        const chaos = clamp(.5 + .5 * chaosWalk(1 / fNow)) * L;
        const sd = sdBase * (.55 + .45 * Math.abs(roughWalk(1 / fNow))) * (crack > 1.05 ? .35 : 1), pd = pdBase * (crack > 1.05 ? .3 : 1);
        cycAmp = (parity ? 1 - sd : 1) * (.9 + .2 * r()) * (1 - chaos * .35 * r());
        cycStretch = parity ? 1 + pd : 1 - pd;
        jit = 1 + (r() * 2 - 1) * (.018 + .024 * L + chaos * .06);
      }
      const tp = .34, tn = .085, ta = .004 + .006 * (1 - L);
      const e = glottis(phase, tp, tn, ta) * cycAmp;
      noiseS ^= noiseS << 13; noiseS ^= noiseS >>> 17; noiseS ^= noiseS << 5;
      const wn = ((noiseS >>> 0) / 4294967296) * 2 - 1;
      const asp = wn * aspBase * (.35 + .65 * flow(phase, tp, tn)) * 2.2;
      roughHz += ((70 + 30 * (.5 + .5 * roughWalk(0))) - roughHz) * 4 * T;
      roughPh += TAU * roughHz * T;
      const rough = 1 - rdBase * (.5 + .5 * Math.sin(roughPh + 1.7 * Math.sin(roughPh * .37)));
      const env = smooth(t0, t0 + .022, t) * (1 + .07 * ampWalk(T)) * (1 + (.05 + .06 * L) * Math.sin(TAU * tremHz * t + tremPh + 1.1)) * rough * (1 - .16 * na * (1 - smooth(tE - .03, tE, t))) * (1 + .12 * smooth(tE - .05, tE, t));
      const x = (e + asp) * env;
      let v = x; for (let i = 0; i < FORM; i++) v = res[i].run(v);
      v += nasal.run(x) * .55 * na * (1 - smooth(tE - .01, tE + .01, t));
      if (t < t0 + .004) { const be = Math.exp(-Math.max(0, t - .003) / .0035) * smooth(0, .0015, t); v += (burstR.run(wn) * 1.1 + burstR2.run(wn) * .6) * be * 6; }
      const gate = 1 - smooth(tEnd - .022, tEnd, t);
      y[n] = v * gate;
      if (n % step === 0) {
        const ti = Math.round(t * 100);
        if (ti < nt) {
          track.open[ti] = t < t0 ? 0 : smooth(t0 - .004, t0 + .06, t) * (1 - .30 * na) * (1 - smooth(tE - .005, tEnd - .004, t) * .9);
          track.round[ti] = na * (1 - smooth(tE, tEnd, t));
          track.squeeze[ti] = smooth(t0 + .02, t0 + .13, t);
          track.shiver[ti] = env * (rdBase + sdBase) * smooth(t0, t0 + .05, t) * gate;
        }
      }
    }
    dcBlock(y, 70, R); shelf(y, 2300, 5, R); peakNormalize(y, 1);
    const drive = 1.5 + 1.9 * L, td = Math.tanh(drive);
    for (let i = 0; i < y.length; i++) { const v = y[i]; y[i] = Math.tanh(drive * v + .08 * v * v) / td; }
    const data = decimate(y, os); dcBlock(data, 60, sr); peakNormalize(data, .95);
    const tailN = 75, sq = new Float32Array(nt + tailN); sq.set(track.squeeze);
    const lastIdx = Math.min(nt - 1, Math.round(tEnd * 100)); for (let k = lastIdx; k < nt + tailN; k++) sq[k] = Math.pow(Math.max(0, 1 - (k - lastIdx) / tailN), 1.5);
    track.squeeze = sq; track.amp = rmsTrack(data, sr);
    return { data, dur, track };
  }

  /* 들숨: 0.2초에 걸쳐 부풀었다가 천천히 잦아드는 숨. 가슴이 차면(full초) 숨을 멈춘다 */
  function inhale(o) {
    const sr = o.sr, os = o.os || Math.max(1, Math.round(48000 / sr)), R = sr * os, T = 1 / R, r = rng(o.seed || 3);
    const dur = o.dur || 2.6, full = o.full || 1.9, N = Math.ceil(dur * R), y = new Float32Array(N);
    const NF = [[870, 260, .8], [1480, 300, 1], [3600, 200, .55], [4500, 240, .32], [5950, 340, .2]];
    const bands = NF.map(() => new Band()), aw = walk(r, 6), fw = walk(r, 1.5);
    let ns = (o.seed * 2654435761) >>> 0 || 11;
    for (let n = 0; n < N; n++) {
      const t = n * T;
      if ((n & 15) === 0) { const f = smooth(0, full, t), w = 1 + .04 * fw(16 * T); for (let i = 0; i < NF.length; i++) bands[i].set(NF[i][0] * (1 + .12 * f) * w, NF[i][1] * .75, R); }
      ns ^= ns << 13; ns ^= ns >>> 17; ns ^= ns << 5; const wn = ((ns >>> 0) / 4294967296) * 2 - 1;
      const swell = smooth(0, .20, t) * (1 - .55 * smooth(.30, .95, t)) * (1 - .45 * smooth(.95, full, t));
      const env = swell * (1 - smooth(full - .05, full + .20, t)) * (1 + .10 * aw(T));
      let z = 0; for (let i = 0; i < NF.length; i++) z += bands[i].run(wn) * NF[i][2];
      y[n] = z * env;
    }
    hipass(y, 90, R); const data = decimate(y, os); hipass(data, 80, sr); peakNormalize(data, .95);
    return { data, dur, track: { rate: 100, amp: rmsTrack(data, sr) } };
  }

  /* 날숨(한숨): 'ha' = 하아아아, 'hu' = 후우우(입술을 모으고, 끝이 떨린다). depth = 들이쉰 깊이 */
  function exhale(o) {
    const hu = o.kind === 'hu', depth = clamp(o.depth ?? .6);
    const P = hu
      ? { rise: .07, hold: .30 + .18 * depth, tau: .28 + .20 * depth, tail: .08, voice: .45, vOn: .06, vTau: .26 + .14 * depth, trem: .20, fric: .35, bright: .5, bwk: .45 }
      : { rise: .08, hold: .34 + .20 * depth, tau: .30 + .22 * depth, tail: .08, voice: .75, vOn: .035, vTau: .22 + .16 * depth, trem: .06, fric: .06, bright: .75, bwk: .40 };
    const sr = o.sr, os = o.os || Math.max(1, Math.round(48000 / sr)), R = sr * os, T = 1 / R, r = rng(o.seed || 5);
    const dur = Math.min(3.2, P.rise + P.hold + P.tau * 4.2 + .25), N = Math.ceil(dur * R), y = new Float32Array(N);
    const NF = hu ? [[350, 200, .5], [820, 260, 1], [2300, 350, .45], [3400, 380, .30], [4400, 500, .2], [5400, 450, .12]]
                  : [[880, 220, .8], [1380, 340, 1], [2560, 380, .55], [3650, 400, .40], [4350, 560, .28], [5360, 380, .2], [6400, 380, .12]];
    const bands = NF.map(() => new Band()), res = Array.from({ length: FORM }, () => new Reson()), fr1 = new Band(), fr2 = new Band();
    const VF = hu ? [330, 780, 2300, 3300, 4300] : [740, 1240, 2500, 3500, 4500], VB = hu ? [110, 120, 200, 280, 380] : [140, 150, 200, 280, 380];
    const fStart = (o.f0 || 120) * (1 + .12 * depth), fEnd = (o.f0 || 120) * .70;
    const pw = walk(r, 2.5), aw = walk(r, 5), fw = walk(r, 1.8);
    const tremHz = hu ? 5.6 + .5 * r() : 5.0 + .6 * r(), tremPh = r() * TAU;
    let phase = 0, cycAmp = 1, jit = 1, ns = (o.seed * 40503) >>> 0 || 13; const vs = { lp: 0, h1: 0, h2: 0 };
    const nt = Math.ceil(dur * 100) + 2, track = { rate: 100, flow: new Float32Array(nt), voice: new Float32Array(nt), open: new Float32Array(nt), round: new Float32Array(nt) };
    const pk = P.rise + P.hold, step = Math.round(R / 100);
    for (let n = 0; n < N; n++) {
      const t = n * T;
      if ((n & 15) === 0) {
        const m = smooth(pk, dur * .8, t), close = 1 - .22 * m, w = 1 + .025 * fw(16 * T);
        for (let i = 0; i < NF.length; i++) bands[i].set(NF[i][0] * (i === 0 ? close : w * (1 - .06 * m)), NF[i][1] * P.bwk * (1 + .4 * m), R);
        for (let i = 0; i < FORM; i++) res[i].set(VF[i] * (i === 0 ? close : w), VB[i] * (1 + .6 * m), T);
        fr1.set(hu ? 1500 : 3000, hu ? 1600 : 3000, R); fr2.set(hu ? 3800 : 6000, 3500, R);
      }
      const air = smooth(0, P.rise, t) * (t < pk ? 1 - .12 * smooth(P.rise, pk, t) : (1 - .12) * (Math.exp(-(t - pk) / P.tau) * (1 - P.tail) + P.tail * (1 - smooth(pk, dur * .9, t)))) * (1 - smooth(dur * .82, dur, t)) * (1 + .13 * aw(T));
      const vEnv = smooth(P.vOn, P.vOn + .07, t) * Math.exp(-Math.max(0, t - P.vOn - .07) / P.vTau) * (1 + P.trem * smooth(.15, .6, t) * Math.sin(TAU * tremHz * t + tremPh));
      const f0 = lerp(fStart, fEnd, 1 - Math.exp(-Math.max(0, t - P.vOn) / (.35 + .3 * depth))) * (1 + .015 * pw(T)) * (1 + .012 * Math.sin(TAU * tremHz * t + tremPh));
      phase += f0 * T * jit;
      if (phase >= 1) { phase -= 1; cycAmp = .88 + .24 * r(); jit = 1 + (r() * 2 - 1) * .022; }
      const g = glottis(phase, .5, .3, .12) * cycAmp;
      vs.lp += (g - vs.lp) * .45; vs.h1 += (vs.lp - vs.h1) * .03; vs.h2 += (vs.lp - vs.h1 - vs.h2) * .03;
      let zv = (vs.lp - vs.h1 - vs.h2) * vEnv; for (let i = 0; i < FORM; i++) zv = res[i].run(zv);
      ns ^= ns << 13; ns ^= ns >>> 17; ns ^= ns << 5; const wn = ((ns >>> 0) / 4294967296) * 2 - 1;
      const src = wn * air * (.7 + .3 * flow(phase, .5, .3) * Math.min(1, vEnv * 2));
      let zn = 0; for (let i = 0; i < NF.length; i++) zn += bands[i].run(src) * NF[i][2];
      zn += (fr1.run(wn) * .6 + fr2.run(wn) * .35) * air * P.fric * (hu ? (1 - .6 * smooth(.08, .45, t)) : 1) * P.bright;
      y[n] = zn * 2.4 + zv * P.voice * .55;
      if (n % step === 0) {
        const ti = Math.round(t * 100);
        if (ti < nt) { track.flow[ti] = air; track.voice[ti] = vEnv; track.open[ti] = (hu ? .25 : .92) * smooth(0, .07, t) * (1 - .6 * smooth(pk, dur * .85, t)); track.round[ti] = hu ? smooth(0, .1, t) * (1 - .3 * smooth(dur * .6, dur, t)) : .3 * smooth(dur * .5, dur, t); }
      }
    }
    hipass(y, 110, R); lopass(y, 7500, R); const data = decimate(y, os); hipass(data, 100, sr); peakNormalize(data, .95);
    track.amp = rmsTrack(data, sr);
    return { data, dur, track };
  }

  /* 띵샤 금속음: 테두리가 닿는 짧은 찰칵, 그리고 조금 어긋난 두 울림이 맥놀이하며 길게 남는다 */
  function ting(o) {
    const sr = o.sr, dur = o.dur || 4.6, N = Math.ceil(dur * sr), y = new Float32Array(N);
    const f = o.f || 2637.02, det = o.det ?? 9.5, parts = [[1, 1, 1.25], [2.31, .30, .42], [3.89, .10, .17], [5.12, .05, .08]];
    let ns = 99991 + (o.seed || 0) * 17, lp1 = 0;
    for (let n = 0; n < N; n++) {
      const t = n / sr; let v = 0;
      for (const [ratio, a, tau] of parts) { const fr = f * ratio; if (fr > sr * .47) continue; v += a * Math.exp(-t / tau) * (Math.sin(TAU * fr * t) + .85 * Math.sin(TAU * (fr + det * ratio) * t + 1.3)); }
      v *= smooth(0, .0015, t);
      ns ^= ns << 13; ns ^= ns >>> 17; ns ^= ns << 5; const wn = ((ns >>> 0) / 4294967296) * 2 - 1;
      lp1 += (wn - lp1) * .55; v += (wn - lp1) * Math.exp(-t / .006) * 1.4;
      y[n] = v;
    }
    peakNormalize(y, .95);
    return { data: y, dur, track: {} };
  }
  return { scream, inhale, exhale, ting };
}
const VOICE = voiceLib();

/* ================= 3. 소리 엔진 ================= */
class ExtraAudio {
  constructor(engine) {
    this.e = engine; const c = this.c = engine.ctx; this.sr = c.sampleRate;
    this.out = c.createGain(); this.out.connect(engine.master);              // 5.4 kHz 저역통과를 거치지 않는다: 비명은 찢어지게 들려야 한다
    this.wet = c.createGain(); this.wet.gain.value = 1; this.wet.connect(engine.convolver);
    this.ringBus = c.createGain(); this.ringBus.connect(engine.bus);          // 금속음은 UI 팅샤와 같은 길
    const rs = c.createGain(); rs.gain.value = .32; this.ringBus.connect(rs); rs.connect(engine.convolver);
    this.voices = []; this.recent = []; this.jobs = new Map(); this.jobId = 0; this.seed = (Date.now() % 100000) + 17;
    const pool = make => ({ items: [], pending: 0, make });
    this.pools = {
      scream: [0, 1, 2].map(lv => [0, 1].map(side => pool(() => ({ fn: 'scream', o: { f0: TUNE.scream.f0[side] * (1 + .04 * lv) * (.97 + .06 * Math.random()), level: TUNE.scream.level[lv] + .06 * (Math.random() - .5), dur: TUNE.scream.dur[lv] * (.92 + .16 * Math.random()) } })))),
      hu: pool(() => ({ fn: 'exhale', o: { kind: 'hu', depth: .30 + .1 * Math.random(), f0: TUNE.sigh.f0[1] } })),
      ha: pool(() => ({ fn: 'exhale', o: { kind: 'ha', depth: .62 + .1 * Math.random(), f0: TUNE.sigh.f0[0] } })),
      deep: pool(() => ({ fn: 'exhale', o: { kind: 'ha', depth: .92 + .08 * Math.random(), f0: TUNE.sigh.f0[0] * .97 } }))
    };
    this.tingBuf = [null, null]; this.inhaleBuf = null;
    this.worker = this.makeWorker();
  }
  makeWorker() {
    try {
      const src = `const VS=(${voiceLib.toString()})();onmessage=e=>{const m=e.data;try{const r=VS[m.fn](m.o);const tr=r.track||{},tf=[r.data.buffer];for(const k in tr)if(tr[k]&&tr[k].buffer)tf.push(tr[k].buffer);postMessage({id:m.id,data:r.data,track:tr,dur:r.dur},tf);}catch(err){postMessage({id:m.id,error:String(err&&err.message||err)});}};`;
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = ev => { const m = ev.data, job = this.jobs.get(m.id); if (!job) return; this.jobs.delete(m.id); if (m.error) job.fail(m); else job.done(m); };
      w.onerror = () => { this.worker = null; for (const job of this.jobs.values()) job.retry(); this.jobs.clear(); };
      return w;
    } catch (_) { return null; }
  }
  wrap(r) {
    const b = this.c.createBuffer(1, Math.max(1, r.data.length), this.sr); b.copyToChannel(r.data, 0);
    /* 한숨: 지금까지 내쉰 숨의 비율(0→1). 오카리나가 이만큼 쪼그라든다 */
    const tr = r.track || {};
    if (tr.flow && !tr.out) { const n = tr.flow.length, out = new Float32Array(n); let sum = 0; for (let i = 0; i < n; i++) { sum += tr.flow[i]; out[i] = sum; } if (sum > 0) for (let i = 0; i < n; i++) out[i] /= sum; tr.out = out; }
    return { buffer: b, track: tr, dur: r.dur };
  }
  gen(fn, o) {
    o = Object.assign({ sr: this.sr, seed: (this.seed = (this.seed * 1103515245 + 12345) >>> 0) || 7 }, o);
    return new Promise(resolve => {
      const local = () => setTimeout(() => resolve(this.wrap(VOICE[fn](o))), 0);
      if (!this.worker) return local();
      const id = ++this.jobId;
      this.jobs.set(id, { done: m => resolve(this.wrap(m)), fail: local, retry: local });
      this.worker.postMessage({ id, fn, o });
    });
  }
  refill(p, size = 2) { while (p.items.length + p.pending < size) { p.pending++; const job = p.make(); this.gen(job.fn, job.o).then(x => { p.pending--; p.items.push(x); }); } }
  takeNow(p) { if (p.items.length) return p.items.shift(); const job = p.make(); return this.wrap(VOICE[job.fn](Object.assign({ sr: this.sr, seed: (this.seed = (this.seed * 1103515245 + 12345) >>> 0) || 7 }, job.o))); }
  warm(mode) {
    const T = this.pools;
    if (mode === 'tingsha' || mode === 'all') {
      for (const side of [0, 1]) this.refill(T.scream[0][side], 1);
      if (!this.tingBuf[0] && !this.tingWait) this.tingWait = Promise.all([0, 1].map(side => this.gen('ting', { f: TUNE.ting.f[side], det: side ? 8.2 : 9.5 }).then(x => { this.tingBuf[side] = x; })));
    }
    if (mode === 'ocarina' || mode === 'all') {
      if (!this.inhaleBuf && !this.inhaleWait) this.inhaleWait = this.gen('inhale', { dur: 2.6, full: 1.9 }).then(x => { this.inhaleBuf = x; });
      this.refill(T.hu, 1); this.refill(T.ha, 1);
    }
    clearTimeout(this.warmMore);
    this.warmMore = setTimeout(() => {
      if (mode !== 'ocarina') { for (const lv of [0, 1, 2]) for (const side of [0, 1]) this.refill(T.scream[lv][side], lv === 2 ? 1 : 2); }
      if (mode !== 'tingsha') { this.refill(T.hu); this.refill(T.ha); this.refill(T.deep, 1); }
    }, mode === 'all' ? 2500 : 300);
  }
  play(item, { when, gain = 1, pan = 0, dest = this.out, room = 0, kind, side = 0 }) {
    const c = this.c, s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner();
    s.buffer = item.buffer; g.gain.value = gain; p.pan.value = pan;
    s.connect(g); g.connect(p); p.connect(dest);
    let send = null; if (room > 0) { send = c.createGain(); send.gain.value = room; p.connect(send); send.connect(this.wet); }
    const v = { kind, side, src: s, g, p, send, start: when, end: when + item.buffer.duration, track: item.track, dur: item.dur, gone: false };
    s.onended = () => this.cleanup(v);
    s.start(when); this.voices.push(v);
    return v;
  }
  cleanup(v) { if (v.gone) return; v.gone = true; for (const n of [v.src, v.g, v.p, v.send]) if (n) try { n.disconnect(); } catch (_) {} this.voices = this.voices.filter(x => x !== v); }
  fade(v, sec = .05, at = this.c.currentTime) {
    if (v.gone || v.fading) return; v.fading = true;
    const g = v.g.gain, t = Math.max(at, this.c.currentTime); g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + sec);
    try { v.src.stop(t + sec + .02); } catch (_) { this.cleanup(v); }
    v.cut = t + sec;
  }
  stop() { for (const v of this.voices.slice()) this.fade(v, .06); this.recent = []; this.breath = null; }
  lag() { return this.e.lag ? this.e.lag() : 0; }
  /* 띵샤를 부딪친다: 두 장이 각자 비명, 그리고 금속 울림 */
  strike(lv, delay) {
    const c = this.c, when = c.currentTime + delay, out = [];
    for (const v of this.voices) if (v.kind === 'scream') this.fade(v, .035, when);
    for (const side of [0, 1]) {
      const item = this.takeNow(this.pools.scream[lv][side]);
      const v = this.play(item, { when: when + side * .014, gain: TUNE.scream.gain * (side ? .92 : 1), pan: side ? .34 : -.34, room: TUNE.scream.room, kind: 'scream', side });
      v.lv = lv;
      this.recent.push(v); out.push(v);
      this.refill(this.pools.scream[lv][side], lv === 2 ? 1 : 2);
    }
    for (const side of [0, 1]) if (this.tingBuf[side]) this.play(this.tingBuf[side], { when, gain: TUNE.ting.gain * (.8 + .2 * lv), pan: side ? .42 : -.42, dest: this.ringBus, kind: 'ting', side });
    this.recent = this.recent.filter(v => c.currentTime < v.start + v.dur + 1.2);
    return out;
  }
  /* 비명이 지금 어디쯤인지: 얼굴과 떨림이 이 값을 따른다 */
  screamState(side) {
    const now = this.c.currentTime - this.lag(); let best = null;
    for (const v of this.recent) if (v.side === side && now >= v.start - .001 && (!best || v.start > best.start)) best = v;
    if (!best) return null;
    const t = now - best.start, cut = best.cut !== undefined && now > best.cut ? Math.max(0, 1 - (now - best.cut) / .12) : 1;
    const S = k => sampleTrack(best.track, k, t);
    return { t, lv: best.lv || 0, open: S('open') * cut, round: S('round'), squeeze: S('squeeze'), shiver: S('shiver') * cut, amp: S('amp') * cut };
  }
  /* 오카리나: 들숨 시작 */
  breatheIn() {
    const c = this.c, now = c.currentTime;
    for (const v of this.voices) if (v.kind === 'inhale' || v.kind === 'exhale') this.fade(v, .08);
    const b = this.breath = { in: now + .01, out: null, v: null, ex: null, held: 0 };
    if (this.inhaleBuf) b.v = this.play(this.inhaleBuf, { when: b.in, gain: TUNE.sigh.inhaleGain, kind: 'inhale', room: TUNE.sigh.room * .6 });
    return b;
  }
  /* 손을 뗐다: 들이쉰 시간만큼 깊은 한숨 */
  breatheOut(minIn = .62) {
    const b = this.breath; if (!b || b.out !== null) return null;
    const c = this.c, now = c.currentTime, held = now - b.in, inEnd = Math.max(now, b.in + minIn);
    b.held = Math.max(held, minIn);
    const pool = b.held < .9 ? this.pools.hu : b.held < 1.7 ? this.pools.ha : (this.pools.deep.items.length ? this.pools.deep : this.pools.ha);
    const item = this.takeNow(pool);
    if (b.v) this.fade(b.v, .07, inEnd);
    const when = inEnd + .11;
    b.out = when; b.ex = this.play(item, { when, gain: TUNE.sigh.gain, kind: 'exhale', room: TUNE.sigh.room });
    b.kind = pool === this.pools.hu ? 'hu' : 'ha';
    this.refill(this.pools.hu); this.refill(this.pools.ha); this.refill(this.pools.deep, 1);
    return b;
  }
  breathState() {
    const b = this.breath; if (!b) return null;
    const now = this.c.currentTime - this.lag(), full = 1.9;
    if (b.out === null || now < b.out) {
      const tin = Math.max(0, now - b.in), inEnd = b.out === null ? Infinity : b.out - .11;
      const drawn = Math.min(tin, inEnd - b.in);
      return { phase: 'in', fill: Math.pow(clamp(drawn / 1.7), .7), t: tin, holdGap: now > inEnd };
    }
    const t = now - b.out, tr = b.ex.track, S = k => sampleTrack(tr, k, t);
    if (t > b.ex.dur + 1.6) { this.breath = null; return null; }
    return { phase: 'out', t, kind: b.kind, held: b.held, dur: b.ex.dur, flow: S('flow'), voice: S('voice'), open: S('open'), round: S('round'), amp: S('amp'), out: t >= b.ex.dur ? 1 : S('out') };
  }
}
function sampleTrack(tr, key, t) {
  const a = tr && tr[key]; if (!a || !a.length || t < 0) return 0;
  const x = t * (tr.rate || 100), i = Math.floor(x); if (i >= a.length - 1) return i >= a.length ? 0 : a[a.length - 1];
  return a[i] + (a[i + 1] - a[i]) * (x - i);
}

/* ================= 4. 조각 얼굴: 싱잉볼 얼굴(hollowFace)을 다른 표면 위로 옮긴다 =================
 * 볼 얼굴 함수들은 전역 faceXYZ(x,y,pose,extra)를 거쳐 점을 만든다. 만드는 동안만 그 함수를
 * 새 표면용으로 바꿔 끼우면, 볼과 똑같은 눈·코·입·주름과 표정 단계(open / grief / wail)가 그대로 새겨진다.
 */
function onSurface(mapper, build, eyeFn, mouthFn) {
  const keep = window.faceXYZ, keepEye = window.eyeContour, keepMouth = window.mouthContour;
  window.faceXYZ = mapper; if (eyeFn) window.eyeContour = eyeFn; if (mouthFn) window.mouthContour = mouthFn;
  try { return build(); } finally { window.faceXYZ = keep; window.eyeContour = keepEye; window.mouthContour = keepMouth; }
}
const BOWL_EYE = window.eyeContour;
/* 볼 얼굴은 입을 벌리면 눈도 같이 뜬다(울먹이는 눈). 오카리나 한숨은 눈을 감은 채로 */
const EYES = {
  closed: (side, a, p) => BOWL_EYE(side, a, { open: p.open * .10, grief: p.grief, blink: p.blink })
};
/* 평평한 판 위에서는 볼 얼굴의 넓은 부풂이 얼굴 테두리에서 벽처럼 끊겨 보인다: 가장자리로 갈수록 부드럽게 눕힌다 */
function faceWindow(x, y) { return (1 - smooth(1.10, 1.64, Math.abs(x))) * smooth(.42, .80, y) * (1 - smooth(2.76, 3.03, y)); }
/* 볼 얼굴의 울음 표정은 아래 얼굴 전체가 크게 부푼다(볼은 원통이라 자연스럽다). 평평한 판에서는 그 덩어리가 상자처럼 보여서
 * 큰 부풂만 덜어내고 주름·눈·코·입은 그대로 둔다. keep = 남길 비율 */
function flatSkin(x, y, g, wl, keep) {
  const G = (cx, cy, wx, wy) => gauss(x, y, cx, cy, wx, wy);
  const bulk = g * (.26 * G(0, .93, 1.14, .60) + .15 * (G(-.93, 1.79, .43, .38) + G(.93, 1.79, .43, .38))) + wl * .10 * G(0, .74, .52, .20);
  return (brassSkin(x, y, g, wl) - (1 - keep) * bulk) * faceWindow(x, y);
}
/* 볼 얼굴(hollowFace)과 똑같은 조각을 여러 토막으로 나눠 만든다.
 * 한 번에 다 만들면 0.5~1초쯤 화면이 멈춘다. 토막마다 얼굴 판 몇 줄씩만 만들고 사이사이 화면을 그린다.
 * 원본 hollowFace의 구성이 바뀌어 있으면 통째로 한 번에 만든다. */
const HOLLOW_SPLIT = String(hollowFace).replace(/\s+/g, '') === 'functionhollowFace(lod=1){constI=n=>Math.max(3,Math.round(n*lod));returnmergeMorph([morphGrid(I(192),I(62),facePoint),morphGrid(I(112),I(24),(u,v,p)=>eyePatch(-1,u,v,p)),morphGrid(I(112),I(24),(u,v,p)=>eyePatch(1,u,v,p)),plainFace(-.18,.18,2.04,2.81,I(24),I(38)),plainFace(-1.66,-1.56,2.04,2.81,5,I(34)),plainFace(1.56,1.66,2.04,2.81,5,I(34)),plainFace(-1.66,1.66,2.81,FACE.top,I(110),I(18))]);}';
function faceSteps(out, mapper, lod, cavityDepth, lensDepth, eyeFn, mouthFn) {
  const I3 = n => Math.max(3, Math.round(n * lod)), I = n => Math.max(4, Math.round(n * lod)), skin = [], lens = [], nos = [], steps = [];
  const S = f => steps.push(() => onSurface(mapper, f, eyeFn, mouthFn));
  /* 격자 하나를 가로줄 몇 개씩 나눠 만든다. 이음매의 점은 원래 격자와 같은 자리라 틈이 없다 */
  const strips = (n, m, fn, rows) => {
    const k = Math.max(1, Math.round(m / rows));
    for (let s = 0; s < k; s++) { const j0 = Math.round(m * s / k), j1 = Math.round(m * (s + 1) / k); S(() => skin.push(morphGrid(n, j1 - j0, (u, v, p) => fn(u, (j0 + v * (j1 - j0)) / m, p)))); }
  };
  if (HOLLOW_SPLIT) {
    strips(I3(192), I3(62), facePoint, 6);
    for (const side of [-1, 1]) strips(I3(112), I3(24), (u, v, p) => eyePatch(side, u, v, p), 10);
    S(() => skin.push(plainFace(-.18, .18, 2.04, 2.81, I3(24), I3(38)), plainFace(-1.66, -1.56, 2.04, 2.81, 5, I3(34)), plainFace(1.56, 1.66, 2.04, 2.81, 5, I3(34))));
    S(() => skin.push(plainFace(-1.66, 1.66, 2.81, FACE.top, I3(110), I3(18))));
  } else S(() => skin.push(hollowFace(lod)));
  for (const side of [-1, 1]) S(() => {
    lens.push(morphGrid(I(96), I(10), (u, v, p) => { const c = eyeContour(side, u * TAU, p), k = 1 - v * .999; return mapper(lerp(side * .77, c[0], k), lerp(2.37, c[1], k), p, .007 - v * (lensDepth[0] + lensDepth[1] * p.open)); }));
    nos.push(morphGrid(I(20), 4, (u, v, p) => nostrilPoint(side, u, v, p)));
  });
  let cavity = null;
  S(() => { cavity = morphGrid(I(150), I(14), (u, v, p) => { const c = mouthContour(u * TAU, p), k = 1 - v * .999; return mapper(c[0] * k, lerp(FACE.cy - p.open * .17, c[1], k), p, .010 - v * (cavityDepth[0] + cavityDepth[1] * p.open)); }); });
  steps.push(() => { out.face = { skin: mergeMorph(skin), eyes: mergeMorph(lens), nostrils: mergeMorph(nos), cavity }; });
  return steps;
}
/* face-plane in-plane warp, identical to the bowls' faceXYZ */
function faceWarp(x, y, p) {
  const g = p.grief, e = (1 - smooth(1.40, 1.66, Math.abs(x))) * smooth(.40, .59, y) * (1 - smooth(2.84, 3.035, y));
  return [x + g * e * .055 * Math.sin(y * 4.0 + .2) * Math.sin(x * 2.2), y + g * e * (.038 * Math.sin(x * 3.7) + .021 * Math.sin(x * 8.6))];
}
const FACE_MID = (FACE.bottom + FACE.top) / 2;

/* ================= 5. 띵샤 =================
 * 지름 2.4의 두꺼운 주물 청동 판. 가운데 꼭지(가죽끈 매듭)가 얼굴 이마 위에 오고, 얼굴은 판 아래쪽에 새겨진다.
 * 판의 로컬 좌표: +y = 바깥면(얼굴 쪽), 얼굴의 위쪽 = -z.
 */
const TG = { R: 1.2, Ri: 1.12, SC: .42, Z0: .73, relief: 1.15, lift: .003, boss: .10 };
function plateTop(r) { const q = Math.min(1, r / TG.Ri), b = Math.min(1, r / TG.boss); return .058 + .115 * (1 - q * q) + .060 * Math.pow(Math.cos(b * Math.PI / 2), 2); }
function plateNormal(X, Z) { const e = .003, f = (x, z) => plateTop(Math.hypot(x, z)); return V.norm([-(f(X + e, Z) - f(X - e, Z)) / (2 * e), 1, -(f(X, Z + e) - f(X, Z - e)) / (2 * e)]); }
/* 띵샤 판 위의 한 점: 얼굴 좌표 (x, y)를 판 위로 옮기고 판 바깥쪽으로 rel(얼굴 단위)만큼 띄운다.
 * 얼굴 사각형의 아래 귀퉁이는 판 밖으로 나가므로 판 테두리 안쪽으로 부드럽게 접어 넣는다 (귀퉁이엔 높낮이가 없다) */
function tingPlace(x, y, rel) {
  let X = x * TG.SC, Z = TG.Z0 - (y - FACE.cy) * TG.SC;
  const r = Math.hypot(X, Z), r0 = .96, rc = TG.Ri - .004;
  if (r > r0) { const rr = r0 + (rc - r0) * Math.tanh((r - r0) / (rc - r0)); X *= rr / r; Z *= rr / r; }
  const n = plateNormal(X, Z), h = plateTop(Math.hypot(X, Z)), k = rel * TG.SC * TG.relief + TG.lift;
  return [X + n[0] * k, h + n[1] * k, Z + n[2] * k];
}

/* ----- 띵샤 얼굴: 개빡쳐서 악쓰는 얼굴 -----
 * 볼 얼굴과 같은 뼈대(입 둘레·눈 둘레에서 바깥으로 뻗는 격자, 미간·이마 판)에 표정만 새로 깎았다.
 * 좌표는 볼 얼굴과 같다: x -1.66~1.66, y 0.40(턱)~3.035(이마), 입 가운데 y 1.28, 눈 y 2.4.
 *  · 쉴 때: 눈썹을 내리깔고 입꼬리를 처뜨린 채 꾹 다문, 부글부글한 얼굴
 *  · expression(분노): 눈썹이 V자로 내리꽂히고, 미간에 11자 주름, 콧등이 구겨지고 콧방울이 벌어지고 광대가 치솟는다
 *  · open(입): 네모나게 찢어지며 윗니·아랫니가 드러난다
 *  · blink(끝까지): 주름이 더 깊어지고 눈이 더 가늘어진다. 연달아 칠수록 여기까지 간다 (입 모양은 건드리지 않는다)
 */
/* 입: 다물면 양 끝이 처진 채 꾹 다물고, 벌리면 아래가 조금 더 넓은 둥근 네모로 찢어진다 */
function rgMouthShape(p) {
  const o = p.open, g = p.grief;
  return { o, g, W: .52 + .05 * g + .38 * o, yc: 1.29 - .05 * o, up: .014 + .25 * o + .07 * o * g, dn: .014 + .44 * o, n: 2 + 2.8 * o };
}
function rgMouth(a, p) {
  const M = rgMouthShape(p), c = Math.cos(a), s = Math.sin(a), e = 2 / M.n;
  const cx = Math.sign(c) * Math.pow(Math.abs(c), e), sy = Math.sign(s) * Math.pow(Math.abs(s), e);
  const x = M.W * cx * (1 - .08 * M.o * sy);
  const bend = -(.045 + .05 * M.g) * (1 - M.o) * c * c + (s > 0 ? .035 * M.o * M.g * (1 - Math.abs(cx)) : 0);
  return [x, M.yc + sy * (s > 0 ? M.up : M.dn) + bend];
}
/* 눈: 바깥 끝이 올라간 비스듬한 눈. 위 눈꺼풀은 평평하게 깎이고 코 쪽에서 더 내려와 눈썹에 눌린다 */
function rgEyeShape(p) {
  const g = p.grief, m = p.blink || 0;
  return { cx: .79, hw: .42, mid: 2.40 - .02 * g, tilt: .05 + .04 * g, ht: .112 - .026 * g - .010 * m, hb: .060 - .010 * g - .005 * m };
}
function rgEye(side, a, p) {
  const E = rgEyeShape(p), c = Math.cos(a), s = Math.sin(a);
  const top = Math.pow(Math.max(0, s), .55) * (.62 + .46 * c), bot = Math.pow(Math.max(0, -s), .9) * (.95 + .05 * c);
  return [side * (E.cx + E.hw * c), E.mid + E.tilt * c + E.ht * top - E.hb * bot];
}
function rgEyeCenter(side, p) { const E = rgEyeShape(p); return [side * (E.cx + .05), E.mid + .03]; }
/* 눈썹 선: 안쪽 끝에서 바깥 끝까지. 화날수록 안쪽이 눈 바로 위로 내리꽂힌다 */
function rgBrow(ax, p) {
  const g = p.grief, m = p.blink || 0, xi = .15, xo = 1.42;
  const t = clamp((ax - xi) / (xo - xi)), yi = 2.66 - .16 * g - .03 * m, yo = 2.82 + .08 * g;
  return { t, yi, y: lerp(yi, yo, t) + (.022 + .016 * g) * Math.sin(Math.PI * t) };
}
function rgWindow(x, y) { return (1 - smooth(1.34, 1.64, Math.abs(x))) * smooth(.42, .72, y) * (1 - smooth(2.95, 3.035, y)); }
/* 얼굴 높낮이 (볼 얼굴 좌표 단위). g = 분노, m = 끝까지, o = 입 */
function rageSkin(x, y, p) {
  const g = p.grief, m = p.blink || 0, o = p.open, ax = Math.abs(x), sx = x < 0 ? -1 : 1;
  const G = (cx, cy, wx, wy) => gauss(x, y, cx, cy, wx, wy), E = (d, w) => Math.exp(-(d / w) * (d / w));
  let z = 0;
  /* 코: 콧날과 코끝. 화나면 콧방울이 벌어지며 들리고, 콧등에 가로 주름이 잡힌다 */
  z += (.055 + .02 * g) * G(0, 2.20, .24, .42) + (.09 + .045 * g) * G(0, 1.95, .28, .17);
  z += (.025 + .06 * g + .02 * m) * (G(-.27 - .04 * g, 1.91 + .03 * g, .15 + .03 * g, .10) + G(.27 + .04 * g, 1.91 + .03 * g, .15 + .03 * g, .10));
  z += .015 * G(0, 1.69, .10, .16);
  const nose = Math.exp(-Math.pow(ax / .21, 4));
  for (let k = 0; k < 3; k++) { const yy = 2.10 + k * .082; z -= (g * (.020 - k * .004) + m * .008) * E(y - yy, .019) * nose; z += g * .010 * E(y - yy - .04, .022) * nose; }
  /* 눈썹: 안쪽이 두꺼운 근육 덩어리. 아래쪽은 깎아지르고 위쪽은 완만하다. 그 아래로 눈두덩이 푹 꺼진다 */
  const B = rgBrow(ax, p), d = y - B.y, be = smooth(-.12, .10, B.t) * (1 - smooth(.78, 1.02, B.t)), thick = 1.25 - .5 * B.t;
  z += (.07 + .08 * g + .03 * m) * thick * be * (d < 0 ? E(d, .055 + .012 * g) : E(d, (.13 + .04 * g) * thick));
  z -= (.03 + .05 * g + .015 * m) * be * E(d + .10 + .015 * g, .045);
  /* 미간: 눈썹 안쪽 끝이 뭉쳐 솟고, 그 위 이마도 불룩해진다. 사이로 11자 주름, 콧뿌리에 가로 주름 */
  z += (.035 + .07 * g + .02 * m) * (G(-(.20 - .03 * g), B.yi + .05, .12, .11) + G(.20 - .03 * g, B.yi + .05, .12, .11));
  z += .03 * g * (G(-.17, B.yi + .23, .14, .09) + G(.17, B.yi + .23, .14, .09));
  const gw = Math.exp(-Math.pow((y - (B.yi + .12)) / .19, 4));
  z -= (.012 + .05 * g + .02 * m) * (E(x - .065, .024) + E(x + .065, .024)) * gw;
  z += (.006 + .02 * g) * E(x, .030) * gw;
  const y0 = B.yi - .09, nr = Math.exp(-Math.pow(x / .16, 4));
  z -= (.006 + .03 * g + .01 * m) * E(y - y0, .020) * nr;
  z += .015 * g * E(y - y0 + .04, .03) * nr;
  /* 광대가 치솟고 아래 눈꺼풀이 밀려 올라간다 */
  z += (.04 + .09 * g + .03 * o) * G(sx * .86, 1.86 + .05 * g, .40, .30);
  const ex = (ax - .80) / .44, ew = Math.exp(-Math.pow(ex, 4)), ycr = 2.22 - .09 * ex * ex + .04 * g;
  z -= (.006 + .022 * g) * E(y - ycr, .03) * ew;
  z += .02 * g * E(y - ycr - .06, .035) * ew;
  /* 팔자 주름: 콧방울 옆에서 입꼬리 바깥으로 휘어 내려간다. 광대 살이 그 위로 덮인다 */
  const ft = (1.95 - y) / 1.05, fx = .34 + .62 * Math.pow(clamp(ft), .75) + .06 * o, fe = smooth(-.05, .15, ft) * (1 - smooth(.80, 1.05, ft));
  z -= (.008 + .045 * g + .03 * o) * E(ax - fx, .05) * fe;
  z += (.012 + .06 * g + .04 * o) * E(ax - fx - .12, .10) * fe;
  /* 입 둘레: 입꼬리 매듭, 입꼬리에서 턱으로 처지는 주름, 꾹 다문 턱의 오돌토돌한 주름, 앙다문 턱 근육 */
  const M = rgMouthShape(p), mcx = M.W + .06, mcy = M.yc - (.045 + .05 * g) * (1 - o);
  z += (.010 + .010 * g) * G(sx * mcx, mcy, .09, .09);
  const xm = M.W - .03 - .05 * (mcy - y), mw = smooth(mcy - .40, mcy - .26, y) * (1 - smooth(mcy - .12, mcy - .02, y));
  z -= (.004 + .010 * g) * (1 - .5 * o) * E(ax - xm, .04) * mw;
  z += (.012 + .035 * (1 - o)) * G(0, .66, .32, .15);
  z += .012 * (1 - o) * (.5 + .5 * g) * Math.cos(x * 31) * Math.cos(y * 29) * G(0, .66, .30, .13);
  z += .025 * (1 - o) * G(sx * 1.28, 1.05, .16, .24);
  return z * rgWindow(x, y);
}
/* 이: 윗입술 안쪽에 윗니 8개가 매달리고, 아랫입술 안쪽에 아랫니 8개가 선다. 입을 다물면 길이가 0이 되어 숨는다.
 * u는 입 너비의 86%를 고르게 나눈 자리, v는 잇몸(0)에서 이 끝(1)까지 */
function rgTooth(upper, u, v, p) {
  const N = 8, i = Math.min(N - 1, Math.floor(u * N)), q = u * N - i, M = rgMouthShape(p);
  const xn = (2 * u - 1) * (upper ? .86 : .80), c = Math.sign(xn) * Math.pow(Math.abs(xn), M.n / 2), s = Math.sqrt(Math.max(0, 1 - c * c));
  const P = rgMouth(Math.atan2(upper ? s : -s, c), p), o = p.open, canine = upper && (i === 1 || i === N - 2) ? 1.14 : 1;
  const tip = (.74 + .26 * Math.pow(Math.sin(Math.PI * q), .45)) * canine;
  const L = (upper ? .15 : .11) * o * tip, root = .016 * o, dir = upper ? -1 : 1;
  return { x: P[0], y: P[1] + dir * (root + v * L), q, P };
}
function tingRageMapper(x, y, p, extra = 0) { return tingPlace(x, y, rageSkin(x, y, p) + extra); }
/* 입 둘레 격자: 입 테두리에서 얼굴 아래 사각형까지. 입술은 얇게 말려 있다 */
function rgFacePoint(u, v, p) {
  const a = u * TAU, inside = rgMouth(a, p), outside = faceBoundary(a), k = Math.pow(v, .86);
  const x = lerp(inside[0], outside[0], k), y = lerp(inside[1], outside[1], k), dist = Math.hypot(x - inside[0], y - inside[1]);
  const lip = (.016 + .022 * p.open + .008 * p.grief) * Math.exp(-(((dist - .026) / (.038 + .01 * p.open)) ** 2));
  return tingRageMapper(x, y, p, lip);
}
/* 눈 둘레 격자: 눈 테두리에서 눈 상자(볼 얼굴과 같은 상자)까지 */
function rgEyePatch(side, u, v, p) {
  const a = u * TAU, ca = Math.cos(a), sa = Math.sin(a), inside = rgEye(side, a, p);
  const cx = side * .87, cy = 2.425, hw = .69, hh = .385, k = Math.max(Math.abs(ca), Math.abs(sa));
  const outside = [cx + side * hw * ca / k, cy + hh * sa / k];
  const x = lerp(inside[0], outside[0], v), y = lerp(inside[1], outside[1], v), d = Math.hypot(x - inside[0], y - inside[1]);
  return tingRageMapper(x, y, p, (.010 + .02 * p.grief) * Math.exp(-((d / .05) ** 2)) * (1 - smooth(.84, 1, v)));
}
/* 눈구멍·입구멍: 테두리 높이에서 가운데로 갈수록 판 속으로 깊어지는 고깔 */
function rgLens(side, u, v, p) {
  const c = rgEye(side, u * TAU, p), C = rgEyeCenter(side, p), k = 1 - v * .999, rim = rageSkin(c[0], c[1], p) + .007;
  return tingPlace(lerp(C[0], c[0], k), lerp(C[1], c[1], k), rim * (1 - v) - v * (.13 + .03 * p.grief));
}
const RG_CAVITY = o => .19 + .15 * o;
function rgCavity(u, v, p) {
  const c = rgMouth(u * TAU, p), M = rgMouthShape(p), k = 1 - v * .999, rim = rageSkin(c[0], c[1], p) + .010;
  return tingPlace(c[0] * k, lerp(M.yc - .02 * p.open, c[1], k), rim * (1 - v) - v * RG_CAVITY(p.open));
}
/* 이는 바로 뒤 입속 벽보다 조금 앞에 놓인다. 이 사이 틈은 벽보다 깊게 파서 어둡게 보이게 */
function rgTeethPoint(upper, u, v, p) {
  const T = rgTooth(upper, u, v, p), M = rgMouthShape(p), cy = M.yc - .02 * p.open;
  const f = clamp(Math.abs(T.y - T.P[1]) / Math.max(.02, Math.abs(cy - T.P[1]))), rim = rageSkin(T.P[0], T.P[1], p) + .010, s = Math.sin(Math.PI * T.q);
  return tingPlace(T.x, T.y, rim * (1 - f) - f * RG_CAVITY(p.open) + .016 + .014 * Math.pow(s, .6) - .03 * Math.pow(1 - s, 8));
}
/* 콧구멍: 콧방울 밑으로 숨은 납작한 구멍. 화날수록 옆으로 벌어지며 바깥 끝이 들린다 */
function rgNostril(side, u, v, p) {
  const a = u * TAU, g = p.grief, m = p.blink || 0, rx = (.046 + .026 * g + .01 * m) * v, ry = (.014 + .008 * g + .003 * m) * v;
  const x = side * (.20 + .03 * g + .01 * m) + Math.cos(a) * rx, y = 1.848 + .014 * g + Math.sin(a) * ry + .30 * side * Math.cos(a) * rx;
  return tingRageMapper(x, y, p, .006);
}
/* 띵샤 얼굴을 여러 토막으로 나눠 만든다 (한 번에 만들면 화면이 멈칫한다) */
function rageFaceSteps(out, lod) {
  const I3 = n => Math.max(3, Math.round(n * lod)), I = n => Math.max(4, Math.round(n * lod)), skin = [], lens = [], nos = [], teeth = [], steps = [];
  const S = f => steps.push(() => onSurface(tingRageMapper, f));
  const strips = (n, m, fn, rows) => {
    const k = Math.max(1, Math.round(m / rows));
    for (let s = 0; s < k; s++) { const j0 = Math.round(m * s / k), j1 = Math.round(m * (s + 1) / k); S(() => skin.push(morphGrid(n, j1 - j0, (u, v, p) => fn(u, (j0 + v * (j1 - j0)) / m, p)))); }
  };
  strips(I3(192), I3(62), rgFacePoint, 6);
  for (const side of [-1, 1]) strips(I3(112), I3(30), (u, v, p) => rgEyePatch(side, u, v, p), 10);
  S(() => skin.push(plainFace(-.18, .18, 2.04, 2.81, I3(40), I3(44)), plainFace(-1.66, -1.56, 2.04, 2.81, 5, I3(34)), plainFace(1.56, 1.66, 2.04, 2.81, 5, I3(34))));
  S(() => skin.push(plainFace(-1.66, 1.66, 2.81, FACE.top, I3(110), I3(18))));
  for (const side of [-1, 1]) S(() => { lens.push(morphGrid(I(96), I(10), (u, v, p) => rgLens(side, u, v, p))); nos.push(morphGrid(I(20), 4, (u, v, p) => rgNostril(side, u, v, p))); });
  let cavity = null;
  S(() => { cavity = morphGrid(I(150), I(14), rgCavity); });
  S(() => { for (const up of [true, false]) teeth.push(morphGrid(96, 4, (u, v, p) => rgTeethPoint(up, u, v, p))); });
  steps.push(() => { out.face = { skin: mergeMorph(skin), eyes: mergeMorph(lens), nostrils: mergeMorph(nos), cavity, teeth: mergeMorph(teeth) }; });
  return steps;
}
function tingShellData() {
  const ri = .18, x1 = FACE.x * TG.SC - .022, z0 = TG.Z0 - (FACE.top - FACE.cy) * TG.SC + .022, z1 = TG.Z0 + (FACE.cy - FACE.bottom) * TG.SC - .022;
  const d = gridMesh(240, 52, (u, v) => { const a = u * TAU, r = v < .28 ? ri * v / .28 : ri + (TG.Ri - ri) * (v - .28) / .72; return [Math.sin(a) * r, plateTop(r), Math.cos(a) * r]; });
  const keep = [], V8 = d.vertices, inside = i => { const x = V8[i * 8], z = V8[i * 8 + 2]; return Math.abs(x) < x1 && z > z0 && z < z1 && Math.hypot(x, z) < .955; };
  for (let i = 0; i < d.indices.length; i += 3) { const a = d.indices[i], b = d.indices[i + 1], c = d.indices[i + 2]; if (!(inside(a) && inside(b) && inside(c))) keep.push(a, b, c); }
  d.indices = keep; return d;
}
function tingRimData() {
  const top = plateTop(TG.Ri);
  return lathe([[TG.Ri, top], [1.150, top - .002], [1.178, .050], [1.194, .030], [1.200, .006], [1.197, -.018], [1.186, -.040], [1.160, -.056], [1.10, -.066], [.92, -.070], [.70, -.064], [.48, -.052], [.28, -.034], [.16, -.010], [.07, .010], [.001, .016]], 200);
}

/* ================= 6. 오카리나 =================
 * 사진(600×600) 윤곽을 그대로 땄다: 왼쪽 둥근 머리, 위로 살짝 감겨 올라간 꼬리, 아래로 나온 취구.
 * 사진 좌표 x,y(px) → 모델 X=(x-300)/92, Y=(300-y)/92. 단면은 세로 높이 A, 두께 B의 둥근 사각(초타원).
 */
const OC_TOP = [[18, 272], [19, 252], [20, 244], [24, 226], [30, 211], [40, 192], [50, 179], [60, 168], [70, 159], [80, 150], [90, 144], [100, 138], [110, 133], [120, 129], [130, 125], [140, 122], [150, 119], [160, 117], [170, 116], [180, 114], [190, 113], [200, 112], [220, 112], [240, 111], [260, 112], [280, 113], [300, 115], [320, 117], [340, 120], [360, 121], [380, 123], [400, 125], [420, 127], [440, 129], [460, 131], [480, 130], [500, 127], [520, 120], [540, 111], [550, 105], [560, 99], [568, 95.5], [574, 95], [578, 99], [581, 108], [584, 128], [586, 150], [587.2, 168], [587.6, 177]];
const OC_BOT = [[18, 272], [19, 292], [20, 298], [24, 312], [30, 327], [40, 343], [50, 357], [60, 368], [70, 376], [80, 385], [90, 393], [100, 399], [110, 406], [120, 412], [130, 419], [140, 427], [150, 434], [165, 441], [180, 445], [195, 447], [210, 446], [225, 444], [240, 440], [250, 436], [260, 430], [270, 423], [280, 416], [290, 409], [300, 403], [320, 389], [340, 376], [360, 363], [380, 349], [400, 335], [420, 321], [440, 307], [460, 293], [480, 279], [500, 265], [520, 250], [540, 236], [560, 222], [570, 214], [578, 206], [582, 201], [585, 196], [587, 189], [587.6, 177]];
function spline(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), n = pts.length, m = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); m[i] = (ys[b] - ys[a]) / (xs[b] - xs[a]); }
  return x => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const OC = (() => {
  const PX = 92, top = spline(OC_TOP), bot = spline(OC_BOT), xl = OC_TOP[0][0], xr = OC_TOP[OC_TOP.length - 1][0], P = 2.25;
  const X = x => (x - 300) / PX, Y = y => (300 - y) / PX;
  const exact = Xm => {
    const x = Xm * PX + 300, t = Y(top(x)), b = Y(bot(x)), A = Math.max(0, (t - b) / 2), Yc = (t + b) / 2;
    const ratio = lerp(.72, .50, smooth(-1.1, 2.3, Xm)) * lerp(1, .88, smooth(2.2, 3.1, Xm));
    return [Yc, A, A * ratio];
  };
  /* 단면은 수십만 번 불리므로 촘촘한 표로 만들어 둔다 (얼굴 조각 시간을 크게 줄인다) */
  const x0 = X(xl), x1 = X(xr), N = 6144, T = new Float64Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) T.set(exact(x0 + (x1 - x0) * i / N), i * 3);
  const slice = Xm => {
    const f = clamp((Xm - x0) / (x1 - x0)) * N, i = Math.min(N - 1, f | 0), k = f - i, o = i * 3;
    return { Yc: T[o] + (T[o + 3] - T[o]) * k, A: T[o + 1] + (T[o + 4] - T[o + 1]) * k, B: T[o + 2] + (T[o + 5] - T[o + 2]) * k };
  };
  const sp = (s, e) => Math.sign(s) * Math.pow(Math.abs(s), e);
  return { PX, P, X, Y, xl: x0, xr: x1, slice, sp };
})();
function ocaPoint(u, v) { // u: 0..1 tip to tail end, v: 0..1 round the section (0 = front)
  const Xm = OC.xl + (OC.xr - OC.xl) * (.5 - .5 * Math.cos(Math.PI * u)), s = OC.slice(Xm), a = v * TAU;
  return [Xm, s.Yc + s.A * OC.sp(Math.sin(a), 2 / OC.P), s.B * OC.sp(Math.cos(a), 2 / OC.P)];
}
function ocaFront(Xm, Ym) { // front surface height field and its normal
  const f = (x, y) => { const s = OC.slice(x); if (s.A < 1e-4) return 0; const q = clamp(Math.abs((y - s.Yc) / s.A), 0, .9995); return s.B * Math.pow(1 - Math.pow(q, OC.P), 1 / OC.P); };
  const e = .004, z = f(Xm, Ym), n = V.norm([-(f(Xm + e, Ym) - f(Xm - e, Ym)) / (2 * e), -(f(Xm, Ym + e) - f(Xm, Ym - e)) / (2 * e), 1]);
  return { p: [Xm, Ym, z], n };
}
/* 숨 쉴 때 부풀고 오므라드는 기준: 몸통 가운데 줄기의 높이(Yc), 단면 반높이(A), 반두께(B), 부푸는 정도(꼬리는 덜) — X -3.25부터 0.5 간격 */
const SW_AXIS = (() => { const a = new Float32Array(56); for (let i = 0; i < 14; i++) { const X = -3.25 + i * .5, sl = OC.slice(X); a.set([sl.Yc, sl.A, sl.B, 1 - .5 * smooth(.3, 2.8, X)], i * 4); } return a; })();
function swellPoint(p, s) { // 셰이더(VERT_B)와 같은 계산
  const sx = clamp((p[0] + 3.25) * 2, 0, 12.999), i = Math.floor(sx), f = sx - i, ax = [0, 1, 2, 3].map(k => lerp(SW_AXIS[i * 4 + k], SW_AXIS[i * 4 + 4 + k], f));
  const ly = Math.max(ax[1], .05), lz = Math.max(ax[2], .05), w = s * ax[3];
  const q = [p[0] + (p[0] + .3) * w * .10, p[1] + clamp(p[1] - ax[0], -ly, ly) * w, p[2] + clamp(p[2], -lz, lz) * w];
  if (s < 0) {
    const dy = clamp(p[1] - ax[0], -ly, ly), dz = clamp(p[2], -lz, lz), r = Math.max(Math.hypot(dy, dz), .3), th = Math.atan2(dy, dz);
    const a = -s * .22 * ax[3] * (Math.abs(p[1] - ax[0]) <= ly ? 1 : 0) * (1 - Math.exp(-Math.pow((q[0] + 1.62) / 1.1, 4) - Math.pow(th / .75, 4)));
    const del = a * (.6 * Math.sin(q[0] * 6 + th * 4 + 1.3) + .4 * Math.sin(q[0] * 9 - th * 3));
    q[1] += dy / r * del; q[2] += dz / r * del;
  }
  return q;
}
/* 얼굴: 머리(왼쪽 불룩한 부분) 앞면. 볼 얼굴 좌표 → X0,Y0 중심, SC배 */
const OF = { SC: .60, X0: -1.62, Y0: .14, relief: 1.25, lift: .004 };
function ocaMapper(x, y, p, extra = 0) {
  const w = faceWarp(x, y, p), f = ocaFront(OF.X0 + w[0] * OF.SC, OF.Y0 + (w[1] - FACE_MID) * OF.SC);
  const rel = (flatSkin(x, y, p.grief, p.blink || 0, .55) + extra) * OF.SC * OF.relief + OF.lift;
  return [f.p[0] + f.n[0] * rel, f.p[1] + f.n[1] * rel, f.p[2] + f.n[2] * rel];
}
function ocaBodyData() {
  const d = gridMesh(220, 112, ocaPoint), V8 = d.vertices;
  const x0 = OF.X0 - FACE.x * OF.SC + .03, x1 = OF.X0 + FACE.x * OF.SC - .03, y0 = OF.Y0 + (FACE.bottom - FACE_MID) * OF.SC + .03, y1 = OF.Y0 + (FACE.top - FACE_MID) * OF.SC - .03;
  const inside = i => { const x = V8[i * 8], y = V8[i * 8 + 1], z = V8[i * 8 + 2]; return z > 0 && x > x0 && x < x1 && y > y0 && y < y1; };
  const keep = [];
  for (let i = 0; i < d.indices.length; i += 3) { const a = d.indices[i], b = d.indices[i + 1], c = d.indices[i + 2]; if (!(inside(a) && inside(b) && inside(c))) keep.push(a, b, c); }
  d.indices = keep; return d;
}
/* 사진 속 구멍 7개 (중심 px, 반지름 px). 앞면에 붙인 어두운 구멍과 살짝 들어간 테두리 */
const OC_HOLES = [[238.9, 134.2, 8.4, 8.4], [191.3, 146.6, 11.5, 14.5], [137.1, 155.0, 6.6, 8.4], [467.3, 266.3, 4.6, 4.6], [421.2, 282.1, 5.0, 5.5], [382.2, 315.1, 4.6, 4.6], [346.0, 354.6, 8.0, 6.0]];
function holeData(hx, hy, rx, ry) {
  const cx = OC.X(hx), cy = OC.Y(hy), RX = rx / OC.PX, RY = ry / OC.PX, nu = 36, nv = 7, inner = [], innerIx = [], rim = [], rimIx = [];
  const at = (k, r, lift) => { const a = k / nu * TAU, f = ocaFront(cx + Math.cos(a) * RX * r, cy + Math.sin(a) * RY * r); return { p: V.add(f.p, V.mul(f.n, lift)), n: f.n }; };
  for (let j = 0; j <= nv; j++) for (let k = 0; k <= nu; k++) { const r = j / nv, q = at(k, r, .0045); inner.push(...q.p, ...q.n, k / nu, 1 - r); }
  for (let j = 0; j <= 3; j++) for (let k = 0; k <= nu; k++) { const r = 1 + j / 3 * .32, q = at(k, r, .0045 + .0035 * Math.sin(Math.PI * j / 3)); rim.push(...q.p, ...q.n, k / nu, j / 3); }
  const quads = (ix, rows) => { for (let j = 0; j < rows; j++) for (let k = 0; k < nu; k++) { const a = j * (nu + 1) + k, b = a + 1, c = a + nu + 1, d = c + 1; ix.push(a, b, c, b, d, c); } };
  quads(innerIx, nv); quads(rimIx, 3);
  return { inner: { vertices: inner, indices: innerIx }, rim: { vertices: rim, indices: rimIx } };
}
/* 취구: 머리 아래에서 뻗어 내려온 납작한 관. 몸통 안쪽에서 부드럽게 넓어지며 붙는다 */
function mouthpieceData() {
  const A = [-1.13, -1.18, .02], B = [-1.215, -2.47, .02], nu = 64, nv = 30, P4 = 4;
  const sec = t => ({ c: [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)], w: .385 + .30 * Math.pow(1 - smooth(0, .40, t), 2) - .07 * t, d: .235 + .21 * Math.pow(1 - smooth(0, .40, t), 2) - .05 * t });
  const ring = (s, k, dy) => (u => { const a = u * TAU; return [s.c[0] + s.w * k * OC.sp(Math.cos(a), 2 / P4), s.c[1] - dy, s.c[2] + s.d * k * OC.sp(Math.sin(a), 2 / P4)]; });
  const tube = gridMesh(nu, nv, (u, v) => ring(sec(v), 1, 0)(u));
  const end = sec(1), cap = gridMesh(nu, 8, (u, v) => ring(end, Math.cos(v * Math.PI / 2), .04 * Math.sin(v * Math.PI / 2))(u));
  const slit = gridMesh(32, 4, (u, v) => { const a = u * TAU, k = 1 - v * .999; return [end.c[0] + .17 * k * OC.sp(Math.cos(a), .5), end.c[1] - .041 - .0005 * v, end.c[2] - .015 + .038 * k * OC.sp(Math.sin(a), .5)]; });
  return { tube: combineData([tube, cap]), slit };
}

/* ================= 7. 장면 ================= */
class ExtraVisuals {
  constructor(scene) {
    this.scene = scene; this.R = scene.renderer; this.mode = null; this.built = {}; this.jobs = {}; this.ripples = new Float32Array(32);
    this.t = 0; this.frame = 0; this.hits = []; this.lastPose = [{ open: 0, expression: 0, blink: 0 }, { open: 0, expression: 0, blink: 0 }];
    this.oc = { open: 0, expression: .1, blink: 0, swell: 0, tilt: 0, sink: 0, mist: [] };
  }
  /* 모양은 여러 토막(steps)으로 나눠 만든다. prebuild가 한가한 틈에 한 토막씩, 고르는 순간엔 남은 것을 한 번에 */
  job(mode) {
    if (this.jobs[mode]) return this.jobs[mode];
    const P = {}, steps = [];
    if (mode === 'tingsha') {
      steps.push(...rageFaceSteps(P, .72));
      steps.push(() => { P.shell = tingShellData(); P.rim = tingRimData(); });
      steps.push(() => this.finishTingsha(P));
    } else {
      steps.push(...faceSteps(P, ocaMapper, .78, [.30, .22], [.16, .06], EYES.closed));
      steps.push(() => { P.body = ocaBodyData(); P.mp = mouthpieceData(); P.holes = OC_HOLES.map(h => holeData(...h)); });
      steps.push(() => this.finishOcarina(P));
    }
    return (this.jobs[mode] = { steps, i: 0 });
  }
  buildStep(mode) { // 한 토막. 다 됐으면 true
    if (this.built[mode]) return true;
    const job = this.job(mode), step = job.steps[job.i];
    step(); job.i++;
    return !!this.built[mode];
  }
  build(mode) { while (!this.built[mode]) this.buildStep(mode); }
  finishTingsha(P) {
    const R = this.R, face = P.face;
    const bronze = { kind: 21, color: [.53, .345, .135], metal: .9, rough: .27 }, rim = { kind: 21, color: [.60, .40, .17], metal: .92, rough: .22 };
    const hollow = { kind: 23, color: [.085, .040, .014], metal: 0, rough: .9 }, deep = { kind: 23, color: [.02, .010, .004], metal: 0, rough: .95 };
    const mesh = { skin: R.mesh(face.skin), eyes: R.mesh(face.eyes), nostrils: R.mesh(face.nostrils), cavity: R.mesh(face.cavity), teeth: R.mesh(face.teeth), shell: R.mesh(P.shell), rim: R.mesh(P.rim), knot: R.mesh(sphereData(18, 12)) };
    const enamel = { kind: 21, color: [.70, .52, .25], metal: .86, rough: .20 };
    this.leather = { kind: 0, color: [.20, .085, .034], metal: 0, rough: .86 };
    this.bells = [-1, 1].map(side => ({
      side, matrix: M.identity(), knotWorld: [0, 0, 0], x: side * 1.45, vx: 0, roll: 0, vroll: 0,
      parts: [
        { mesh: mesh.shell, mat: bronze }, { mesh: mesh.rim, mat: rim },
        { mesh: mesh.skin, mat: bronze, face: true }, { mesh: mesh.cavity, mat: hollow, face: true }, { mesh: mesh.teeth, mat: enamel, face: true }, { mesh: mesh.eyes, mat: hollow, face: true }, { mesh: mesh.nostrils, mat: deep, face: true },
        { mesh: mesh.knot, mat: this.leather, local: M.model([0, plateTop(0) + .028, 0], [.062, .05, .062]) }
      ]
    }));
    this.strapMesh = R.mesh(tubePath(Array.from({ length: 64 }, (_, i) => [i / 63, 0, 0]), .052, 8), true);
    this.strap = { mesh: this.strapMesh, mat: this.leather, model: M.identity() };
    this.ringBatch = this.scene.ringBatch;
    this.built.tingsha = true;
  }
  finishOcarina(P) {
    const R = this.R, face = P.face, mp = P.mp, holes = P.holes;
    const glaze = { kind: 22, color: [.47, .20, .066], metal: 0, rough: .16 };
    const hollow = { kind: 23, color: [.10, .042, .014], metal: 0, rough: .9 }, deep = { kind: 23, color: [.03, .012, .004], metal: 0, rough: .95 };
    this.ocParts = [
      { mesh: R.mesh(P.body), mat: glaze },
      { mesh: R.mesh(mp.tube), mat: glaze }, { mesh: R.mesh(mp.slit), mat: deep },
      { mesh: R.mesh(combineData(holes.map(h => h.inner))), mat: hollow }, { mesh: R.mesh(combineData(holes.map(h => h.rim))), mat: glaze },
      { mesh: R.mesh(face.skin), mat: glaze, face: true }, { mesh: R.mesh(face.cavity), mat: hollow, face: true }, { mesh: R.mesh(face.eyes), mat: hollow, face: true }, { mesh: R.mesh(face.nostrils), mat: deep, face: true }
    ];
    this.mouthLocal = onSurface(ocaMapper, () => ocaMapper(0, FACE.cy, { open: 0, grief: 0, blink: 0 }, .02));
    this.mouthNormal = ocaFront(OF.X0, OF.Y0 + (FACE.cy - FACE_MID) * OF.SC).n;
    this.mistBatch = R.makeInstances(quadData, 64, { kind: 4, color: [.93, .89, .82], glow: .40, alpha: .62 });
    this.ocMatrix = M.identity();
    this.swellGPU = !!R.uniforms.uSwell && !!R.uniforms.uSwAxis;
    this.built.ocarina = true;
  }
  setMode(mode) { if (mode) this.build(mode); this.mode = mode; this.hits = []; this.frame = 0; }
  strike(t) { this.hits.push(t); if (this.hits.length > 6) this.hits.shift(); }
  camera(target, dir, halfW, halfH) {
    const scene = this.scene, c = scene.camera, a = scene.width / scene.height, portrait = a < .83, short = scene.height < 500;
    const top = short ? 56 : 92, bottom = short ? 96 : (portrait ? 196 : 176), room = Math.max(.38, 1 - (top + bottom) / scene.height);
    c.fov = (portrait ? 44 : 36) * Math.PI / 180; c.offset = (bottom - top) / scene.height;
    const tan = Math.tan(c.fov / 2), dist = Math.max(halfW / (tan * a * .92), halfH / (tan * room * .96)) + 2.2;
    const d = V.norm(dir); c.eye = V.add(target, V.mul(d, dist)); c.target = target; c.reye = [c.eye[0], -c.eye[1] - .26, c.eye[2]];
    const proj = M.perspective(c.fov, a, .1, 150); proj[9] = -c.offset;
    c.vp = M.mul(proj, M.look(c.eye, target)); c.rvp = M.mul(proj, M.look(c.reye, [target[0], -target[1] - .26, target[2]], [0, -1, 0]));
    c.forward = V.norm(V.sub(target, c.eye)); c.right = V.norm(V.cross(c.forward, [0, 1, 0])); c.up = V.norm(V.cross(c.right, c.forward));
  }
  update(t, dt, audio) {
    this.t = t; if (!this.mode) return;
    const reduced = this.scene.reduced ? .2 : 1;
    this.ripples.fill(0);
    if (this.mode === 'tingsha') this.updateTingsha(t, dt, audio, reduced); else this.updateOcarina(t, dt, audio, reduced);
  }
  updateTingsha(t, dt, audio, reduced) {
    this.camera([0, 1.86, 0], [0, .28, 1], 2.66, 1.86);
    const age = this.hits.length ? t - this.hits[this.hits.length - 1] : 99;
    const strap = [];
    for (const b of this.bells) {
      const st = audio ? audio.screamState(b.side < 0 ? 0 : 1) : null;
      /* 부딪힘: 0.06초에 맞붙고 튕겨 나갔다가 출렁이며 제자리로 */
      const rest = 1.40, contact = 1.215;
      let x = rest, roll = 0;
      if (age < .06) { const k = age / .06; x = lerp(rest, contact, k * k); roll = -.10 * k; }
      else if (age < 3) { const a = age - .06; x = rest - (rest - contact) * Math.exp(-a * 6.5) * Math.cos(a * 15); roll = .16 * Math.exp(-a * 4.2) * Math.sin(a * 17 + 1.2); }
      const shiver = st ? st.shiver : 0, scream = st ? st.amp : 0;
      const tremble = reduced * (.016 * shiver + .006 * scream) * (1 + .3 * (st ? st.lv : 0));   // 악을 쓰며 부들부들 떤다. 연달아 칠수록 더
      const sway = .012 * Math.sin(t * 1.3 + b.side) * reduced;
      const pos = [b.side * x + tremble * Math.sin(t * 61 + b.side * 2), 1.50 + tremble * .8 * Math.sin(t * 73 + 1), 0];
      b.matrix = M.model(pos, 1, [.92 + sway + tremble * 2 * Math.sin(t * 57), -b.side * .13, b.side * (.10 + roll * reduced) + tremble * Math.sin(t * 67)]);
      /* 표정: 비명 트랙을 그대로 따른다. 입은 비명 소리대로 벌어지고, 분노는 치는 순간 치솟았다가 소리가 끝난 뒤 천천히 가라앉는다.
       * 연달아 칠수록(lv 0→2) 끝까지 일그러진다. 쉬면 꾹 참는 얼굴 */
      const P = this.lastPose[b.side < 0 ? 0 : 1];
      const want = st ? { open: Math.min(1, st.open * 1.02 * (1 - .18 * st.round)), expression: Math.min(1, st.squeeze), blink: Math.min(1, st.squeeze * (.45 + .275 * (st.lv || 0))) } : { open: 0, expression: 0, blink: 0 };
      const k = 1 - Math.exp(-dt * 26), kr = 1 - Math.exp(-dt * 9);
      P.open = lerp(P.open, want.open, want.open > P.open ? k : kr); P.expression = lerp(P.expression, want.expression, want.expression > P.expression ? k : kr * .8); P.blink = lerp(P.blink, want.blink, want.blink > P.blink ? k : kr * .8);
      for (const p of b.parts) { p.model = p.local ? M.mul(b.matrix, p.local) : b.matrix; if (p.face) { p.open = P.open; p.expression = P.expression; p.blink = P.blink; } p.seed = b.side > 0 ? 3.1 : 1.3; p.energy = 0; }
      b.knotWorld = M.point(b.matrix, [0, plateTop(0) + .05, 0]).slice(0, 3);
      b.up = V.norm(M.point(b.matrix, [0, 1, 0]).slice(0, 3).map((v, i) => v - b.matrix[12 + i]));
      b.normalWorld = b.up; b.center = [b.matrix[12], b.matrix[13], b.matrix[14]];
      b.ring = (b.ring || 0) * Math.exp(-dt * 1.4); if (age < .08) b.ring = 1;
      b.scream = scream;
    }
    /* 가죽끈: 두 매듭에서 위로 올라가 한가운데 위에서 만난다 (손에 쥔 자리). 띵샤는 그 끈에 매달려 있다 */
    const [A, B] = this.bells, ka = A.knotWorld, kb = B.knotWorld, top = [0, 3.30, -.40];
    const mid = (k, u) => [lerp(k[0], top[0], .5) * 1.04, lerp(k[1], top[1], .5) + .10, lerp(k[2], top[2], .5)];
    const ctrl = [ka, V.add(ka, V.add(V.mul(A.up, .20), [0, .10, 0])), mid(ka), [top[0] - .34, top[1] - .13, top[2]], top, [top[0] + .34, top[1] - .13, top[2]], mid(kb), V.add(kb, V.add(V.mul(B.up, .20), [0, .10, 0])), kb];
    for (let i = 0; i < 64; i++) strap.push(bezier(ctrl, i / 63));
    const d = tubePath(strap, .052, 8); this.strapMesh.verts.set(d.vertices); this.R.updateMesh(this.strapMesh);
    /* 바닥 물결 */
    for (let i = 0; i < 2; i++) { const b = this.bells[i], o = i * 4; this.ripples[o] = b.center[0]; this.ripples[o + 1] = b.center[2]; this.ripples[o + 2] = Math.max(.004, .16 * b.ring + .10 * b.scream); this.ripples[o + 3] = 1; }
  }
  updateOcarina(t, dt, audio, reduced) {
    const base = [0, 2.84, 0], oc = this.oc, B = TUNE.breath;
    this.camera([0, 2.74, 0], [.10, .26, 1], 3.45, 2.80);
    const st = audio ? audio.breathState() : null;
    let swellT = 0, open = 0, grief = .10, flow = 0, sink = 0, tilt = 0;
    /* 들숨: 들이쉰 만큼 몸통이 부푼다 */
    if (st && st.phase === 'in') { swellT = B.swell * st.fill; open = .10 + .06 * st.fill; grief = .02; tilt = .045 * st.fill; }
    /* 날숨: 내쉰 숨만큼 줄어들다가 원래보다 홀쭉하게 쪼그라들고, 한숨이 끝나면 천천히 원래대로 */
    else if (st && st.phase === 'out') {
      const hu = st.kind === 'hu', shrink = B.shrink * (.4 + .6 * clamp(st.held / 1.7)), back = smooth(st.dur * .92, st.dur + B.back, st.t);
      swellT = lerp((oc.swellAtOut || 0) * (1 - st.out) - shrink * st.out, 0, back);
      open = hu ? Math.max(.12, st.open * 1.1) : st.open * .62; grief = .12 + .32 * smooth(0, .35, st.t) * (1 - .4 * smooth(st.dur * .8, st.dur + 1.2, st.t));
      flow = st.flow; sink = (.07 + .5 * shrink * st.out) * (1 - back); tilt = -.035 * smooth(0, .8, st.t) * (1 - smooth(st.dur, st.dur + 1.4, st.t));
      oc.kind = st.kind;
    }
    if (!st || st.phase === 'in') oc.swellAtOut = swellT;
    const k = 1 - Math.exp(-dt * 10);
    oc.swell = lerp(oc.swell, swellT, 1 - Math.exp(-dt * 7)); oc.open = lerp(oc.open, open, k); oc.expression = lerp(oc.expression, grief, 1 - Math.exp(-dt * 4)); oc.sink = lerp(oc.sink, sink, 1 - Math.exp(-dt * 4)); oc.tilt = lerp(oc.tilt, tilt, 1 - Math.exp(-dt * 4));
    const idle = reduced * .018 * Math.sin(t * .9);
    /* 셰이더로 부풀릴 수 없는 기기에서는 통째로 키우고 줄인다 */
    const sw = this.swellGPU ? 1 : 1 + oc.swell;
    this.ocMatrix = M.model([base[0], base[1] + idle - oc.sink, base[2]], [this.swellGPU ? 1 : 1 + .3 * oc.swell, sw, sw], [0, -.10, oc.tilt]);
    for (const p of this.ocParts) { p.model = this.ocMatrix; if (p.face) { p.open = oc.open; p.expression = oc.expression; p.blink = 0; } p.seed = 2.2; p.energy = 0; }
    /* 입김: 날숨 동안 입에서 나와 퍼지며 사라진다 */
    const ml = this.swellGPU ? swellPoint(this.mouthLocal, oc.swell) : this.mouthLocal, mouth = M.point(this.ocMatrix, ml).slice(0, 3), mn = V.norm(V.sub(M.point(this.ocMatrix, V.add(ml, this.mouthNormal)).slice(0, 3), mouth));
    oc.mistClock = (oc.mistClock || 0) + dt * (flow > .05 ? 16 * flow : 0);
    while (oc.mistClock >= 1 && oc.mist.length < 60) { oc.mistClock--; const j = () => (Math.random() - .5); oc.mist.push({ p: V.add(mouth, [j() * .05, j() * .05, .04]), v: V.add(V.mul(mn, (.35 + .25 * Math.random()) * (oc.kind === 'hu' ? 1.3 : 1)), [-.30 + j() * .18, -.38 + j() * .14, .10 + j() * .10]), age: 0, life: 1.3 + .6 * Math.random(), a: .30 + .45 * flow, s: .05 + .04 * Math.random() }); }
    for (const m of oc.mist) { m.age += dt; m.p = V.add(m.p, V.mul(m.v, dt)); m.v = V.mul(m.v, Math.exp(-dt * 1.3)); m.v[1] += dt * .06; }
    oc.mist = oc.mist.filter(m => m.age < m.life);
    this.ripples[0] = 0; this.ripples[1] = 0; this.ripples[2] = .004 + .06 * flow; this.ripples[3] = 1.4;
  }
  render(t) {
    if (!this.mode) return;
    const R = this.R, scene = this.scene, cam = scene.camera, mirrorDue = (this.frame++ % 2 === 0);
    for (const mirror of mirrorDue ? [true, false] : [false]) {
      R.begin(cam, t, this.ripples, mirror); if (!mirror) R.draw(scene.floor);
      if (this.mode === 'tingsha') { for (const b of this.bells) for (const p of b.parts) R.draw(p); R.draw(this.strap); }
      else {
        if (this.swellGPU) { R.gl.uniform4fv(R.uniforms.uSwAxis, SW_AXIS); R.u('uSwell', this.oc.swell); }
        for (const p of this.ocParts) R.draw(p);
        if (this.swellGPU) R.u('uSwell', 0);
      }
      if (mirror) continue;
      if (this.mode === 'tingsha') this.drawRings(t);
      else this.drawMist();
    }
  }
  drawRings(t) {
    const RB = this.ringBatch, m = RB.matrices; let n = 0;
    for (const b of this.bells) {
      if (b.ring < .01 && b.scream < .02) continue;
      const up = b.up, right = V.norm(V.cross(up, [0, 0, 1])), fwd = V.norm(V.cross(right, up)), e = Math.max(b.ring, b.scream * .8);
      for (let q = 0; q < 4; q++) {
        const k = (t * (.9 + q * .13) + q * .25 + (b.side > 0 ? .37 : 0)) % 1, sc = 1.24 + k * 1.6, alpha = (.14 - .025 * q) * e * (1 - k) * (1 - k), o = n++ * 16;
        const c = V.add(b.center, V.mul(up, .06));
        m[o] = right[0] * sc; m[o + 1] = right[1] * sc; m[o + 2] = right[2] * sc; m[o + 3] = 0;
        m[o + 4] = fwd[0] * sc; m[o + 5] = fwd[1] * sc; m[o + 6] = fwd[2] * sc; m[o + 7] = 0;
        m[o + 8] = up[0] * sc; m[o + 9] = up[1] * sc; m[o + 10] = up[2] * sc; m[o + 11] = 0;
        m[o + 12] = c[0]; m[o + 13] = c[1]; m[o + 14] = c[2]; m[o + 15] = alpha;
      }
    }
    this.R.uploadInstances(RB, n); if (n) this.R.draw(RB);
  }
  drawMist() {
    const MB = this.mistBatch, m = MB.matrices, cam = this.scene.camera; let n = 0;
    for (const p of this.oc.mist) {
      if (n >= MB.capacity) break;
      const u = p.age / p.life, s = p.s + u * .70, a = p.a * smooth(0, .12, u) * Math.pow(1 - u, 1.6), o = n++ * 16, r = cam.right, up = cam.up, f = cam.forward;
      m[o] = r[0] * s; m[o + 1] = r[1] * s; m[o + 2] = r[2] * s; m[o + 3] = 0;
      m[o + 4] = up[0] * s; m[o + 5] = up[1] * s; m[o + 6] = up[2] * s; m[o + 7] = 0;
      m[o + 8] = -f[0] * s; m[o + 9] = -f[1] * s; m[o + 10] = -f[2] * s; m[o + 11] = 0;
      m[o + 12] = p.p[0]; m[o + 13] = p.p[1]; m[o + 14] = p.p[2]; m[o + 15] = a;
    }
    this.R.uploadInstances(MB, n); if (n) this.R.draw(MB);
  }
  contains(x, y, pad = 0) {
    const scene = this.scene, pr = p => { const q = M.point(scene.camera.vp, p); return [(q[0] / q[3] * .5 + .5) * scene.width, (.5 - q[1] / q[3] * .5) * scene.height]; };
    if (this.mode === 'tingsha') {
      for (const b of this.bells || []) { const c = pr(b.center), e = pr(V.add(b.center, [TG.R, 0, 0])), f = pr(V.add(b.center, V.mul(V.norm(V.cross([1, 0, 0], b.up)), TG.R))); const rx = Math.max(34, Math.hypot(e[0] - c[0], e[1] - c[1])) + pad, ry = Math.max(30, Math.hypot(f[0] - c[0], f[1] - c[1])) + pad; if (((x - c[0]) / rx) ** 2 + ((y - c[1]) / ry) ** 2 < 1.15) return true; }
      return false;
    }
    if (!this.ocMatrix) return false;
    const poly = [];
    for (const p of OC_TOP) poly.push(pr(M.point(this.ocMatrix, [OC.X(p[0]), OC.Y(p[1]), 0]).slice(0, 3)));
    for (let i = OC_BOT.length - 1; i >= 0; i--) poly.push(pr(M.point(this.ocMatrix, [OC.X(OC_BOT[i][0]), OC.Y(OC_BOT[i][1]), 0]).slice(0, 3)));
    let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
    if (inside) return true;
    const m1 = pr(M.point(this.ocMatrix, [-1.62, -2.5, 0]).slice(0, 3)), m2 = pr(M.point(this.ocMatrix, [-.80, -1.3, 0]).slice(0, 3));
    if (x > Math.min(m1[0], m2[0]) - pad && x < Math.max(m1[0], m2[0]) + pad && y > Math.min(m1[1], m2[1]) - pad && y < Math.max(m1[1], m2[1]) + pad) return true;
    if (pad) { let best = 1e9; for (const p of poly) best = Math.min(best, Math.hypot(p[0] - x, p[1] - y)); return best < pad; }
    return false;
  }
}
function bezier(c, u) { // Catmull-Rom through the control points
  const n = c.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const p0 = c[Math.max(0, i - 1)], p1 = c[i], p2 = c[i + 1], p3 = c[Math.min(n, i + 2)];
  return p1.map((v, k) => .5 * (2 * v + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * v + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * v - 3 * p2[k] + p3[k]) * t * t * t));
}

/* ================= 8. 연결: 원본 index.html의 클래스는 그대로 두고 두 악기만 덧붙인다 ================= */
const originalInit = App.prototype.init, originalAppendix = App.prototype.appendix, originalDamp = App.prototype.damp, originalPlayTick = App.prototype.playTick;
const DRONE_BASE = PLAY.drone.level;
const originalSceneTick = Scene.prototype.tick, originalSceneRender = Scene.prototype.render, originalToggle = App.prototype.updateModeToggle;

const ICONS = {
  tingsha: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 29L30.3 11.3Q32 9.2 33.7 11.3L47 29" fill="none" stroke="#6b4426" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><g><ellipse cx="17" cy="39" rx="14.5" ry="13" fill="#b98a48"/><ellipse cx="17" cy="39" rx="14.5" ry="13" fill="none" stroke="#e9cc96" stroke-width="1.6"/><circle cx="17" cy="29" r="2.6" fill="#7a4a24"/><path d="M7.4 32.6L14.6 35.6M26.6 32.6L19.4 35.6" fill="none" stroke="#2a1c0e" stroke-width="2.4" stroke-linecap="round"/><path d="M8.6 37.3l4.6 1.3M25.4 37.3l-4.6 1.3" fill="none" stroke="#2a1c0e" stroke-width="1.7" stroke-linecap="round"/><rect x="11.4" y="41" width="11.2" height="7.2" rx="2.4" fill="#2a1c0e"/><path d="M12.8 42.5h8.4M13.4 46.8h7.2" stroke="#e9cc96" stroke-width="1.3" stroke-linecap="round"/></g><g><ellipse cx="47" cy="39" rx="14.5" ry="13" fill="#b98a48"/><ellipse cx="47" cy="39" rx="14.5" ry="13" fill="none" stroke="#e9cc96" stroke-width="1.6"/><circle cx="47" cy="29" r="2.6" fill="#7a4a24"/><path d="M37.4 32.6L44.6 35.6M56.6 32.6L49.4 35.6" fill="none" stroke="#2a1c0e" stroke-width="2.4" stroke-linecap="round"/><path d="M38.6 37.3l4.6 1.3M55.4 37.3l-4.6 1.3" fill="none" stroke="#2a1c0e" stroke-width="1.7" stroke-linecap="round"/><rect x="41.4" y="41" width="11.2" height="7.2" rx="2.4" fill="#2a1c0e"/><path d="M42.8 42.5h8.4M43.4 46.8h7.2" stroke="#e9cc96" stroke-width="1.3" stroke-linecap="round"/></g><path d="M31 32.6l1.8-5.4M33.3 36.1l3.3-1.9M30.7 36.1l-3.3-1.9" stroke="#e9cc96" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  ocarina: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 47C11 47 4 41 4 31 4 20 13 14 23 13.5 34 13 44 14.5 51 11.5 55 9.6 58 9 59.5 11 61 13 60.5 18 58 22.5 54 29 42 37.5 32 42 30.5 43 30 45 30 46.5L30 54Q30 57.5 26.5 57.5L24.5 57.5Q21.5 57.5 21.5 54Z" fill="#c4783e"/><path d="M4.8 34C7 43 15 46.5 23 46.5 30 46.5 44 38 54 29 49 34 38 40 28 41.5 17 43 8 40 4.8 34Z" fill="#9c5528"/><path d="M14 18.5C20 15.5 30 15 40 15.8" fill="none" stroke="#f0c48e" stroke-width="2.2" stroke-linecap="round" opacity=".8"/><path d="M9.5 28.5q3 2.6 6 0M19.5 28.5q3 2.6 6 0" fill="none" stroke="#2a1c0e" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="17.5" cy="35.5" rx="2.3" ry="2.8" fill="#2a1c0e"/><circle cx="35" cy="18" r="1.6" fill="#2a1c0e"/><circle cx="28" cy="19" r="2.1" fill="#2a1c0e"/><circle cx="45" cy="27.5" r="1.3" fill="#2a1c0e"/><circle cx="41" cy="31" r="1.3" fill="#2a1c0e"/><circle cx="37" cy="34.3" r="1.6" fill="#2a1c0e"/></svg>`
};

class ExtraController {
  constructor(app) {
    this.app = app; this.mode = null; this.request = 0; this.sound = null; this.level = 0; this.lastStrike = -99; this.holding = null;
    this.visual = new ExtraVisuals(app.scene); app.scene.extraInstruments = this;
    const style = document.createElement('style');
    style.textContent = `
      #modeSwitch .extra-tab{display:grid;place-items:center;width:50px;height:50px;min-width:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;opacity:.36;filter:saturate(.45);transition:opacity .2s,background .2s}
      #modeSwitch .extra-tab+.extra-tab,#modeSwitch #showFrog+.extra-tab{border-left:1px solid rgba(194,166,117,.18)}
      #modeSwitch .extra-tab.active{opacity:1;filter:none;background:rgba(125,94,48,.34)}
      #modeSwitch .extra-tab.loading{animation:extraLoading .9s ease-in-out infinite}
      @keyframes extraLoading{0%,100%{opacity:.36}50%{opacity:.85}}
      @media(prefers-reduced-motion:reduce){#modeSwitch .extra-tab.loading{animation:none;opacity:.7}}
      #modeSwitch .extra-tab svg{width:38px;height:38px}
      #extraControls{display:none;align-items:center;justify-content:center;gap:10px}
      .extra-instrument #extraControls{display:flex}
      .extra-instrument #forceRow,.extra-instrument #quickControls{display:none!important}
      #extraControls button{min-height:46px;padding:10px 22px;border:1px solid rgba(194,166,117,.45);border-radius:999px;background:rgba(18,21,25,.88);color:#eadbc7;font-size:13px;letter-spacing:.08em;user-select:none;-webkit-user-select:none;touch-action:none}
      #extraControls #extraAction.held{background:rgba(125,94,48,.55);border-color:#e9cc96}
      #extraControls #extraStop{min-width:46px;padding:10px 14px;color:#c9b89d}
      #extraControls #extraStop svg{width:15px;height:15px;display:block}
      #extraHint{display:none;margin:11px 0 0;color:#c2b8aa;font-size:11px;letter-spacing:.035em;text-shadow:0 2px 7px #000}
      .extra-instrument #extraHint{display:block}
      .extra-instrument #stage{cursor:default}
      @media(max-width:700px){
        #modeSwitch{right:auto!important;left:50%!important;transform:translateX(-50%)!important;bottom:max(12px,env(safe-area-inset-bottom))!important}
        #modeSwitch .extra-tab{width:46px;height:46px}
        #modeSwitch .extra-tab svg{width:34px;height:34px}
        #dock{left:50%!important;width:calc(100vw - 24px)!important;bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}
        #extraHint{font-size:10.5px}
      }
      @media(max-height:500px) and (min-width:701px){#modeSwitch{bottom:10px!important}#extraHint{margin-top:6px;font-size:10px}}
    `;
    document.head.append(style);
    const nav = $('#modeSwitch');
    for (const [mode, label] of [['tingsha', '띵샤'], ['ocarina', '오카리나']]) {
      const b = document.createElement('button'); b.id = `show-${mode}`; b.className = 'extra-tab'; b.type = 'button'; b.title = label;
      b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', 'false'); b.innerHTML = ICONS[mode];
      b.addEventListener('click', () => this.select(mode)); nav.append(b);
    }
    const controls = document.createElement('div'); controls.id = 'extraControls';
    controls.innerHTML = '<button id="extraAction" type="button"></button><button id="extraStop" type="button" aria-label="멈춤" title="멈춤"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor"/></svg></button>';
    const hint = document.createElement('p'); hint.id = 'extraHint';
    $('#dock').append(controls, hint);
    const act = $('#extraAction');
    act.addEventListener('pointerdown', e => { e.preventDefault(); try { act.setPointerCapture(e.pointerId); } catch (_) {} this.press('button'); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) act.addEventListener(type, () => this.release('button'));
    act.addEventListener('click', e => { if (e.detail === 0) { this.press('key'); setTimeout(() => this.release('key'), 380); } });
    $('#extraStop').addEventListener('click', () => this.stop());
    const canvas = $('#stage');
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'wheel', 'contextmenu']) {
      canvas.addEventListener(type, e => {
        if (!this.mode) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (type === 'pointermove' && !this.holding) canvas.style.cursor = this.visual.contains(e.clientX, e.clientY, 10) ? 'pointer' : 'default';
        if (type === 'pointerdown' && e.button !== 2 && e.isPrimary !== false) {
          canvas.focus({ preventScroll: true });
          const pad = e.pointerType === 'touch' ? 34 : 12;
          if (this.visual.contains(e.clientX, e.clientY, pad)) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} this.press('pointer'); }
        }
        if (type === 'pointerup' || type === 'pointercancel' || type === 'lostpointercapture') this.release('pointer');
      }, { capture: true, passive: false });
    }
    window.addEventListener('keydown', e => {
      if (!this.mode || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); app.appendix(false); return; }
      if (e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); this.stop(); return; }
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.press('key'); return; }
      if (/^Digit[1-8]$/.test(e.code) || ['ArrowLeft', 'ArrowRight'].includes(e.key) || 'asdfghjkr'.includes(e.key.toLowerCase())) e.stopImmediatePropagation();
    }, true);
    window.addEventListener('keyup', e => { if (this.mode && e.key === 'Enter') { e.preventDefault(); this.release('key'); } }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    window.addEventListener('blur', () => { this.release('pointer'); this.release('button'); this.release('key'); });
    this.lastInput = -1e9;
    for (const type of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(type, () => { this.lastInput = performance.now(); }, { capture: true, passive: true });
    this.prebuild();
  }
  /* 처음 고를 때 멈칫하지 않게 두 악기 모양을 미리 만들어 둔다. 한 번에 한 토막씩, 연주를 방해하지 않을 때만:
   * 시작 화면에 있을 때, 또는 1.4초 넘게 아무 입력이 없고 띵샤·오카리나 소리도 나지 않을 때 */
  prebuild() {
    const queue = ['tingsha', 'ocarina'];
    const idle = f => window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1200 }) : setTimeout(f, 60);
    const busy = () => this.app.started && (performance.now() - this.lastInput < 1400 || !!this.holding || (!!this.sound && this.sound.voices.some(v => !v.gone)));
    const next = () => {
      while (queue.length && this.visual.built[queue[0]]) queue.shift();
      if (!queue.length) return;
      if (busy()) { setTimeout(() => idle(next), 500); return; }
      try { this.visual.buildStep(queue[0]); } catch (e) { console.error(e); return; }
      setTimeout(() => idle(next), 24);
    };
    setTimeout(() => idle(next), 250);
  }
  async select(mode) {
    const request = ++this.request;
    await this.app.start();
    if (request !== this.request || !this.app.audio.ready) return;
    this.sound ||= new ExtraAudio(this.app.audio);
    this.sound.warm(mode);
    /* 모양이 아직 덜 됐으면 남은 토막을 하나씩 만들며 화면은 계속 그린다 (탭이 깜빡이는 동안) */
    const tab = $(`#show-${mode}`);
    try {
      while (!this.visual.built[mode]) {
        tab?.classList.add('loading');
        await new Promise(r => setTimeout(r, 16));
        if (request !== this.request) return;
        this.visual.buildStep(mode);
      }
    } catch (e) { console.error(e); return; } finally { tab?.classList.remove('loading'); }
    await originalAppendix.call(this.app, false);
    if (request !== this.request) return;
    this.stop();
    this.app.frogMode = 'stop'; this.app.stopGroove?.(); this.app.releaseAll();
    this.visual.setMode(mode);
    this.mode = mode; this.level = 0; this.lastStrike = -99;
    document.body.classList.add('extra-instrument');
    $('#extraAction').textContent = mode === 'tingsha' ? '부딪히기' : '한숨 쉬기';
    $('#extraHint').textContent = mode === 'tingsha' ? '띵샤를 눌러 부딪치세요 · 연달아 치면 비명이 커집니다' : '누르고 있으면 숨을 들이쉬고, 떼면 한숨을 쉽니다';
    $('#stage').setAttribute('aria-label', mode === 'tingsha' ? '띵샤 — 누르거나 Enter로 부딪치기, Space로 멈춤' : '오카리나 — 누르고 있으면 들숨, 떼면 한숨. Enter로도 됩니다');
    this.updateTabs();
  }
  updateTabs() {
    if (this.mode) for (const id of ['#showBowls', '#showFrog']) { const el = $(id); if (!el) continue; el.classList.remove('active'); el.setAttribute('aria-pressed', 'false'); }
    for (const mode of ['tingsha', 'ocarina']) { const b = $(`#show-${mode}`); if (!b) continue; b.classList.toggle('active', this.mode === mode); b.setAttribute('aria-pressed', String(this.mode === mode)); }
  }
  leave() { ++this.request; this.stop(); this.mode = null; PLAY.drone.level = DRONE_BASE; this.droneMix = 1; this.visual.setMode(null); document.body.classList.remove('extra-instrument'); $('#stage').setAttribute('aria-label', '크라잉볼 — 악기를 눌러 연주'); this.updateTabs(); }
  async press(from) {
    const mode = this.mode; if (!mode || !this.app.audio.ready) return;
    if (this.app.audio.ctx.state === 'suspended') { try { await this.app.audio.ctx.resume(); } catch (_) {} }
    if (this.mode !== mode) return;
    if (mode === 'tingsha') {
      const now = this.app.audio.ctx.currentTime; if (now - this.lastStrike < .16) return;
      this.level = now - this.lastStrike < TUNE.scream.chain ? Math.min(2, this.level + 1) : 0;
      this.lastStrike = now;
      const delay = .06; this.sound.strike(this.level, delay); this.visual.strike(this.app.time + this.app.audio.lag());
      return;
    }
    if (this.holding) return;
    this.holding = from; $('#extraAction').classList.add('held');
    this.sound.breatheIn();
  }
  release(from) {
    if (this.mode !== 'ocarina' || this.holding !== from) return;
    this.holding = null; $('#extraAction').classList.remove('held');
    this.sound?.breatheOut();
  }
  stop() { this.sound?.stop(); this.holding = null; $('#extraAction')?.classList.remove('held'); this.visual.hits = []; this.lastStrike = -99; this.level = 0; }
  tick(t, dt) {
    this.visual.update(t, dt, this.sound);
    const busy = !!this.sound && this.sound.voices.some(v => (v.kind === 'scream' || v.kind === 'exhale') && !v.gone);
    this.droneMix = lerp(this.droneMix ?? 1, busy ? TUNE.drone.voice : TUNE.drone.idle, 1 - Math.exp(-dt * 3));
    PLAY.drone.level = DRONE_BASE * this.droneMix;
  }
}

const originalStart = App.prototype.start;
App.prototype.start = async function (...args) {
  const r = await originalStart.apply(this, args);
  const c = this.extraInstruments;
  if (c && this.audio.ready && !c.sound) { try { c.sound = new ExtraAudio(this.audio); c.sound.warm('all'); } catch (e) { console.error(e); } }
  return r;
};
App.prototype.init = async function (...args) { await originalInit.apply(this, args); if (this.ready && !this.extraInstruments) { try { this.extraInstruments = new ExtraController(this); } catch (e) { console.error(e); } } };
App.prototype.appendix = async function (...args) { this.extraInstruments?.leave(); return originalAppendix.apply(this, args); };
App.prototype.damp = function (...args) { this.extraInstruments?.stop(); return originalDamp.apply(this, args); };
App.prototype.updateModeToggle = function (...args) { const value = originalToggle.apply(this, args); this.extraInstruments?.updateTabs(); return value; };
App.prototype.playTick = function (...args) { if (this.extraInstruments?.mode) return; return originalPlayTick.apply(this, args); };
Scene.prototype.tick = function (t, dt, audio) { if (this.extraInstruments?.mode) return this.extraInstruments.tick(t, dt); return originalSceneTick.call(this, t, dt, audio); };
Scene.prototype.render = function (t) { if (this.extraInstruments?.mode) return this.extraInstruments.visual.render(t); return originalSceneRender.call(this, t); };
window.CryingBowlExtra = { version: '3.0.0', tune: TUNE, voice: VOICE };
})();
