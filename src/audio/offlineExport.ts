import * as Tone from 'tone';
import type { SongProject, PatternData, StepModifier, TrackData } from '../types/sequencer';
import { audioBufferToWav } from './wavEncoder';
import { getFreqForNote } from './tuningEngine';

export async function renderProjectOffline(
  project: SongProject,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const bpm = project.tempo;
  const sixteenthSec = (60 / bpm) / 4;

  // Determine patterns to render
  const patternList: PatternData[] = [];
  if (project.chainMode && project.patternChain.length > 0) {
    project.patternChain.forEach((pid) => {
      if (project.patterns[pid]) {
        patternList.push(project.patterns[pid]);
      }
    });
  } else {
    // Render 2 loops of the active pattern
    const active = project.patterns[project.activePatternId] || Object.values(project.patterns)[0];
    if (active) {
      patternList.push(active, active);
    }
  }

  if (patternList.length === 0) {
    throw new Error('No patterns available to render.');
  }

  // Calculate total duration in seconds
  let totalSteps = 0;
  patternList.forEach((pat) => {
    totalSteps += pat.stepCount;
  });
  const musicDuration = totalSteps * sixteenthSec;
  const tailDuration = 2.0; // reverb & delay decay tail
  const totalDuration = musicDuration + tailDuration;

  if (onProgress) onProgress(10);

  // Render using Tone.Offline
  const renderedBuffer = await Tone.Offline(async (ctx) => {
    ctx.transport.bpm.value = bpm;
    ctx.transport.swing = project.swing;
    ctx.transport.swingSubdivision = '16n';

    // 1. Master FX Chain in offline context
    const masterGain = new Tone.Gain(0.9).toDestination();

    // Freeverb Reverb
    const reverb = new Tone.Freeverb({
      roomSize: project.masterFx.reverb.roomSize,
      dampening: project.masterFx.reverb.dampening,
    });
    reverb.wet.value = project.masterFx.reverb.enabled ? project.masterFx.reverb.wet : 0;

    // Filter
    const filter = new Tone.Filter({
      frequency: project.masterFx.filter.enabled ? project.masterFx.filter.cutoff : 20000,
      type: 'lowpass',
      rolloff: -12,
    });

    // Delay
    const delay = new Tone.FeedbackDelay(
      project.masterFx.delay.time,
      project.masterFx.delay.feedback
    );
    delay.wet.value = project.masterFx.delay.enabled ? project.masterFx.delay.wet : 0;

    // Bitcrusher
    const bitcrusher = new Tone.BitCrusher(project.masterFx.bitcrusher.bits);
    bitcrusher.wet.value = project.masterFx.bitcrusher.enabled ? 1 : 0;

    // Connect FX chain: bitcrusher -> delay -> filter -> reverb -> masterGain
    bitcrusher.connect(delay);
    delay.connect(filter);
    filter.connect(reverb);
    reverb.connect(masterGain);

    // 2. Synths for the tracks
    const leadSynth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.15 },
    });
    const arpSynth = new Tone.Synth({
      oscillator: { type: 'pulse', width: 0.25 },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.08 },
    });
    const bassSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.015, decay: 0.3, sustain: 0.5, release: 0.2 },
    });

    // Drum Synths
    const kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 },
    });
    const snareNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    });
    const hhFilter = new Tone.Filter(7500, 'highpass');
    const hhClosed = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    }).connect(hhFilter);
    const ohFilter = new Tone.Filter(6500, 'highpass');
    const hhOpen = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0 },
    }).connect(ohFilter);

    // Track Gains
    const leadGain = new Tone.Gain(Tone.dbToGain(0)).connect(bitcrusher);
    const arpGain = new Tone.Gain(Tone.dbToGain(-3)).connect(bitcrusher);
    const bassGain = new Tone.Gain(Tone.dbToGain(0)).connect(bitcrusher);
    const drumGain = new Tone.Gain(Tone.dbToGain(0)).connect(bitcrusher);

    leadSynth.connect(leadGain);
    arpSynth.connect(arpGain);
    bassSynth.connect(bassGain);
    kickSynth.connect(drumGain);
    snareNoise.connect(drumGain);
    hhFilter.connect(drumGain);
    ohFilter.connect(drumGain);

    // 3. Schedule all patterns and steps
    let currentGlobalTime = 0.05;

    patternList.forEach((pat) => {
      // Find tracks
      const leadTrk = pat.tracks.find((t) => t.type === 'lead');
      const arpTrk = pat.tracks.find((t) => t.type === 'arp');
      const bassTrk = pat.tracks.find((t) => t.type === 'bass');
      const drumTrk = pat.tracks.find((t) => t.type === 'drums');

      for (let s = 0; s < pat.stepCount; s++) {
        const stepTime = currentGlobalTime + s * sixteenthSec;

        // Schedule Lead
        if (leadTrk && !leadTrk.muted) {
          const step = leadTrk.steps[s];
          if (step && step.active) {
            const freq = step.freq || getFreqForNote(project.activeScale, step.note);
            const microOffset = (step.microTiming || 0) / 1000;
            const gateTime = sixteenthSec * (step.gate || 0.6);
            leadSynth.triggerAttackRelease(freq, gateTime, stepTime + microOffset, step.velocity || 0.8);
          }
        }

        // Schedule Arp
        if (arpTrk && !arpTrk.muted) {
          const step = arpTrk.steps[s];
          if (step && step.active) {
            const freq = step.freq || getFreqForNote(project.activeScale, step.note);
            const microOffset = (step.microTiming || 0) / 1000;
            const gateTime = sixteenthSec * (step.gate || 0.4);
            arpSynth.triggerAttackRelease(freq, gateTime, stepTime + microOffset, step.velocity || 0.7);
          }
        }

        // Schedule Bass
        if (bassTrk && !bassTrk.muted) {
          const step = bassTrk.steps[s];
          if (step && step.active) {
            const freq = step.freq || getFreqForNote(project.activeScale, step.note);
            const microOffset = (step.microTiming || 0) / 1000;
            const gateTime = sixteenthSec * (step.gate || 0.7);
            bassSynth.triggerAttackRelease(freq, gateTime, stepTime + microOffset, step.velocity || 0.9);
          }
        }

        // Schedule Drums
        if (drumTrk && !drumTrk.muted) {
          const step = drumTrk.steps[s];
          if (step && step.active && step.drumSounds) {
            const microOffset = (step.microTiming || 0) / 1000;
            const vel = step.velocity || 0.9;
            if (step.drumSounds.kick) {
              kickSynth.triggerAttackRelease('C1', '8n', stepTime + microOffset, vel);
            }
            if (step.drumSounds.snare) {
              snareNoise.triggerAttackRelease('16n', stepTime + microOffset, vel * 0.9);
            }
            if (step.drumSounds.hihat_closed) {
              hhClosed.triggerAttackRelease('32n', stepTime + microOffset, vel * 0.7);
            }
            if (step.drumSounds.hihat_open) {
              hhOpen.triggerAttackRelease('8n', stepTime + microOffset, vel * 0.85);
            }
          }
        }
      }

      currentGlobalTime += pat.stepCount * sixteenthSec;
    });
  }, totalDuration);

  if (onProgress) onProgress(80);

  // Convert raw Tone.Offline rendered AudioBuffer to uncompressed 16-bit PCM WAV
  const rawAudioBuffer = renderedBuffer.get() as AudioBuffer;
  const wavBlob = audioBufferToWav(rawAudioBuffer);

  if (onProgress) onProgress(100);

  return wavBlob;
}
