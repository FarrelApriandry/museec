import * as Tone from 'tone';
import type { SongProject, StepModifier } from '../types/sequencer';
import type { DawProject, TimelineTrack, MidiClip, NoteEvent, DrumStepEvent, AudioClip } from '../types/daw';
import { PPQ } from './timeUtils';
import { getFreqForNote } from './tuningEngine';
import { audioBufferCache, extractAudioPeaks } from './audioRecorder';

/**
 * Creates a synthetic ambient river/rain audio buffer for demo audio tracks
 */
export function createSyntheticAmbientBuffer(): string {
  const bufferId = 'buf-demo-rain-river';
  if (audioBufferCache.has(bufferId)) return bufferId;

  if (typeof window === 'undefined') return bufferId;
  const rawCtx = (Tone?.getContext?.()?.rawContext as AudioContext) || new (window.AudioContext || (window as any).webkitAudioContext)();
  const sampleRate = rawCtx.sampleRate || 44100;
  const duration = 16.0; // 16 seconds loop
  const buffer = rawCtx.createBuffer(2, Math.floor(sampleRate * duration), sampleRate);

  // Pink noise + gentle lowpass filtered river stream
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      const pink = (b0 + b1 + b2 + white * 0.1848) * 0.05;
      // Gentle stereo phase drift
      data[i] = pink * Math.sin((i / (sampleRate * 2.5)) + ch);
    }
  }

  audioBufferCache.set(bufferId, buffer);
  return bufferId;
}

/**
 * Converts a v2 step-sequencer SongProject into a v3 multi-track timeline DawProject
 */
