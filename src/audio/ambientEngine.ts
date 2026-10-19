import * as Tone from 'tone';
import type { AmbientTrackSettings } from '../types/sequencer';

export class AmbientEngine {
  private isRunning = false;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private cachedSettings: AmbientTrackSettings | null = null;

  // Active audio source nodes
  private activeSources: (AudioNode | number)[] = [];
  private rainInterval: number | null = null;
  private cricketInterval: number | null = null;

  public init(context: AudioContext, destination: AudioNode): void {
    this.ctx = context;
    this.filterNode = context.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 8000;

    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0;

    this.filterNode.connect(this.masterGain);
    this.masterGain.connect(destination);

    if (this.cachedSettings) {
      this.updateSettings(this.cachedSettings);
    }
  }

  public updateSettings(settings: AmbientTrackSettings): void {
    this.cachedSettings = settings;

    if (!this.masterGain || !this.filterNode || !this.ctx) return;

    if (!settings.enabled || settings.soundType === 'off') {
      this.stop();
      return;
    }

    // Convert dB to linear gain
    const linearGain = Tone.dbToGain(settings.volume);
    const now = this.ctx.currentTime;

    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(linearGain, now + 0.1);
    } catch {
      this.masterGain.gain.value = linearGain;
    }

    try {
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
      this.filterNode.frequency.linearRampToValueAtTime(settings.filterCutoff, now + 0.1);
    } catch {
      this.filterNode.frequency.value = settings.filterCutoff;
    }

    if (!this.isRunning) {
      this.play(settings.soundType);
    } else {
      // Re-trigger if sound type changed
      this.stop();
      this.play(settings.soundType);
    }
  }

  public play(type: AmbientTrackSettings['soundType']): void {
    if (!this.ctx || !this.filterNode) return;
    this.stop();

    if (type === 'rain') {
      this.startRain();
    } else if (type === 'crickets') {
      this.startCrickets();
    } else if (type === 'river') {
      this.startRiver();
    }

    this.isRunning = true;
  }

  public stop(): void {
    this.activeSources.forEach((node) => {
      if (typeof node === 'object' && 'stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
        try {
          (node as AudioScheduledSourceNode).stop();
          (node as AudioNode).disconnect();
        } catch {
          // Ignore
        }
      }
    });
    this.activeSources = [];

    if (this.rainInterval) {
      clearInterval(this.rainInterval);
      this.rainInterval = null;
    }
    if (this.cricketInterval) {
      clearInterval(this.cricketInterval);
      this.cricketInterval = null;
    }

    this.isRunning = false;
  }

  // --- Procedural Generators ---

  private startRain(): void {
    if (!this.ctx || !this.filterNode) return;

    // Pink / White noise base
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = noiseBuffer.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.12;
      }
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 1400;

    noiseSource.connect(rainFilter);
    rainFilter.connect(this.filterNode);
    noiseSource.start();

    this.activeSources.push(noiseSource);

    // Occasional rain droplet clicks
    this.rainInterval = window.setInterval(() => {
      if (!this.ctx || !this.filterNode) return;
      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.frequency.setValueAtTime(1800 + Math.random() * 1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);

      dropGain.gain.setValueAtTime(0.04 * Math.random(), now);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(dropGain);
      dropGain.connect(this.filterNode);

      osc.start(now);
      osc.stop(now + 0.04);
    }, 180);
  }

  private startCrickets(): void {
    if (!this.ctx || !this.filterNode) return;

    // Synthesized rhythmic cicadas & crickets pulse
    this.cricketInterval = window.setInterval(() => {
      if (!this.ctx || !this.filterNode) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 4400 + (Math.random() > 0.5 ? 400 : 0);
      osc.frequency.setValueAtTime(baseFreq, now);

      // Rapid 3-chirp envelope
      for (let i = 0; i < 3; i++) {
        const chirpStart = now + i * 0.045;
        gain.gain.setValueAtTime(0.0001, chirpStart);
        gain.gain.linearRampToValueAtTime(0.08, chirpStart + 0.015);
        gain.gain.linearRampToValueAtTime(0.0001, chirpStart + 0.035);
      }

      osc.connect(gain);
      gain.connect(this.filterNode);

      osc.start(now);
      osc.stop(now + 0.18);
    }, 700 + Math.random() * 300);
  }

  private startRiver(): void {
    if (!this.ctx || !this.filterNode) return;

    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = noiseBuffer.getChannelData(c);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.2;
      }
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Resonant water stream filter
    const riverFilter = this.ctx.createBiquadFilter();
    riverFilter.type = 'bandpass';
    riverFilter.frequency.value = 650;
    riverFilter.Q.value = 1.8;

    noiseSource.connect(riverFilter);
    riverFilter.connect(this.filterNode);
    noiseSource.start();

    this.activeSources.push(noiseSource);
  }

  public dispose(): void {
    this.stop();
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore
      }
      this.masterGain = null;
    }
    if (this.filterNode) {
      try {
        this.filterNode.disconnect();
      } catch {
        // Ignore
      }
      this.filterNode = null;
    }
  }
}

export const ambientEngine = new AmbientEngine();
