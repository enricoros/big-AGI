// noinspection JSUnusedGlobalSymbols

import { isBrowser } from '~/common/util/pwaUtils';

export namespace AudioGenerator {

  interface SoundOptions {
    volume?: number;
    roomSize?: 'small' | 'large';
  }

  // Advanced Sounds (with room acoustics)
  export function mouseClick(): void {
    const ctx = singleContext();
    if (!ctx) return;

    const clickOsc = ctx.createOscillator();
    const resonanceOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    const resonanceGain = ctx.createGain();

    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(2000, ctx.currentTime);
    clickOsc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.02);

    resonanceOsc.type = 'sine';
    resonanceOsc.frequency.setValueAtTime(800, ctx.currentTime);

    // Use fixed gain values to match original
    clickGain.gain.setValueAtTime(1, ctx.currentTime);
    createEnvelope(ctx, clickGain.gain, 0.001, 0.02, 0, 0.01);

    resonanceGain.gain.setValueAtTime(0.2, ctx.currentTime);
    createEnvelope(ctx, resonanceGain.gain, 0.002, 0.05, 0, 0.03);

    const merger = ctx.createChannelMerger(2);
    clickOsc.connect(clickGain).connect(merger, 0, 0);
    resonanceOsc.connect(resonanceGain).connect(merger, 0, 0);

    applyRoomAcoustics(ctx, merger, 'small');

