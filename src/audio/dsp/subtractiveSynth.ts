import * as Tone from 'tone';
import type { SubtractiveSynthParams } from '../../types/daw';

interface ActiveVoice {
  voiceIndex: number;
  noteFreq: number;
  osc1: Tone.Oscillator;
  osc2: Tone.Oscillator;
  subOsc: Tone.Oscillator;
  filter: Tone.Filter;
  ampEnv: Tone.AmplitudeEnvelope;
  filterEnv: Tone.Envelope;
  startTime: number;
}

export class PolySubtractiveSynth {
  public output: Tone.Gain;
  private params: SubtractiveSynthParams;
  private voices: Map<string, ActiveVoice> = new Map();
  private maxPolyphony = 12;

  // LFO Modulation
  private lfo: Tone.LFO;
  private lfoGain: Tone.Gain;

  constructor(initialParams?: Partial<SubtractiveSynthParams>) {
    this.output = new Tone.Gain(0.7);

    this.params = {
      osc1Type: 'sawtooth',
      osc2Type: 'square',
      osc2Detune: 7, // 7 cents warm chorusing
      osc2Mix: 0.5,
      subOscGain: 0.25,
      filterType: 'lowpass',
      filterCutoff: 3500,
      filterResonance: 3,
      filterEnvAmount: 0.4,
      attack: 0.02,
      decay: 0.3,
      sustain: 0.7,
      release: 0.4,
      lfoRate: 3.5,
      lfoAmount: 0.1,
      lfoTarget: 'filter',
      ...initialParams,
    };

    // Global LFO for chorus/vibrato/wah modulation
    this.lfo = new Tone.LFO(this.params.lfoRate, -1, 1);
    this.lfoGain = new Tone.Gain(this.params.lfoAmount);
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
  }

  public updateParams(newParams: Partial<SubtractiveSynthParams>): void {
    this.params = { ...this.params, ...newParams };
    if (newParams.lfoRate !== undefined) {
      this.lfo.frequency.value = newParams.lfoRate;
    }
    if (newParams.lfoAmount !== undefined) {
      this.lfoGain.gain.value = newParams.lfoAmount;
    }
  }

