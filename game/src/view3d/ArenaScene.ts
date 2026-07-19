import * as THREE from 'three';
import type { CombatState } from '../engine/combat';
import type { Combatant } from '../engine/types';
import type { AppState } from '../state/game';

/**
 * Riftwake 3D stage — anime-arena-fighter language:
 * behind-the-shoulder camera, cel-shaded fighters with living auras,
 * ki bolts with trails, impact bursts + hit-stop, damage numbers,
 * sunset wasteland arena, planet vista for the world hub.
 */

type Mode = 'title' | 'combat' | 'planets';

const ALLY = 0x6ee7c5;
const ENEMY = 0xf0a35e;
const GOLD = 0xffd75e;
const SKY = {
  title: { top: 0x0b1626, bottom: 0x1c3448, fog: 0x0e1a28 },
  combat: { top: 0x1a2c4e, bottom: 0xd97a3e, fog: 0x483226 },
  planets: { top: 0x05070f, bottom: 0x101a30, fog: 0x05070f },
};

interface Fighter {
  id: string;
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  auraFlames: THREE.Mesh[];
  auraLight: THREE.PointLight;
  groundRing: THREE.Mesh;
  label: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  color: number;
  phase: number;
  home: THREE.Vector3;
  // animation state
  anim: 'idle' | 'lunge' | 'recoil' | 'ko' | 'cast';
  animT: number;
  animTarget: THREE.Vector3 | null;
  hover: number;
  alive: boolean;
  output: number;
  ascended: boolean;
}

interface Effect {
  kind: string;
  t: number;
  life: number;
  objects: THREE.Object3D[];
  from?: THREE.Vector3;
  to?: THREE.Vector3;
  onUpdate: (e: Effect, dt: number, k: number) => void;
}

