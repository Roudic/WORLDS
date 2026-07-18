import * as THREE from 'three';
import type { CombatState } from '../engine/combat';
import type { Combatant } from '../engine/types';
import type { AppState } from '../state/game';

type FighterMesh = {
  id: string;
  root: THREE.Group;
  body: THREE.Mesh;
  aura: THREE.Mesh;
  ring: THREE.Mesh;
  labelOffset: number;
};

export class ArenaScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private fighters = new Map<string, FighterMesh>();
  private beams: THREE.Mesh[] = [];
  private particles: THREE.Points | null = null;
  private host: HTMLElement;
  private raf = 0;
  private mode: 'title' | 'combat' | 'ambient' = 'title';
  private orbit = 0;
  private flash = 0;
  private lastCombatKey = '';
  private cityGroup: THREE.Group | null = null;
  private arenaGroup: THREE.Group | null = null;
  private disposed = false;

  constructor(host: HTMLElement) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a1018, 0.045);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 8, 14);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a1018, 1);
    this.renderer.shadowMap.enabled = true;
    host.appendChild(this.renderer.domElement);

    this.buildLights();
    this.buildTitleCity();
    this.buildArena();
    this.buildParticles();

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
    if (state.screen === 'title' || state.screen === 'gallery') {
      this.setMode('title');
    } else if (state.screen === 'combat' || state.screen === 'clash') {
      this.setMode('combat');
      if (state.combat) this.syncCombat(state.combat, state.screen === 'clash');
    } else {
      this.setMode('ambient');
    }
  }

  private setMode(mode: 'title' | 'combat' | 'ambient') {
    if (this.mode === mode) return;
    this.mode = mode;
    if (this.cityGroup) this.cityGroup.visible = mode === 'title' || mode === 'ambient';
    if (this.arenaGroup) this.arenaGroup.visible = mode === 'combat';
    for (const f of this.fighters.values()) {
      f.root.visible = mode === 'combat';
    }
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x1a1208, 0.85);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe0b0, 1.1);
    key.position.set(6, 12, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x6ee7c5, 0.55);
    fill.position.set(-8, 4, -6);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0xf0a35e, 1.2, 40);
    rim.position.set(0, 3, 0);
    this.scene.add(rim);
  }

  private buildTitleCity() {
    const g = new THREE.Group();
    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.MeshStandardMaterial({ color: 0x121c2a, roughness: 0.92, metalness: 0.1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);

    // Procedural skyline blocks
    const palette = [0x1a2a3d, 0x243448, 0x2a3d52, 0x33485c];
    for (let i = 0; i < 42; i++) {
      const h = 2 + Math.random() * 10;
      const w = 0.8 + Math.random() * 1.8;
      const d = 0.8 + Math.random() * 1.8;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: palette[i % palette.length],
          roughness: 0.7,
          metalness: 0.35,
          emissive: i % 5 === 0 ? 0x6ee7c5 : i % 7 === 0 ? 0xf0a35e : 0x000000,
          emissiveIntensity: i % 5 === 0 || i % 7 === 0 ? 0.35 : 0,
        }),
      );
      const ang = (i / 42) * Math.PI * 2 + Math.random() * 0.2;
      const rad = 10 + Math.random() * 16;
      mesh.position.set(Math.cos(ang) * rad, h / 2, Math.sin(ang) * rad);
      mesh.castShadow = true;
      g.add(mesh);
    }

    // Floating railway ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(14, 0.12, 8, 80),
      new THREE.MeshStandardMaterial({
        color: 0x6ee7c5,
        emissive: 0x6ee7c5,
        emissiveIntensity: 0.6,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    ring.rotation.x = Math.PI / 2.4;
    ring.position.y = 5;
    g.add(ring);

    // Central rift shard
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf0a35e,
        emissive: 0xf0a35e,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.85,
        metalness: 0.6,
        roughness: 0.15,
      }),
    );
    shard.position.y = 3.2;
    g.add(shard);

    this.cityGroup = g;
    this.scene.add(g);
  }

  private buildArena() {
    const g = new THREE.Group();
    g.visible = false;

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 0.35, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1a2433,
        roughness: 0.55,
        metalness: 0.45,
      }),
    );
    floor.receiveShadow = true;
    g.add(floor);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(9.1, 0.18, 10, 64),
      new THREE.MeshStandardMaterial({
        color: 0x6ee7c5,
        emissive: 0x6ee7c5,
        emissiveIntensity: 0.45,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.25;
    g.add(rim);

    // Arena pillars
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 4.5, 0.45),
        new THREE.MeshStandardMaterial({
          color: 0x2a3a4e,
          emissive: i % 2 === 0 ? 0x6ee7c5 : 0xf0a35e,
          emissiveIntensity: 0.2,
          metalness: 0.5,
          roughness: 0.4,
        }),
      );
      pillar.position.set(Math.cos(ang) * 8.2, 2.25, Math.sin(ang) * 8.2);
      pillar.castShadow = true;
      g.add(pillar);
    }

    // Center plate
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 32),
      new THREE.MeshStandardMaterial({
        color: 0x243044,
        emissive: 0x102018,
        emissiveIntensity: 0.4,
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.19;
    g.add(plate);

    this.arenaGroup = g;
    this.scene.add(g);
  }

  private buildParticles() {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x6ee7c5,
      size: 0.06,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  private makeFighter(c: Combatant, index: number, total: number): FighterMesh {
    const root = new THREE.Group();
    const ally = c.isPlayer || c.isCompanion;
    const bodyColor = ally ? 0x6ee7c5 : 0xf0a35e;
    const torsoColor = ally ? 0x3d5a6c : 0x5a3d3d;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 10),
      new THREE.MeshStandardMaterial({
        color: torsoColor,
        roughness: 0.45,
        metalness: 0.35,
        emissive: bodyColor,
        emissiveIntensity: 0.15,
      }),
    );
    body.position.y = 1.1;
    body.castShadow = true;
    root.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8d5c4, roughness: 0.55 }),
    );
    head.position.y = 1.95;
    head.castShadow = true;
    root.add(head);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 24),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        emissive: bodyColor,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    aura.position.y = 1.2;
    root.add(aura);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.04, 8, 32),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        emissive: bodyColor,
        emissiveIntensity: 0.9,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    root.add(ring);

    // Position on arena: allies left, enemies right
    const side = ally ? -1 : 1;
    const slot = index - (total - 1) / 2;
    root.position.set(side * 3.2, 0, slot * 1.8);
    root.lookAt(0, 1.2, root.position.z * 0.2);

    this.scene.add(root);
    return { id: c.id, root, body, aura, ring, labelOffset: 2.4 };
  }

  private syncCombat(combat: CombatState, clash: boolean) {
    const key = `${combat.id}:${combat.round}:${combat.activeIndex}:${combat.log.length}:${clash}`;
    const alive = combat.combatants.filter((c) => c.alive || true);

    // Rebuild fighter set if roster changed
    const ids = new Set(combat.combatants.map((c) => c.id));
    for (const [id, f] of this.fighters) {
      if (!ids.has(id)) {
        this.scene.remove(f.root);
        this.fighters.delete(id);
      }
    }

    const allies = combat.combatants.filter((c) => c.isPlayer || c.isCompanion);
    const enemies = combat.combatants.filter((c) => !c.isPlayer && !c.isCompanion);

    for (const [list, allySide] of [
      [allies, true],
      [enemies, false],
    ] as const) {
      list.forEach((c, i) => {
        let f = this.fighters.get(c.id);
        if (!f) {
          f = this.makeFighter(c, i, list.length);
          this.fighters.set(c.id, f);
        }
        f.root.visible = true;
        const side = allySide ? -1 : 1;
        const slot = i - (list.length - 1) / 2;
        const targetPos = new THREE.Vector3(side * 3.2, c.alive ? 0 : -0.6, slot * 1.8);
        f.root.position.lerp(targetPos, 0.35);
        f.root.visible = true;

        const mat = f.body.material as THREE.MeshStandardMaterial;
        const auraMat = f.aura.material as THREE.MeshStandardMaterial;
        const power = c.output;
        const ascended = c.ascended;
        mat.emissiveIntensity = 0.12 + power * 0.55 + (ascended ? 0.35 : 0);
        auraMat.opacity = 0.08 + power * 0.35 + (ascended ? 0.25 : 0);
        const scale = 1 + power * 0.35 + (ascended ? 0.25 : 0);
        f.aura.scale.setScalar(scale);
        f.ring.scale.setScalar(0.9 + power * 0.5);
        f.root.scale.setScalar(c.alive ? (ascended ? 1.12 : 1) : 0.85);
        if (!c.alive) {
          auraMat.opacity = 0.02;
          mat.emissiveIntensity = 0.02;
        }

        // Active turn highlight bounce
        const activeId = combat.turnOrder[combat.activeIndex];
        if (c.id === activeId && c.alive) {
          f.root.position.y = 0.15 + Math.sin(this.clock.elapsedTime * 6) * 0.05;
        }
      });
    }

    if (clash) {
      this.flash = 1;
      this.spawnClashBeams(combat);
    } else if (key !== this.lastCombatKey) {
      const last = combat.log[combat.log.length - 1];
      if (last && (last.kind === 'attack' || last.kind === 'ascend')) {
        this.flash = 0.7;
        this.spawnAttackBurst(combat);
      }
    }
    this.lastCombatKey = key;

    // Keep unused var quiet
    void alive;
  }

  private clearBeams() {
    for (const b of this.beams) {
      this.scene.remove(b);
      b.geometry.dispose();
      (b.material as THREE.Material).dispose();
    }
    this.beams = [];
  }

  private spawnClashBeams(combat: CombatState) {
    this.clearBeams();
    const clash = combat.pendingClash;
    if (!clash) return;
    const a = this.fighters.get(clash.attackerId);
    const b = this.fighters.get(clash.defenderId);
    if (!a || !b) return;
    const start = a.root.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    const end = b.root.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    const mid = start.clone().lerp(end, 0.5);
    const len = start.distanceTo(end);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, len, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x6ee7c5,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.9,
      }),
    );
    beam.position.copy(mid);
    beam.lookAt(end);
    beam.rotateX(Math.PI / 2);
    this.scene.add(beam);
    this.beams.push(beam);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf0a35e,
        emissive: 0xf0a35e,
        emissiveIntensity: 2.2,
      }),
    );
    core.position.copy(mid);
    this.scene.add(core);
    this.beams.push(core);
  }

  private spawnAttackBurst(combat: CombatState) {
    const activeId = combat.turnOrder[combat.activeIndex];
    // burst near last attacker approx: active or previous
    const f =
      this.fighters.get(activeId) ??
      [...this.fighters.values()][0];
    if (!f) return;
    const burst = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x6ee7c5,
        emissive: 0x6ee7c5,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.8,
      }),
    );
    burst.position.copy(f.root.position).add(new THREE.Vector3(0, 1.4, 0));
    this.scene.add(burst);
    this.beams.push(burst);
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
    const t = this.clock.getElapsedTime();
    this.orbit += 0.0035;

    if (this.mode === 'title' || this.mode === 'ambient') {
      const r = 18;
      this.camera.position.set(Math.cos(this.orbit) * r, 7 + Math.sin(t * 0.4) * 0.6, Math.sin(this.orbit) * r);
      this.camera.lookAt(0, 2.5, 0);
      if (this.cityGroup) {
        const shard = this.cityGroup.children.find(
          (c) => (c as THREE.Mesh).geometry instanceof THREE.OctahedronGeometry,
        );
        if (shard) {
          shard.rotation.y = t * 0.6;
          shard.position.y = 3.2 + Math.sin(t * 2) * 0.2;
        }
      }
    } else {
      // Combat camera — slight orbit around arena
      const r = 12.5;
      const ang = Math.sin(t * 0.25) * 0.35;
      this.camera.position.set(Math.sin(ang) * r, 7.5, Math.cos(ang) * r);
      this.camera.lookAt(0, 1.2, 0);
      if (this.flash > 0) {
        this.flash *= 0.92;
        this.renderer.setClearColor(
          new THREE.Color(0x0a1018).lerp(new THREE.Color(0x6ee7c5), this.flash * 0.25),
          1,
        );
        for (const b of this.beams) {
          b.scale.multiplyScalar(1.02);
          const mat = b.material as THREE.MeshStandardMaterial;
          if (mat.opacity !== undefined) mat.opacity *= 0.96;
        }
        if (this.flash < 0.05) {
          this.flash = 0;
          this.clearBeams();
          this.renderer.setClearColor(0x0a1018, 1);
        }
      }
      for (const f of this.fighters.values()) {
        f.aura.rotation.y = t * 1.5;
        f.ring.rotation.z = t * 2.2;
      }
    }

    if (this.particles) {
      this.particles.rotation.y = t * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
