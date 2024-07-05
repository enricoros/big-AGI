// noinspection JSUnusedGlobalSymbols

import { isBrowser } from '~/common/util/pwaUtils';

/**
 * Audio Generator - only a Single instance is needed
 */
export class AudioGenerator {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;


  public playSound(soundName: keyof typeof Sounds): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const soundFunction = Sounds[soundName];
    if (typeof soundFunction === 'function') {
      soundFunction(ctx);
    } else {
      console.error(`Sound "${soundName}" not found.`);
    }
  }

  public setVolume(volume: number): void {
    const ctx = this.ensureContext();
    !!ctx && this.masterGain!.gain.setValueAtTime(volume, ctx.currentTime);
  }

  public mute(): void {
    this.muted = true;
    this.setVolume(0);
  }

  public unmute(): void {
    this.muted = false;
    this.setVolume(1);
  }

  private initContext(): boolean {
    if (!isBrowser) return false;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return true;
  }

  private ensureContext(): AudioContext | null {
    if (!this.initContext())
      return null;
    if (this.ctx!.state === 'suspended') {
      // fire/forget
      void this.ctx!.resume();
    }
    return this.ctx!;
  }
}


// Sound Generation Functions
namespace Sounds {

  export function basicSound(ctx: AudioContext): void {
    const o = Ops.createNode(ctx, 'Oscillator', {
      type: 'sine',
      frequency: 440,
    });
    const g = Ops.createNode(ctx, 'Gain', {
      gain: [
        ['setValueAtTime', 0.3, 0],
        ['exponentialRampToValueAtTime', 0.001, 0.5],
      ] as const,
    });

    Ops.connectNodes(o, g, ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  }
/*
  export function randomSound(ctx: AudioContext): void {
    const types = ['sine', 'square', 'sawtooth', 'triangle'] as OscillatorType[];
    const baseFrequency = 200 + Math.random() * 500;
    const duration = 0.1 + Math.random() * 0.5;

    const o = Ops.createNode(ctx, 'Oscillator', {
      type: types[Math.floor(Math.random() * types.length)],
      frequency: baseFrequency,
    });
    const g = Ops.createNode(ctx, 'Gain', {
      gain: [
        ['setValueAtTime', 0.3, 0],
        ['exponentialRampToValueAtTime', 0.001, duration],
      ] as const,
    });

    Ops.connectNodes(o, g, ctx.destination);
    o.start();
    o.stop(ctx.currentTime + duration);
  }

  export function bubblingLava(ctx: AudioContext): void {
    const noise = Ops.createNoise(ctx, 1);
    const filter = Ops.createNode(ctx, 'BiquadFilter', {
      type: 'lowpass',
      frequency: [
        ['setValueAtTime', 100, 0],
        ['linearRampToValueAtTime', 1000, 0.5],
      ] as const,
    });
    const g = Ops.createNode(ctx, 'Gain', {
      gain: [
        ['setValueAtTime', 0.15, 0],
        ['linearRampToValueAtTime', 0, 1],
      ] as const,
    });

    Ops.connectNodes(noise, filter, g, ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 1);
  }

  export function retroGlitch(ctx: AudioContext): void {
    const o = Ops.createNode(ctx, 'Oscillator', {
      type: 'sawtooth',
      frequency: 110,
    });
    const g = Ops.createNode(ctx, 'Gain', {
      gain: [
        ['setValueAtTime', 0.15, 0],
        ['linearRampToValueAtTime', 0, 0.5],
      ] as const,
    });

    const frequencySchedule: Ops.AudioParamSchedule = Array.from({ length: 10 }, (_, i) =>
      ['exponentialRampToValueAtTime', 110 * Math.pow(2, Math.random() * 3), i * 0.05] as const,
    );
    o.frequency.setValueAtTime(110, ctx.currentTime);
    frequencySchedule.forEach(([method, ...args]) => {
      (o.frequency[method] as Function).apply(o.frequency, [ctx.currentTime + (args[1] || 0), args[0]]);
    });

    Ops.connectNodes(o, g, ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  }

  export function zenChimes(ctx: AudioContext): void {
    [523.25, 587.33, 659.25, 698.46, 783.99].forEach((freq, i) => {
      setTimeout(() => {
        const o = Ops.createNode(ctx, 'Oscillator', {
          type: 'sine',
          frequency: freq,
        });
        const g = Ops.createNode(ctx, 'Gain', {
          gain: [
            ['setValueAtTime', 0.15, 0],
            ['exponentialRampToValueAtTime', 0.001, 1],
          ] as const,
        });
        Ops.connectNodes(o, g, ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 1);
      }, i * 200);
    });
  }

  export function astralChimes(ctx: AudioContext): void {
    const f = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const o = Ops.createNode(ctx, 'Oscillator', {
          type: 'sine',
          frequency: f[Math.floor(Math.random() * f.length)],
        });
        const g = Ops.createNode(ctx, 'Gain', {
          gain: [
            ['setValueAtTime', 0, 0],
            ['linearRampToValueAtTime', 0.05, 0.01],
            ['exponentialRampToValueAtTime', 0.001, 2],
          ] as const,
        });
        Ops.connectNodes(o, g, ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 2);
      }, i * 150);
    }
  }

  export function whisperGarden(ctx: AudioContext): void {
    const noise = Ops.createNoise(ctx, 3);
    const filter = Ops.createNode(ctx, 'BiquadFilter', {
      type: 'lowpass',
      frequency: 1000,
    });
    const g = Ops.createNode(ctx, 'Gain', {
      gain: [
        ['setValueAtTime', 0, 0],
        ['linearRampToValueAtTime', 0.1, 0.5],
        ['linearRampToValueAtTime', 0, 3],
      ] as const,
    });

    Ops.connectNodes(noise, filter, g, ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 3);
  }

  export function warmHearthEmbrace(ctx: AudioContext): void {
    const noise = Ops.createNoise(ctx, 4);
    const filter = Ops.createNode(ctx, 'BiquadFilter', {
      type: 'bandpass',
      frequency: 300,
      Q: 10,
    });
    const g = Ops.createNode(ctx, 'Gain', {
      gain: [
        ['setValueAtTime', 0, 0],
        ['linearRampToValueAtTime', 0.2, 0.5],
        ['linearRampToValueAtTime', 0.1, 3.5],
        ['linearRampToValueAtTime', 0, 4],
      ] as const,
    });

    Ops.connectNodes(noise, filter, g, ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 4);
  }
*/
}


// Sound Construction functions
namespace Ops {

