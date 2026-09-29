import { mkdir, writeFile } from 'node:fs/promises';

const rate = 22050;
const tau = Math.PI * 2;

function writeWav(file, seconds, sampleAt) {
  const count = Math.floor(rate * seconds);
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    const value = Math.max(-1, Math.min(1, sampleAt(i / rate, i) * 0.72));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return writeFile(file, Buffer.concat([header, data]));
}

function writeStereoWav(file, seconds, sampleAt) {
  const count = Math.floor(rate * seconds);
  const data = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i += 1) {
    const [left, right] = sampleAt(i / rate, i);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left * 0.72)) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right * 0.72)) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return writeFile(file, Buffer.concat([header, data]));
}

let seed = 421;
function noise() { seed = (seed * 16807) % 2147483647; return (seed / 1073741823.5) - 1; }

await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeWav(new URL('../public/horror-score.wav', import.meta.url), 16, (t, frame) => {
  const beatTime = t % 2.4;
  const thump = (offset) => {
    const age = beatTime - offset;
    if (age < 0 || age > 0.24) return 0;
    const env = Math.exp(-age * 20);
    return Math.sin(tau * (48 - age * 85) * age) * env * 0.5;
  };
  const noteStep = Math.floor(t / 3.2) % 6;
  const noteAge = (t % 3.2);
  const scale = [146.83, 138.59, 110, 123.47, 98, 130.81];
  const melody = Math.sin(tau * scale[noteStep] * t) * Math.exp(-noteAge * 1.25) * 0.25;
  const drone = Math.sin(tau * 55 * t) * 0.15 + Math.sin(tau * 82.41 * t) * 0.07 + Math.sin(tau * 110.0 * t) * 0.035;
  const hiss = noise() * (0.01 + (noteAge < 0.2 ? 0.035 : 0));
  const fade = Math.min(1, t / 0.12, (16 - t) / 0.12);
  return (drone + melody + thump(0) + thump(0.22) + hiss) * fade;
});

await writeWav(new URL('../public/horror-scare.wav', import.meta.url), 2.6, (t) => {
  const sweep = Math.sin(tau * (185 * t + 310 * t * t)) + Math.sin(tau * (310 * t + 520 * t * t)) * 0.36;
  const shriekEnvelope = Math.min(1, t / 0.055) * Math.exp(-Math.max(0, t - 0.12) * 1.45);
  const bassHit = Math.sin(tau * (66 - 28 * t) * t) * Math.exp(-t * 4.2) * 0.8;
  const impact = noise() * Math.exp(-t * 17) * 0.82;
  const rasp = noise() * Math.max(0, Math.sin(tau * 23 * t)) * Math.exp(-t * 1.4) * 0.23;
  return sweep * shriekEnvelope * 0.74 + bassHit + impact + rasp;
});

let whisperState = 0;
await writeStereoWav(new URL('../public/horror-midcue.wav', import.meta.url), 5, (t) => {
  const knocks = [0.35, 1.95, 3.55].reduce((sum, at) => {
    const age = t - at;
    if (age < 0 || age > 0.65) return sum;
    return sum + Math.sin(tau * (86 - age * 28) * age) * Math.exp(-age * 7) * 0.45 + Math.sin(tau * 430 * age) * Math.exp(-age * 5) * 0.13;
  }, 0);
  whisperState = whisperState * 0.91 + noise() * 0.09;
  const whisper = whisperState * (0.18 + 0.25 * Math.sin(tau * 0.35 * t));
  const drone = Math.sin(tau * 61.74 * t) * 0.09 + Math.sin(tau * 92.5 * t) * 0.035;
  const fade = Math.min(1, t / 0.1, (5 - t) / 0.1);
  return [0, (knocks + whisper + drone) * fade];
});
