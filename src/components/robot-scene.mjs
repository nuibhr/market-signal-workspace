import * as THREE from 'three';

// Decorative geometry only. This scene never reads prices or emits trade signals.
export function createRobotScene(canvas, { onError } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(3.7, 2.5, 8.7);
  camera.lookAt(0, 0.05, 0);
  const robot = new THREE.Group();
  robot.rotation.y = -0.14;
  scene.add(robot);
  scene.add(new THREE.HemisphereLight(0xd9fff7, 0x152431, 2.8));
  const key = new THREE.DirectionalLight(0xffffff, 4.5); key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x78ffe3, 3); rim.position.set(4, 2, -3); scene.add(rim);
  const blue = new THREE.PointLight(0x76a7ff, 25, 15); blue.position.set(-4, 1, 2); scene.add(blue);
  const shell = new THREE.MeshStandardMaterial({ color: 0xe3eee9, roughness: 0.27, metalness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x10252b, roughness: 0.27, metalness: 0.65 });
  const visor = new THREE.MeshPhysicalMaterial({ color: 0x041217, roughness: 0.12, metalness: 0.45, clearcoat: 1 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x9affde, emissive: 0x53efc4, emissiveIntensity: 2, roughness: 0.3 });
  const blueInk = new THREE.MeshBasicMaterial({ color: 0x83b6ff, transparent: true, opacity: 0.7 });
  const gridInk = new THREE.LineBasicMaterial({ color: 0x60b9a7, transparent: true, opacity: 0.2 });
  const materials = new Set([shell, dark, visor, mint, blueInk, gridInk]);
  const neonLine = new THREE.LineBasicMaterial({ color: 0x99ffe0 }); materials.add(neonLine);
  const geometries = new Set();
  const textures = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const mesh = (shape, material, group, x = 0, y = 0, z = 0) => {
    const item = new THREE.Mesh(geometry(shape), material); item.position.set(x, y, z); group.add(item); return item;
  };
  function rounded(w, h, d, radius, material, group, x, y, z) {
    const s = new THREE.Shape(), a = -w / 2, b = -h / 2, r = radius;
    s.moveTo(a + r, b); s.lineTo(a + w - r, b); s.quadraticCurveTo(a + w, b, a + w, b + r);
    s.lineTo(a + w, b + h - r); s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    s.lineTo(a + r, b + h); s.quadraticCurveTo(a, b + h, a, b + h - r);
    s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b);
    const shape = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 12 });
    shape.translate(0, 0, -d / 2);
    return mesh(shape, material, group, x, y, z);
  }
  function line(points, material, group) {
    const item = new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)))), material === mint ? neonLine : material);
    group.add(item); return item;
  }
  function ring(radius, tube, material, group, y) {
    const item = mesh(new THREE.TorusGeometry(radius, tube, 8, 80), material, group, 0, y, 0);
    item.rotation.x = Math.PI / 2; return item;
  }
  function glow(color, size, group, x, y, z) {
    const art = document.createElement('canvas'); art.width = art.height = 64;
    const ctx = art.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, color); gradient.addColorStop(0.22, color + '66'); gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(art); textures.add(texture);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); materials.add(material);
    const sprite = new THREE.Sprite(material); sprite.scale.set(size, size, 1); sprite.position.set(x, y, z); group.add(sprite); return sprite;
  }

  // Pearl shell, dark glass face, expressive eyes and antenna.
  rounded(1.38, 1.23, 0.82, 0.29, shell, robot, 0, -0.12, 0);
  rounded(0.94, 0.64, 0.09, 0.16, dark, robot, 0, -0.08, 0.47);
  const badge = mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 40), mint, robot, 0, -0.03, 0.55);
  line([[-0.065, -0.11, 0.565], [-0.065, 0.05, 0.565], [0.065, -0.11, 0.565], [0.065, 0.05, 0.565]], mint, robot);
  mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.22, 32), dark, robot, 0, 0.65, 0);
  const head = new THREE.Group(); head.position.y = 1.3; robot.add(head);
  rounded(1.88, 1.22, 1.0, 0.3, shell, head, 0, 0, 0);
  rounded(1.65, 0.85, 0.08, 0.23, visor, head, 0, 0, 0.56);
  const eyes = [-0.39, 0.39].map(x => rounded(0.28, 0.15, 0.025, 0.07, mint, head, x, 0.05, 0.64));
  line([[-0.15, -0.2, 0.64], [-0.08, -0.24, 0.65], [0.08, -0.24, 0.65], [0.15, -0.2, 0.64]], mint, head);
  for (const x of [-1.04, 1.04]) {
    const ear = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 32), dark, head, x, 0, 0); ear.rotation.z = Math.PI / 2;
    const earLight = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.21, 24), mint, head, x, 0, 0); earLight.rotation.z = Math.PI / 2;
  }
  mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.3, 12), dark, head, 0.05, 0.82, 0);
  mesh(new THREE.SphereGeometry(0.105, 20, 12), mint, head, 0.05, 1.01, 0);
  glow('#8bffde', 0.55, head, 0.05, 1.01, 0);
  // Articulated arms and softly rounded palms.
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.2, 20, 12), dark, robot, side * 0.82, 0.2, 0);
    const arm = new THREE.Group(); arm.position.set(side * 0.99, -0.02, 0.12); arm.rotation.z = side * 0.42; robot.add(arm);
    mesh(new THREE.CapsuleGeometry(0.18, 0.46, 6, 16), shell, arm, 0, -0.16, 0);
    mesh(new THREE.SphereGeometry(0.21, 20, 12), dark, arm, 0, -0.52, 0.02);
    mesh(new THREE.SphereGeometry(0.25, 24, 16), shell, arm, 0, -0.61, 0.18);
    rounded(0.19, 0.13, 0.025, 0.04, mint, arm, 0, -0.6, 0.42);
  }
  mesh(new THREE.CylinderGeometry(0.32, 0.49, 0.22, 32), dark, robot, 0, -0.86, 0);
  ring(0.31, 0.035, mint, robot, -1.0);
  glow('#75ffd8', 1.5, robot, 0, -1.1, 0);

  // Holographic floor and radar sweep.
  const floor = new THREE.Group(); floor.position.y = -1.85; scene.add(floor);
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x0c2b2b, transparent: true, opacity: 0.5, side: THREE.DoubleSide }); materials.add(floorMaterial);
  const disk = mesh(new THREE.CircleGeometry(2.7, 80), floorMaterial, floor); disk.rotation.x = -Math.PI / 2;
  [0.8, 1.5, 2.2, 2.7].forEach((r, i) => ring(r, 0.008, i === 2 ? blueInk : mint, floor, 0.01));
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    line([[Math.cos(angle) * 2.45, 0.02, Math.sin(angle) * 2.45], [Math.cos(angle) * 2.65, 0.02, Math.sin(angle) * 2.65]], gridInk, floor);
  }
  const sweepMaterial = new THREE.MeshBasicMaterial({ color: 0x55ffd0, opacity: 0.09, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }); materials.add(sweepMaterial);
  const sweep = mesh(new THREE.CircleGeometry(2.65, 40, 0, Math.PI / 3), sweepMaterial, floor, 0, 0.03, 0); sweep.rotation.x = -Math.PI / 2;
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x8bffe0, transparent: true, opacity: 0.5 }); materials.add(pulseMaterial);
  const pulse = ring(1, 0.012, pulseMaterial, floor, 0.04);

  // A floating glass chart with illustrative candles, never actual market prices.
  const panel = new THREE.Group(); panel.position.set(1.45, -0.85, 1.05); panel.rotation.set(-0.36, -0.28, 0.08); scene.add(panel);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x10323b, transparent: true, opacity: 0.68, metalness: 0.2, roughness: 0.3, side: THREE.DoubleSide }); materials.add(glass);
  rounded(2.35, 1.26, 0.035, 0.13, glass, panel, 0, 0, 0);
  const outlinePlane = new THREE.PlaneGeometry(2.18, 1.1);
  const outline = new THREE.EdgesGeometry(outlinePlane); outlinePlane.dispose();
  const border = new THREE.LineSegments(geometry(outline), gridInk); border.position.z = 0.07; panel.add(border);
  for (let i = 0; i < 3; i++) line([[-1.04, i * 0.27 - 0.3, 0.08], [1.04, i * 0.27 - 0.3, 0.08]], gridInk, panel);
  const candles = [];
  for (let i = 0; i < 10; i++) {
    const x = -0.93 + i * 0.2, y = -0.25 + Math.sin(i * 0.8) * 0.17 + i * 0.033;
    const height = 0.12 + (i % 3) * 0.055;
    const bar = mesh(new THREE.BoxGeometry(0.085, height, 0.025), i % 3 === 0 ? blueInk : mint, panel, x, y, 0.08); candles.push(bar);
    line([[x, y - height, 0.09], [x, y + height, 0.09]], i % 3 === 0 ? blueInk : mint, panel);
  }
  const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xa0ffe4, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }); materials.add(laserMaterial);
  const scanPlane = mesh(new THREE.PlaneGeometry(0.1, 1.03), laserMaterial, panel, -1, 0, 0.12);
  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0x5effd1, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }); materials.add(beamMaterial);
  const beam = mesh(new THREE.ConeGeometry(0.5, 1.8, 24, 1, true), beamMaterial, scene, 0.9, -0.12, 1.22); beam.rotation.z = -0.65;
  // Sparse points keep the composition airy and light on mobile GPUs.
  const positions = new Float32Array(60 * 3);
  for (let i = 0; i < 60; i++) { positions[i * 3] = Math.sin(i * 2.399) * (2.2 + (i % 5) * 0.2); positions[i * 3 + 1] = (i % 13) * 0.3 - 1.7; positions[i * 3 + 2] = Math.cos(i * 2.399) * 2; }
  const pointsGeometry = geometry(new THREE.BufferGeometry()); pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pointsMaterial = new THREE.PointsMaterial({ color: 0x85e4c6, size: 0.025, transparent: true, opacity: 0.5 }); materials.add(pointsMaterial);
  const points = new THREE.Points(pointsGeometry, pointsMaterial); scene.add(points);

  let active = true, disposed = false, frame = 0, previous = 0, elapsed = 0, boost = 0;
  const pointer = new THREE.Vector2(), smooth = new THREE.Vector2();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.position.set(3.7, 2.5, camera.aspect < 1 ? 10.5 : 8.7); camera.lookAt(0, 0.05, 0); camera.updateProjectionMatrix();
    if (!active) renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const move = event => { const box = canvas.getBoundingClientRect(); pointer.set((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1); };
  const reset = () => pointer.set(0, 0);
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', reset);
  function draw(now) {
    if (disposed || !active) return;
    frame = requestAnimationFrame(draw);
    if (now - previous < 1000 / 30) return;
    const dt = Math.min((now - previous) / 1000, 0.06); previous = now;
    if (!reduced.matches) elapsed += dt;
    const t = elapsed;
    smooth.lerp(pointer, 0.06);
    robot.position.y = reduced.matches ? 0 : Math.sin(t * 1.25) * 0.09;
    robot.rotation.y = -0.14 + smooth.x * 0.16;
    head.rotation.y = Math.sin(t * 0.65) * 0.13 + smooth.x * 0.12;
    head.rotation.x = smooth.y * 0.045;
    const blink = !reduced.matches && t % 5.2 > 5.03 ? 0.18 : 1;
    eyes.forEach(eye => eye.scale.y = blink);
    badge.rotation.z = t * 0.2;
    panel.position.y = -0.85 + Math.sin(t * 0.85 + 1) * 0.04;
    scanPlane.position.x = Math.sin(t * (boost > 0 ? 3 : 0.8)) * 1.04;
    sweep.rotation.z = -t * 0.5;
    const phase = (t * 0.28) % 1; pulse.scale.setScalar(0.7 + phase * 2); pulseMaterial.opacity = (1 - phase) * 0.5;
    points.rotation.y = t * 0.025;
    boost = Math.max(0, boost - dt); beamMaterial.opacity = boost > 0 ? 0.13 : 0.055;
    try { renderer.render(scene, camera); } catch { active = false; cancelAnimationFrame(frame); onError?.(); }
    if (reduced.matches) { active = false; cancelAnimationFrame(frame); }
  }
  const contextLost = event => { event.preventDefault(); active = false; cancelAnimationFrame(frame); onError?.(); };
  canvas.addEventListener('webglcontextlost', contextLost);
  frame = requestAnimationFrame(draw);
  return {
    scan() { boost = 2.5; },
    setActive(value) { if (disposed) return; active = value; cancelAnimationFrame(frame); previous = performance.now(); if (active) frame = requestAnimationFrame(draw); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', reset); canvas.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