export function convertSongProjectToDaw(song: SongProject): DawProject {
  const ppq = PPQ; // 192 ticks per quarter note
  const ticksPerStep = ppq / 4; // 16th note = 48 ticks

  const chain = song.patternChain && song.patternChain.length > 0
    ? song.patternChain
    : [song.activePatternId || Object.keys(song.patterns)[0]];

  // 1. Create tracks based on v2 track definitions
  const samplePattern = song.patterns[chain[0]] || Object.values(song.patterns)[0];

  const tracks: TimelineTrack[] = samplePattern.tracks.map((v2Track, trackIdx) => {
    const isDrums = v2Track.type === 'drums';
    const trackColor = v2Track.color || (isDrums ? '#f59e0b' : '#38bdf8');

    const timelineTrack: TimelineTrack = {
      id: v2Track.id,
      name: v2Track.name,
      type: isDrums ? 'drum_rack' : 'midi',
      color: trackColor,
      volume: v2Track.volume,
      pan: v2Track.pan,
      muted: v2Track.muted,
      solo: v2Track.solo,
      armed: trackIdx === 0,
      instrument: {
        type: isDrums ? 'drum_rack' : (v2Track.instrumentMode === 'sampler' ? 'sampler' : 'chiptune'),
        presetName: v2Track.samplePreset || v2Track.waveform,
        samplePreset: v2Track.samplePreset,
        waveform: v2Track.waveform,
        octaveOffset: v2Track.octaveOffset || 0,
      },
      fxChain: [
        {
          id: `fx-eq-${v2Track.id}`,
          name: '4-Band EQ',
          type: 'eq4',
          enabled: true,
          params: {
            lowGain: 0,
            lowFreq: 100,
            mid1Gain: 0,
            mid1Freq: 800,
            mid1Q: 1,
            mid2Gain: 0,
            mid2Freq: 3000,
            mid2Q: 1,
            highGain: 0,
            highFreq: 10000,
          },
        },
      ],
      sends: {
        sendA: -12, // Reverb send
        sendB: -18, // Delay send
      },
      clips: [],
    };

    return timelineTrack;
  });

  // 2. Add Polyphonic Subtractive Synth Track for warm background pad
  const polyTrack: TimelineTrack = {
    id: 'track-poly-pad',
    name: 'Lo-Fi Atmospheric Pad',
    type: 'midi',
    color: '#a855f7', // Purple
    volume: -6,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    instrument: {
      type: 'poly-synth',
      presetName: 'Deep Mataram Pad',
      octaveOffset: 0,
      subtractive: {
        osc1Type: 'sawtooth',
        osc2Type: 'square',
        osc2Detune: 8,
        osc2Mix: 0.4,
        subOscGain: 0.3,
        filterType: 'lowpass',
        filterCutoff: 1800,
        filterResonance: 2.5,
        filterEnvAmount: 0.3,
        attack: 0.15,
        decay: 0.5,
        sustain: 0.8,
        release: 0.8,
        lfoRate: 1.2,
        lfoAmount: 0.15,
        lfoTarget: 'filter',
      },
    },
    fxChain: [],
    sends: { sendA: -6, sendB: -14 },
    clips: [],
  };
  tracks.splice(2, 0, polyTrack);

  // 3. Populate MIDI Clips along the timeline for each pattern in the chain
  let currentTimelineTick = 0;

  chain.forEach((patId, chainIdx) => {
    const pat = song.patterns[patId] || samplePattern;
    const patStepCount = pat.stepCount || 16;
    const clipDurationTicks = patStepCount * ticksPerStep;

    pat.tracks.forEach((patTrack) => {
      const targetTrack = tracks.find((t) => t.id === patTrack.id);
      if (!targetTrack) return;

      if (patTrack.type === 'drums') {
        // Build Drum Step Clip
        const drumSteps: DrumStepEvent[] = [];
        patTrack.steps.forEach((step, sIdx) => {
          if (step.active && step.drumSounds) {
            drumSteps.push({
              tick: sIdx * ticksPerStep,
              kick: !!step.drumSounds.kick,
              snare: !!step.drumSounds.snare,
              hihat_closed: !!step.drumSounds.hihat_closed,
              hihat_open: !!step.drumSounds.hihat_open,
              zap: !!step.drumSounds.zap,
              velocity: step.velocity ?? 0.8,
            });
          }
        });

        const drumClip: MidiClip = {
          id: `clip-${patTrack.id}-${chainIdx}`,
          name: `${pat.name} Beat`,
          type: 'midi',
          trackId: targetTrack.id,
          startTick: currentTimelineTick,
          durationTicks: clipDurationTicks,
          color: targetTrack.color,
          notes: [],
          drumSteps,
        };
        targetTrack.clips.push(drumClip);
      } else {
        // Build Melodic Note Clip
        const notes: NoteEvent[] = [];
        patTrack.steps.forEach((step, sIdx) => {
          if (step.active) {
            const noteStartTick = sIdx * ticksPerStep;
            const gateLength = Math.max(0.2, step.gate ?? 0.6);
            const durationTicks = Math.round(ticksPerStep * gateLength);
            const freq = step.freq || getFreqForNote(step.note, song.activeScale);

            notes.push({
              id: `note-${chainIdx}-${patTrack.id}-${sIdx}`,
              pitch: step.note,
              freq,
              startTick: noteStartTick,
              durationTicks,
              velocity: step.velocity ?? 0.8,
              microTiming: step.microTiming ?? 0,
              glide: step.glide ?? false,
            });
          }
        });

        const clip: MidiClip = {
          id: `clip-${patTrack.id}-${chainIdx}`,
          name: `${pat.name}`,
          type: 'midi',
          trackId: targetTrack.id,
          startTick: currentTimelineTick,
          durationTicks: clipDurationTicks,
          color: targetTrack.color,
          notes,
        };
        targetTrack.clips.push(clip);
      }
    });

    // Populate chords/pads for the Polyphonic Subtractive track
    const padNotes: NoteEvent[] = [
      {
        id: `pad-1-${chainIdx}`,
        pitch: 'PL1-3',
        freq: 262,
        startTick: 0,
        durationTicks: clipDurationTicks - 24,
        velocity: 0.65,
      },
      {
        id: `pad-2-${chainIdx}`,
        pitch: 'PL3-3',
        freq: 330,
        startTick: 0,
        durationTicks: clipDurationTicks - 24,
        velocity: 0.6,
      },
      {
        id: `pad-3-${chainIdx}`,
        pitch: 'PL5-3',
        freq: 392,
        startTick: 0,
        durationTicks: clipDurationTicks - 24,
        velocity: 0.6,
      },
    ];

    polyTrack.clips.push({
      id: `clip-poly-${chainIdx}`,
      name: `${pat.name} Sustained Pad`,
      type: 'midi',
      trackId: polyTrack.id,
      startTick: currentTimelineTick,
      durationTicks: clipDurationTicks,
      color: polyTrack.color,
      notes: padNotes,
    });

    currentTimelineTick += clipDurationTicks;
  });

  // 4. Add Ambient Audio Track (Full Audio Clip support!)
  const audioBufferId = createSyntheticAmbientBuffer();
  const audioTrack: TimelineTrack = {
    id: 'track-audio-ambient',
    name: '🌿 Rainforest Stream Ambience',
    type: 'audio',
    color: '#10b981', // Emerald green
    volume: -14,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    instrument: {
      type: 'sampler',
      presetName: 'Stream & Rain',
      octaveOffset: 0,
    },
    fxChain: [],
    sends: { sendA: -10, sendB: -20 },
    clips: [
      {
        id: 'clip-audio-stream-1',
        name: 'Stream Texture (WAV)',
        type: 'audio',
        trackId: 'track-audio-ambient',
        startTick: 0,
        durationTicks: currentTimelineTick,
        audioBufferId,
        durationSeconds: 16,
        offsetSeconds: 0,
        gain: 1.0,
        fadeInTicks: 96,
        fadeOutTicks: 96,
        peaks: Array.from({ length: 120 }, (_, i) => 0.15 + 0.3 * Math.abs(Math.sin(i * 0.2))),
        color: '#10b981',
      },
    ],
  };
  tracks.push(audioTrack);

  const totalLengthTicks = Math.max(currentTimelineTick, ppq * 16); // At least 4 bars

  return {
    version: 3,
    id: `daw-${song.id}`,
    name: song.name,
    tempo: song.tempo || 95,
    timeSignature: [4, 4],
    ppq,
    activeScale: song.activeScale || 'pelog',
    tracks,
    buses: [
      {
        id: 'bus-a',
        name: 'Bus A (Reverb)',
        type: 'bus',
        color: '#6366f1',
        volume: 0,
        pan: 0,
        fxChain: [],
      },
      {
        id: 'bus-b',
        name: 'Bus B (Delay)',
        type: 'bus',
        color: '#ec4899',
        volume: 0,
        pan: 0,
        fxChain: [],
      },
    ],
    masterTrack: {
      volume: 0,
      fxChain: [],
      limiterCeiling: -0.2,
    },
    loopRegion: {
      enabled: true,
      startTick: 0,
      endTick: totalLengthTicks,
    },
  };
}
