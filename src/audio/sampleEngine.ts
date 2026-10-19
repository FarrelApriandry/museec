import * as Tone from 'tone';
import type { SamplePresetId } from '../types/sequencer';

export class HybridSampleEngine {
  private isLoaded = false;
  private samplers: Map<SamplePresetId, Tone.Sampler> = new Map();
  private sampleBuffers: Map<string, AudioBuffer> = new Map();

  /**
   * Generates procedural acoustic PCM sample buffers for Gamelan & Traditional instruments.
   * This guarantees 100% offline, immediate availability with zero missing network assets.
   */
  public async init(audioContext: AudioContext): Promise<void> {
    if (this.isLoaded) return;

    try {
      // 1. Synthesize Saron (Bronze Metallophone)
      const saronBuffer = this.synthesizeMetallophone(audioContext, 440, 1.8, 'saron');
      this.sampleBuffers.set('saron_A4', saronBuffer);

      // 2. Synthesize Bonang (Kettle Gong)
      const bonangBuffer = this.synthesizeMetallophone(audioContext, 523.25, 1.4, 'bonang');
      this.sampleBuffers.set('bonang_C5', bonangBuffer);

      // 3. Synthesize Suling (Bamboo Flute)
      const sulingBuffer = this.synthesizeBambooFlute(audioContext, 440, 2.2);
      this.sampleBuffers.set('suling_A4', sulingBuffer);

      // 4. Synthesize Siter (Plucked Zither)
      const siterBuffer = this.synthesizePluckedZither(audioContext, 330, 2.0);
      this.sampleBuffers.set('siter_E4', siterBuffer);

      this.isLoaded = true;
      console.log('%c[HybridSampleEngine] Procedural Gamelan instruments synthesized successfully!', 'color: #10b981;', {
        instruments: Array.from(this.sampleBuffers.keys())
      });
    } catch (e) {
      console.warn('[HybridSampleEngine] procedural generation fallback to synths:', e);
    }
  }

  /**
   * Play an acoustic instrument sample with pitch shift matching target frequency
   */
  public triggerSample(
    presetId: SamplePresetId,
    freq: number,
    duration: number,
    time: number,
    velocity: number,
    destination: Tone.ToneAudioNode
  ): boolean {
    if (!this.isLoaded) {
      console.warn('[HybridSampleEngine] triggerSample called before loaded! preset:', presetId);
      return false;
    }

    let bufferKey = '';
    let baseFreq = 440;

    switch (presetId) {
      case 'saron':
        bufferKey = 'saron_A4';
        baseFreq = 440;
        break;
      case 'bonang':
        bufferKey = 'bonang_C5';
        baseFreq = 523.25;
        break;
      case 'suling':
        bufferKey = 'suling_A4';
        baseFreq = 440;
        break;
      case 'siter':
        bufferKey = 'siter_E4';
        baseFreq = 330;
        break;
      default:
        return false;
    }

    const audioBuffer = this.sampleBuffers.get(bufferKey);
    if (!audioBuffer) return false;

    try {
      const source = new Tone.ToneBufferSource(audioBuffer);
      const gainNode = new Tone.Gain(velocity * 0.85);

      source.playbackRate.setValueAtTime(freq / baseFreq, time);

      source.connect(gainNode);
      gainNode.connect(destination);

      const playDuration = Math.max(0.05, duration + 0.1);
      source.start(time, 0, playDuration);

      source.onended = () => {
        try {
          gainNode.dispose();
          source.dispose();
        } catch {}
      };

      return true;
    } catch (err) {
      console.warn('Error playing procedural sample, falling back to synth:', err);
      return false;
    }
  }

  // --- Procedural Acoustic Instrument Synthesis ---

  private synthesizeMetallophone(
    ctx: AudioContext,
    baseFreq: number,
    duration: number,
    type: 'saron' | 'bonang'
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Physical bronze inharmonic modes
    const partials =
      type === 'saron'
        ? [
            { mult: 1.0, amp: 1.0, decay: 1.2 },
            { mult: 2.756, amp: 0.6, decay: 0.7 },
            { mult: 5.404, amp: 0.35, decay: 0.4 },
            { mult: 8.933, amp: 0.15, decay: 0.2 },
          ]
        : [
            { mult: 1.0, amp: 1.0, decay: 0.9 },
            { mult: 2.01, amp: 0.75, decay: 0.8 },
            { mult: 3.42, amp: 0.4, decay: 0.5 },
            { mult: 4.88, amp: 0.2, decay: 0.3 },
          ];

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // Inharmonic bronze bar modes
      partials.forEach(({ mult, amp, decay }) => {
        const freq = baseFreq * mult;
        const env = Math.exp(-t / (decay * (type === 'saron' ? 0.8 : 0.6)));
        sample += Math.sin(2 * Math.PI * freq * t) * amp * env;
      });

      // Wooden / Mallet strike transient (first 8ms)
      if (t < 0.008) {
        const noise = (Math.random() * 2 - 1) * Math.exp(-t / 0.002);
        sample += noise * 0.4;
      }

      data[i] = sample * 0.35;
    }

    return buffer;
  }

  private synthesizeBambooFlute(ctx: AudioContext, baseFreq: number, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;

      // Natural flute breath vibrato (5 Hz)
      const vibrato = 1 + 0.008 * Math.sin(2 * Math.PI * 5.2 * t);
      const freq = baseFreq * vibrato;
      phase += freq / sampleRate;

      // Warm hollow pipe harmonics (odd harmonics dominant)
      const p = phase % 1;
      const core =
        Math.sin(2 * Math.PI * p) +
        0.35 * Math.sin(2 * Math.PI * 3 * p) +
        0.12 * Math.sin(2 * Math.PI * 5 * p);

      // Airy breath noise
      const breath = (Math.random() * 2 - 1) * 0.08;

      // Soft flute envelope (30ms attack, sustained body, 150ms release)
      let env = 1.0;
      if (t < 0.04) {
        env = t / 0.04;
      } else if (t > duration - 0.2) {
        env = Math.max(0, (duration - t) / 0.2);
      }

      data[i] = (core + breath) * env * 0.35;
    }

    return buffer;
  }

  private synthesizePluckedZither(ctx: AudioContext, baseFreq: number, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Karplus-Strong string synthesis model
    const period = Math.max(2, Math.floor(sampleRate / baseFreq));
    const delayLine = new Float32Array(period);

    // Initial pluck noise burst
    for (let p = 0; p < period; p++) {
      delayLine[p] = Math.random() * 2 - 1;
    }

    let delayIndex = 0;
    const feedback = 0.992; // Steel-bronze string resonance

    for (let i = 0; i < length; i++) {
      const current = delayLine[delayIndex];
      const nextIndex = (delayIndex + 1) % period;
      const next = delayLine[nextIndex];

      // Lowpass averaging filter
      const filtered = (current + next) * 0.5 * feedback;
      delayLine[delayIndex] = filtered;

      data[i] = current * 0.4;
      delayIndex = nextIndex;
    }

    return buffer;
  }

  public dispose(): void {
    this.samplers.forEach((s) => s.dispose());
    this.samplers.clear();
    this.sampleBuffers.clear();
    this.isLoaded = false;
  }
}

export const hybridSampleEngine = new HybridSampleEngine();
