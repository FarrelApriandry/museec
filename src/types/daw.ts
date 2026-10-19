import type { ScaleId, WaveformType, SamplePresetId } from './sequencer';

export type TrackType = 'midi' | 'audio' | 'drum_rack' | 'bus';

export type GridSnapType = '1/4' | '1/8' | '1/16' | '1/32' | '1/8t' | '1/16t' | 'off';

export interface NoteEvent {
  id: string;
  pitch: string;            // Standard note (e.g. "C4", "F#3") or microtonal notation ("PL1-4", "SL3-2")
  freq: number;             // Frequency in Hz (accurately microtonal for Pelog/Slendro)
  startTick: number;        // Ticks relative to the start of the parent clip
  durationTicks: number;    // Length of note in ticks (e.g. 192 ticks = 1 quarter note at 192 PPQ)
  velocity: number;         // 0.0 to 1.0 (default 0.8)
  microTiming?: number;     // Humanization offset in milliseconds (-25ms to +25ms)
  glide?: boolean;          // Portamento / pitch glide
}

export interface DrumStepEvent {
  tick: number;
  kick: boolean;
  snare: boolean;
  hihat_closed: boolean;
  hihat_open: boolean;
  zap: boolean;
  velocity: number;
}

export interface BaseClip {
  id: string;
  name: string;
  trackId: string;
  startTick: number;        // Absolute timeline position in ticks
  durationTicks: number;    // Length of clip in ticks
  color: string;
}

export interface MidiClip extends BaseClip {
  type: 'midi';
  notes: NoteEvent[];
  drumSteps?: DrumStepEvent[]; // Optional drum step container
}

export interface AudioClip extends BaseClip {
  type: 'audio';
  audioBufferId: string;    // Key in audio storage / memory cache
  durationSeconds: number;  // Original buffer duration in seconds
  offsetSeconds: number;    // Start offset within the sample
  gain: number;             // Linear gain (1.0 = 0dB)
  fadeInTicks: number;      // Fade in length
  fadeOutTicks: number;     // Fade out length
  peaks?: number[];         // Pre-calculated normalized peak amplitudes for waveform drawing (0.0 - 1.0)
}

export type TimelineClip = MidiClip | AudioClip;

export type FxType = 'eq4' | 'compressor' | 'delay' | 'reverb' | 'bitcrusher' | 'filter' | 'limiter';

export interface Eq4Params {
  lowGain: number;       // dB (-18 to +18)
  lowFreq: number;       // Hz (30 to 500)
  mid1Gain: number;      // dB (-18 to +18)
  mid1Freq: number;      // Hz (200 to 4000)
  mid1Q: number;         // Q (0.1 to 10)
  mid2Gain: number;      // dB (-18 to +18)
  mid2Freq: number;      // Hz (1000 to 12000)
  mid2Q: number;         // Q (0.1 to 10)
  highGain: number;      // dB (-18 to +18)
  highFreq: number;      // Hz (3000 to 18000)
}

export interface CompressorParams {
  threshold: number;     // dB (-60 to 0)
  ratio: number;         // 1 to 20
  attack: number;        // seconds (0.001 to 0.5)
  release: number;       // seconds (0.01 to 1.0)
  knee: number;          // dB (0 to 40)
  makeupGain: number;    // dB (0 to 24)
}

export interface DelayParams {
  time: string;          // '8n', '16n', '8t'
  feedback: number;      // 0.0 to 0.95
  wet: number;           // 0.0 to 1.0
  pingPong: boolean;
}

export interface ReverbParams {
  roomSize: number;      // 0.0 to 0.98
  dampening: number;     // Hz (200 to 10000)
  wet: number;           // 0.0 to 1.0
  preDelay: number;      // seconds (0 to 0.1)
}

export interface BitcrusherParams {
  bits: number;          // 1 to 16
  downsample: number;    // 1 to 16
  wet: number;           // 0.0 to 1.0
}

export interface FilterParams {
  type: 'lowpass' | 'highpass' | 'bandpass';
  cutoff: number;        // Hz (20 to 20000)
  resonance: number;     // 0 to 20
}

export interface FxDevice {
  id: string;
  name: string;
  type: FxType;
  enabled: boolean;
  params: Eq4Params | CompressorParams | DelayParams | ReverbParams | BitcrusherParams | FilterParams | Record<string, any>;
}

export interface SubtractiveSynthParams {
  osc1Type: WaveformType;
  osc2Type: WaveformType;
  osc2Detune: number;    // cents (-1200 to +1200)
  osc2Mix: number;       // 0.0 to 1.0 (balance between osc1 and osc2)
  subOscGain: number;    // 0.0 to 1.0 (sub-octave sine/square)
  filterType: 'lowpass' | 'highpass' | 'bandpass';
  filterCutoff: number;  // 50 to 18000 Hz
  filterResonance: number; // 0 to 15
  filterEnvAmount: number; // -1.0 to 1.0
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  lfoRate: number;       // Hz (0.1 to 20)
  lfoAmount: number;     // 0.0 to 1.0
  lfoTarget: 'pitch' | 'filter' | 'pwm';
}

export interface InstrumentConfig {
  type: 'poly-synth' | 'chiptune' | 'sampler' | 'drum_rack';
  presetName: string;
  subtractive?: SubtractiveSynthParams;
  samplePreset?: SamplePresetId;
  waveform?: WaveformType;
  octaveOffset: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number;        // dB (-60 to +6)
  pan: number;           // -1.0 to +1.0
  muted: boolean;
  solo: boolean;
  armed: boolean;        // Record arm flag
  instrument: InstrumentConfig;
  fxChain: FxDevice[];
  sends: {
    sendA: number;       // Reverb bus send dB (-60 to +6)
    sendB: number;       // Delay bus send dB (-60 to +6)
  };
  clips: TimelineClip[];
}

export interface AuxBusTrack {
  id: 'bus-a' | 'bus-b';
  name: string;
  type: 'bus';
  color: string;
  volume: number;        // dB
  pan: number;
  fxChain: FxDevice[];
}

export interface MasterTrackConfig {
  volume: number;        // dB (-60 to +6)
  fxChain: FxDevice[];
  limiterCeiling: number;// dB (-0.1 to -1.0)
}

export interface LoopRegion {
  enabled: boolean;
  startTick: number;
  endTick: number;
}

export interface DawProject {
  version: 3;
  id: string;
  name: string;
  tempo: number;         // 40 to 240 BPM
  timeSignature: [number, number]; // [beatsPerBar, beatValue] e.g. [4, 4], [3, 4]
  ppq: number;           // Pulses Per Quarter note = 192
  activeScale: ScaleId;
  tracks: TimelineTrack[];
  buses: AuxBusTrack[];
  masterTrack: MasterTrackConfig;
  loopRegion: LoopRegion;
}

export type DawActiveDockTab = 'piano-roll' | 'mixer' | 'devices' | 'browser' | 'step-sequencer';
