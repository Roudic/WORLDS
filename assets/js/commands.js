/* Intent router. Each entry: a matcher and a handler returning a reply string
   (or a promise for one). First match wins, so order matters. */
(function (J) {
  'use strict';

  var HONORIFIC = 'sir';

  function tidy(s) {
    return s.toLowerCase().replace(/[?!.,]+$/g, '').replace(/\s+/g, ' ').trim();
  }

  /* Tiny recursive-descent arithmetic parser — no eval, no injection surface. */
  function calc(expr) {
    var src = expr.replace(/[^0-9+\-*/(). %^]/g, '');
    var i = 0;

    function ws() { while (src[i] === ' ') i++; }
    function number() {
      ws();
      if (src[i] === '(') {
        i++;
        var v = add();
        ws();
        if (src[i] === ')') i++;
        return v;
      }
      if (src[i] === '-') { i++; return -number(); }
      var start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i++;
      if (start === i) throw new Error('bad expression');
      return parseFloat(src.slice(start, i));
    }
    function power() {
      var base = number();
      ws();
      while (src[i] === '^') { i++; base = Math.pow(base, power()); ws(); }
      return base;
    }
    function mul() {
      var v = power();
      ws();
      while (src[i] === '*' || src[i] === '/' || src[i] === '%') {
        var op = src[i++];
        var r = power();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
        ws();
      }
      return v;
    }
    function add() {
      var v = mul();
      ws();
      while (src[i] === '+' || src[i] === '-') {
        var op = src[i++];
        var r = mul();
        v = op === '+' ? v + r : v - r;
        ws();
      }
      return v;
    }
    var out = add();
    ws();
    if (i < src.length || !isFinite(out)) throw new Error('bad expression');
    return out;
  }

  function statusReport() {
    var feeds = J.readTelemetry ? J.readTelemetry() : [];
    if (!feeds.length) return 'Telemetry is still spinning up, ' + HONORIFIC + '.';
    var parts = feeds.map(function (f) { return f.label + ' ' + f.text + ' ' + f.unit; });
    /* Only feeds that declare a bad direction can be "hot" — a pegged
       frame rate or a full battery is good news, not an alarm. */
    var hot = feeds.filter(function (f) {
      return (f.warn === 'high' && f.v > 0.85) || (f.warn === 'low' && f.v < 0.15);
    });
    var head = hot.length
      ? 'Running hot on ' + hot.map(function (f) { return f.label.toLowerCase(); }).join(' and ') + '.'
      : 'All systems nominal, ' + HONORIFIC + '.';
    return head + ' ' + parts.join(' · ') + '.';
  }

  var QUIPS = [
    'As you wish, ' + HONORIFIC + '.',
    'Working on it.',
    'Consider it handled.',
    'On it, ' + HONORIFIC + '.'
  ];

  var routes = [
    {
      name: 'greet',
      test: /^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/,
      run: function () {
        var h = new Date().getHours();
        var part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
        return 'Good ' + part + ', ' + HONORIFIC + '. All systems are online and awaiting instruction.';
      }
    },
    {
      name: 'identity',
      test: /\b(who are you|what are you|your name)\b/,
      run: function () {
        return 'J.A.R.V.I.S. — Just A Rather Very Intelligent System. I run this dashboard, read the telemetry, and answer when spoken to.';
      }
    },
    {
      name: 'time',
      test: /\b(what('| i)?s the )?time\b|^time$/,
      run: function () {
        return 'The time is ' + new Date().toLocaleTimeString() + '.';
      }
    },
    {
      name: 'date',
      test: /\b(what('| i)?s the )?date|what day is it\b/,
      run: function () {
        return 'Today is ' + new Date().toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) + '.';
      }
    },
    {
      name: 'status',
      test: /\b(status|report|diagnostic|diagnostics|systems|how are we|sitrep)\b/,
      run: statusReport
    },
    {
      name: 'metric',
      test: /\b(core|load|memory|uplink|network|power|battery|audio|thermal|temperature|shield)\b/,
      run: function (text) {
        var feeds = J.readTelemetry ? J.readTelemetry() : [];
        var alias = {
          network: 'uplink', battery: 'power', temperature: 'thermal'
        };
        var hit = null;
        feeds.forEach(function (f) {
          var key = f.label.toLowerCase();
          if (text.indexOf(key) > -1) hit = f;
          Object.keys(alias).forEach(function (a) {
            if (alias[a] === key && text.indexOf(a) > -1) hit = f;
          });
        });
        if (!hit) return statusReport();
        return hit.label + ' reads ' + hit.text + ' ' + hit.unit +
          (hit.real ? '.' : ' — simulated feed, ' + HONORIFIC + '.');
      }
    },
    {
      name: 'listen-on',
      test: /\b(start listening|keep listening|listen up|wake up)\b/,
      run: function () {
        J.bus.emit('cmd:listen', { on: true });
        return 'Listening, ' + HONORIFIC + '.';
      }
    },
    {
      name: 'listen-off',
      test: /\b(stop listening|stand down|go to sleep|sleep now)\b/,
      run: function () {
        J.bus.emit('cmd:listen', { on: false });
        return 'Standing by.';
      }
    },
    {
      name: 'mute',
      test: /\b(mute|be quiet|shut up|silence|stop talking)\b/,
      run: function () {
        J.bus.emit('cmd:mute', { on: true });
        return 'Voice output muted.';
      }
    },
    {
      name: 'unmute',
      test: /\b(unmute|speak up|talk to me|voice on)\b/,
      run: function () {
        J.bus.emit('cmd:mute', { on: false });
        return 'Voice output restored.';
      }
    },
    {
      name: 'mic',
      test: /\b(enable|turn on|open) (the )?(mic|microphone)\b/,
      run: function () {
        J.bus.emit('cmd:mic', {});
        return 'Requesting microphone access.';
      }
    },
    {
      name: 'clear',
      test: /\b(clear|reset) (the )?(log|screen|transcript|console)\b|^clear$/,
      run: function () {
        J.bus.emit('cmd:clear', {});
        return 'Transcript cleared.';
      }
    },
    {
      name: 'alert',
      test: /\b(red alert|alert mode|threat|battle stations)\b/,
      run: function () {
        J.bus.emit('cmd:state', { state: 'alert', hold: 6000 });
        return 'Red alert. Raising shields and rerouting power.';
      }
    },
    {
      name: 'timer',
      test: /\b(set a )?(timer|alarm|remind me)\b.*?(\d+)\s*(second|sec|minute|min|hour|hr)/,
      run: function (text) {
        var m = text.match(/(\d+)\s*(second|sec|minute|min|hour|hr)/);
        var n = parseInt(m[1], 10);
        var unit = m[2];
        var ms = unit.indexOf('h') === 0 ? n * 3600000 : unit.indexOf('m') === 0 ? n * 60000 : n * 1000;
        J.bus.emit('cmd:timer', { ms: ms, label: n + ' ' + unit });
        return 'Timer set for ' + n + ' ' + unit + (n === 1 ? '' : 's') + '.';
      }
    },
    {
      name: 'math',
      test: /^(calculate|compute|what is|what's|whats)?\s*[-+(]?\d[\d\s+\-*/().%^]*$/,
      run: function (text) {
        var expr = text.replace(/^(calculate|compute|what is|what's|whats)\s*/, '');
        try {
          var out = calc(expr);
          return expr.trim() + ' = ' + (Math.round(out * 1e6) / 1e6);
        } catch (err) {
          return 'That expression does not parse, ' + HONORIFIC + '.';
        }
      }
    },
    {
      name: 'help',
      test: /\b(help|commands|what can you do)\b/,
      run: function () {
        return [
          'Try any of these:',
          '  status / report        — full telemetry readout',
          '  power, thermal, uplink — a single gauge',
          '  time, date             — the obvious',
          '  12 * (7 + 3)           — arithmetic',
          '  set a timer for 5 min  — countdown',
          '  red alert              — mood lighting',
          '  mute / unmute          — voice output',
          '  start / stop listening — the microphone',
          '  clear                  — wipe the transcript'
        ].join('\n');
      }
    },
    {
      name: 'thanks',
      test: /\b(thanks|thank you|appreciate it|good job)\b/,
      run: function () { return 'Always a pleasure, ' + HONORIFIC + '.'; }
    }
  ];

  J.commands = {
    /* Returns { reply, intent } — never throws, so the UI layer stays simple. */
    handle: function (raw) {
      var text = tidy(String(raw || ''));
      if (!text) return { reply: '', intent: 'empty' };

      for (var i = 0; i < routes.length; i++) {
        if (routes[i].test.test(text)) {
          try {
            return { reply: routes[i].run(text), intent: routes[i].name };
          } catch (err) {
            return { reply: 'That command failed on my end, ' + HONORIFIC + '.', intent: 'error' };
          }
        }
      }
      return {
        reply: 'I have no routine for that yet, ' + HONORIFIC + '. ' + J.pick(QUIPS) +
               ' Say "help" for what I do know.',
        intent: 'unknown'
      };
    },
    calc: calc
  };
})(window.J);
