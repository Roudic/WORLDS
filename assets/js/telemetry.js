/* Telemetry feeds. Real browser signals where the platform exposes them,
   clearly-flagged simulated drift where it does not. */
(function (J) {
  'use strict';

  var battery = null;
  if (navigator.getBattery) {
    navigator.getBattery().then(function (b) { battery = b; }).catch(function () {});
  }

  function drift(seed, speed, lo, hi) {
    return function (t) {
      var n = 0.5
        + 0.30 * Math.sin(t * speed + seed)
        + 0.14 * Math.sin(t * speed * 2.7 + seed * 1.9)
        + 0.06 * Math.sin(t * speed * 6.1 + seed * 0.4);
      return lo + J.clamp(n, 0, 1) * (hi - lo);
    };
  }

  var loadDrift = drift(1.3, 0.21, 0.14, 0.78);
  var thermalDrift = drift(4.1, 0.13, 0.28, 0.66);
  var memDrift = drift(2.7, 0.09, 0.35, 0.72);

  var feeds = [
    {
      id: 'core',
      label: 'Core',
      hue: 194,
      real: true,
      read: function () {
        var f = J.fps();
        return { v: J.clamp(f / 60, 0, 1), text: Math.round(f), unit: 'fps' };
      }
    },
    {
      id: 'load',
      warn: 'high',
      label: 'Load',
      hue: 168,
      real: false,
      read: function (t) {
        var v = loadDrift(t);
        return { v: v, text: Math.round(v * 100), unit: '%' };
      }
    },
    {
      id: 'memory',
      warn: 'high',
      label: 'Memory',
      hue: 210,
      real: !!(performance && performance.memory),
      read: function (t) {
        if (performance && performance.memory && performance.memory.jsHeapSizeLimit) {
          var m = performance.memory;
          var v = m.usedJSHeapSize / m.jsHeapSizeLimit;
          return { v: J.clamp(v, 0, 1), text: (m.usedJSHeapSize / 1048576).toFixed(0), unit: 'mb' };
        }
        var d = memDrift(t);
        return { v: d, text: Math.round(d * 100), unit: '%' };
      }
    },
    {
      id: 'network',
      label: 'Uplink',
      hue: 186,
      real: !!(navigator.connection && navigator.connection.downlink != null),
      read: function (t) {
        var c = navigator.connection;
        if (c && c.downlink != null) {
          return { v: J.clamp(c.downlink / 10, 0.04, 1), text: c.downlink.toFixed(1), unit: 'mbps' };
        }
        if (!navigator.onLine) return { v: 0, text: 'off', unit: 'line' };
        var d = drift(5.5, 0.3, 0.4, 0.95)(t);
        return { v: d, text: (d * 10).toFixed(1), unit: 'mbps' };
      }
    },
    {
      id: 'power',
      warn: 'low',
      label: 'Power',
      hue: 150,
      real: !!navigator.getBattery,
      read: function (t) {
        if (battery && battery.level != null) {
          return { v: battery.level, text: Math.round(battery.level * 100), unit: battery.charging ? '\u26a1' : '%' };
        }
        return { v: 1, text: 'ext', unit: 'pwr' };
      }
    },
    {
      id: 'audio',
      label: 'Audio',
      hue: 40,
      real: true,
      read: function () {
        var v = J.mic.level;
        return { v: v, text: Math.round(v * 100), unit: J.mic.enabled() ? 'live' : 'idle' };
      }
    },
    {
      id: 'thermal',
      warn: 'high',
      label: 'Thermal',
      hue: 52,
      real: false,
      read: function (t) {
        var v = thermalDrift(t);
        return { v: v, text: Math.round(28 + v * 44), unit: '°c' };
      }
    },
    {
      id: 'shield',
      label: 'Shield',
      hue: 280,
      real: false,
      read: function (t) {
        var v = 0.82 + 0.16 * Math.sin(t * 0.4);
        return { v: v, text: Math.round(v * 100), unit: '%' };
      }
    }
  ];

  /* Builds the orb grid and keeps every gauge fed from the single rAF loop. */
  J.mountTelemetry = function (root) {
    var widgets = feeds.map(function (feed) {
      var cell = document.createElement('div');
      cell.className = 'orb';
      cell.title = feed.label + (feed.real ? ' — live browser signal' : ' — simulated feed');

      var canvas = document.createElement('canvas');
      var value = document.createElement('div');
      value.className = 'orb-value';
      var label = document.createElement('div');
      label.className = 'orb-label';
      label.textContent = feed.real ? feed.label : feed.label + ' · sim';

      cell.appendChild(canvas);
      cell.appendChild(value);
      cell.appendChild(label);
      root.appendChild(cell);

      return {
        feed: feed,
        orb: new J.GaugeOrb(canvas, { hue: feed.hue, warn: feed.warn }),
        value: value,
        last: { v: 0, text: '0', unit: '' }
      };
    });

    var acc = 0;
    J.onFrame(function (t, dt) {
      acc += dt;
      var refresh = acc >= 0.25;
      if (refresh) acc = 0;

      widgets.forEach(function (w) {
        if (refresh) {
          var r = w.feed.read(t);
          w.last = r;
          w.orb.set(r.v);
          w.value.innerHTML = r.text + ' <small>' + r.unit + '</small>';
        }
        w.orb.draw(t);
      });
    });

    /* Snapshot for the command layer ("status", "report"). */
    J.readTelemetry = function () {
      return widgets.map(function (w) {
        return {
          label: w.feed.label,
          real: w.feed.real,
          warn: w.feed.warn || null,
          text: w.last.text,
          unit: w.last.unit,
          v: w.last.v
        };
      });
    };
  };
})(window.J);
