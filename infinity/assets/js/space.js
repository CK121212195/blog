// 宇宙の背景 ── 重力で曲がる光と、降着円盤（WebGL）
// 光の道すじを一歩ずつ進め、ブラックホールの近くで曲げる。円盤を横切ったら色を足し、抜けた先は星空。
// WebGL が使えない端末では、何もせずに false を返す（呼ぶ側が代わりの絵を出す）。

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uSeed;   // x:仰角 y:傾き z:回転の向き w:色温度
uniform float uShift; // 横へのずらし（文字の場所をあける）
uniform float uZoom;

float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1.,0.)),u.x),mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*nz(p);p*=2.03;a*=.5;}return v;}

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

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  uv.x-=uShift;
  uv/=uZoom;
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
        vec3 dc=disk(rq,atan(q.z,q.x),uTime);
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
  col=1.-exp(-col*1.2);
  col*=1.-.28*dot(uv*uZoom,uv*uZoom);
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

// 星空とブラックホールを canvas に描きつづける。戻り値は操作用（失敗なら null）
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
  for (const n of ['uRes', 'uTime', 'uSeed', 'uShift', 'uZoom']) U[n] = gl.getUniformLocation(prog, n);

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let quality = opts.quality || 0.55; // 画面の何割の細かさで描くか
  let seed = [0.13, 0.06, 1, 0.3];
  let shift = 0, zoom = 1;
  let raf = 0, running = false, visible = true, t0 = performance.now(), last = 0;
  const times = [];

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(r.width * dpr * quality));
    const h = Math.max(2, Math.round(r.height * dpr * quality));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const wide = r.width / Math.max(1, r.height);
    shift = opts.shift ? opts.shift(wide) : 0;
    zoom = opts.zoom ? opts.zoom(wide) : 1;
  }
  function draw(t) {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, t);
    gl.uniform4f(U.uSeed, seed[0], seed[1], seed[2], seed[3]);
    gl.uniform1f(U.uShift, shift);
    gl.uniform1f(U.uZoom, zoom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // 重ければ粗く、軽ければ細かく
  function adapt(dt) {
    times.push(dt);
    if (times.length < 24) return;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    times.length = 0;
    if (avg > 34 && quality > 0.28) { quality = Math.max(0.28, quality * 0.8); size(); }
    else if (avg < 14 && quality < 0.8) { quality = Math.min(0.8, quality * 1.12); size(); }
  }
  function frame(now) {
    if (!running) return;
    const dt = now - last;
    last = now;
    if (dt > 0 && dt < 500) adapt(dt);
    draw((now - t0) / 1000 + 20);
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
  const ro = new ResizeObserver(() => { size(); if (!running) draw(24); });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); else stop(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();

  return {
    // ブロックのハッシュ（後ろの16バイト）で、円盤の向きと色を変える
    setSeed(bytes) {
      const b = bytes || [];
      seed = [0.07 + ((b[0] || 0) / 255) * 0.16, ((b[1] || 0) / 255 - 0.5) * 0.24, (b[2] || 0) & 1 ? 1 : -1, (b[3] || 0) / 255];
      if (!running) draw(24);
    },
    get quality() { return quality; },
    stop,
    start,
  };
}
