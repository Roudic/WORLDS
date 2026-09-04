/* Speech in (Web Speech API) and speech out (speechSynthesis).
   Both are optional — the HUD stays fully usable by keyboard without them. */
(function (J) {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recog = null;
  var listening = false;
  var wantContinuous = false;

  var voice = {
    muted: false,
    supported: { listen: !!SR, speak: 'speechSynthesis' in window },
    listening: function () { return listening; }
  };

  function build() {
    if (!SR) return null;
    var r = new SR();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    r.onstart = function () {
      listening = true;
      J.bus.emit('listen', { on: true });
    };
    r.onend = function () {
      listening = false;
      J.bus.emit('listen', { on: false });
      if (wantContinuous) {
        setTimeout(function () { if (wantContinuous) voice.listen(true); }, 320);
      }
    };
    r.onerror = function (e) {
      listening = false;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') wantContinuous = false;
      J.bus.emit('listen-error', { error: e.error });
    };
    r.onresult = function (e) {
      var finalText = '';
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (interim) J.bus.emit('heard-partial', { text: interim.trim() });
      if (finalText.trim()) J.bus.emit('heard', { text: finalText.trim() });
    };
    return r;
  }

  voice.listen = function (keepAlive) {
    if (!SR) return false;
    wantContinuous = !!keepAlive;
    if (listening) return true;
    recog = recog || build();
    try {
      recog.start();
      return true;
    } catch (err) {
      /* start() throws if a session is already spinning up — harmless. */
      return listening;
    }
  };

  voice.stop = function () {
    wantContinuous = false;
    if (recog && listening) {
      try { recog.stop(); } catch (err) { /* already stopping */ }
    }
  };

  voice.toggle = function () {
    if (listening || wantContinuous) { voice.stop(); return false; }
    return voice.listen(true);
  };

  /* Prefer a calm British voice — closest thing to the man himself. */
  function preferredVoice() {
    var all = window.speechSynthesis.getVoices() || [];
    if (!all.length) return null;
    var ranked = [
      /Daniel/i, /Google UK English Male/i, /en-GB/i, /Arthur/i, /Male/i
    ];
    for (var i = 0; i < ranked.length; i++) {
      var hit = all.find(function (v) { return ranked[i].test(v.name) || ranked[i].test(v.lang); });
      if (hit) return hit;
    }
    return all[0];
  }

  voice.say = function (text) {
    if (voice.muted || !voice.supported.speak || !text) {
      J.bus.emit('speak-end', {});
      return;
    }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = preferredVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 1.02;
      u.pitch = 0.92;
      u.onstart = function () { J.bus.emit('speak-start', { text: text }); };
      u.onend = function () { J.bus.emit('speak-end', {}); };
      u.onerror = function () { J.bus.emit('speak-end', {}); };
      window.speechSynthesis.speak(u);
    } catch (err) {
      J.bus.emit('speak-end', {});
    }
  };

  voice.shutUp = function () {
    if (voice.supported.speak) window.speechSynthesis.cancel();
  };

  if (voice.supported.speak && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = function () { preferredVoice(); };
  }

  J.voice = voice;
})(window.J);
