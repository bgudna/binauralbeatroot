/*
 * audio.js: Web Audio binaural engine.
 *
 * Graph, built once on the first Play (inside a user gesture):
 *
 *   oscLeft  (sine) -> merger input 0 -> left channel only
 *   oscRight (sine) -> merger input 1 -> right channel only
 *   merger -> fadeGain (play/pause envelope) -> volumeGain (master volume) -> destination
 *
 * The oscillators run continuously once created. Pause mutes by ramping
 * fadeGain to zero, so no duplicate nodes are ever created.
 */
(function () {
  "use strict";

  // ---- Constraints from the plan ----
  const CARRIER_MIN = 200;
  const CARRIER_MAX = 600;
  const BEAT_MIN = 1;
  const BEAT_MAX = 30;
  const DEFAULT_CARRIER = 400;
  const DEFAULT_BEAT = 10;

  // ---- Tuning ----
  const FADE_TIME = 0.3;          // seconds for play/pause fades
  const GLIDE_TIME_CONSTANT = 0.25; // seconds; how quickly frequencies glide to a new set
  const VOLUME_TIME_CONSTANT = 0.03;
  const MAX_LEVEL = 0.4;          // output gain at slider = 100

  let ctx = null;
  let oscLeft = null;
  let oscRight = null;
  let fadeGain = null;
  let volumeGain = null;
  let playing = false;
  let volumeSlider = 30;          // 0..100, matches the default in index.html
  let tone = makeTone(DEFAULT_CARRIER, DEFAULT_BEAT);

  // ---- Helpers ----

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Build a tone description from carrier and beat frequencies.
   * Both inputs are clamped to the plan's constraints.
   */
  function makeTone(carrier, beat) {
    const c = clamp(carrier, CARRIER_MIN, CARRIER_MAX);
    const b = clamp(beat, BEAT_MIN, BEAT_MAX);
    return {
      carrier: c,
      beat: b,
      left: c - b / 2,
      right: c + b / 2
    };
  }

  /** Map the 0..100 slider to an output gain. Squared for a perceptual curve. */
  function levelFromSlider(value) {
    const fraction = clamp(value, 0, 100) / 100;
    return MAX_LEVEL * fraction * fraction;
  }

  /**
   * Glide an AudioParam to a new value without a click.
   * Anchors the automation at the current value first, so the glide starts from where
   * the parameter actually is.
   */
  function glideTo(param, value) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.setTargetAtTime(value, now, GLIDE_TIME_CONSTANT);
  }

  /** Create the audio graph exactly once. Must be called from a user gesture. */
  function buildGraph() {
    if (ctx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContextClass();

    const merger = ctx.createChannelMerger(2);

    fadeGain = ctx.createGain();
    fadeGain.gain.value = 0; // silent until Play

    volumeGain = ctx.createGain();
    volumeGain.gain.value = levelFromSlider(volumeSlider);

    oscLeft = ctx.createOscillator();
    oscLeft.type = "sine";
    oscLeft.frequency.value = tone.left;

    oscRight = ctx.createOscillator();
    oscRight.type = "sine";
    oscRight.frequency.value = tone.right;

    // Each mono oscillator goes into exactly one merger input, so the two
    // frequencies never mix between channels.
    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);

    merger.connect(fadeGain);
    fadeGain.connect(volumeGain);
    volumeGain.connect(ctx.destination);

    oscLeft.start();
    oscRight.start();
  }

  // ---- Public API ----

  /** Returns a copy of the current tone set. */
  function getTone() {
    return { ...tone };
  }

  /** True while playback is active (not paused). */
  function isPlaying() {
    return playing;
  }

  /**
   * Generate a new random tone set, avoiding an exact repeat of the current one.
   * If the graph exists, the frequencies glide to the new values, which works
   * whether or not playback is active.
   */
  function generateNewToneSet() {
    let next;
    do {
      next = makeTone(
        randomInt(CARRIER_MIN, CARRIER_MAX),
        randomInt(BEAT_MIN, BEAT_MAX)
      );
    } while (next.carrier === tone.carrier && next.beat === tone.beat);

    tone = next;

    if (oscLeft && oscRight) {
      glideTo(oscLeft.frequency, tone.left);
      glideTo(oscRight.frequency, tone.right);
    }

    return getTone();
  }

  /** Start playback with a fade-in. Resumes the AudioContext if needed. */
  async function play() {
    buildGraph();

    if (ctx.state !== "running") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    fadeGain.gain.cancelScheduledValues(now);
    fadeGain.gain.setValueAtTime(fadeGain.gain.value, now);
    fadeGain.gain.linearRampToValueAtTime(1, now + FADE_TIME);

    playing = true;
  }

  /** Pause with a fade-out. Oscillators keep running silently. */
  function pause() {
    if (!ctx) return;

    const now = ctx.currentTime;
    fadeGain.gain.cancelScheduledValues(now);
    fadeGain.gain.setValueAtTime(fadeGain.gain.value, now);
    fadeGain.gain.linearRampToValueAtTime(0, now + FADE_TIME);

    playing = false;
  }

  /** Set master volume from the 0..100 slider. Smoothed to avoid zipper noise. */
  function setVolume(value) {
    volumeSlider = clamp(Number(value), 0, 100);
    if (!volumeGain) return; // applied when the graph is built

    volumeGain.gain.setTargetAtTime(
      levelFromSlider(volumeSlider),
      ctx.currentTime,
      VOLUME_TIME_CONSTANT
    );
  }

  window.BinauralAudio = {
    generateNewToneSet: generateNewToneSet,
    play: play,
    pause: pause,
    setVolume: setVolume,
    isPlaying: isPlaying,
    getTone: getTone
  };
})();
