import * as Tone from 'tone';
import type { DawProject, TimelineTrack, MidiClip, AudioClip } from '../types/daw';
import { ticksToSeconds } from './timeUtils';
import { getFreqForNote } from './tuningEngine';
import { hybridSampleEngine } from './sampleEngine';
import { PolySubtractiveSynth } from './dsp/subtractiveSynth';
import { audioBufferCache } from './audioRecorder';
import { audioBufferToWav } from './wavEncoder';

export interface StemRenderProgress {
  trackName: string;
  trackIndex: number;
  totalTracks: number;
  progress: number;
}

/**
 * Renders the entire DAW arrangement or individual stems offline
 */
export async function renderDawOffline(
  project: DawProject,
  options: {
    soloTrackId?: string; // If set, only renders this track (for stems)
    onProgress?: (progress: number) => void;
  } = {}
): Promise<Blob> {
  const tempo = project.tempo;
  // Calculate total project length in ticks
  let maxTick = project.loopRegion.enabled ? project.loopRegion.endTick : 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startTick + clip.durationTicks;
      if (clipEnd > maxTick) maxTick = clipEnd;
    }
  }

  const durationSeconds = Math.max(2, ticksToSeconds(maxTick, tempo) + 1.5); // +1.5s tail
  const sampleRate = 44100;

  const renderedBuffer = await Tone.Offline(async (ctx) => {
    const rawCtx = ctx.rawContext as AudioContext;
    await hybridSampleEngine.init(rawCtx);
    const masterGain = new Tone.Gain(Math.pow(10, project.masterTrack.volume / 20)).toDestination();

    // Reverb Bus
    const reverbBus = new Tone.Freeverb({ roomSize: 0.8, dampening: 2500 });
    reverbBus.connect(masterGain);

    // Active tracks
    const targetTracks = options.soloTrackId
      ? project.tracks.filter((t) => t.id === options.soloTrackId)
      : project.tracks.filter((t) => !t.muted);

    for (const track of targetTracks) {
      const trackGain = new Tone.Gain(Math.pow(10, track.volume / 20));
      const panner = new Tone.Panner(track.pan);
      trackGain.connect(panner);
      panner.connect(masterGain);

      // Reverb Send
      if (track.sends?.sendA > -50) {
        const sendAGain = new Tone.Gain(Math.pow(10, track.sends.sendA / 20));
        trackGain.connect(sendAGain);
        sendAGain.connect(reverbBus);
      }

      // Schedule clips
      for (const clip of track.clips) {
        if (clip.type === 'midi') {
          const midiClip = clip as MidiClip;
          // Instruments
          let polySynth: PolySubtractiveSynth | null = null;
          let chipSynth: Tone.Synth | null = null;
          let kick: Tone.MembraneSynth | null = null;
          let snare: Tone.NoiseSynth | null = null;
          let hihat: Tone.NoiseSynth | null = null;

          if (track.instrument.type === 'poly-synth') {
            polySynth = new PolySubtractiveSynth(track.instrument.subtractive);
            polySynth.output.connect(trackGain);
          } else if (track.type === 'drum_rack') {
            kick = new Tone.MembraneSynth();
            snare = new Tone.NoiseSynth();
            hihat = new Tone.NoiseSynth();
            kick.connect(trackGain);
            snare.connect(trackGain);
            hihat.connect(trackGain);
          } else {
            chipSynth = new Tone.Synth({
              oscillator: { type: track.instrument.waveform || 'square' },
            });
            chipSynth.connect(trackGain);
          }

          // Schedule notes
          for (const note of midiClip.notes) {
            const absoluteTick = clip.startTick + note.startTick;
            const noteSeconds = ticksToSeconds(absoluteTick, tempo);
            const duration = ticksToSeconds(note.durationTicks, tempo);
            const freq = note.freq || getFreqForNote(note.pitch, project.activeScale);

            if (polySynth) {
              polySynth.triggerAttack(freq, note.velocity, noteSeconds);
              Tone.getTransport().scheduleOnce(() => {
                polySynth?.triggerRelease(freq);
              }, noteSeconds + duration);
            } else if (chipSynth) {
              chipSynth.triggerAttackRelease(freq, duration, noteSeconds, note.velocity);
            }
          }

          // Schedule drum steps
          if (midiClip.drumSteps) {
            for (const step of midiClip.drumSteps) {
              const sec = ticksToSeconds(clip.startTick + step.tick, tempo);
              if (step.kick && kick) kick.triggerAttackRelease('C1', '8n', sec, step.velocity);
              if (step.snare && snare) snare.triggerAttackRelease('16n', sec, step.velocity);
              if (step.hihat_closed && hihat) hihat.triggerAttackRelease('32n', sec, step.velocity * 0.7);
            }
          }
        } else if (clip.type === 'audio') {
          const audioClip = clip as AudioClip;
          const clipStartSec = ticksToSeconds(audioClip.startTick, tempo);
          const clipDurSec = ticksToSeconds(audioClip.durationTicks, tempo);
          const buf = audioBufferCache.get(audioClip.audioBufferId);
          if (buf) {
            const bufferSource = new Tone.ToneBufferSource(buf);
            const clipGain = new Tone.Gain(audioClip.gain);
            bufferSource.connect(clipGain);
            clipGain.connect(trackGain);
            bufferSource.start(clipStartSec, audioClip.offsetSeconds, clipDurSec);
          }
        }
      }
    }
  }, durationSeconds);

  const nativeBuffer = renderedBuffer.get() as AudioBuffer;
  return audioBufferToWav(nativeBuffer);
}

/**
 * Renders all tracks as isolated stem WAV files
 */
export async function renderAllStems(
  project: DawProject,
  onStemProgress?: (status: StemRenderProgress) => void
): Promise<Map<string, Blob>> {
  const stems = new Map<string, Blob>();
  const total = project.tracks.length;

  for (let i = 0; i < total; i++) {
    const track = project.tracks[i];
    onStemProgress?.({
      trackName: track.name,
      trackIndex: i + 1,
      totalTracks: total,
      progress: (i / total) * 100,
    });

    const stemBlob = await renderDawOffline(project, { soloTrackId: track.id });
    stems.set(`${track.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_stem.wav`, stemBlob);
  }

  return stems;
}