  type AudioParamMethod = keyof {
    [K in keyof AudioParam as AudioParam[K] extends (...args: any[]) => any ? K : never]: AudioParam[K]
  };

  export type AudioParamScheduleItem = {
    [T in AudioParamMethod]: [T, ...Parameters<AudioParam[T]>]
  }[AudioParamMethod];

  export type AudioParamSchedule = ReadonlyArray<AudioParamScheduleItem>;

  export type AudioNodeType =
    | OscillatorNode
    | GainNode
    | BiquadFilterNode
    | AudioBufferSourceNode;

  type AudioParamValue<T> = T extends AudioParam ? number | AudioParamSchedule : never;

  export type AudioNodeOptions<T extends AudioNodeType> = {
    [K in keyof T]?: T[K] extends AudioParam ? AudioParamValue<T[K]> : T[K];
  };

  type AudioNodeCreationMap = {
    'Oscillator': OscillatorNode;
    'Gain': GainNode;
    'BiquadFilter': BiquadFilterNode;
    'BufferSource': AudioBufferSourceNode;
  };

  export function createNode<T extends keyof AudioNodeCreationMap>(
    ctx: AudioContext,
    type: T,
    options: AudioNodeOptions<AudioNodeCreationMap[T]> = {},
  ): AudioNodeCreationMap[T] {
    const node = ctx[`create${type}`]() as AudioNodeCreationMap[T];
    Object.entries(options).forEach(([key, value]) => {
      const nodeKey = key as keyof AudioNodeCreationMap[T];
      if (node[nodeKey] instanceof AudioParam) {
        const param = node[nodeKey] as AudioParam;
        if (typeof value === 'number') {
          param.setValueAtTime(value, ctx.currentTime);
        } else if (Array.isArray(value)) {
          setParamSchedule(ctx, param, value as AudioParamSchedule);
        }
      } else {
        (node as any)[key] = value;
      }
    });
    return node;
  }

  function setParamSchedule(
    ctx: AudioContext,
    param: AudioParam,
    schedule: AudioParamSchedule,
  ): void {
    schedule.forEach(([method, ...args]) => {
      (param[method] as Function).apply(param, [ctx.currentTime, ...args]);
    });
  }


  export function createNoise(ctx: AudioContext, duration: number, type: 'white' | 'pink' = 'white'): AudioBufferSourceNode {
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

    return createNode(ctx, 'BufferSource', { buffer }) as AudioBufferSourceNode;
  }

  export function connectNodes(...nodes: AudioNode[]): AudioNode {
    nodes.reduce((a, b) => a.connect(b));
    return nodes[nodes.length - 1];
  }

}