  /**
   * Triggers a polyphonic note
   * @param freq Exact frequency in Hz
   * @param velocity Note velocity (0.0 to 1.0)
   * @param time AudioContext scheduled trigger time
   */
  public triggerAttack(freq: number, velocity: number = 0.8, time?: number): void {
    const triggerTime = time !== undefined ? Math.max(Tone.now() + 0.005, time) : Tone.now() + 0.005;
    const voiceKey = `${freq.toFixed(2)}`;

    // Voice stealing if note is already sounding
    if (this.voices.has(voiceKey)) {
      this.triggerRelease(freq, triggerTime);
    }

    // Limit active polyphony
    if (this.voices.size >= this.maxPolyphony) {
      const oldestKey = this.voices.keys().next().value;
      if (oldestKey) this.triggerReleaseByKey(oldestKey, triggerTime);
    }

    // Create voice nodes
    const osc1 = new Tone.Oscillator(freq, this.params.osc1Type as any);
    const osc2 = new Tone.Oscillator(freq, this.params.osc2Type as any);
    osc2.detune.value = this.params.osc2Detune;

    const subOsc = new Tone.Oscillator(freq / 2, 'sine'); // Sub-osc 1 octave down

    const osc1Gain = new Tone.Gain(1 - this.params.osc2Mix);
    const osc2Gain = new Tone.Gain(this.params.osc2Mix);
    const subGain = new Tone.Gain(this.params.subOscGain);

    const filter = new Tone.Filter({
      frequency: this.params.filterCutoff,
      type: this.params.filterType,
      rolloff: -24,
      Q: this.params.filterResonance,
    });

    const ampEnv = new Tone.AmplitudeEnvelope({
      attack: Math.max(0.002, this.params.attack),
      decay: Math.max(0.01, this.params.decay),
      sustain: Math.max(0.0, Math.min(1.0, this.params.sustain)),
      release: Math.max(0.01, this.params.release),
    });

    // Wire voice graph:
    // [Osc1, Osc2, Sub] -> Mixer -> Filter -> AmpEnv -> Master Output
    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    subOsc.connect(subGain);

    osc1Gain.connect(filter);
    osc2Gain.connect(filter);
    subGain.connect(filter);

    filter.connect(ampEnv);
    ampEnv.connect(this.output);

    // Apply LFO modulation if targeted to filter
    if (this.params.lfoTarget === 'filter' && this.params.lfoAmount > 0) {
      this.lfoGain.connect(filter.detune);
    }

    // Filter Envelope Mod
    const baseCutoff = this.params.filterCutoff;
    const peakCutoff = Math.min(18000, baseCutoff + this.params.filterEnvAmount * 8000);
    filter.frequency.setValueAtTime(baseCutoff, triggerTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, peakCutoff), triggerTime + this.params.attack);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(100, baseCutoff + (peakCutoff - baseCutoff) * this.params.sustain),
      triggerTime + this.params.attack + this.params.decay
    );

    // Start Oscillators & Envelope
    osc1.start(triggerTime);
    osc2.start(triggerTime);
    subOsc.start(triggerTime);
    ampEnv.triggerAttack(triggerTime, velocity);

    const voice: ActiveVoice = {
      voiceIndex: this.voices.size,
      noteFreq: freq,
      osc1,
      osc2,
      subOsc,
      filter,
      ampEnv,
      filterEnv: null as any,
      startTime: triggerTime,
    };

    this.voices.set(voiceKey, voice);
  }

  /**
   * Triggers a polyphonic note with automatic release after duration
   */
  public triggerAttackRelease(
    freq: number,
    duration: number,
    time?: number,
    velocity: number = 0.8
  ): void {
    const triggerTime = time !== undefined ? Math.max(Tone.now() + 0.005, time) : Tone.now() + 0.005;
    this.triggerAttack(freq, velocity, triggerTime);
    this.triggerRelease(freq, triggerTime + duration);
  }

  /**
   * Releases a polyphonic note
   */
  public triggerRelease(freq: number, time?: number): void {
    const voiceKey = `${freq.toFixed(2)}`;
    this.triggerReleaseByKey(voiceKey, time);
  }

  private triggerReleaseByKey(voiceKey: string, time?: number): void {
    const voice = this.voices.get(voiceKey);
    if (!voice) return;

    const releaseTime = time !== undefined ? Math.max(Tone.now() + 0.005, time) : Tone.now() + 0.005;
    voice.ampEnv.triggerRelease(releaseTime);

    // Disconnect LFO from filter
    if (this.params.lfoTarget === 'filter') {
      try {
        this.lfoGain.disconnect(voice.filter.detune);
      } catch {
        // Disconnect ignored if already unlinked
      }
    }

    // Filter close ramp on release
    try {
      voice.filter.frequency.exponentialRampToValueAtTime(
        Math.max(80, this.params.filterCutoff * 0.5),
        releaseTime + this.params.release
      );
    } catch {
      // Ignore ramp collision
    }

    const cleanUpDelay = (this.params.release + 0.1) * 1000;
    setTimeout(() => {
      try {
        voice.osc1.stop();
        voice.osc2.stop();
        voice.subOsc.stop();
        voice.osc1.dispose();
        voice.osc2.dispose();
        voice.subOsc.dispose();
        voice.filter.dispose();
        voice.ampEnv.dispose();
      } catch {
        // Node already cleaned up
      }
    }, cleanUpDelay);

    this.voices.delete(voiceKey);
  }

  public releaseAll(time?: number): void {
    const releaseTime = time !== undefined ? Math.max(Tone.now() + 0.005, time) : Tone.now() + 0.005;
    for (const key of Array.from(this.voices.keys())) {
      this.triggerReleaseByKey(key, releaseTime);
    }
  }

  public dispose(): void {
    this.releaseAll();
    this.lfo.stop();
    this.lfo.dispose();
    this.lfoGain.dispose();
    this.output.dispose();
  }
}
