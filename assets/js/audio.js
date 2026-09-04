/* Microphone analyser. Optional: everything degrades to a synthetic idle signal. */
(function (J) {
  'use strict';

  var ctx = null;
  var analyser = null;
  var stream = null;
  var freq = null;
  var time = null;
  var enabled = false;

  var mic = {
    /* 0..1 loudness, smoothed so the orb breathes instead of twitching. */
    level: 0,
    /* 32-bin spectrum, normalized 0..1. */
    bins: new Float32Array(32),
    enabled: function () { return enabled; }
  };

  mic.enable = function () {
    if (enabled) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('microphone API unavailable'));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      freq = new Uint8Array(analyser.frequencyBinCount);
      time = new Uint8Array(analyser.fftSize);
      enabled = true;
      J.bus.emit('mic', { on: true });
      return true;
    });
  };

  mic.disable = function () {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    if (ctx) ctx.close();
    ctx = analyser = stream = null;
    enabled = false;
    J.bus.emit('mic', { on: false });
  };

  /* Synthetic signal so the orb still has life before mic permission. */
  function idleSignal(t) {
    var base = 0.10 + 0.05 * Math.sin(t * 0.7) + 0.03 * Math.sin(t * 1.9 + 1.2);
    for (var i = 0; i < mic.bins.length; i++) {
      var f = i / mic.bins.length;
      mic.bins[i] = J.clamp(
        base * (1.6 - f) * (0.7 + 0.5 * Math.sin(t * (1.1 + f * 4) + i * 0.6)),
        0, 1
      );
    }
    return J.clamp(base, 0, 1);
  }

  J.onFrame(function (t) {
    if (!enabled || !analyser) {
      mic.level = J.lerp(mic.level, idleSignal(t), 0.12);
      return;
    }
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);

    var sum = 0;
    for (var i = 0; i < time.length; i++) {
      var v = (time[i] - 128) / 128;
      sum += v * v;
    }
    var rms = Math.sqrt(sum / time.length);
    mic.level = J.lerp(mic.level, J.clamp(rms * 3.2, 0, 1), 0.28);

    var per = Math.floor(freq.length / mic.bins.length);
    for (var b = 0; b < mic.bins.length; b++) {
      var acc = 0;
      for (var k = 0; k < per; k++) acc += freq[b * per + k];
      mic.bins[b] = J.lerp(mic.bins[b], (acc / per) / 255, 0.35);
    }
  });

  J.mic = mic;
})(window.J);
