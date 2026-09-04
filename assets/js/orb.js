/* Orb renderers: one big reactive core, plus the small telemetry gauges. */
(function (J) {
  'use strict';

  var PALETTE = {
    standby:  { hue: 194, glow: 0.55 },
    listening:{ hue: 168, glow: 1.00 },
    thinking: { hue: 38,  glow: 0.85 },
    speaking: { hue: 200, glow: 1.00 },
    alert:    { hue: 352, glow: 1.00 }
  };

  function hsl(hue, s, l, a) {
    return 'hsla(' + hue + ',' + s + '%,' + l + '%,' + a + ')';
  }

  /* ---------------- core orb ---------------- */

  function CoreOrb(canvas) {
    this.canvas = canvas;
    this.state = 'standby';
    this.hue = PALETTE.standby.hue;
    this.glow = PALETTE.standby.glow;
    this.energy = 0;
    this.spin = 0;
    this.particles = [];
    for (var i = 0; i < 56; i++) {
      this.particles.push({
        a: Math.random() * Math.PI * 2,
        r: 0.55 + Math.random() * 0.7,
        v: (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.22),
        s: 0.6 + Math.random() * 1.6
      });
    }
  }

  CoreOrb.prototype.setState = function (state) {
    if (!PALETTE[state]) return;
    this.state = state;
  };

  CoreOrb.prototype.draw = function (t, dt) {
    var fit = J.fitCanvas(this.canvas);
    var ctx = fit.ctx;
    var cx = fit.w / 2;
    var cy = fit.h / 2;
    /* 0.27 keeps the outer tick ring (1.62R) and its glow inside the box. */
    var R = Math.min(fit.w, fit.h) * 0.27;

    var target = PALETTE[this.state];
    this.hue = J.lerp(this.hue, target.hue, 0.06);
    this.glow = J.lerp(this.glow, target.glow, 0.08);

    var drive = this.state === 'standby' ? J.mic.level * 0.55 : J.mic.level;
    if (this.state === 'thinking') drive = 0.32 + 0.18 * Math.sin(t * 6);
    if (this.state === 'speaking') drive = Math.max(drive, 0.34 + 0.26 * Math.abs(Math.sin(t * 7.5)));
    this.energy = J.lerp(this.energy, J.clamp(drive, 0, 1), 0.18);
    this.spin += dt * (0.22 + this.energy * 1.5);

    var e = this.energy;
    var hue = this.hue;

    ctx.clearRect(0, 0, fit.w, fit.h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    /* halo */
    var halo = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * (2.0 + e * 0.5));
    halo.addColorStop(0, hsl(hue, 100, 62, 0.30 * this.glow));
    halo.addColorStop(0.4, hsl(hue, 100, 52, 0.12 * this.glow));
    halo.addColorStop(1, hsl(hue, 100, 50, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.3, 0, Math.PI * 2);
    ctx.fill();

    /* outer tick ring */
    ctx.save();
    ctx.rotate(-this.spin * 0.35);
    ctx.strokeStyle = hsl(hue, 90, 66, 0.5);
    ctx.lineWidth = 1;
    for (var i = 0; i < 72; i++) {
      var big = i % 6 === 0;
      var len = big ? 12 : 5;
      var a = (i / 72) * Math.PI * 2;
      ctx.globalAlpha = big ? 0.75 : 0.32;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 1.62, Math.sin(a) * R * 1.62);
      ctx.lineTo(Math.cos(a) * (R * 1.62 + len), Math.sin(a) * (R * 1.62 + len));
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    /* broken arcs, counter-rotating */
    var arcs = [
      { r: 1.42, from: 0.10, to: 1.05, w: 2.0, dir: 1, a: 0.85 },
      { r: 1.42, from: 3.35, to: 4.20, w: 2.0, dir: 1, a: 0.85 },
      { r: 1.26, from: 1.60, to: 3.10, w: 1.2, dir: -1, a: 0.5 },
      { r: 1.26, from: 4.60, to: 5.60, w: 1.2, dir: -1, a: 0.5 }
    ];
    for (var k = 0; k < arcs.length; k++) {
      var arc = arcs[k];
      ctx.save();
      ctx.rotate(this.spin * arc.dir * 0.8);
      ctx.strokeStyle = hsl(hue, 95, 68, arc.a);
      ctx.lineWidth = arc.w;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 16 * this.glow;
      ctx.shadowColor = hsl(hue, 100, 60, 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, R * arc.r, arc.from, arc.to);
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    /* spectrum ring — the part that actually listens */
    var bins = J.mic.bins;
    var n = bins.length * 2;
    ctx.save();
    ctx.rotate(this.spin * 0.15);
    ctx.lineWidth = Math.max(2, R * 0.045);
    ctx.lineCap = 'round';
    for (var b = 0; b < n; b++) {
      var idx = b < bins.length ? b : n - 1 - b;
      var mag = bins[idx] * (0.4 + e * 1.5);
      var ang = (b / n) * Math.PI * 2 - Math.PI / 2;
      var r0 = R * 1.02;
      var r1 = r0 + R * (0.06 + mag * 0.42);
      ctx.strokeStyle = hsl(hue + mag * 30, 95, 55 + mag * 25, 0.35 + mag * 0.6);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
      ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.restore();

    /* orbiting particles */
    for (var p = 0; p < this.particles.length; p++) {
      var pt = this.particles[p];
      pt.a += pt.v * dt * (0.5 + e * 2.2);
      var pr = R * pt.r * (1 + e * 0.14);
      var px = Math.cos(pt.a) * pr;
      var py = Math.sin(pt.a) * pr * 0.42;
      ctx.fillStyle = hsl(hue, 100, 78, 0.30 + e * 0.5);
      ctx.beginPath();
      ctx.arc(px, py, pt.s * (0.7 + e * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }

    /* core body */
    var pulse = 1 + e * 0.16 + Math.sin(t * 2.1) * 0.015;
    var body = ctx.createRadialGradient(0, 0, 0, 0, 0, R * pulse);
    body.addColorStop(0, hsl(hue, 100, 96, 0.95));
    body.addColorStop(0.32, hsl(hue, 100, 72, 0.55 + e * 0.3));
    body.addColorStop(0.72, hsl(hue, 100, 52, 0.20 + e * 0.2));
    body.addColorStop(1, hsl(hue, 100, 45, 0));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, R * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* waveform slicing through the middle */
    ctx.strokeStyle = hsl(hue, 100, 88, 0.5 + e * 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    var span = R * 0.78;
    for (var x = -span; x <= span; x += 3) {
      var f = x / span;
      var env = Math.cos(f * Math.PI / 2);
      var wave = Math.sin(f * 9 + t * 5) * env * R * 0.22 * (0.12 + e);
      if (x === -span) ctx.moveTo(x, wave); else ctx.lineTo(x, wave);
    }
    ctx.stroke();

    /* rim */
    ctx.strokeStyle = hsl(hue, 100, 82, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, R * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  /* ---------------- small gauge orb ---------------- */

  function GaugeOrb(canvas, opts) {
    this.canvas = canvas;
    this.hue = opts.hue == null ? 194 : opts.hue;
    /* 'high' = big numbers are bad (load, heat); 'low' = small ones are
       (battery). Anything else keeps a fixed hue so the color never lies. */
    this.warn = opts.warn || null;
    this.value = 0;
    this.shown = 0;
    this.phase = Math.random() * Math.PI * 2;
  }

  GaugeOrb.prototype.set = function (v) { this.value = J.clamp(v, 0, 1); };

  GaugeOrb.prototype.draw = function (t) {
    var fit = J.fitCanvas(this.canvas);
    var ctx = fit.ctx;
    var cx = fit.w / 2;
    var cy = fit.h / 2;
    var R = Math.min(fit.w, fit.h) * 0.40;

    this.shown = J.lerp(this.shown, this.value, 0.10);
    var v = this.shown;

    /* Only ramp toward red inside the top band of a reading that can go bad. */
    var risk = this.warn === 'high' ? v : this.warn === 'low' ? 1 - v : 0;
    risk = J.clamp((risk - 0.6) / 0.35, 0, 1);
    var hue = J.lerp(this.hue, 6, risk);

    ctx.clearRect(0, 0, fit.w, fit.h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    var glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.7);
    glow.addColorStop(0, hsl(hue, 100, 60, 0.22 + v * 0.28));
    glow.addColorStop(1, hsl(hue, 100, 50, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.7, 0, Math.PI * 2);
    ctx.fill();

    /* track */
    ctx.strokeStyle = hsl(hue, 60, 60, 0.16);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    /* value arc */
    var start = -Math.PI / 2;
    ctx.strokeStyle = hsl(hue, 100, 66, 0.95);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 12;
    ctx.shadowColor = hsl(hue, 100, 60, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, R, start, start + Math.PI * 2 * Math.max(v, 0.002));
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* inner breathing disc */
    var breathe = 0.42 + Math.sin(t * 1.6 + this.phase) * 0.02 + v * 0.16;
    var disc = ctx.createRadialGradient(0, 0, 0, 0, 0, R * breathe);
    disc.addColorStop(0, hsl(hue, 100, 88, 0.42 + v * 0.35));
    disc.addColorStop(1, hsl(hue, 100, 55, 0));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R * breathe, 0, Math.PI * 2);
    ctx.fill();

    /* orbit marker */
    var ma = start + Math.PI * 2 * v;
    ctx.fillStyle = hsl(hue, 100, 90, 0.95);
    ctx.beginPath();
    ctx.arc(Math.cos(ma) * R, Math.sin(ma) * R, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  J.CoreOrb = CoreOrb;
  J.GaugeOrb = GaugeOrb;
})(window.J);
