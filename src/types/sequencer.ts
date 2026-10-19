export type WaveformType = 'square' | 'pulse' | 'triangle' | 'sawtooth' | 'sine';

export type DrumSoundType = 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'zap';

export type ScaleId =
  | 'pentatonic-minor'
  | 'dorian'
  | 'chromatic'
  | 'slendro'
  | 'pelog';

export interface ScaleNote {
  label: string;          // Display label e.g. "1. Panunggul" or "C4"
  traditionalName?: string; // e.g. "Ji", "Ro", "Lu", "Ma", "Nem"
  freq: number;           // Absolute frequency in Hz (microtonally accurate)
  centOffset?: number;    // Cent deviation from nearest 12-TET note
  degree: number;         // 1-based scale degree
  octave: number;         // Octave index (e.g. 2, 3, 4, 5)
}

export interface ScaleDefinition {
  id: ScaleId;
  name: string;
  description: string;
  tuningType: '12tet' | 'microtonal';
  notesPerOctave: number;
  baseFrequency: number;
  intervalsCents: number[];
  degreeNames: string[];
}

export type TrackInstrumentMode = 'synth' | 'sampler';

export type SamplePresetId = 'saron' | 'bonang' | 'suling' | 'siter' | 'kendang' | 'none';

export interface EnvelopeSettings {
  attack: number;   // seconds (0.001 to 1.0)
  decay: number;    // seconds (0.01 to 2.0)
  sustain: number;  // level (0.0 to 1.0)
  release: number;  // seconds (0.01 to 2.0)
}

export interface ArpSettings {
  enabled: boolean;
  rate: '1/16' | '1/32' | '1/64' | '60Hz';
  pattern: 'up' | 'up-down' | 'octave' | 'major' | 'minor' | 'fifth';
  octaves: number; // 1 to 3
}

export interface StepModifier {
  active: boolean;
  note: string;           // Display note string e.g. "A4" or "1_Ji"
  freq?: number;          // Exact microtonal frequency in Hz
  velocity: number;       // 0.0 to 1.0 (default 0.8)
  gate: number;           // Note duration fraction (0.1 to 2.0, default 0.6)
  microTiming: number;    // Micro-timing humanization offset in milliseconds (-25ms to +25ms)
  glide: boolean;         // Portamento / pitch glide to next note
  drumSounds?: {
    kick: boolean;
    snare: boolean;
    hihat_closed: boolean;
    hihat_open: boolean;
    zap: boolean;
  };
}

// Backward-compatible alias
export type StepData = StepModifier;

export interface TrackData {
  id: string;
  name: string;
  channelNumber: 1 | 2 | 3 | 4;
  type: 'lead' | 'arp' | 'bass' | 'drums';
  instrumentMode: TrackInstrumentMode;
  samplePreset: SamplePresetId;
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;        // dB (-30 to +6, 0 default)
  pan: number;           // -1 (Left) to +1 (Right)
  waveform: WaveformType;
  pulseWidth?: number;   // for pulse wave (0.125, 0.25, 0.5, 0.75)
  envelope: EnvelopeSettings;
  arp: ArpSettings;
  octaveOffset: number;  // -2 to +2
  steps: StepModifier[];
}

export interface MasterFxSettings {
  bitcrusher: {
    enabled: boolean;
    bits: number;        // 1 to 16 bits (default 8)
    downsample: number;  // sample rate divider (1 to 16, default 2)
  };
  delay: {
    enabled: boolean;
    time: string;        // '8n', '16n', '8t'
    feedback: number;    // 0.0 to 0.9
    wet: number;         // 0.0 to 1.0
  };
  filter: {
    enabled: boolean;
    cutoff: number;      // 200Hz to 16000Hz
    resonance: number;   // 0 to 10
  };
  reverb: {
    enabled: boolean;
    roomSize: number;    // 0.0 to 0.95
    dampening: number;   // 100 to 10000 Hz
    wet: number;         // 0.0 to 1.0
  };
}

export interface AmbientTrackSettings {
  enabled: boolean;
  soundType: 'rain' | 'crickets' | 'river' | 'off';
  volume: number;        // -30 to 0 dB
  filterCutoff: number;  // 500 to 12000 Hz
}

export interface PatternData {
  id: string;            // e.g. "pattern-a", "pattern-b"
  name: string;          // e.g. "Pattern A: Morning Mist"
  stepCount: 16 | 32 | 64;
  tracks: TrackData[];
}

// Legacy alias for single pattern
export interface SongPattern extends PatternData {
  tempo: number;
  swing: number;
  stepsCount: 16;
  masterFx: MasterFxSettings;
}

export interface SongProject {
  version: 2;
  id: string;
  name: string;
  tempo: number;         // 60 to 180 BPM
  swing: number;         // 0 to 1
  activeScale: ScaleId;
  activePatternId: string;
  patternChain: string[]; // e.g. ["pattern-a", "pattern-a", "pattern-b", "pattern-c"]
  chainMode: boolean;    // true = follow patternChain, false = loop activePattern
  patterns: Record<string, PatternData>;
  masterFx: MasterFxSettings;
  ambientTrack: AmbientTrackSettings;
}

export type VisualizerMode = 'waveform' | 'spectrum';

export interface VisualizerData {
  timeData: Float32Array;
  freqData: Uint8Array;
}
