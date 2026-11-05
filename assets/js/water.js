/* Superficie d'acqua "Venezia liquida" in Three.js.
   Onde procedurali + increspature analitiche generate da mouse e dita,
   riflessi dorati dei lampioni e riflesso del titolo. */
import * as THREE from '../vendor/three.module.min.js';

const MAX_DROPS = 16;

const vert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec2  uRes;        // px (CSS * pixelRatio)
  uniform float uTime;
  uniform vec2  uMouse;      // spazio p (aspetto corretto)
  uniform float uMouseOn;
  uniform vec4  uDrops[${MAX_DROPS}]; // x, y, t0, ampiezza
  uniform float uScroll;     // 0 → 1 lungo la pagina
  uniform vec2  uTilt;       // giroscopio
  uniform sampler2D uTitle;
  uniform vec4  uTitleRect;  // x, y(top), w, h in pixel del buffer (y dall'alto)
  uniform float uTitleAlpha;
  uniform float uQuality;    // 1 desktop, 0 mobile
  uniform float uDropLimit;

  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<4;i++){
      if(float(i) > 2.0 + uQuality) break;
      v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5;
    }
    return v;
  }
  float height(vec2 p){
    float t = uTime;
    // onde lente di laguna: allungate in orizzontale, come la superficie vista di sbieco
    vec2 q = vec2(p.x*1.1, p.y*3.2);
    float h = fbm(q*1.6 + vec2(t*0.05, t*0.11)) * 0.55;
    h += sin(q.y*6.0 + t*0.9 + fbm(q*0.8)*4.0) * 0.06;
    // increspature dei punti di contatto
    for(int i=0;i<${MAX_DROPS};i++){
      if(float(i) >= uDropLimit) break;
      vec4 d = uDrops[i];
      float age = t - d.z;
      if(d.w <= 0.0 || age < 0.0 || age > 4.0) continue;
      float dist = length((p - d.xy) * vec2(1.0, 1.6));
      float r = age * 0.32;
      float x = dist - r;
      float env = exp(-x*x*90.0) * exp(-age*1.15) * smoothstep(0.0, 0.08, r + 0.02);
      h += sin(x*55.0) * env * d.w * 0.22;
    }
    // scia morbida del mouse
    float md = length((p - uMouse) * vec2(1.0, 1.5));
    h += uMouseOn * exp(-md*md*28.0) * 0.05 * sin(md*30.0 - t*4.0);
    return h;
  }
  vec3 env(vec2 q){
    // cielo notturno + riflessi verticali dei lampioni (oro) + bagliore bordeaux
    vec3 deep = mix(vec3(0.035,0.07,0.085), vec3(0.06,0.13,0.15), smoothstep(-0.6, 0.6, q.y));
    vec3 wine = vec3(0.50,0.075,0.19);
    vec3 gold = vec3(0.79,0.65,0.42);
    float glowW = exp(-dot(q - vec2(0.75, 0.42), q - vec2(0.75, 0.42)) * 3.2);
    vec3 col = deep + wine * glowW * mix(0.32, 0.55, uScroll);
    float lamps = 0.0;
    lamps += exp(-pow((q.x + 0.62)*18.0, 2.0)) * 0.9;
    lamps += exp(-pow((q.x + 0.12)*24.0, 2.0)) * 0.55;
    lamps += exp(-pow((q.x - 0.38)*16.0, 2.0)) * 0.8;
    lamps += exp(-pow((q.x - 0.92)*22.0, 2.0)) * 0.5;
    float vfade = smoothstep(-0.55, 0.15, q.y) * (1.0 - smoothstep(0.3, 0.7, q.y));
    col += gold * lamps * vfade * mix(0.28, 0.12, uScroll);
    return col;
  }
  void main(){
    vec2 frag = vUv * uRes;
    vec2 p = (frag - 0.5*uRes) / uRes.y;
    float e = 2.0 / uRes.y;
    float h  = height(p);
    float hx = height(p + vec2(e, 0.0));
    float hy = height(p + vec2(0.0, e));
    vec3 n = normalize(vec3((h - hx)/e, (h - hy)/e, 6.0));

    vec2 q = p + n.xy * 0.22 + uTilt * 0.06;
    vec3 col = env(q);

    // luce speculare (avorio) con inclinazione del telefono
    vec3 L = normalize(vec3(-0.35 + uTilt.x, 0.55 + uTilt.y, 0.9));
    vec3 V = vec3(0.0, 0.0, 1.0);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0);
    col += vec3(0.96,0.92,0.86) * smoothstep(0.0, 1.0, spec) * 0.16;

    // bagliore dorato attorno al cursore / al dito
    float md = length(p - uMouse);
    col += vec3(0.79,0.65,0.42) * exp(-md*md*9.0) * 0.06 * uMouseOn;

    // riflesso del titolo (specchiato sotto la sua base, deformato dalle onde)
    if(uTitleAlpha > 0.001){
      vec2 fp = vec2(frag.x, uRes.y - frag.y);          // y dall'alto
      float base = uTitleRect.y + uTitleRect.w;
      float d = fp.y - base;
      float span = uTitleRect.w * 0.5;
      if(d > 0.0 && d < span){
        float srcY = base - d * 1.15;
        vec2 tuv = vec2((fp.x - uTitleRect.x) / uTitleRect.z, (srcY - uTitleRect.y) / uTitleRect.w);
        tuv += n.xy * vec2(0.03, 0.06);
        if(tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0){
          vec4 tx = texture2D(uTitle, vec2(tuv.x, 1.0 - tuv.y));
          float fade = pow(1.0 - d / span, 1.8);
          col = mix(col, tx.rgb, tx.a * fade * 0.26 * uTitleAlpha);
        }
      }
    }

    // verso il fondo pagina l'acqua scivola nel bordeaux
    col = mix(col, col * vec3(1.25, 0.72, 0.8), uScroll * 0.55);
    // vignettatura + dithering contro il banding
    float vig = smoothstep(1.25, 0.25, length(p * vec2(0.8, 1.0)));
    col *= mix(0.6, 1.0, vig);
    col += (hash(frag + fract(uTime)) - 0.5) / 255.0 * 2.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createWater(canvas, { mobile = false, onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: mobile ? 'low-power' : 'high-performance',
    failIfMajorPerformanceCaveat: !!mobile,
  });
  const dpr = window.devicePixelRatio || 1;
  const scale = mobile ? Math.min(dpr, 1) * 0.5 : Math.min(dpr, 1.5) * 0.75;
  renderer.setPixelRatio(scale);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const drops = Array.from({ length: MAX_DROPS }, () => new THREE.Vector4(0, 0, -10, 0));
  let titleTex = new THREE.CanvasTexture(document.createElement('canvas'));
  titleTex.minFilter = THREE.LinearFilter;

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, -2) },
    uMouseOn: { value: 0 },
    uDrops: { value: drops },
    uScroll: { value: 0 },
    uTilt: { value: new THREE.Vector2(0, 0) },
    uTitle: { value: titleTex },
    uTitleRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTitleAlpha: { value: 0 },
    uQuality: { value: mobile ? 0 : 1 },
    uDropLimit: { value: mobile ? 6 : MAX_DROPS },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  let w = 1, h = 1, dropIdx = 0, running = true, paused = false, last = performance.now(), t = 0;
  const frameMs = mobile ? 1000 / 30 : 0;
  const target = { mouse: new THREE.Vector2(0, -2), on: 0, tilt: new THREE.Vector2() };
  let titleBox = null; // {x, y(page), w, h} in CSS px
  let scrollY = 0;

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    uniforms.uRes.value.set(Math.round(w * pr), Math.round(h * pr));
  }
  function toP(x, y) { // CSS px → spazio p dello shader
    return new THREE.Vector2((x - w / 2) / h, (h / 2 - y) / h);
  }
  function drop(x, y, amp = 1) {
    const p = toP(x, y);
    drops[dropIdx].set(p.x, p.y, t, amp);
    dropIdx = (dropIdx + 1) % MAX_DROPS;
  }
  function pointer(x, y) { target.mouse.copy(toP(x, y)); target.on = 1; }
  function pointerLeave() { target.on = 0; }
  function tilt(gx, gy) { target.tilt.set(gx, gy); }
  function setScroll(y, progress) { scrollY = y; uniforms.uScroll.value = progress; }

  function setTitle(el) {
    // disegna il titolo su un canvas 2D per poterlo riflettere nell'acqua
    const r = el.getBoundingClientRect();
    const pr = renderer.getPixelRatio();
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(r.width * pr)); c.height = Math.max(2, Math.round(r.height * pr));
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(pr, pr);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const family = getComputedStyle(el).fontFamily;
    el.querySelectorAll('.line').forEach((line) => {
      // uso la riga (non lo span interno, che può essere traslato dall'animazione d'entrata)
      const s = getComputedStyle(line);
      const lr = line.getBoundingClientRect();
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${fs}px ${family}`;
      ctx.fillStyle = s.color;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(line.textContent.trim(), lr.left - r.left + parseFloat(s.paddingLeft), lr.top - r.top + fs * 0.74);
    });
    const old = titleTex;
    titleTex = new THREE.CanvasTexture(c);
    titleTex.minFilter = THREE.LinearFilter;
    titleTex.generateMipmaps = false;
    uniforms.uTitle.value = titleTex;
    old.dispose();
    titleBox = { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height };
  }
  let titleAlpha = 0;
  function showTitle(v) { titleAlpha = v; }

  let lost = false;
  function setPaused(v) {
    paused = !!v;
    if (!paused) last = performance.now();
  }
  function fail(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (lost) return;
    lost = true;
    running = false;
    onLost?.();
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (paused || document.hidden) { last = now; return; }
    if (frameMs && now - last < frameMs) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
    uniforms.uTime.value = t;
    uniforms.uMouse.value.lerp(target.mouse, 1 - Math.pow(0.001, dt));
    uniforms.uMouseOn.value += (target.on - uniforms.uMouseOn.value) * (1 - Math.pow(0.02, dt));
    uniforms.uTilt.value.lerp(target.tilt, 1 - Math.pow(0.01, dt));
    uniforms.uTitleAlpha.value = titleAlpha * Math.max(0, 1 - scrollY / (h * 0.7));
    if (titleBox) {
      const pr = renderer.getPixelRatio();
      uniforms.uTitleRect.value.set(titleBox.x * pr, (titleBox.y - scrollY) * pr, titleBox.w * pr, titleBox.h * pr);
    }
    try { renderer.render(scene, camera); }
    catch { fail(); }
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, mobile ? 180 : 60);
  }
  resize();
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  canvas.addEventListener('webglcontextlost', fail);
  document.addEventListener('visibilitychange', () => {
    if (lost) return;
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);

  return { drop, pointer, pointerLeave, tilt, setScroll, setTitle, showTitle, resize, setPaused };
}
