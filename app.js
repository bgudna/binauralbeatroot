/*
 * app.js: UI interactions and display state.
 * All audio work is delegated to window.BinauralAudio (audio.js).
 */
(function () {
  "use strict";

  const audio = window.BinauralAudio;

  const els = {
    playBtn: document.getElementById("play"),
    generateBtn: document.getElementById("generate"),
    status: document.getElementById("status"),
    beat: document.getElementById("beat"),
    left: document.getElementById("left"),
    right: document.getElementById("right"),
    carrier: document.getElementById("carrier"),
    volume: document.getElementById("volume")
  };

  /** Whole numbers print without a decimal; halves print with one decimal place. */
  function formatHz(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function renderTone() {
    const t = audio.getTone();
    els.beat.textContent = formatHz(t.beat);
    els.left.textContent = formatHz(t.left);
    els.right.textContent = formatHz(t.right);
    els.carrier.textContent = formatHz(t.carrier);
  }

  function renderPlayState(isPlaying) {
    document.body.classList.toggle("is-playing", isPlaying);
    els.playBtn.setAttribute("aria-pressed", String(isPlaying));
    els.playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    els.status.textContent = isPlaying ? "Playing" : "Paused";
  }

  async function onPlayClick() {
    if (audio.isPlaying()) {
      audio.pause();
      renderPlayState(false);
      return;
    }

    try {
      await audio.play();
      renderPlayState(true);
    } catch (err) {
      console.error("Playback failed:", err);
      els.status.textContent = "Audio unavailable";
    }
  }

  function onGenerateClick() {
    audio.generateNewToneSet();
    renderTone();
  }

  function onVolumeInput(event) {
    audio.setVolume(event.target.value);
  }

  els.playBtn.addEventListener("click", onPlayClick);
  els.generateBtn.addEventListener("click", onGenerateClick);
  els.volume.addEventListener("input", onVolumeInput);

  // Initial state: paused, default tone, slider synced with audio engine.
  // No audio is started here.
  renderTone();
  renderPlayState(false);
  audio.setVolume(els.volume.value);
})();
