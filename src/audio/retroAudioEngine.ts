import * as Tone from 'tone';
import type {
  SongProject,
  PatternData,
  TrackData,
  StepModifier,
  MasterFxSettings,
  ScaleId,
  ArpSettings,
} from '../types/sequencer';
import { getFreqForNote } from './tuningEngine';
import { hybridSampleEngine } from './sampleEngine';
import { ambientEngine } from './ambientEngine';
import { renderProjectOffline } from './offlineExport';

export type PlayheadCallback = (stepIndex: number, patternId: string, chainIndex: number) => void;

export class RetroAudioEngine {
  private isInitialized = false;
  private isPlaying = false;
  private currentStep = 0;
  private currentChainIndex = 0;
  private repeatEventId: number | null = null;
  private subscribers: Set<PlayheadCallback> = new Set();

  // Active Project Reference
  private currentProject: SongProject | null = null;

  // Master Nodes
  private masterGain!: Tone.Gain;
  private bitCrusher!: Tone.BitCrusher;
  private delayNode!: Tone.FeedbackDelay;
  private masterFilter!: Tone.Filter;
  private reverbNode!: Tone.Freeverb;
  private analyserNode!: AnalyserNode;

  // Synths (Chip Synthesizer Mode & Fallback)
  private leadSynth!: Tone.Synth;
  private arpSynth!: Tone.Synth;
  private bassSynth!: Tone.Synth;

  // Drum Synths
  private drumKickSynth!: Tone.MembraneSynth;
  private drumSnareNoise!: Tone.NoiseSynth;
  private drumSnareTone!: Tone.Synth;
  private drumHiHatClosed!: Tone.NoiseSynth;
  private drumHiHatOpen!: Tone.NoiseSynth;
  private drumZapSynth!: Tone.Synth;

  // Channel Nodes
  private trackGains: Map<string, Tone.Gain> = new Map();
  private trackPanners: Map<string, Tone.Panner> = new Map();

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await Tone.start();
    const ctx = Tone.getContext();
    const rawCtx = ctx.rawContext as AudioContext;

    // 1. Master Output Chain
    this.masterGain = new Tone.Gain(0.9);

    // Reverb (Algorithmic / Freeverb)
    this.reverbNode = new Tone.Freeverb({
      roomSize: 0.5,
      dampening: 3000,
    });
    this.reverbNode.wet.value = 0;

    // Filter
    this.masterFilter = new Tone.Filter({
      frequency: 14000,
      type: 'lowpass',
      rolloff: -12,
    });

    // Delay
    this.delayNode = new Tone.FeedbackDelay('8n', 0.25);
    this.delayNode.wet.value = 0;

    // Bitcrusher
    this.bitCrusher = new Tone.BitCrusher(8);
    this.bitCrusher.wet.value = 0;

    // Native Analyser for 60fps Visualizer
    this.analyserNode = rawCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Master FX Pipeline:
    // TrackGains -> BitCrusher -> DelayNode -> MasterFilter -> ReverbNode -> MasterGain -> Analyser & Destination
    this.bitCrusher.connect(this.delayNode);
    this.delayNode.connect(this.masterFilter);
    this.masterFilter.connect(this.reverbNode);
    this.reverbNode.connect(this.masterGain);

    const masterNative = this.masterGain.input as unknown as AudioNode;
    masterNative.connect(this.analyserNode);
    this.masterGain.connect(Tone.getDestination());

    // 2. Initialize Ambient Engine
    ambientEngine.init(rawCtx, masterNative);

    // 3. Initialize Hybrid Sampler Engine (procedural acoustic samples)
    await hybridSampleEngine.init(rawCtx);