export class ArenaScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private host: HTMLElement;
  private raf = 0;
  private disposed = false;
  private mode: Mode = 'title';

  private titleGroup!: THREE.Group;
  private combatGroup!: THREE.Group;
  private planetsGroup!: THREE.Group;
  private skyDome!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private sun!: THREE.Sprite;
  private dust!: THREE.Points;
  private stars!: THREE.Points;
  private floatRocks: THREE.Mesh[] = [];
  private planets: { mesh: THREE.Group; speed: number; radius: number; angle: number }[] = [];

  private fighters = new Map<string, Fighter>();
  private effects: Effect[] = [];
  private toonGradient: THREE.Texture;

  private processedLog = new Map<string, number>();
  private shake = 0;
  private hitStop = 0;
  private clashActive = false;
  private camPos = new THREE.Vector3(0, 8, 16);
  private camLook = new THREE.Vector3(0, 2, 0);
  private orbit = 0;

  constructor(host: HTMLElement) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(SKY.title.fog, 0.03);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
    this.camera.position.copy(this.camPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    host.appendChild(this.renderer.domElement);

    this.toonGradient = this.makeToonGradient();

    this.buildSky();
    this.buildLights();
    this.buildTitle();
    this.buildCombatArena();
    this.buildPlanets();
    this.buildDust();
    this.buildStars();
    this.applyMode('title');

    window.addEventListener('resize', this.onResize);
    this.onResize();
    this.loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.host.innerHTML = '';
  }

  sync(state: AppState) {
    if (state.screen === 'title' || state.screen === 'gallery' || state.screen === 'create') {
      this.applyMode('title');
    } else if (state.screen === 'combat' || state.screen === 'clash') {
      this.applyMode('combat');
      if (state.combat) this.syncCombat(state.combat, state.screen === 'clash');
    } else {
      this.applyMode('planets');
    }
  }

  // ------------------------------------------------------------------
  // Materials / helpers
  // ------------------------------------------------------------------

  private makeToonGradient(): THREE.Texture {
    const data = new Uint8Array([80, 80, 80, 255, 150, 150, 150, 255, 220, 220, 220, 255, 255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private toon(color: number, emissive = 0x000000, emissiveIntensity = 0): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: this.toonGradient,
      emissive,
      emissiveIntensity,
    });
  }

  private glowSprite(color: number, size = 1, opacity = 0.8): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    const col = new THREE.Color(color);
    g.addColorStop(0, `rgba(255,255,255,1)`);
    g.addColorStop(0.25, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.9)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(size);
    return s;
  }

  // ------------------------------------------------------------------
  // Environments
  // ------------------------------------------------------------------

  private buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(SKY.title.top) },
        bottom: { value: new THREE.Color(SKY.title.bottom) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottom, top, smoothstep(0.02, 0.65, h)), 1.0);
        }`,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), this.skyMat);
    this.scene.add(this.skyDome);

    this.sun = this.glowSprite(0xffc27a, 60, 0.9);
    this.sun.position.set(-60, 18, -120);
    this.scene.add(this.sun);
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xd8e8ff, 0x4a3220, 1.05);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffdcb0, 1.5);
    key.position.set(-14, 20, -8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -22;
    key.shadow.camera.right = 22;
    key.shadow.camera.top = 22;
    key.shadow.camera.bottom = -22;
    this.scene.add(key);
    // camera-side fill so fighters read clearly from the battle camera
    const fill = new THREE.DirectionalLight(0xffe8d0, 0.75);
    fill.position.set(6, 9, 20);
    this.scene.add(fill);
    const teal = new THREE.DirectionalLight(0x6ee7c5, 0.3);
    teal.position.set(10, 6, -12);
    this.scene.add(teal);
  }

  private buildTitle() {
    const g = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      this.toon(0x14202e),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);

    const palette = [0x1a2a3d, 0x243448, 0x2a3d52, 0x33485c];
    for (let i = 0; i < 48; i++) {
      const h = 2 + Math.random() * 12;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 + Math.random() * 2, h, 0.9 + Math.random() * 2),
        this.toon(
          palette[i % palette.length],
          i % 5 === 0 ? ALLY : i % 7 === 0 ? ENEMY : 0x000000,
          i % 5 === 0 || i % 7 === 0 ? 0.4 : 0,
        ),
      );
      const ang = (i / 48) * Math.PI * 2 + Math.random() * 0.2;
      const rad = 11 + Math.random() * 20;
      mesh.position.set(Math.cos(ang) * rad, h / 2, Math.sin(ang) * rad);
      mesh.castShadow = true;
      g.add(mesh);
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(15, 0.14, 8, 90),
      new THREE.MeshStandardMaterial({
        color: ALLY, emissive: ALLY, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.2,
      }),
    );
    ring.rotation.x = Math.PI / 2.4;
    ring.position.y = 6;
    ring.name = 'ring';
    g.add(ring);

    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.8, 0),
      new THREE.MeshStandardMaterial({
        color: ENEMY, emissive: ENEMY, emissiveIntensity: 1.1, transparent: true, opacity: 0.9,
      }),
    );
    shard.position.y = 4;
    shard.name = 'shard';
    g.add(shard);
    g.add(this.glowSprite(ENEMY, 7, 0.5)).position.set(0, 4, 0);

    this.titleGroup = g;
    this.scene.add(g);
  }

  private terrainHeight(x: number, z: number): number {
    const d = Math.sqrt(x * x + z * z);
    if (d < 11) return 0;
    const n =
      Math.sin(x * 0.18) * Math.cos(z * 0.15) * 1.4 +
      Math.sin(x * 0.05 + z * 0.08) * 2.4;
    return Math.max(0, (d - 11) * 0.12) * (1.6 + n * 0.4);
  }

  private buildCombatArena() {
    const g = new THREE.Group();

    // Wasteland terrain with a flat battle circle
    const geo = new THREE.CircleGeometry(90, 96, 0, Math.PI * 2);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.terrainHeight(x, z));
    }
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 0.95, metalness: 0.02 }),
    );
    ground.receiveShadow = true;
    g.add(ground);

    // Battle circle plate
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(10.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.02;
    plate.receiveShadow = true;
    g.add(plate);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(10.5, 0.1, 8, 80),
      new THREE.MeshStandardMaterial({ color: ALLY, emissive: ALLY, emissiveIntensity: 0.7 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.06;
    g.add(rim);

    // Rock spires
    for (let i = 0; i < 26; i++) {
      const h = 3 + Math.random() * 9;
      const rock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3 + Math.random() * 0.8, 1.2 + Math.random() * 2.2, h, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a6648, roughness: 0.9, flatShading: true }),
      );
      const ang = Math.random() * Math.PI * 2;
      const rad = 18 + Math.random() * 55;
      rock.position.set(Math.cos(ang) * rad, h / 2 + this.terrainHeight(Math.cos(ang) * rad, Math.sin(ang) * rad) * 0.6, Math.sin(ang) * rad);
      rock.rotation.y = Math.random() * Math.PI;
      rock.castShadow = true;
      g.add(rock);
    }

    // Floating rocks (anime energy pressure)
    for (let i = 0; i < 10; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x8a6648, roughness: 0.85, flatShading: true }),
      );
      const ang = Math.random() * Math.PI * 2;
      const rad = 6 + Math.random() * 10;
      rock.position.set(Math.cos(ang) * rad, 1.5 + Math.random() * 4, Math.sin(ang) * rad);
      rock.castShadow = true;
      g.add(rock);
      this.floatRocks.push(rock);
    }

    // Cloud sprites
    for (let i = 0; i < 8; i++) {
      const cloud = this.glowSprite(0xffffff, 26 + Math.random() * 22, 0.06);
      const ang = (i / 8) * Math.PI * 2;
      cloud.position.set(Math.cos(ang) * 110, 26 + Math.random() * 22, Math.sin(ang) * 110);
      g.add(cloud);
    }

    g.visible = false;
    this.combatGroup = g;
    this.scene.add(g);
  }

  private buildPlanets() {
    const g = new THREE.Group();

    const mkPlanet = (
      color: number,
      size: number,
      radius: number,
      speed: number,
      ringColor?: number,
      emissive = 0,
    ) => {
      const grp = new THREE.Group();
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(size, 28, 20),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.7,
          metalness: 0.1,
          emissive: color,
          emissiveIntensity: emissive,
        }),
      );
      grp.add(p);
      // simple band details
      const band = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.002, 28, 20, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }),
      );
      grp.add(band);
      if (ringColor !== undefined) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(size * 1.8, size * 0.1, 8, 60),
          new THREE.MeshStandardMaterial({
            color: ringColor, emissive: ringColor, emissiveIntensity: 0.5, transparent: true, opacity: 0.8,
          }),
        );
        ring.rotation.x = Math.PI / 2.6;
        grp.add(ring);
      }
      grp.add(this.glowSprite(color, size * 5, 0.16));
      g.add(grp);
      this.planets.push({ mesh: grp, speed, radius, angle: Math.random() * Math.PI * 2 });
    };

    mkPlanet(0x3d8f7a, 2.6, 0, 0, undefined, 0.12); // home world center
    mkPlanet(0xc27444, 1.2, 8, 0.12, GOLD);
    mkPlanet(0x4a6fb8, 1.6, 13, 0.07);
    mkPlanet(0x8a4ab8, 0.9, 18, 0.05, 0x6ee7c5);
    mkPlanet(0xb84a55, 1.1, 23, 0.035);

    // nebula glows
    const neb1 = this.glowSprite(0x3d5a9e, 90, 0.1);
    neb1.position.set(-50, 18, -80);
    g.add(neb1);
    const neb2 = this.glowSprite(0x8a4ab8, 70, 0.08);
    neb2.position.set(60, -6, -70);
    g.add(neb2);

    g.visible = false;
    this.planetsGroup = g;
    this.scene.add(g);
  }

  private buildDust() {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffdcae, size: 0.07, transparent: true, opacity: 0.5, depthWrite: false,
      }),
    );
    this.scene.add(this.dust);
  }

  private buildStars() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 120 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6 + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xcfe0ff, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false,
      }),
    );
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  private applyMode(mode: Mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.titleGroup.visible = mode === 'title';
    this.combatGroup.visible = mode === 'combat';
    this.planetsGroup.visible = mode === 'planets';
    this.stars.visible = mode === 'planets';
    this.sun.visible = mode !== 'planets';
    this.dust.visible = mode !== 'planets';
    for (const f of this.fighters.values()) f.root.visible = mode === 'combat';

    const sky = SKY[mode];
    (this.skyMat.uniforms.top.value as THREE.Color).setHex(sky.top);
    (this.skyMat.uniforms.bottom.value as THREE.Color).setHex(sky.bottom);
    this.scene.fog = mode === 'planets' ? null : new THREE.FogExp2(sky.fog, mode === 'combat' ? 0.012 : 0.028);
    if (mode !== 'combat') {
      this.clearEffects();
      this.clashActive = false;
    }
  }

  // ------------------------------------------------------------------
  // Fighters
  // ------------------------------------------------------------------

  private makeLimb(color: number, upperLen: number, lowerLen: number, r: number): THREE.Group {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(r, upperLen, 4, 8), this.toon(color));
    upper.position.y = -upperLen / 2;
    upper.castShadow = true;
    g.add(upper);
    const lowerPivot = new THREE.Group();
    lowerPivot.position.y = -upperLen;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.85, lowerLen, 4, 8), this.toon(color));
    lower.position.y = -lowerLen / 2;
    lower.castShadow = true;
    lowerPivot.add(lower);
    lowerPivot.name = 'lower';
    g.add(lowerPivot);
    return g;
  }

  private makeLabel(): { sprite: THREE.Sprite; canvas: HTMLCanvasElement } {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 2;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.6, 0.73, 1);
    return { sprite, canvas };
  }

  private drawLabel(f: Fighter, c: Combatant) {
    const ctx = f.labelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 72);
    // name
    ctx.font = 'bold 22px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(c.name, 130, 24);
    ctx.fillStyle = c.isPlayer || c.isCompanion ? '#8ff5d8' : '#ffbf80';
    ctx.fillText(c.name, 128, 22);
    // hp bar
    const w = 180;
    const hp = Math.max(0, c.vitality / c.maxVitality);
    ctx.fillStyle = 'rgba(10,16,24,0.75)';
    ctx.fillRect(128 - w / 2 - 2, 34, w + 4, 14);
    ctx.fillStyle = hp > 0.5 ? '#5ee787' : hp > 0.25 ? '#f0c35e' : '#ef6b6b';
    ctx.fillRect(128 - w / 2, 36, w * hp, 10);
    // energy bar
    const fx = Math.max(0, c.flux / Math.max(1, c.maxFlux));
    ctx.fillStyle = 'rgba(10,16,24,0.75)';
    ctx.fillRect(128 - w / 2 - 2, 52, w + 4, 10);
    ctx.fillStyle = '#5ea8f0';
    ctx.fillRect(128 - w / 2, 54, w * fx, 6);
    (f.label.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  private makeFighter(c: Combatant): Fighter {
    const ally = c.isPlayer || c.isCompanion;
    const color = ally ? ALLY : ENEMY;
    const gi = ally ? 0x3f6e86 : 0x8a4f38; // gi/outfit tone
    const skin = 0xf0d2b0;

    const root = new THREE.Group();

    // Hips + legs
    const hips = new THREE.Group();
    hips.position.y = 0.96;
    root.add(hips);

    const legL = this.makeLimb(gi, 0.42, 0.42, 0.11);
    legL.position.set(0.16, 0, 0);
    hips.add(legL);
    const legR = this.makeLimb(gi, 0.42, 0.42, 0.11);
    legR.position.set(-0.16, 0, 0);
    hips.add(legR);

    // Torso
    const torso = new THREE.Group();
    torso.position.y = 0.14;
    hips.add(torso);
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 10), this.toon(gi, color, 0.12));
    chest.position.y = 0.42;
    chest.scale.set(1.15, 1, 0.85);
    chest.castShadow = true;
    torso.add(chest);
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.1, 12),
      this.toon(color, color, 0.5),
    );
    belt.position.y = 0.1;
    torso.add(belt);

    // Arms
    const armL = this.makeLimb(gi, 0.36, 0.34, 0.09);
    armL.position.set(0.34, 0.68, 0);
    torso.add(armL);
    const armR = this.makeLimb(gi, 0.36, 0.34, 0.09);
    armR.position.set(-0.34, 0.68, 0);
    torso.add(armR);

    // Head with spiky hair
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), this.toon(skin));
    head.position.y = 0.94;
    head.castShadow = true;
    torso.add(head);
    const hairMat = this.toon(ally ? 0x2e4a5e : 0x5c3626, color, 0.3);
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 6), hairMat);
      const ang = (i / 7) * Math.PI * 2;
      spike.position.set(Math.cos(ang) * 0.12, 0.16 + (i % 2) * 0.05, Math.sin(ang) * 0.12 - 0.02);
      spike.rotation.x = Math.sin(ang) * 0.5;
      spike.rotation.z = -Math.cos(ang) * 0.5;
      head.add(spike);
    }

    // Aura — layered flame cones (additive, soft)
    const auraFlames: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.5 + i * 0.2, 1.8 + i * 0.45, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08 - i * 0.02,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      flame.position.y = 1.05 + i * 0.16;
      root.add(flame);
      auraFlames.push(flame);
    }
    const auraLight = new THREE.PointLight(color, 0.0, 7);
    auraLight.position.y = 1.4;
    root.add(auraLight);

    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.85, 32),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = 0.03;
    root.add(groundRing);

    const { sprite, canvas } = this.makeLabel();
    sprite.position.y = 2.6;
    root.add(sprite);

    this.scene.add(root);
    return {
      id: c.id,
      root, hips, torso, head, armL, armR, legL, legR,
      auraFlames, auraLight, groundRing,
      label: sprite, labelCanvas: canvas,
      color,
      phase: Math.random() * Math.PI * 2,
      home: new THREE.Vector3(),
      anim: 'idle', animT: 0, animTarget: null,
      hover: 0, alive: true, output: 0.5, ascended: false,
    };
  }

  // ------------------------------------------------------------------
  // Combat sync + FX triggers
  // ------------------------------------------------------------------

  private syncCombat(combat: CombatState, clash: boolean) {
    const ids = new Set(combat.combatants.map((c) => c.id));
    for (const [id, f] of this.fighters) {
      if (!ids.has(id)) {
        this.scene.remove(f.root);
        this.fighters.delete(id);
      }
    }

    const allies = combat.combatants.filter((c) => c.isPlayer || c.isCompanion);
    const enemies = combat.combatants.filter((c) => !c.isPlayer && !c.isCompanion);
    const activeId = combat.turnOrder[combat.activeIndex];

    for (const [list, isAlly] of [
      [allies, true],
      [enemies, false],
    ] as const) {
      list.forEach((c, i) => {
        let f = this.fighters.get(c.id);
        if (!f) {
          f = this.makeFighter(c);
          this.fighters.set(c.id, f);
        }
        f.root.visible = this.mode === 'combat';
        const side = isAlly ? -1 : 1;
        const slot = i - (list.length - 1) / 2;
        f.home.set(side * 3.4, 0, slot * 2.3);
        f.root.rotation.y = isAlly ? Math.PI / 2 : -Math.PI / 2;
        f.alive = c.alive;
        f.output = c.output;
        f.ascended = c.ascended;
        // hover when output high (flight)
        f.hover = c.alive && c.output >= 0.8 ? 0.7 : 0;
        if (!c.alive && f.anim !== 'ko') {
          f.anim = 'ko';
          f.animT = 0;
          this.spawnDust(f.root.position.clone(), 8);
        }
        this.drawLabel(f, c);
        // active pulse
        (f.groundRing.material as THREE.MeshBasicMaterial).opacity = c.id === activeId && c.alive ? 0.75 : 0.25;
      });
    }

    // New log entries → FX
    const seen = this.processedLog.get(combat.id) ?? 0;
    if (combat.log.length > seen) {
      for (let i = seen; i < combat.log.length; i++) {
        this.triggerFx(combat, combat.log[i].text, combat.log[i].kind);
      }
      this.processedLog.set(combat.id, combat.log.length);
    }

    // Clash beams
    if (clash && combat.pendingClash) {
      if (!this.clashActive) {
        this.clashActive = true;
        this.spawnClash(combat.pendingClash.attackerId, combat.pendingClash.defenderId);
      }
    } else if (this.clashActive) {
      this.clashActive = false;
      this.clearEffectsOf('clash');
      this.shake = Math.max(this.shake, 0.5);
    }
  }

  private findByName(combat: CombatState, text: string): { actor?: Fighter; target?: Fighter } {
    const sorted = [...combat.combatants].sort((a, b) => b.name.length - a.name.length);
    let actor: Fighter | undefined;
    let target: Fighter | undefined;
    for (const c of sorted) {
      if (!actor && text.startsWith(c.name)) actor = this.fighters.get(c.id);
    }
    for (const c of sorted) {
      if (actor && this.fighters.get(c.id) !== actor && text.includes(` ${c.name}`)) {
        target = this.fighters.get(c.id);
        break;
      }
    }
    return { actor, target };
  }

  private triggerFx(combat: CombatState, text: string, kind: string) {
    const { actor, target } = this.findByName(combat, text);

    if (kind === 'attack' && text.includes(' hits ') && actor && target) {
      const dmgMatch = /for (\d+) damage/.exec(text);
      const dmg = dmgMatch ? parseInt(dmgMatch[1], 10) : 0;
      const melee = Math.random() < 0.45;
      if (melee) this.spawnMeleeDash(actor, target, dmg);
      else this.spawnKiBolt(actor, target, dmg);
      return;
    }
    if (kind === 'attack' && text.includes(' misses ') && actor && target) {
      this.spawnKiBolt(actor, target, 0, true);
      return;
    }
    if (kind === 'heal' && actor) {
      this.spawnHeal(target ?? actor);
      return;
    }
    if (kind === 'ascend' || text.startsWith('TRANSFORM')) {
      const f = actor ?? this.fighters.get(combat.turnOrder[combat.activeIndex]);
      if (f) this.spawnTransform(f);
      return;
    }
    if (text.includes('drives Flux wide open') && actor) {
      this.spawnPowerUp(actor);
      return;
    }
    if (text.startsWith('SCAN') && target) {
      this.spawnScan(target);
      return;
    }
    if (kind === 'defeat' && actor) {
      this.shake = Math.max(this.shake, 0.5);
      this.spawnDust(actor.root.position.clone(), 14);
    }
  }

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  private addEffect(e: Effect) {
    for (const o of e.objects) this.scene.add(o);
    this.effects.push(e);
  }

  private clearEffects() {
    for (const e of this.effects) {
      for (const o of e.objects) this.scene.remove(o);
    }
    this.effects = [];
  }

  private clearEffectsOf(kind: string) {
    this.effects = this.effects.filter((e) => {
      if (e.kind === kind) {
        for (const o of e.objects) this.scene.remove(o);
        return false;
      }
      return true;
    });
  }

  private chestOf(f: Fighter): THREE.Vector3 {
    return f.root.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  }

  private spawnKiBolt(actor: Fighter, target: Fighter, dmg: number, miss = false) {
    const from = this.chestOf(actor);
    const to = this.chestOf(target).add(
      miss ? new THREE.Vector3(0, 1.2, (Math.random() - 0.5) * 2) : new THREE.Vector3(),
    );
    const core = this.glowSprite(actor.color, 1.5, 1);
    core.position.copy(from);
    const trail: THREE.Sprite[] = [];
    for (let i = 0; i < 6; i++) {
      const t = this.glowSprite(actor.color, 0.9 - i * 0.1, 0.5 - i * 0.06);
      t.position.copy(from);
      trail.push(t);
    }
    // cast pose
    actor.anim = 'cast';
    actor.animT = 0;

    this.addEffect({
      kind: 'bolt',
      t: 0,
      life: 0.34,
      objects: [core, ...trail],
      from, to,
      onUpdate: (e, _dt, k) => {
        const p = e.from!.clone().lerp(e.to!, k);
        p.y += Math.sin(k * Math.PI) * 0.6;
        core.position.copy(p);
        trail.forEach((s, i) => {
          const kk = Math.max(0, k - (i + 1) * 0.05);
          const pp = e.from!.clone().lerp(e.to!, kk);
          pp.y += Math.sin(kk * Math.PI) * 0.6;
          s.position.copy(pp);
        });
        if (k >= 1) {
          if (!miss) {
            this.spawnImpact(e.to!, actor.color, dmg, target);
          } else {
            this.spawnDamageNumber(e.to!, 'MISS', 0xbfd4e6);
          }
        }
      },
    });
  }

  private spawnMeleeDash(actor: Fighter, target: Fighter, dmg: number) {
    actor.anim = 'lunge';
    actor.animT = 0;
    actor.animTarget = target.root.position.clone();
    // after-image sprites along the dash
    const from = this.chestOf(actor);
    const to = this.chestOf(target);
    const ghosts: THREE.Sprite[] = [];
    for (let i = 0; i < 5; i++) {
      const gsp = this.glowSprite(actor.color, 1.4, 0.28);
      gsp.position.copy(from.clone().lerp(to, i / 5));
      ghosts.push(gsp);
    }
    this.addEffect({
      kind: 'dash',
      t: 0,
      life: 0.32,
      objects: ghosts,
      onUpdate: (_e, _dt, k) => {
        ghosts.forEach((s, i) => {
          const m = s.material as THREE.SpriteMaterial;
          m.opacity = Math.max(0, 0.3 - k * 0.3 - i * 0.03);
        });
        if (k >= 1) this.spawnImpact(to, actor.color, dmg, target);
      },
    });
  }

  private spawnImpact(at: THREE.Vector3, color: number, dmg: number, target?: Fighter) {
    this.shake = Math.max(this.shake, Math.min(0.7, 0.25 + dmg * 0.012));
    this.hitStop = dmg > 18 ? 0.12 : 0.07;
    if (target) {
      target.anim = 'recoil';
      target.animT = 0;
    }

    const flash = this.glowSprite(0xffffff, 2.6, 1);
    flash.position.copy(at);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.24, 32),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    ring.position.copy(at);
    ring.lookAt(this.camera.position);
    const sparks: THREE.Sprite[] = [];
    const dirs: THREE.Vector3[] = [];
    for (let i = 0; i < 10; i++) {
      const s = this.glowSprite(color, 0.5, 0.9);
      s.position.copy(at);
      sparks.push(s);
      dirs.push(
        new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).normalize(),
      );
    }
    this.addEffect({
      kind: 'impact',
      t: 0,
      life: 0.45,
      objects: [flash, ring, ...sparks],
      onUpdate: (_e, _dt, k) => {
        (flash.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k * 2.2);
        flash.scale.setScalar(2.6 + k * 3);
        ring.scale.setScalar(1 + k * 9);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - k * 1.4);
        sparks.forEach((s, i) => {
          s.position.addScaledVector(dirs[i], 0.14 * (1 - k));
          (s.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.9 - k * 1.2);
        });
      },
    });
    if (dmg > 0) this.spawnDamageNumber(at, String(dmg), dmg > 18 ? 0xffd75e : 0xffffff);
    this.spawnDust(new THREE.Vector3(at.x, 0, at.z), 6);
  }

  private spawnDamageNumber(at: THREE.Vector3, textValue: string, color: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '900 44px "Syne", sans-serif';
    ctx.textAlign = 'center';
    const col = new THREE.Color(color);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 8;
    ctx.strokeText(textValue, 80, 54);
    ctx.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
    ctx.fillText(textValue, 80, 54);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    sprite.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, 0));
    sprite.scale.set(1.7, 0.85, 1);
    this.addEffect({
      kind: 'dmg',
      t: 0,
      life: 0.85,
      objects: [sprite],
      onUpdate: (_e, dt, k) => {
        sprite.position.y += dt * 1.4;
        (sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k * k * 1.3);
        const pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
        sprite.scale.set(1.7 * pop, 0.85 * pop, 1);
      },
    });
  }

  private spawnDust(at: THREE.Vector3, n: number) {
    const puffs: THREE.Sprite[] = [];
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.glowSprite(0xc9a87a, 0.8 + Math.random(), 0.25);
      p.position.set(at.x + (Math.random() - 0.5), 0.2, at.z + (Math.random() - 0.5));
      puffs.push(p);
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.5 + Math.random(), (Math.random() - 0.5) * 1.4));
    }
    this.addEffect({
      kind: 'dust',
      t: 0,
      life: 0.8,
      objects: puffs,
      onUpdate: (_e, dt, k) => {
        puffs.forEach((p, i) => {
          p.position.addScaledVector(vels[i], dt * (1 - k));
          (p.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.25 - k * 0.3);
          p.scale.multiplyScalar(1 + dt * 1.2);
        });
      },
    });
  }

  private spawnPowerUp(f: Fighter) {
    this.shake = Math.max(this.shake, 0.3);
    const at = f.root.position.clone();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.3, 6, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    pillar.position.set(at.x, 3, at.z);
    const rocks: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.16, 0),
        new THREE.MeshStandardMaterial({ color: 0x6b4f36, flatShading: true }),
      );
      const ang = Math.random() * Math.PI * 2;
      r.position.set(at.x + Math.cos(ang) * 1.2, 0.1, at.z + Math.sin(ang) * 1.2);
      rocks.push(r);
    }
    this.addEffect({
      kind: 'powerup',
      t: 0,
      life: 1.1,
      objects: [pillar, ...rocks],
      onUpdate: (_e, dt, k) => {
        (pillar.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.35 - k * 0.35);
        pillar.scale.x = pillar.scale.z = 1 + k * 0.6;
        pillar.rotation.y += dt * 3;
        rocks.forEach((r, i) => {
          r.position.y += dt * (1.5 + i * 0.3) * (1 - k);
          r.rotation.x += dt * 4;
          r.rotation.z += dt * 3;
        });
      },
    });
    this.spawnDust(at, 10);
  }

  private spawnTransform(f: Fighter) {
    this.shake = Math.max(this.shake, 0.6);
    this.hitStop = 0.1;
    const at = f.root.position.clone();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.1, 10, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: GOLD, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    pillar.position.set(at.x, 5, at.z);
    const flash = this.glowSprite(GOLD, 8, 0.9);
    flash.position.copy(at).add(new THREE.Vector3(0, 1.4, 0));
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.06, 8, 40),
        new THREE.MeshBasicMaterial({
          color: GOLD, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      ring.position.copy(at).add(new THREE.Vector3(0, 0.4 + i * 0.5, 0));
      ring.rotation.x = Math.PI / 2;
      rings.push(ring);
    }
    // recolor aura to gold
    for (const flame of f.auraFlames) {
      (flame.material as THREE.MeshBasicMaterial).color.setHex(GOLD);
    }
    f.auraLight.color.setHex(GOLD);
    (f.groundRing.material as THREE.MeshBasicMaterial).color.setHex(GOLD);

    this.addEffect({
      kind: 'transform',
      t: 0,
      life: 1.3,
      objects: [pillar, flash, ...rings],
      onUpdate: (_e, dt, k) => {
        (pillar.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - k * 0.55);
        pillar.rotation.y += dt * 5;
        (flash.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.9 - k * 1.1);
        rings.forEach((r, i) => {
          r.position.y += dt * (2 + i);
          r.scale.setScalar(1 + k * 2);
          (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - k);
        });
      },
    });
    this.spawnDust(at, 12);
  }

  private spawnHeal(f: Fighter) {
    const at = f.root.position.clone();
    const motes: THREE.Sprite[] = [];
    for (let i = 0; i < 8; i++) {
      const m = this.glowSprite(0x5ee787, 0.5, 0.8);
      m.position.set(at.x + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.5, at.z + (Math.random() - 0.5) * 0.8);
      motes.push(m);
    }
    this.addEffect({
      kind: 'heal',
      t: 0,
      life: 0.9,
      objects: motes,
      onUpdate: (_e, dt, k) => {
        motes.forEach((m) => {
          m.position.y += dt * 1.6;
          (m.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.8 - k);
        });
      },
    });
  }

  private spawnScan(f: Fighter) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.03, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0x5ee7c5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    ring.position.copy(f.root.position);
    ring.rotation.x = Math.PI / 2;
    this.addEffect({
      kind: 'scan',
      t: 0,
      life: 0.8,
      objects: [ring],
      onUpdate: (_e, dt, k) => {
        ring.position.y = k * 2.4;
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - k);
        void dt;
      },
    });
  }

  private spawnClash(attackerId: string, defenderId: string) {
    const a = this.fighters.get(attackerId);
    const b = this.fighters.get(defenderId);
    if (!a || !b) return;
    const from = this.chestOf(a);
    const to = this.chestOf(b);
    const mid = from.clone().lerp(to, 0.5);

    const mkBeam = (s: THREE.Vector3, e: THREE.Vector3, color: number) => {
      const len = s.distanceTo(e);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.38, len, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      beam.position.copy(s.clone().lerp(e, 0.5));
      beam.lookAt(e);
      beam.rotateX(Math.PI / 2);
      return beam;
    };

    const beamA = mkBeam(from, mid, a.color);
    const beamB = mkBeam(to, mid, b.color);
    const core = this.glowSprite(0xffffff, 4, 1);
    core.position.copy(mid);
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.08, 10, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    coreRing.position.copy(mid);

    this.addEffect({
      kind: 'clash',
      t: 0,
      life: 9999,
      objects: [beamA, beamB, core, coreRing],
      onUpdate: (e, dt, _k) => {
        const wobble = Math.sin(e.t * 22) * 0.08;
        core.scale.setScalar(4 + Math.sin(e.t * 14) * 0.7);
        coreRing.scale.setScalar(1 + Math.sin(e.t * 10) * 0.2);
        coreRing.lookAt(this.camera.position);
        beamA.scale.x = beamA.scale.z = 1 + wobble;
        beamB.scale.x = beamB.scale.z = 1 - wobble;
        this.shake = Math.max(this.shake, 0.12);
        // sparks
        if (Math.random() < dt * 18) {
          const s = this.glowSprite(Math.random() < 0.5 ? a.color : b.color, 0.6, 0.9);
          s.position.copy(mid).add(
            new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6),
          );
          this.addEffect({
            kind: 'spark',
            t: 0,
            life: 0.4,
            objects: [s],
            onUpdate: (_e2, dt2, k2) => {
              s.position.y += dt2 * 1.5;
              (s.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.9 - k2 * 1.5);
            },
          });
        }
      },
    });
  }

  // ------------------------------------------------------------------
  // Per-frame animation
  // ------------------------------------------------------------------

  private animateFighter(f: Fighter, t: number, dt: number) {
    const breathe = Math.sin(t * 2.4 + f.phase) * 0.03;
    const baseY = f.hover > 0 ? f.hover + Math.sin(t * 3 + f.phase) * 0.12 : 0;

    // aura
    const auraStrength = f.alive ? 0.03 + f.output * 0.22 + (f.ascended ? 0.2 : 0) : 0;
    f.auraFlames.forEach((flame, i) => {
      const m = flame.material as THREE.MeshBasicMaterial;
      m.opacity = auraStrength * (1 - i * 0.25) * (0.8 + Math.sin(t * (11 + i * 3) + f.phase) * 0.2);
      flame.scale.y = 1 + Math.sin(t * (9 + i * 2) + f.phase) * 0.12 + f.output * 0.4;
      flame.scale.x = flame.scale.z = 1 + f.output * 0.25 + (f.ascended ? 0.2 : 0);
      flame.rotation.y = t * (1.6 + i * 0.5);
    });
    f.auraLight.intensity = f.alive ? f.output * 1.6 + (f.ascended ? 1.2 : 0) : 0;
    f.groundRing.rotation.z = t * 1.4;
    const ringScale = 1 + f.output * 0.5 + Math.sin(t * 5 + f.phase) * 0.06;
    f.groundRing.scale.setScalar(ringScale);

    // combat stance idle
    const stanceLegSpread = 0.35;
    f.legL.rotation.x = stanceLegSpread * 0.4;
    f.legR.rotation.x = -stanceLegSpread * 0.5;
    (f.legL.getObjectByName('lower') as THREE.Group).rotation.x = -0.3;
    (f.legR.getObjectByName('lower') as THREE.Group).rotation.x = 0.5;

    if (f.anim === 'idle') {
      f.root.position.lerp(new THREE.Vector3(f.home.x, f.home.y + baseY, f.home.z), 0.12);
      f.hips.position.y = 0.96 + breathe;
      f.torso.rotation.x = 0.08 + breathe * 0.5;
      // guard arms
      f.armL.rotation.x = -0.9 + breathe;
      f.armL.rotation.z = 0.35;
      f.armR.rotation.x = -1.1 - breathe;
      f.armR.rotation.z = -0.3;
      (f.armL.getObjectByName('lower') as THREE.Group).rotation.x = -1.1;
      (f.armR.getObjectByName('lower') as THREE.Group).rotation.x = -1.3;
    } else if (f.anim === 'lunge') {
      f.animT += dt;
      const k = Math.min(1, f.animT / 0.34);
      const tgt = f.animTarget ?? f.home;
      const dir = tgt.clone().sub(f.home);
      dir.setLength(Math.max(0.001, dir.length() - 1.4));
      const lungePos = f.home.clone().add(dir.multiplyScalar(k < 0.5 ? k * 2 : (1 - k) * 2));
      lungePos.y += Math.sin(k * Math.PI) * 0.8 + baseY;
      f.root.position.copy(lungePos);
      // punch pose
      f.armR.rotation.x = -1.6 + Math.sin(k * Math.PI) * -0.8;
      f.armR.rotation.z = 0;
      (f.armR.getObjectByName('lower') as THREE.Group).rotation.x = -0.2;
      f.torso.rotation.x = 0.35;
      if (k >= 1) {
        f.anim = 'idle';
        f.animTarget = null;
      }
    } else if (f.anim === 'cast') {
      f.animT += dt;
      const k = Math.min(1, f.animT / 0.3);
      // both palms forward
      f.armL.rotation.x = -1.5;
      f.armR.rotation.x = -1.5;
      f.armL.rotation.z = 0.15;
      f.armR.rotation.z = -0.15;
      (f.armL.getObjectByName('lower') as THREE.Group).rotation.x = -0.15;
      (f.armR.getObjectByName('lower') as THREE.Group).rotation.x = -0.15;
      f.torso.rotation.x = -0.05;
      f.root.position.lerp(new THREE.Vector3(f.home.x, f.home.y + baseY, f.home.z), 0.15);
      if (k >= 1) f.anim = 'idle';
    } else if (f.anim === 'recoil') {
      f.animT += dt;
      const k = Math.min(1, f.animT / 0.28);
      const back = Math.sin(k * Math.PI) * 0.7;
      const away = f.root.rotation.y > 0 ? -1 : 1; // recoil away from center
      f.root.position.set(f.home.x + back * away * -1, f.home.y + baseY + Math.sin(k * Math.PI) * 0.2, f.home.z);
      f.torso.rotation.x = -0.4 * Math.sin(k * Math.PI);
      if (k >= 1) f.anim = 'idle';
    } else if (f.anim === 'ko') {
      f.animT += dt;
      const k = Math.min(1, f.animT / 0.6);
      f.torso.rotation.x = k * 1.4;
      f.hips.position.y = 0.96 - k * 0.55;
      f.root.position.lerp(new THREE.Vector3(f.home.x, 0, f.home.z), 0.1);
      f.label.position.y = 2.6 - k * 0.8;
    }
  }

  private updateCamera(t: number, dt: number) {
    let targetPos: THREE.Vector3;
    let targetLook: THREE.Vector3;

    if (this.mode === 'title') {
      this.orbit += dt * 0.12;
      const r = 20;
      targetPos = new THREE.Vector3(Math.cos(this.orbit) * r, 7.5 + Math.sin(t * 0.4) * 0.6, Math.sin(this.orbit) * r);
      targetLook = new THREE.Vector3(0, 3, 0);
    } else if (this.mode === 'planets') {
      this.orbit += dt * 0.05;
      const r = 26;
      targetPos = new THREE.Vector3(Math.cos(this.orbit) * r, 7 + Math.sin(t * 0.3) * 1.4, Math.sin(this.orbit) * r);
      targetLook = new THREE.Vector3(0, 0, 0);
    } else {
      // combat — behind-the-shoulder of player side
      const player = [...this.fighters.values()].find((f) => f.home.x < 0);
      const foes = [...this.fighters.values()].filter((f) => f.home.x > 0);
      const p = player?.root.position ?? new THREE.Vector3(-3.4, 0, 0);
      const e =
        foes.length > 0
          ? foes.reduce((acc, f) => acc.add(f.root.position), new THREE.Vector3()).multiplyScalar(1 / foes.length)
          : new THREE.Vector3(3.4, 0, 0);

      const mid = p.clone().lerp(e, 0.5);
      const span = Math.max(4, p.distanceTo(e));

      if (this.clashActive) {
        // side-on cinematic; beams framed right of the clash panel
        const r = span * 0.8 + 5.5;
        targetPos = new THREE.Vector3(mid.x + 1.2, mid.y + 2.6, mid.z + r);
        targetLook = mid.clone().add(new THREE.Vector3(-3.4, 1.4, 0));
      } else {
        // cinematic side arc — both fighters always in frame,
        // slow drift, action pushed right of screen (HUD sits left)
        const r = Math.max(12, span * 1.4);
        const ang = Math.PI / 2 + Math.sin(t * 0.16) * 0.3;
        targetPos = new THREE.Vector3(
          mid.x + Math.cos(ang) * r,
          4.4 + Math.sin(t * 0.3) * 0.5,
          mid.z + Math.sin(ang) * r,
        );
        // look left in world-x so subjects sit right of center (clear of HUD)
        targetLook = mid.clone().add(new THREE.Vector3(-5.0, 1.5, 0));
      }
    }

    this.camPos.lerp(targetPos, this.mode === 'combat' ? 0.06 : 0.03);
    this.camLook.lerp(targetLook, 0.08);

    // shake
    let sx = 0;
    let sy = 0;
    if (this.shake > 0.01) {
      sx = (Math.random() - 0.5) * this.shake * 0.5;
      sy = (Math.random() - 0.5) * this.shake * 0.5;
      this.shake *= Math.pow(0.02, dt); // fast decay
    }
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  private onResize = () => {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    // hit-stop slows the world briefly
    let dt = rawDt;
    if (this.hitStop > 0) {
      this.hitStop -= rawDt;
      dt = rawDt * 0.12;
    }

    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.life);
      e.onUpdate(e, dt, k);
      if (e.t >= e.life) {
        for (const o of e.objects) this.scene.remove(o);
        this.effects.splice(i, 1);
      }
    }

    // fighters
    if (this.mode === 'combat') {
      for (const f of this.fighters.values()) this.animateFighter(f, t, dt);
      for (const rock of this.floatRocks) {
        rock.position.y += Math.sin(t * 0.8 + rock.position.x) * 0.0035;
        rock.rotation.y += dt * 0.3;
      }
    }

    // title props
    if (this.mode === 'title') {
      const shard = this.titleGroup.getObjectByName('shard');
      if (shard) {
        shard.rotation.y = t * 0.6;
        shard.position.y = 4 + Math.sin(t * 2) * 0.25;
      }
      const ring = this.titleGroup.getObjectByName('ring');
      if (ring) ring.rotation.z = t * 0.1;
    }

    // planets
    if (this.mode === 'planets') {
      for (const p of this.planets) {
        p.angle += dt * p.speed;
        if (p.radius > 0) {
          p.mesh.position.set(Math.cos(p.angle) * p.radius, Math.sin(p.angle * 1.7) * 1.2, Math.sin(p.angle) * p.radius);
        }
        p.mesh.rotation.y += dt * 0.25;
      }
      this.stars.rotation.y = t * 0.005;
    }

    if (this.dust.visible) this.dust.rotation.y = t * 0.015;

    this.updateCamera(t, rawDt);
    this.renderer.render(this.scene, this.camera);
  };
}