    clickOsc.start();
    resonanceOsc.start();
    clickOsc.stop(ctx.currentTime + 0.1);
    resonanceOsc.stop(ctx.currentTime + 0.1);
  }

  export function typewriterKeystroke(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;

    const strikeNoise = createNoise(ctx, 0.02);
    const inkNoise = createNoise(ctx, 0.05);
    const mechanismOsc = ctx.createOscillator();

    const strikeFilter = ctx.createBiquadFilter();
    const inkFilter = ctx.createBiquadFilter();
    const strikeGain = ctx.createGain();
    const inkGain = ctx.createGain();
    const mechanismGain = ctx.createGain();

    strikeFilter.type = 'highpass';
    strikeFilter.frequency.setValueAtTime(3000, ctx.currentTime);
    strikeFilter.Q.setValueAtTime(10, ctx.currentTime);

    inkFilter.type = 'lowpass';
    inkFilter.frequency.setValueAtTime(500, ctx.currentTime);

    mechanismOsc.type = 'triangle';
    mechanismOsc.frequency.setValueAtTime(400, ctx.currentTime);
    mechanismOsc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.05);

    createEnvelope(ctx, strikeGain.gain, 0.001, 0.01, 0, 0.01);
    createEnvelope(ctx, inkGain.gain, 0.01, 0.03, 0.1, 0.02);
    createEnvelope(ctx, mechanismGain.gain, 0.001, 0.03, 0, 0.02);

    strikeGain.gain.setValueAtTime(options.volume || 0.3, ctx.currentTime);
    inkGain.gain.setValueAtTime((options.volume || 0.3) * 0.5, ctx.currentTime);
    mechanismGain.gain.setValueAtTime((options.volume || 0.3) * 0.2, ctx.currentTime);

    const merger = ctx.createChannelMerger(2);
    strikeNoise.connect(strikeFilter).connect(strikeGain).connect(merger, 0, 0);
    inkNoise.connect(inkFilter).connect(inkGain).connect(merger, 0, 0);
    mechanismOsc.connect(mechanismGain).connect(merger, 0, 0);

    applyRoomAcoustics(ctx, merger, options.roomSize || 'small');

    strikeNoise.start();
    inkNoise.start(ctx.currentTime + 0.01);
    mechanismOsc.start();
    mechanismOsc.stop(ctx.currentTime + 0.1);
  }

  export function smallFirework(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;

    const launchNoise = createNoise(ctx, 0.5);
    const explosionNoise = createNoise(ctx, 0.2);
    const boomOsc = ctx.createOscillator();

    const launchFilter = ctx.createBiquadFilter();
    const explosionFilter = ctx.createBiquadFilter();
    const launchGain = ctx.createGain();
    const explosionGain = ctx.createGain();
    const boomGain = ctx.createGain();

    launchFilter.type = 'bandpass';
    launchFilter.frequency.setValueAtTime(1000, ctx.currentTime);
    launchFilter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.5);

    explosionFilter.type = 'lowpass';
    explosionFilter.frequency.setValueAtTime(10000, ctx.currentTime + 0.5);
    explosionFilter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.7);

    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(100, ctx.currentTime + 0.5);
    boomOsc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.7);

    createEnvelope(ctx, launchGain.gain, 0.01, 0.1, 0.5, 0.39);
    explosionGain.gain.setValueAtTime(0, ctx.currentTime);
    explosionGain.gain.setValueAtTime(options.volume || 0.3, ctx.currentTime + 0.5);
    createEnvelope(ctx, explosionGain.gain, 0.001, 0.1, 0.3, 0.1);
    boomGain.gain.setValueAtTime(0, ctx.currentTime);
    boomGain.gain.setValueAtTime((options.volume || 0.3) * 0.5, ctx.currentTime + 0.5);
    createEnvelope(ctx, boomGain.gain, 0.001, 0.1, 0.3, 0.2);

    const merger = ctx.createChannelMerger(2);
    launchNoise.connect(launchFilter).connect(launchGain).connect(merger, 0, 0);
    explosionNoise.connect(explosionFilter).connect(explosionGain).connect(merger, 0, 0);
    boomOsc.connect(boomGain).connect(merger, 0, 0);

    // Add crackle sounds
    for (let i = 0; i < 20; i++) {
      const crackleNoise = createNoise(ctx, 0.05);
      const crackleFilter = ctx.createBiquadFilter();
      const crackleGain = ctx.createGain();

      crackleFilter.type = 'bandpass';
      crackleFilter.frequency.setValueAtTime(2000 + Math.random() * 3000, ctx.currentTime);

      const startTime = ctx.currentTime + 0.55 + Math.random() * 0.4;
      crackleGain.gain.setValueAtTime(0, startTime);
      createEnvelope(ctx, crackleGain.gain, 0.001, 0.02, 0, 0.03);

      crackleNoise.connect(crackleFilter).connect(crackleGain).connect(merger, 0, 0);
      crackleNoise.start(startTime);
    }

    applyRoomAcoustics(ctx, merger, options.roomSize || 'large');

    launchNoise.start();
    explosionNoise.start(ctx.currentTime + 0.5);
    boomOsc.start(ctx.currentTime + 0.5);
    boomOsc.stop(ctx.currentTime + 1);
  }


  // Basic Sounds

  // export function basicSound(options: SoundOptions = {}): void {
  //   const ctx = singleContext();
  //   if (!ctx) return;
  //   const o = ctx.createOscillator();
  //   const g = ctx.createGain();
  //
  //   o.type = 'sine';
  //   o.frequency.setValueAtTime(440, ctx.currentTime);
  //
  //   g.gain.setValueAtTime(options.volume || 0.3, ctx.currentTime);
  //   g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  //
  //   o.connect(g).connect(ctx.destination);
  //   o.start();
  //   o.stop(ctx.currentTime + 0.5);
  // }

  export function basicNote(note: string = 'C4', duration: number = 1, options: SoundOptions = {}) {
    const ctx = singleContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = 'sine';
    o.frequency.setValueAtTime(noteToFrequency(note), now);

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(options.volume || 0.3, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    o.connect(g);
    g.connect(agMasterGain);
    // applyRoomAcoustics(ctx, g, options.roomSize || 'small');

    o.start(now);
    o.stop(now + duration);
  }

  export function basicRandomSound(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;
    const types: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = types[Math.floor(Math.random() * types.length)];
    o.frequency.setValueAtTime(200 + Math.random() * 500, ctx.currentTime);

    const duration = 0.1 + Math.random() * 0.5;
    g.gain.setValueAtTime(options.volume || 0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + duration);
  }

  export function basicBubblingLava(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;
    const noise = createNoise(ctx, 1);
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.5);

    g.gain.setValueAtTime(options.volume || 0.15, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);

    noise.connect(filter).connect(g).connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 1);
  }

  export function basicRetroGlitch(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, ctx.currentTime);

    g.gain.setValueAtTime(options.volume || 0.15, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

    for (let i = 0; i < 10; i++) {
      o.frequency.exponentialRampToValueAtTime(
        110 * Math.pow(2, Math.random() * 3),
        ctx.currentTime + i * 0.05,
      );
    }

    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  }

  export function basicZenChimes(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;
    const frequencies = [523.25, 587.33, 659.25, 698.46, 783.99];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();

        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime);

        g.gain.setValueAtTime(options.volume || 0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 1);
      }, i * 200);
    });
  }

  export function basicAstralChimes(options: SoundOptions = {}, start: number = 0, count: number = 20, stepMs: number = 150): void {
    const ctx = singleContext();
    if (!ctx) return;
    const frequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();

        o.type = 'sine';
        o.frequency.setValueAtTime(frequencies[Math.floor((start + i) % frequencies.length)], ctx.currentTime);

        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(options.volume || 0.05, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

        o.connect(g).connect(ctx.destination);
        // applyRoomAcoustics(ctx, g, 'small');
        o.start();
        o.stop(ctx.currentTime + 2);
      }, i * stepMs);
    }
  }

  export function basicWhisperGarden(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;
    const noise = createNoise(ctx, 3);
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);

    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(options.volume || 0.1, ctx.currentTime + 0.5);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);

    noise.connect(filter).connect(g).connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 3);
  }

  export function basicWarmHearthEmbrace(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;
    const noise = createNoise(ctx, 4);
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.Q.setValueAtTime(10, ctx.currentTime);

    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(options.volume || 0.2, ctx.currentTime + 0.5);
    g.gain.linearRampToValueAtTime(options.volume ? options.volume / 2 : 0.1, ctx.currentTime + 3.5);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);

    noise.connect(filter).connect(g).connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 4);
  }


  // Big-AGI Sounds

  export function chatAutoSend(options: SoundOptions = {}) {
    const ctx = singleContext();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);

    // o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
    // o.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
    // o.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 1.0);

    g.gain.setValueAtTime(options.volume || 0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    o.connect(g).connect(agMasterGain);
    // applyRoomAcoustics(ctx, o.connect(g), options.roomSize || 'small');

    o.start();
    o.stop(ctx.currentTime + 0.4);
  }

  /** Play a gentle notification sound when the assistant's response is ready */
  export function chatNotifyResponse(options: SoundOptions = {}): void {
    const ctx = singleContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const volume = options.volume ?? 0.2;
    const noteDuration = 0.12;

    // const frequencies = [523.25, 783.99]; // C5, G5
    const frequencies = [392.00, 466.16]; // G4, A#4 // Low and nice
    // const frequencies = [880.00, 1108.73]; // A5, C#6 // High and more alert
    // const frequencies = [783.99, 659.25, 523.25]; // G5, E5, C5

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now + index * noteDuration);

      gainNode.gain.setValueAtTime(0, now + index * noteDuration);
      gainNode.gain.linearRampToValueAtTime(volume, now + index * noteDuration + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + (index + 1) * noteDuration);

      oscillator.connect(gainNode); // .connect(agMasterGain);
      applyRoomAcoustics(ctx, gainNode, options.roomSize || 'small');
      oscillator.start(now + index * noteDuration);
      oscillator.stop(now + (index + 2) * noteDuration);
    });
  }

}


