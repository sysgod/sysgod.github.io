// JobTarot audio: plays FILES only (studio rule: .ogg + an .mp3 copy for Safari / iOS). The files are rendered offline by AYForge from
// audio_src/sfx.ay.js (audio_src/render.cmd). WebAudio buffers, unlocked on the first tap; a missing file is skipped silently.
export class Sfx {
  constructor(dir) { this.dir = dir; this.buf = {}; this.muted = false; this.ctx = null; this.names = []; }
  ext() { const a = document.createElement('audio'); return a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.gain = this.ctx.createGain(); this.gain.gain.value = this.muted ? 0 : 0.8; this.gain.connect(this.ctx.destination);
    this.fetchAll();
  }
  load(names) { this.names = names; if (this.ctx) this.fetchAll(); }
  fetchAll() {
    const e = this.ext();
    for (const n of this.names) if (!this.buf[n]) {
      this.buf[n] = 'loading';
      fetch(`${this.dir}${n}.${e}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => this.ctx.decodeAudioData(b)).then((d) => (this.buf[n] = d)).catch(() => (this.buf[n] = null));
    }
  }
  play(n, vol = 1) {
    const b = this.buf[n]; if (!this.ctx || !b || b === 'loading') return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.gain); s.start();
  }
  music(n, vol = 0.45) {
    if (!this.ctx || this.mus) return; const b = this.buf[n];
    if (b === null) return; if (!b || b === 'loading') { setTimeout(() => this.music(n, vol), 400); return; }
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; s.loop = true; g.gain.setValueAtTime(0, this.ctx.currentTime); g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 2.5);
    s.connect(g); g.connect(this.gain); s.start(); this.mus = s;
  }
  setMuted(m) { this.muted = m; if (this.gain) this.gain.gain.value = m ? 0 : 0.8; }
}
