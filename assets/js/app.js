/* Boot sequence + wiring. Owns the HUD state machine and the DOM. */
(function (J) {
  'use strict';

  var el = {};
  var core = null;
  var stateHoldUntil = 0;
  var state = 'standby';

  var BOOT_STEPS = [
    'mounting arc reactor telemetry',
    'calibrating audio spectrum',
    'linking speech synthesis',
    'spinning up orb array',
    'all systems online'
  ];

  function $(id) { return document.getElementById(id); }

  function setState(next, holdMs) {
    if (Date.now() < stateHoldUntil && next !== 'alert') return;
    state = next;
    stateHoldUntil = holdMs ? Date.now() + holdMs : 0;
    if (core) core.setState(next);
    el.coreState.textContent = next;
    el.chipMode.textContent = next.toUpperCase();
    el.chipMode.classList.toggle('hot', next !== 'standby');
    el.dot.className = 'dot ' + (
      next === 'alert' ? 'err' : next === 'thinking' ? 'busy' : next === 'standby' ? '' : 'on'
    );
  }

  function log(who, body, kind) {
    var line = document.createElement('div');
    line.className = 'line ' + (kind || who);
    var w = document.createElement('div');
    w.className = 'who';
    w.textContent = who;
    var b = document.createElement('div');
    b.className = 'body';
    b.textContent = body;
    line.appendChild(w);
    line.appendChild(b);
    el.log.appendChild(line);
    el.log.scrollTop = el.log.scrollHeight;
    while (el.log.children.length > 120) el.log.removeChild(el.log.firstChild);
    return b;
  }

  /* Types the reply out so it feels like the thing is thinking, not pasting. */
  function typeOut(node, text, done) {
    var i = 0;
    var step = Math.max(1, Math.round(text.length / 90));
    var timer = setInterval(function () {
      i += step;
      node.textContent = text.slice(0, i);
      el.log.scrollTop = el.log.scrollHeight;
      if (i >= text.length) {
        clearInterval(timer);
        node.textContent = text;
        if (done) done();
      }
    }, 16);
  }

  function respond(input) {
    var text = String(input || '').trim();
    if (!text) return;

    log('you', text);
    setState('thinking');

    /* Small deliberate beat — a zero-latency reply reads as a lookup, not a mind. */
    setTimeout(function () {
      var out = J.commands.handle(text);
      if (!out.reply) { setState('standby'); return; }

      var node = log('jarvis', '', 'jarvis');
      typeOut(node, out.reply, function () {
        if (J.voice.muted || !J.voice.supported.speak) {
          setState(state === 'alert' ? 'alert' : 'standby');
        }
      });
      J.voice.say(out.reply);
      if (!J.voice.muted && J.voice.supported.speak) setState('speaking');
      else setState('standby');
    }, 260 + Math.random() * 220);
  }

  function boot() {
    el = {
      boot: $('boot'), bootSub: $('boot-sub'), bootFill: $('boot-fill'),
      hud: $('hud'), log: $('log'), orbs: $('orbs'), input: $('input'),
      composer: $('composer'), coreState: $('core-state'), coreHint: $('core-hint'),
      chipMode: $('chip-mode'), chipClock: $('chip-clock'), chipFps: $('chip-fps'),
      dot: $('status-dot'), ticker: $('ticker'),
      btnListen: $('btn-listen'), btnMic: $('btn-mic'), btnMute: $('btn-mute')
    };

    var step = 0;
    var seq = setInterval(function () {
      el.bootSub.textContent = BOOT_STEPS[step];
      el.bootFill.style.width = Math.round(((step + 1) / BOOT_STEPS.length) * 100) + '%';
      step++;
      if (step >= BOOT_STEPS.length) {
        clearInterval(seq);
        setTimeout(start, 520);
      }
    }, 340);
  }

  function start() {
    el.boot.classList.add('done');
    el.hud.classList.add('live');
    el.hud.setAttribute('aria-hidden', 'false');

    core = new J.CoreOrb($('core-canvas'));
    J.onFrame(function (t, dt) { core.draw(t, dt); });
    J.mountTelemetry(el.orbs);

    setState('standby');
    log('sys', 'jarvis online · ' + J.clock(), 'sys');
    if (!J.voice.supported.listen) {
      log('sys', 'speech recognition unavailable in this browser — keyboard input still works', 'sys');
      el.btnListen.disabled = true;
      el.coreHint.textContent = 'type a command below';
    }

    var greet = 'Good ' + (new Date().getHours() < 12 ? 'morning' :
      new Date().getHours() < 18 ? 'afternoon' : 'evening') +
      '. J.A.R.V.I.S. online. Say "help" for the command list.';
    var node = log('jarvis', '', 'jarvis');
    typeOut(node, greet);

    wire();
    tickerText();
  }

  function wire() {
    /* clock + fps chips */
    J.onFrame(function () {
      el.chipClock.textContent = J.clock();
      el.chipFps.textContent = Math.round(J.fps()) + ' fps';
      if (stateHoldUntil && Date.now() > stateHoldUntil) {
        stateHoldUntil = 0;
        setState('standby');
      }
    });

    el.composer.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = el.input.value;
      el.input.value = '';
      respond(v);
    });

    el.btnListen.addEventListener('click', function () { toggleListen(); });

    el.btnMic.addEventListener('click', function () {
      J.mic.enable().then(function () {
        log('sys', 'microphone linked — spectrum is live', 'sys');
        el.btnMic.textContent = 'Mic Live';
        el.btnMic.classList.add('live');
      }).catch(function (err) {
        log('sys', 'microphone denied: ' + err.message, 'err');
      });
    });

    el.btnMute.addEventListener('click', function () { setMuted(!J.voice.muted); });

    /* Space toggles listening unless you're typing. */
    document.addEventListener('keydown', function (e) {
      if (e.target === el.input) {
        if (e.key === 'Escape') el.input.blur();
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); toggleListen(); }
      else if (e.key === '/') { e.preventDefault(); el.input.focus(); }
      else if (e.key === 'Escape') { J.voice.shutUp(); J.voice.stop(); setState('standby'); }
    });

    J.bus.on('listen', function (p) {
      el.btnListen.textContent = p.on ? 'Listening…' : 'Listen';
      el.btnListen.classList.toggle('live', p.on);
      if (p.on) setState('listening');
      else if (state === 'listening') setState('standby');
    });

    J.bus.on('listen-error', function (p) {
      log('sys', 'speech input error: ' + p.error, 'err');
      el.btnListen.textContent = 'Listen';
      el.btnListen.classList.remove('live');
      setState('standby');
    });

    J.bus.on('heard-partial', function (p) { el.coreHint.textContent = '“' + p.text + '”'; });

    J.bus.on('heard', function (p) {
      el.coreHint.textContent = 'say “jarvis” or press Space';
      /* Wake word is optional: strip it when present, act either way. */
      var text = p.text.replace(/^\s*(hey\s+)?jarvis[,\s]*/i, '');
      respond(text || p.text);
    });

    J.bus.on('speak-start', function () { setState('speaking'); });
    J.bus.on('speak-end', function () { if (state === 'speaking') setState('standby'); });

    J.bus.on('cmd:listen', function (p) { p.on ? J.voice.listen(true) : J.voice.stop(); });
    J.bus.on('cmd:mute', function (p) { setMuted(p.on); });
    J.bus.on('cmd:mic', function () { el.btnMic.click(); });
    J.bus.on('cmd:clear', function () { el.log.innerHTML = ''; });
    J.bus.on('cmd:state', function (p) { setState(p.state, p.hold); });

    J.bus.on('cmd:timer', function (p) {
      setTimeout(function () {
        log('sys', 'timer elapsed · ' + p.label, 'sys');
        setState('alert', 4000);
        J.voice.say('Your ' + p.label + ' timer has elapsed, sir.');
      }, p.ms);
    });
  }

  function toggleListen() {
    if (!J.voice.supported.listen) {
      log('sys', 'speech recognition unavailable — type instead', 'err');
      return;
    }
    J.voice.toggle();
  }

  function setMuted(on) {
    J.voice.muted = on;
    if (on) J.voice.shutUp();
    el.btnMute.textContent = on ? 'Voice: Off' : 'Voice: On';
    el.btnMute.setAttribute('aria-pressed', String(on));
  }

  function tickerText() {
    var msgs = [
      'arc reactor stable', 'orb array synchronized', 'no anomalies detected',
      'speech interface armed', 'telemetry streaming', 'awaiting instruction'
    ];
    var line = msgs.join('   ·   ') + '   ·   ';
    el.ticker.innerHTML = '<span>' + line + line + '</span>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.J);
