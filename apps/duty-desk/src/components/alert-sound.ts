// The bell's alert chime. Phones are strict about sound from web pages, so it's
// played the way they allow:
//  - As a short sound clip in a plain <audio> element, which phones treat like
//    media: an iPhone plays it even with the silent switch on, and Android
//    follows the media volume.
//  - A page may only make sound once a tap has allowed it. The first tap anywhere
//    plays the clip's silent start (it opens with a quarter second of silence)
//    and stops, which lets it play on its own from then on.
//  - If the clip is still refused, the Web Audio version is tried instead.
// Phones that can vibrate (Android) also buzz; iPhones don't let web pages vibrate.

const RATE = 22050;
const LEAD = 0.25; // seconds of silence before the chime

// Two notes (880 Hz, then 1320 Hz), made here as a WAV file so there's nothing to download.
function chimeUrl(): string {
  const n = Math.floor(RATE * (LEAD + 0.5));
  const pcm = new Float32Array(n);
  for (const [freq, at] of [[880, 0], [1320, 0.12]] as const) {
    const from = Math.floor((LEAD + at) * RATE);
    for (let i = from; i < n; i++) {
      const t = (i - from) / RATE;
      if (t > 0.32) break;
      const env = t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 14);
      pcm[i] += Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    }
  }
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

let player: HTMLAudioElement | null = null;
let allowed = false;
let lastPlay = 0;
let ctx: AudioContext | null = null;

function clip(): HTMLAudioElement {
  if (!player) {
    player = new Audio(chimeUrl());
    player.preload = "auto";
  }
  return player;
}

function webAudio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    // A phone suspends it when the app goes to the background; a tap wakes it.
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Call from a tap or key press: that's when phones allow a page to start sound.
export function allowSound(): void {
  try {
    const c = webAudio();
    if (c) {
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, RATE);
      s.connect(c.destination);
      s.start(0);
    }
  } catch {}
  if (allowed) return;
  try {
    const p = clip();
    const id = ++lastPlay;
    p.currentTime = 0;
    void p.play().then(() => {
      allowed = true;
      // Stop inside the silent start, unless a real chime has started since.
      setTimeout(() => { if (lastPlay === id) { p.pause(); p.currentTime = 0; } }, 60);
    }).catch(() => {});
  } catch {}
}

function webAudioChime(): boolean {
  const c = webAudio();
  if (!c || c.state !== "running") return false;
  const now = c.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
  return true;
}

// Plays the chime (and buzzes where the phone can). Resolves to whether any
// sound was allowed to play; the pop-up shows either way.
export async function playChime(): Promise<boolean> {
  try { navigator.vibrate?.([120, 60, 120]); } catch {}
  try {
    const p = clip();
    lastPlay++;
    p.pause();
    p.currentTime = LEAD;
    await p.play();
    allowed = true;
    return true;
  } catch {
    return webAudioChime();
  }
}
