// 操縦席の窓の外 ── 地球（雲・海・夜の灯・大気）と、重力で光を曲げる特異点（WebGL）
//  - 地球に当たる光線は地球を描き、当たらない光線は特異点のまわりで一歩ずつ曲げて、円盤と星空を拾う
//  - 窓の外の向き（カメラ）は、呼ぶ側が set() で渡す。取引の弧を重ねる側も、同じ数字で位置を計算する
//  - WebGL が使えない端末では null を返す（呼ぶ側が代わりの絵を出す）
const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uSeed;   // 円盤 x:仰角 y:傾き z:回転の向き w:色温度
uniform vec4 uBH;     // 特異点の方向(xyz) と見かけの大きさ(w)
uniform vec4 uCam;    // 画面のずれ(xy)・傾き(z)・焦点距離(w)
uniform float uPitch; // 見下ろす角度（ラジアン）
uniform vec4 uEarth;  // x:高度 y:前後のずれ z:自転の速さ w:描くか
uniform vec3 uSun;
uniform float uPulse; // ブロックが届いたときの明るさ

float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1.,0.)),u.x),mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*nz(p);p*=2.03;a*=.5;}return v;}
float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1.,0.,0.)),u.x),mix(h13(i+vec3(0.,1.,0.)),h13(i+vec3(1.,1.,0.)),u.x),u.y),
             mix(mix(h13(i+vec3(0.,0.,1.)),h13(i+vec3(1.,0.,1.)),u.x),mix(h13(i+vec3(0.,1.,1.)),h13(i+vec3(1.,1.,1.)),u.x),u.y),u.z);}
float fbm5(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}
float fbm3(vec3 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v/.875;}
vec3 rotX(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,v.y*c-v.z*s,v.y*s+v.z*c);}

vec3 stars(vec3 d){
  vec2 sp=vec2(atan(d.z,d.x),asin(clamp(d.y,-1.,1.)));
  vec3 col=vec3(0.);
  for(int k=0;k<2;k++){
    float sc=k==0?70.:150.;
    vec2 g=sp*sc; vec2 id=floor(g); vec2 f=fract(g)-.5;
    float h=h12(id+float(k)*17.);
    if(h>.955){
      vec2 o=vec2(h12(id+7.1),h12(id+3.3))-.5;
      float r=length(f-o*.6);
      float b=smoothstep(.12,0.,r)*(h-.955)*22.;
      col+=mix(vec3(1.,.86,.7),vec3(.75,.85,1.),h12(id+1.7))*b;
    }
  }
  float band=exp(-pow(d.y*2.6+.25*sin(sp.x*2.+1.),2.));
  col+=vec3(.16,.2,.3)*band*fbm(sp*5.)*.35;
  return col;
}

vec3 disk(float r,float a,float t){
  float x=clamp((r-2.6)/8.,0.,1.);
  vec3 hot=vec3(1.,.95,.84);
  vec3 mid=mix(vec3(1.,.62,.24),vec3(1.,.72,.36),uSeed.w);
  vec3 cold=vec3(.62,.18,.05);
  vec3 c=mix(hot,mid,smoothstep(0.,.3,x));
  c=mix(c,cold,smoothstep(.3,1.,x));
  float w=pow(r,-1.5)*uSeed.z;
  float n=fbm(vec2(r*1.8,a*3.-t*w*4.));
  float n2=fbm(vec2(r*7.,a*9.-t*w*4.));
  float d=(.45+n)*(.55+.6*n2);
  float edge=smoothstep(2.55,3.3,r)*(1.-smoothstep(6.8,10.,r));
  return c*d*edge*.9;
}