    // 4. Initialize Melodic Synths
    this.leadSynth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.45, release: 0.15 },
    });

    this.arpSynth = new Tone.Synth({
      oscillator: { type: 'pulse', width: 0.25 },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.25, release: 0.08 },
    });

    this.bassSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.015, decay: 0.3, sustain: 0.6, release: 0.2 },
    });

    // 5. Initialize Drum Voices
    this.drumKickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0.01, release: 0.1 },
    });

    this.drumSnareNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    });
    this.drumSnareTone = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    });

    const hhFilter = new Tone.Filter(7500, 'highpass');
    this.drumHiHatClosed = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    }).connect(hhFilter);

    const ohFilter = new Tone.Filter(6500, 'highpass');
    this.drumHiHatOpen = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
    }).connect(ohFilter);

    this.drumZapSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    });

    // 6. Connect Track Routing
    this.setupTrackRouting('track-1', this.leadSynth);
    this.setupTrackRouting('track-2', this.arpSynth);
    this.setupTrackRouting('track-3', this.bassSynth);

    const drumBus = new Tone.Gain(1);
    this.drumKickSynth.connect(drumBus);
    this.drumSnareNoise.connect(drumBus);
    this.drumSnareTone.connect(drumBus);
    hhFilter.connect(drumBus);
    ohFilter.connect(drumBus);
    this.drumZapSynth.connect(drumBus);

    this.setupTrackRouting('track-4', drumBus);

    this.isInitialized = true;
  }

  private setupTrackRouting(trackId: string, sourceNode: Tone.ToneAudioNode) {
    const panner = new Tone.Panner(0);
    const gain = new Tone.Gain(1);

    sourceNode.connect(panner);
    panner.connect(gain);
    gain.connect(this.bitCrusher);

    this.trackGains.set(trackId, gain);
    this.trackPanners.set(trackId, panner);
  }

  // --- Fast Decoupled Playhead Subscriber ---
  public subscribePlayhead(callback: PlayheadCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Backward-compatible alias
  public setOnStepCallback(callback: (step: number) => void): () => void {
    return this.subscribePlayhead((step) => callback(step));
  }

  private notifyPlayhead(step: number, patternId: string, chainIdx: number) {
    this.subscribers.forEach((cb) => cb(step, patternId, chainIdx));
  }

  // --- Project & Pattern Management ---
  public loadProject(project: SongProject) {
    this.currentProject = project;

    Tone.getTransport().bpm.value = project.tempo;
    Tone.getTransport().swing = project.swing;
    Tone.getTransport().swingSubdivision = '16n';

    this.updateMasterFx(project.masterFx);
    this.updateAmbient(project.ambientTrack);

    const activePattern = this.getActivePattern();
    if (activePattern) {
      activePattern.tracks.forEach((t) => this.updateTrackSettings(t));
    }
  }

  public getActivePattern(): PatternData | null {
    if (!this.currentProject) return null;
    if (this.currentProject.chainMode && this.currentProject.patternChain.length > 0) {
      const pid = this.currentProject.patternChain[this.currentChainIndex % this.currentProject.patternChain.length];
      return this.currentProject.patterns[pid] || Object.values(this.currentProject.patterns)[0] || null;
    }
    return this.currentProject.patterns[this.currentProject.activePatternId] || Object.values(this.currentProject.patterns)[0] || null;
  }

  public updateMasterFx(fx: MasterFxSettings) {
    if (!this.isInitialized) return;

    // Bitcrusher
    if (fx.bitcrusher.enabled) {
      this.bitCrusher.bits.value = fx.bitcrusher.bits;
      this.bitCrusher.wet.rampTo(1, 0.05);
    } else {
      this.bitCrusher.wet.rampTo(0, 0.05);
    }

    // Delay
    if (fx.delay.enabled) {
      this.delayNode.delayTime.value = fx.delay.time;
      this.delayNode.feedback.value = Math.max(0, Math.min(0.95, fx.delay.feedback));
      this.delayNode.wet.rampTo(Math.max(0, Math.min(1, fx.delay.wet)), 0.05);
    } else {
      this.delayNode.wet.rampTo(0, 0.05);
    }

    // Filter
    if (fx.filter.enabled) {
      this.masterFilter.frequency.rampTo(fx.filter.cutoff, 0.05);
      this.masterFilter.Q.value = fx.filter.resonance;
    } else {
      this.masterFilter.frequency.rampTo(20000, 0.05);
    }

    // Reverb
    if (fx.reverb.enabled) {
      this.reverbNode.roomSize.value = fx.reverb.roomSize;
      this.reverbNode.dampening = fx.reverb.dampening;
      this.reverbNode.wet.rampTo(fx.reverb.wet, 0.05);
    } else {
      this.reverbNode.wet.rampTo(0, 0.05);
    }
  }

  public updateAmbient(ambient: SongProject['ambientTrack']) {
    ambientEngine.updateSettings(ambient);
  }

  public updateTrackSettings(track: TrackData) {
    if (!this.isInitialized) return;

    const gainNode = this.trackGains.get(track.id);
    const pannerNode = this.trackPanners.get(track.id);

    if (gainNode) {
      const activePat = this.getActivePattern();
      const anySolo = activePat?.tracks.some((t) => t.solo) ?? false;
      const shouldMute = track.muted || (anySolo && !track.solo);

      if (shouldMute) {
        gainNode.gain.rampTo(0, 0.02);
      } else {
        const linearGain = Tone.dbToGain(track.volume);
        gainNode.gain.rampTo(linearGain, 0.02);
      }
    }

    if (pannerNode) {
      pannerNode.pan.rampTo(track.pan, 0.02);
    }

    // Melodic Synth parameter updates
    let synth: Tone.Synth | null = null;
    if (track.type === 'lead') synth = this.leadSynth;
    if (track.type === 'arp') synth = this.arpSynth;
    if (track.type === 'bass') synth = this.bassSynth;

    if (synth) {
      if (track.waveform === 'pulse') {
        synth.oscillator.type = 'pulse';
        if ('width' in synth.oscillator) {
          (synth.oscillator as Tone.PulseOscillator).width.value = track.pulseWidth ?? 0.25;
        }
      } else {
        synth.oscillator.type = track.waveform;
      }

      synth.envelope.attack = track.envelope.attack;
      synth.envelope.decay = track.envelope.decay;
      synth.envelope.sustain = track.envelope.sustain;
      synth.envelope.release = track.envelope.release;
    }
  }

  public setBpm(bpm: number) {
    const clamped = Math.max(60, Math.min(180, bpm));
    Tone.getTransport().bpm.rampTo(clamped, 0.05);
  }

  public setSwing(swing: number) {
    Tone.getTransport().swing = Math.max(0, Math.min(1, swing));
  }

  // --- Transport Controls ---
  public async play(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (this.isPlaying) return;

    this.isPlaying = true;
    if (this.repeatEventId === null) {
      this.repeatEventId = Tone.getTransport().scheduleRepeat((time) => {
        this.tick(time);
      }, '16n');
    }

    Tone.getTransport().start();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    Tone.getTransport().pause();
  }

  public stop(): void {
    this.isPlaying = false;
    Tone.getTransport().stop();
    this.currentStep = 0;
    this.currentChainIndex = 0;
    const activePat = this.getActivePattern();
    this.notifyPlayhead(0, activePat?.id || '', 0);
  }

  public getPlaybackState(): { isPlaying: boolean; currentStep: number; currentChainIndex: number } {
    return {
      isPlaying: this.isPlaying,
      currentStep: this.currentStep,
      currentChainIndex: this.currentChainIndex,
    };
  }

  // --- Sample-Accurate Sequencing Loop ---
  private tick(time: number): void {
    if (!this.currentProject) return;

    const activePattern = this.getActivePattern();
    if (!activePattern) return;

    const stepIdx = this.currentStep;
    const chainIdx = this.currentChainIndex;
    const patternId = activePattern.id;

    // 1. Schedule 60fps playhead UI notification on Tone.Draw
    Tone.getDraw().schedule(() => {
      this.notifyPlayhead(stepIdx, patternId, chainIdx);
    }, time);

    // 2. Trigger step audio
    this.triggerStepAudio(activePattern, this.currentProject.activeScale, stepIdx, time);

    // 3. Advance step and handle Pattern Chaining
    const nextStep = this.currentStep + 1;
    if (nextStep >= activePattern.stepCount) {
      this.currentStep = 0;
      if (this.currentProject.chainMode && this.currentProject.patternChain.length > 1) {
        this.currentChainIndex = (this.currentChainIndex + 1) % this.currentProject.patternChain.length;
      }
    } else {
      this.currentStep = nextStep;
    }
  }

  private triggerStepAudio(
    pattern: PatternData,
    scaleId: ScaleId,
    stepIndex: number,
    time: number
  ): void {
    const sixteenthDuration = Tone.Time('16n').toSeconds();

    pattern.tracks.forEach((track) => {
      const step = track.steps[stepIndex];
      if (!step || !step.active) return;

      const anySolo = pattern.tracks.some((t) => t.solo);
      if (track.muted || (anySolo && !track.solo)) return;

      // Calculate micro-timing offset (-25ms to +25ms)
      const microSec = (step.microTiming || 0) / 1000;
      const scheduledTime = time + microSec;

      // Note frequency (microtonal or 12-TET)
      const freq = step.freq || getFreqForNote(scaleId, step.note);

      if (track.type === 'lead') {
        this.triggerMelodicTrack(this.leadSynth, track, step, freq, sixteenthDuration, scheduledTime);
      } else if (track.type === 'arp') {
        this.triggerMelodicTrack(this.arpSynth, track, step, freq, sixteenthDuration, scheduledTime);
      } else if (track.type === 'bass') {
        this.triggerMelodicTrack(this.bassSynth, track, step, freq, sixteenthDuration, scheduledTime);
      } else if (track.type === 'drums') {
        this.triggerDrumTrack(step, scheduledTime);
      }
    });
  }

  private triggerMelodicTrack(
    synth: Tone.Synth,
    track: TrackData,
    step: StepModifier,
    freq: number,
    stepDuration: number,
    time: number
  ): void {
    try {
      const validTime = Math.max(Tone.now() + 0.005, time);
      const gateDuration = stepDuration * Math.max(0.1, Math.min(2.0, step.gate || 0.6));
      const velocity = step.velocity || 0.8;

      // 1. Portamento / Glide
      synth.portamento = step.glide ? 0.06 : 0;

      // 2. Hybrid Sampler Voice Mode
      if (track.instrumentMode === 'sampler' && track.samplePreset !== 'none') {
        const gainNode = this.trackGains.get(track.id) || this.masterGain;
        const played = hybridSampleEngine.triggerSample(
          track.samplePreset,
          freq,
          gateDuration,
          validTime,
          velocity,
          gainNode
        );
        if (played) return; // Handled by acoustic sampler
      }

      // 3. Fast Retro Arpeggiator (if active)
      if (track.arp && track.arp.enabled) {
        const intervals = this.getArpIntervals(track.arp.pattern);
        const subCount = track.arp.rate === '1/64' || track.arp.rate === '60Hz' ? 4 : 2;
        const subDuration = (stepDuration / subCount) * 0.9;
        const subInterval = stepDuration / subCount;

        for (let i = 0; i < subCount; i++) {
          const semitoneShift = intervals[i % intervals.length] + (track.arp.octaves > 1 && i >= intervals.length ? 12 : 0);
          const arpFreq = freq * Math.pow(2, semitoneShift / 12);
          const subTime = validTime + i * subInterval;
          synth.triggerAttackRelease(arpFreq, subDuration, subTime, velocity);
        }
      } else {
        // Pure Chip Synth Voice
        synth.triggerAttackRelease(freq, gateDuration, validTime, velocity);
      }
    } catch (e) {
      console.warn('Error triggering melodic track:', e);
    }
  }

  private getArpIntervals(pattern: ArpSettings['pattern']): number[] {
    switch (pattern) {
      case 'major':
        return [0, 4, 7, 12];
      case 'minor':
        return [0, 3, 7, 12];
      case 'octave':
        return [0, 12, 0, 12];
      case 'fifth':
        return [0, 7, 12, 7];
      case 'up':
        return [0, 4, 7, 11];
      case 'up-down':
        return [0, 4, 7, 4];
      default:
        return [0, 4, 7, 12];
    }
  }

  private triggerDrumTrack(step: StepModifier, time: number): void {
    const sounds = step.drumSounds;
    const velocity = step.velocity || 0.9;
    const validTime = Math.max(Tone.now() + 0.005, time);

    if (!sounds) {
      this.drumKickSynth.triggerAttackRelease('C1', '8n', validTime, velocity);
      return;
    }

    if (sounds.kick) {
      this.drumKickSynth.triggerAttackRelease('C1', '8n', validTime, velocity);
    }
    if (sounds.snare) {
      this.drumSnareNoise.triggerAttackRelease('16n', validTime, velocity * 0.9);
      this.drumSnareTone.triggerAttackRelease('G2', '16n', validTime, velocity * 0.75);
    }
    if (sounds.hihat_closed) {
      this.drumHiHatClosed.triggerAttackRelease('32n', validTime, velocity * 0.7);
    }
    if (sounds.hihat_open) {
      this.drumHiHatOpen.triggerAttackRelease('8n', validTime, velocity * 0.85);
    }
    if (sounds.zap) {
      const zapFreq = Tone.Frequency('G5').toFrequency();
      this.drumZapSynth.triggerAttackRelease(zapFreq, '16n', validTime, velocity);
    }
  }

  // Audition / Note preview
  public previewNote(freqOrNote: number | string, type: TrackData['type']): void {
    if (!this.isInitialized) return;
    const time = Tone.now();
    const synth = type === 'lead' ? this.leadSynth : type === 'arp' ? this.arpSynth : this.bassSynth;
    synth.triggerAttackRelease(freqOrNote, '8n', time, 0.85);
  }

  public previewDrum(drumType: 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'zap'): void {
    if (!this.isInitialized) return;
    const time = Tone.now();
    const step: StepModifier = {
      active: true,
      note: 'C2',
      velocity: 0.9,
      gate: 0.5,
      microTiming: 0,
      glide: false,
      drumSounds: {
        kick: drumType === 'kick',
        snare: drumType === 'snare',
        hihat_closed: drumType === 'hihat_closed',
        hihat_open: drumType === 'hihat_open',
        zap: drumType === 'zap',
      },
    };
    this.triggerDrumTrack(step, time);
  }

  public getVisualizerData(mode: 'waveform' | 'spectrum'): Uint8Array {
    if (!this.analyserNode) {
      return new Uint8Array(128);
    }
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    if (mode === 'waveform') {
      this.analyserNode.getByteTimeDomainData(dataArray);
    } else {
      this.analyserNode.getByteFrequencyData(dataArray);
    }
    return dataArray;
  }

  // --- Offline High-Quality Export ---
  public async exportProjectWav(onProgress?: (pct: number) => void): Promise<Blob> {
    if (!this.currentProject) {
      throw new Error('No active project to export.');
    }
    return renderProjectOffline(this.currentProject, onProgress);
  }

  public dispose(): void {
    this.stop();
    if (this.repeatEventId !== null) {
      Tone.getTransport().clear(this.repeatEventId);
      this.repeatEventId = null;
    }

    this.subscribers.clear();
    ambientEngine.dispose();
    hybridSampleEngine.dispose();

    try {
      this.leadSynth?.dispose();
      this.arpSynth?.dispose();
      this.bassSynth?.dispose();
      this.drumKickSynth?.dispose();
      this.drumSnareNoise?.dispose();
      this.drumSnareTone?.dispose();
      this.drumHiHatClosed?.dispose();
      this.drumHiHatOpen?.dispose();
      this.drumZapSynth?.dispose();
      this.bitCrusher?.dispose();
      this.delayNode?.dispose();
      this.masterFilter?.dispose();
      this.reverbNode?.dispose();
      this.masterGain?.dispose();
    } catch (e) {
      console.warn('Engine cleanup error:', e);
    }

    this.isInitialized = false;
  }
}

export const retroAudioEngine = new RetroAudioEngine();