// export namespace TR909 {
//   interface TR909Options {
//     volume?: number;
//     pitch?: number;
//     decay?: number;
//     tone?: number;
//     noiseType?: 'white' | 'pink';
//   }
//
//   export function kick(options: TR909Options = {}): void {
//     const ctx = singleContext();
//     if (!ctx) return;
//
//     const now = ctx.currentTime;
//     const { pitch = 80, decay = 0.35, tone = 0.40, noiseType = 'white' } = options;
//
//     // oscillator
//     const o = ctx.createOscillator();
//     o.type = 'sine';
//     o.frequency.setValueAtTime(pitch, now);
//     o.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.15);
//
//     const og = ctx.createGain();
//     createEnvelope(ctx, og.gain, 0.001, decay, 0.1, 0.1);
//     o.connect(og);
//
//     // noise
//     const n = createNoise(ctx, decay + 0.1, noiseType);
//
//     const ng = ctx.createGain();
//     createEnvelope(ctx, ng.gain, 0.001, 0.05, 0.1, 0.05);
//     n.connect(ng);
//
//     // filter
//     const oToneFilter = ctx.createBiquadFilter();
//     oToneFilter.type = 'lowpass';
//     oToneFilter.frequency.setValueAtTime(1000 * tone, now);
//     og.connect(oToneFilter);
//     ng.connect(oToneFilter);
//
//     const compressor = ctx.createDynamicsCompressor();
//     oToneFilter.connect(compressor);
//     compressor.connect(agMasterGain);
//
//     o.start(now);
//     n.start(now);
//     o.stop(now + decay + 0.2);
//     n.stop(now + decay + 0.1);
//   }
//
//   export function snare(options: TR909Options = {}): void {
//     const ctx = singleContext();
//     if (!ctx) return;
//
//     const now = ctx.currentTime;
//     const { pitch = 150, decay = 0.2, tone = 1, noiseType = 'white' } = options;
//
//     // Oscillator
//     const o = ctx.createOscillator();
//     o.type = 'triangle';
//     o.frequency.setValueAtTime(pitch, now);
//
//     const oscGain = ctx.createGain();
//     createEnvelope(ctx, oscGain.gain, 0.001, 0.06, 0, 0.1);
//     o.connect(oscGain);
//
//     const oToneFilter = ctx.createBiquadFilter();
//     oToneFilter.type = 'bandpass';
//     oToneFilter.frequency.setValueAtTime(400 * tone, now);
//     oToneFilter.Q.setValueAtTime(1, now);
//     oscGain.connect(oToneFilter);
//
//     // Noise
//     const n = createNoise(ctx, decay + 0.1, noiseType);
//
//     const ng = ctx.createGain();
//     createEnvelope(ctx, ng.gain, 0.001, decay, 0, 0.01, 0.2);
//     n.connect(ng);
//
//     const nHighpassFilter = ctx.createBiquadFilter();
//     nHighpassFilter.type = 'highpass';
//     nHighpassFilter.frequency.setValueAtTime(2000, now);
//     ng.connect(nHighpassFilter);
//
//
//     // Compressor
//     const compressor = ctx.createDynamicsCompressor();
//     oToneFilter.connect(compressor);
//     nHighpassFilter.connect(compressor);
//     compressor.connect(agMasterGain);
//
//     n.start(now);
//     o.start(now);
//     n.stop(now + decay + 0.2);
//     o.stop(now + decay + 0.2);
//   }
//
//   export function hihat(options: TR909Options = {}): void {
//     const ctx = singleContext();
//     if (!ctx) return;
//
//     const now = ctx.currentTime;
//     const { decay = 0.08, tone = 1.5, noiseType = 'white' } = options;
//
//     // noise
//     const noise = createNoise(ctx, decay + 0.05, noiseType);
//     const noiseGain = ctx.createGain();
//     createEnvelope(ctx, noiseGain.gain, 0.001, decay, 0.1, 0.05);
//     noise.connect(noiseGain);
//
//     // noise filter
//     const nHighpassFilter = ctx.createBiquadFilter();
//     nHighpassFilter.type = 'highpass';
//     nHighpassFilter.frequency.setValueAtTime(7000 * tone, now);
//     noiseGain.connect(nHighpassFilter);
//
//     // compressor
//     const compressor = ctx.createDynamicsCompressor();
//     nHighpassFilter.connect(compressor);
//     compressor.connect(agMasterGain);
//
//     noise.start(now);
//     noise.stop(now + decay + 0.05);
//   }
//
//   export function clap(options: TR909Options = {}): void {
//     const ctx = singleContext();
//     if (!ctx) return;
//
//     const now = ctx.currentTime;
//     const { decay = 0.2, tone = 1, noiseType = 'white' } = options;
//
//     // noise 1
//     const n1 = createNoise(ctx, 0.05, noiseType);
//     const n1gain = ctx.createGain();
//     createEnvelope(ctx, n1gain.gain, 0.001, 0.03, 0, 0.02);
//     n1.connect(n1gain);
//
//     // noise 2
//     const n2 = createNoise(ctx, decay, noiseType);
//     const n2gain = ctx.createGain();
//     createEnvelope(ctx, n2gain.gain, 0.02, decay - 0.02, 0.1, 0.05);
//     n2.connect(n2gain);
//
//     // n1 + n2 filter
//     const bandpassFilter = ctx.createBiquadFilter();
//     bandpassFilter.type = 'bandpass';
//     bandpassFilter.frequency.setValueAtTime(1000 * tone, now);
//     bandpassFilter.Q.setValueAtTime(1.6, now);
//     n1gain.connect(bandpassFilter);
//     n2gain.connect(bandpassFilter);
//
//     // compressor
//     const compressor = ctx.createDynamicsCompressor();
//     bandpassFilter.connect(compressor);
//     compressor.connect(agMasterGain);
//
//     n1.start(now);
//     n2.start(now + 0.02);
//     n1.stop(now + 0.05);
//     n2.stop(now + decay);
//   }
// }