// 特異点：光線を一歩ずつ曲げ、円盤を横切ったら色を足し、抜けた先は星空
vec3 singularity(vec3 rd){
  vec3 bw=normalize(uBH.xyz);
  vec3 bu=normalize(cross(vec3(0.,1.,0.),bw));
  vec3 bv=cross(bw,bu);
  vec3 lc=vec3(dot(rd,bu),dot(rd,bv),dot(rd,bw));
  if(lc.z<.08)return stars(rd);
  vec2 uv=lc.xy/lc.z*2.1/uBH.w;
  float el=uSeed.x;
  float az=uTime*.018;
  float R=30.;
  vec3 ro=vec3(R*cos(el)*sin(az),R*sin(el),-R*cos(el)*cos(az));
  vec3 ww=normalize(-ro);
  vec3 uu=normalize(cross(vec3(0.,1.,0.),ww));
  vec3 vv=cross(ww,uu);
  float rl=uSeed.y;
  vec3 up=cos(rl)*vv+sin(rl)*uu;
  vec3 rt=cos(rl)*uu-sin(rl)*vv;
  vec3 v=normalize(uv.x*rt+uv.y*up+2.1*ww);
  vec3 p=ro;
  vec3 hh=cross(p,v);
  float h2=dot(hh,hh);
  vec3 col=vec3(0.);
  float al=0.;
  for(int i=0;i<170;i++){
    float r=length(p);
    if(r<1.){al=1.;break;}
    float dt=clamp(.07*r,.025,1.4);
    vec3 pn=p+v*dt;
    v+=-1.5*h2*p/(r*r*r*r*r)*dt;
    if(p.y*pn.y<0.){
      vec3 q=mix(p,pn,p.y/(p.y-pn.y));
      float rq=length(q.xz);
      if(rq>2.5&&rq<12.){
        vec3 dc=disk(rq,atan(q.z,q.x),uTime)*(1.+uPulse*.9);
        vec3 vel=normalize(vec3(-q.z,0.,q.x))*sqrt(.5/rq)*uSeed.z;
        float g=1.+1.6*dot(vel,-normalize(v));
        g=pow(max(g,.2),2.6);
        float op=clamp(dot(dc,vec3(.4))*1.1,0.,1.);
        col+=(1.-al)*dc*g;
        al+=(1.-al)*op;
        if(al>.985)break;
      }
    }
    p=pn;
    if(r>48.)break;
  }
  col+=(1.-al)*stars(normalize(v));
  return col;
}

// 地球：海・陸・雲、夜の灯（ノード）、晨昏線、大気
vec3 earth(vec3 n,vec3 rd){
  float t=uTime;
  float mu=max(dot(-rd,n),0.);
  float far=smoothstep(.03,.3,mu); // 地平線の近くは細かい模様を消す（ちらつき防止）
  vec3 q=rotX(n,-t*uEarth.z);
  float c=fbm5(q*9.+vec3(3.1,1.7,.3));
  float land=smoothstep(.5,.525,c);
  float coast=smoothstep(.44,.5,c)*(1.-land);
  float det=mix(.5,fbm3(q*40.),far);
  vec3 ocean=mix(vec3(.004,.025,.08),vec3(.015,.09,.21),smoothstep(.3,.48,c));
  ocean=mix(ocean,vec3(.03,.16,.2),coast*.7);
  vec3 ground=mix(vec3(.27,.23,.15),vec3(.08,.13,.07),smoothstep(.35,.65,det));
  ground=mix(ground,vec3(.5,.41,.27),smoothstep(.56,.78,fbm3(q*15.+7.)));
  ground=mix(ground,vec3(.82,.84,.88),smoothstep(.74,.8,det+(c-.5)*.8)*far*.8);
  vec3 surf=mix(ocean,ground,land);
  vec3 qc=rotX(n,-t*uEarth.z*1.35+.35);
  float big=fbm3(qc*4.+vec3(0.,t*.003,0.));
  vec3 wq=qc*13.+vec3(fbm3(qc*6.),fbm3(qc*6.+4.3),fbm3(qc*6.+8.7))*2.6;
  float mid=fbm5(wq);
  float fine=mix(.5,fbm3(qc*46.+mid*3.),far);
  float cl=smoothstep(.43,.8,mid*.62+big*.3+fine*.22-.02);
  cl*=cl*(3.-2.*cl);
  cl*=mix(.72,1.,far);
  float ndl=dot(n,uSun);
  float day=smoothstep(-.1,.22,ndl);
  vec3 col=surf*(.01+1.35*max(ndl,0.));
  vec3 hv=normalize(uSun-rd);
  float spec=pow(max(dot(n,hv),0.),70.)*(1.-land)*(1.-cl)*smoothstep(0.,.2,ndl);
  col+=vec3(1.,.86,.68)*spec*1.2;
  col=mix(col,vec3(1.,.99,.97)*(.008+1.6*max(ndl,0.)),cl*.94);
  float city=smoothstep(.8,.97,n3(q*560.))*land*smoothstep(.45,.72,fbm3(q*30.+2.))*far;
  city*=.75+.25*sin(t*1.7+n3(q*90.)*40.);
  col+=vec3(1.,.62,.28)*city*(1.-day)*(1.-cl*.8)*(2.4+uPulse*3.5);
  col+=vec3(.6,.22,.05)*exp(-pow(ndl*6.,2.))*.12*(1.-cl*.4);
  vec3 bw=normalize(uBH.xyz);
  col+=vec3(1.,.55,.22)*pow(max(dot(n,bw),0.),3.)*.035*(1.+uPulse);
  float fr=pow(1.-mu,3.);
  col=mix(col,vec3(.3,.55,1.)*(.03+.85*day),fr*.5);
  col+=vec3(.25,.45,1.)*pow(1.-mu,8.)*(.06+.9*day)*.7;
  return col;
}

