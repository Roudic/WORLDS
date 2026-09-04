/* Shared helpers + the tiny event bus every module talks over. */
window.J = window.J || {};

(function (J) {
  'use strict';

  var listeners = {};

  J.bus = {
    on: function (name, fn) {
      (listeners[name] = listeners[name] || []).push(fn);
      return function () { J.bus.off(name, fn); };
    },
    off: function (name, fn) {
      var list = listeners[name];
      if (!list) return;
      var i = list.indexOf(fn);
      if (i > -1) list.splice(i, 1);
    },
    emit: function (name, payload) {
      (listeners[name] || []).slice().forEach(function (fn) {
        try { fn(payload); } catch (err) { console.error('[bus:' + name + ']', err); }
      });
    }
  };

  J.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  J.lerp = function (a, b, t) { return a + (b - a) * t; };
  J.rand = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  J.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  J.pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  J.clock = function (date) {
    var d = date || new Date();
    return J.pad(d.getHours()) + ':' + J.pad(d.getMinutes()) + ':' + J.pad(d.getSeconds());
  };

  /* Canvas sized to its CSS box at device resolution; returns the CSS-pixel box. */
  J.fitCanvas = function (canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  };

  /* One rAF loop for the whole HUD — cheaper than a timer per widget. */
  var frameFns = [];
  var fps = 60;
  var lastFrame = performance.now();

  J.onFrame = function (fn) { frameFns.push(fn); };
  J.fps = function () { return fps; };

  function tick(now) {
    var dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    fps = J.lerp(fps, 1 / Math.max(dt, 0.0001), 0.06);
    for (var i = 0; i < frameFns.length; i++) {
      try { frameFns[i](now / 1000, dt); } catch (err) { console.error('[frame]', err); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})(window.J);