/// Utility Functions ///

function applyRoomAcoustics(ctx: AudioContext, source: AudioNode, roomSize: 'small' | 'large' = 'small'): void {
  const convolver = ctx.createConvolver();
  const reverbTime = roomSize === 'large' ? 2 : 0.5;
  const decayRate = roomSize === 'large' ? 0.5 : 2;

  const rate = ctx.sampleRate;
  const length = rate * reverbTime;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const impulseData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      impulseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decayRate);
    }
  }
  convolver.buffer = impulse;

  const reverbGain = ctx.createGain();
  reverbGain.gain.setValueAtTime(0.2, ctx.currentTime);

  source.connect(convolver);
  convolver.connect(reverbGain);
  reverbGain.connect(agMasterGain);
  source.connect(agMasterGain);
}

function createEnvelope(ctx: AudioContext, param: AudioParam, attackTime: number, decayTime: number, sustainLevel: number, releaseTime: number, amplitude?: number): void {
  const now = ctx.currentTime;
  param.setValueAtTime(0, now);
  param.linearRampToValueAtTime(amplitude !== undefined ? amplitude : 1, now + attackTime);
  param.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
  param.linearRampToValueAtTime(0, now + attackTime + decayTime + releaseTime);
}

function createNoise(ctx: AudioContext, duration: number, type: 'white' | 'pink' = 'white') {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  switch (type) {
    case 'white':
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      break;

    case 'pink':
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11;
        b6 = white * 0.115926;
      }
      break;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  return noiseSource;
}

function noteToFrequency(note: string /* = 'C4' */): number {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = parseInt(note.slice(-1));
  const keyNumber = notes.indexOf(note.slice(0, -1));

  if (keyNumber === -1) throw new Error('Invalid note');

  // A4 is 440 Hz
  const a4 = 440;

  // Calculate half steps from A4
  const halfStepsFromA4 = (octave - 4) * 12 + keyNumber - 9;

  // Formula: f = 440 * (2^(1/12))^n
  // Where n is the number of half steps from A4
  return a4 * Math.pow(2, halfStepsFromA4 / 12);
}


// (Single) Global Audio Generation Context
let agCtx: AudioContext;
let agMasterGain: GainNode;

function singleContext() {
  if (!isBrowser) return null;
  if (!agCtx) {
    agCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    agMasterGain = agCtx.createGain();
    agMasterGain.connect(agCtx.destination);
  }
  if (agCtx.state === 'suspended') {
    // fire/forget
    void agCtx.resume();
  }
  return agCtx;
}