// 地球の縁の大気（地球に当たらなかった光線）
vec3 limb(vec3 rd,vec3 C){
  float b=max(dot(rd,C),0.);
  vec3 m=rd*b-C;
  float d=length(m);
  float a=max(d-1.,0.);
  vec3 mn=m/max(d,1e-4);
  float lit=smoothstep(-.3,.45,dot(mn,uSun));
  return vec3(.2,.42,1.)*exp(-a/.013)*(.05+.95*lit)+vec3(.78,.9,1.)*exp(-a/.0032)*(.04+.85*lit);
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 q=uv-uCam.xy;
  float cr=cos(uCam.z),sr=sin(uCam.z);
  q=vec2(cr*q.x-sr*q.y,sr*q.x+cr*q.y);
  vec3 rd=normalize(vec3(q,uCam.w));
  float cp=cos(uPitch),sp=sin(uPitch);
  rd=vec3(rd.x,rd.y*cp-rd.z*sp,rd.y*sp+rd.z*cp);
  vec3 col;
  vec3 C=vec3(0.,-(1.+uEarth.x),uEarth.y);
  float th=-1.;
  if(uEarth.w>.5){
    float b=dot(rd,C);
    float h=b*b-(dot(C,C)-1.);
    if(h>0.&&b>0.)th=b-sqrt(h);
  }
  if(th>0.){
    col=earth(normalize(rd*th-C),rd);
  }else{
    col=singularity(rd);
    if(uEarth.w>.5)col+=limb(rd,C);
  }
  col=1.-exp(-col*1.15);
  col*=1.-.24*dot(uv,uv);
  gl_FragColor=vec4(col,1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || 'shader');
  }
  return s;
}

// シェーダーと同じ計算（取引の弧の位置合わせに使う）
export const view = {
  // 画面の点(uv) → 世界の向き
  dir(uv, P) {
    let x = uv[0] - P.shift[0], y = uv[1] - P.shift[1];
    const cr = Math.cos(P.roll), sr = Math.sin(P.roll);
    [x, y] = [cr * x - sr * y, sr * x + cr * y];
    const l = Math.hypot(x, y, P.F);
    const d = [x / l, y / l, P.F / l];
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    return [d[0], d[1] * cp - d[2] * sp, d[1] * sp + d[2] * cp];
  },
  // 世界の点 → 画面の点(uv)。カメラの後ろなら null
  project(p, P) {
    const cp = Math.cos(-P.pitch), sp = Math.sin(-P.pitch);
    const y = p[1] * cp - p[2] * sp, z = p[1] * sp + p[2] * cp, x = p[0];
    if (z <= 1e-4) return null;
    let u = (x / z) * P.F, v = (y / z) * P.F;
    const cr = Math.cos(-P.roll), sr = Math.sin(-P.roll);
    [u, v] = [cr * u - sr * v, sr * u + cr * v];
    return [u + P.shift[0], v + P.shift[1]];
  },
};

// 星空・地球・特異点を canvas に描きつづける。戻り値は操作用（失敗なら null）
export function mountSpace(canvas, opts = {}) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) {
    if (opts.onError) opts.onError(e);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uRes', 'uTime', 'uSeed', 'uBH', 'uCam', 'uPitch', 'uEarth', 'uSun', 'uPulse']) U[n] = gl.getUniformLocation(prog, n);

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let quality = opts.quality || 0.5;
  let seed = [0.13, 0.06, 1, 0.3];
  // 窓の外の向き（呼ぶ側が set で変える）
  const P = { bh: [0.15, 0.05, 1], bhScale: 0.5, shift: [0, 0], roll: 0, F: 1.15, pitch: 0.22, earth: [0.085, 0, 0.0045, 1], sun: [-0.62, 0.42, 0.66], pulse: 0 };
  let raf = 0, running = false, visible = true, t0 = performance.now(), last = 0, tNow = 24;
  const times = [];
  const frameSubs = new Set();

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(r.width * dpr * quality));
    const h = Math.max(2, Math.round(r.height * dpr * quality));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }
  function draw(t) {
    tNow = t;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, t);
    gl.uniform4f(U.uSeed, seed[0], seed[1], seed[2], seed[3]);
    gl.uniform4f(U.uBH, P.bh[0], P.bh[1], P.bh[2], P.bhScale);
    gl.uniform4f(U.uCam, P.shift[0], P.shift[1], P.roll, P.F);
    gl.uniform1f(U.uPitch, P.pitch);
    gl.uniform4f(U.uEarth, P.earth[0], P.earth[1], P.earth[2], P.earth[3]);
    const sl = Math.hypot(P.sun[0], P.sun[1], P.sun[2]) || 1;
    gl.uniform3f(U.uSun, P.sun[0] / sl, P.sun[1] / sl, P.sun[2] / sl);
    gl.uniform1f(U.uPulse, P.pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // 重ければ粗く、軽ければ細かく
  function adapt(dt) {
    times.push(dt);
    if (times.length < 24) return;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    times.length = 0;
    if (avg > 34 && quality > 0.28) { quality = Math.max(0.28, quality * 0.8); size(); }
    else if (avg < 14 && quality < 0.75) { quality = Math.min(0.75, quality * 1.1); size(); }
  }
  function frame(now) {
    if (!running) return;
    const dt = now - last;
    last = now;
    if (dt > 0 && dt < 500) adapt(dt);
    const t = (now - t0) / 1000 + 20;
    frameSubs.forEach((fn) => fn(t, P, now));
    draw(t);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduce || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  size();
  draw(24);
  const ro = new ResizeObserver(() => { size(); if (!running) { frameSubs.forEach((fn) => fn(tNow, P, performance.now())); draw(tNow); } });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); else stop(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();

  return {
    P,
    // ブロックのハッシュ（後ろの16バイト）で、円盤の向きと色を変える
    setSeed(bytes) {
      const b = bytes || [];
      seed = [0.07 + ((b[0] || 0) / 255) * 0.16, ((b[1] || 0) / 255 - 0.5) * 0.24, (b[2] || 0) & 1 ? 1 : -1, (b[3] || 0) / 255];
      if (!running) draw(tNow);
    },
    set(o) { Object.assign(P, o); if (!running) draw(tNow); },
    onFrame(fn) { frameSubs.add(fn); return () => frameSubs.delete(fn); },
    redraw() { draw(tNow); },
    get time() { return tNow; },
    get running() { return running; },
    get quality() { return quality; },
    stop,
    start,
  };
}
