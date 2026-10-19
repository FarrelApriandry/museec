import * as Tone from 'tone';
import type {
  DawProject,
  TimelineTrack,
  TimelineClip,
  MidiClip,
  AudioClip,
  NoteEvent,
  FxDevice,
  Eq4Params,
  CompressorParams,
  DelayParams,
  ReverbParams,
  BitcrusherParams,
  FilterParams,
} from '../types/daw';
import { PPQ, ticksToSeconds, secondsToTicks } from './timeUtils';
import { getFreqForNote } from './tuningEngine';
import { hybridSampleEngine } from './sampleEngine';
import { PolySubtractiveSynth } from './dsp/subtractiveSynth';
import { ParametricEqNode } from './dsp/parametricEq';
import { DynamicCompressorNode } from './dsp/compressorNode';
import { audioBufferCache } from './audioRecorder';

export type DawPlayheadCallback = (currentTick: number, currentSeconds: number) => void;

interface TrackNodes {
  inputNode: Tone.Gain;
  pannerNode: Tone.Panner;
  gainNode: Tone.Gain;
  sendAGain: Tone.Gain;
  sendBGain: Tone.Gain;
  fxNodes: Map<string, any>;
  polySynth?: PolySubtractiveSynth;
  chipSynth?: Tone.Synth;
  drumKick?: Tone.MembraneSynth;
  drumSnare?: Tone.NoiseSynth;
  drumHiHatClosed?: Tone.NoiseSynth;
  drumHiHatOpen?: Tone.NoiseSynth;
  drumZap?: Tone.Synth;
}

export class DawAudioEngine {
  private isInitialized = false;
  private isPlaying = false;
  private currentTick = 0;
  private transportEventId: number | null = null;
  private meterInterval: any = null;
  private playheadSubscribers: Set<DawPlayheadCallback> = new Set();
  private project: DawProject | null = null;

  // Master Nodes (clean Web Audio / Tone gain path)
  private masterGain!: Tone.Gain;
  private masterAnalyser!: AnalyserNode;

  // Aux Return Busses (Reverb & Delay)
  private busAReverb!: Tone.Freeverb;
  private busBDelay!: Tone.FeedbackDelay;
  private busAGain!: Tone.Gain;
  private busBGain!: Tone.Gain;

  // Dynamic Tracks
  private trackNodeMap: Map<string, TrackNodes> = new Map();

  // Scheduled audio buffer source nodes for clips
  private activeAudioSources: any[] = [];

  public async init(): Promise<void> {
    console.log('%c[DawAudioEngine] init() called, isInitialized:', 'color: #38bdf8;', this.isInitialized);
    if (this.isInitialized) {
      if (Tone.getContext().state !== 'running') {
        console.log('[DawAudioEngine] AudioContext not running (' + Tone.getContext().state + '), calling Tone.start()...');
        await Tone.start();
        const raw = Tone.getContext().rawContext as AudioContext;
        if (raw?.state === 'suspended') await raw.resume();
        console.log('[DawAudioEngine] AudioContext state after start:', Tone.getContext().state);
      }
      return;
    }

    console.log('[DawAudioEngine] Starting Tone.js AudioContext...');
    await Tone.start();
    const ctx = Tone.getContext();
    const rawCtx = ctx.rawContext as AudioContext;
    if (rawCtx?.state === 'suspended') {
      await rawCtx.resume();
    }
    console.log('[DawAudioEngine] AudioContext active, sampleRate:', rawCtx?.sampleRate, 'state:', rawCtx?.state);

    // Unmute Tone Destination explicitly
    try {
      Tone.getDestination().mute = false;
      Tone.getDestination().volume.value = 0;
    } catch {}

    // 1. Master Output Chain (clean Gain to both Tone Destination and Raw WebAudio Destination)
    this.masterGain = new Tone.Gain(1);
    this.masterGain.toDestination();
    try {
      const masterNative = this.masterGain.output as unknown as AudioNode;
      if (masterNative && rawCtx?.destination) {
        masterNative.connect(rawCtx.destination);
      }
    } catch (e) {
      console.warn('[DawAudioEngine] Direct native destination connection note:', e);
    }

    // Native Analyser for 60fps Visualizer & Metering
    this.masterAnalyser = rawCtx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    try {
      const masterNativeInput = this.masterGain.input as unknown as AudioNode;
      masterNativeInput.connect(this.masterAnalyser);
    } catch {}

    // 2. Aux Return Bus A (Reverb)
    this.busAReverb = new Tone.Freeverb({ roomSize: 0.8, dampening: 2500 });
    this.busAGain = new Tone.Gain(0.7);
    this.busAReverb.connect(this.busAGain);
    this.busAGain.connect(this.masterGain);

    // 3. Aux Return Bus B (Delay)
    this.busBDelay = new Tone.FeedbackDelay('8n', 0.3);
    this.busBGain = new Tone.Gain(0.5);
    this.busBDelay.connect(this.busBGain);
    this.busBGain.connect(this.masterGain);

    // Tone.Transport setup
    Tone.getTransport().PPQ = PPQ;

    // 4. Initialize procedural Gamelan / Traditional instruments
    console.log('[DawAudioEngine] Initializing procedural acoustic Gamelan instruments...');
    await hybridSampleEngine.init(rawCtx);

    this.isInitialized = true;
    console.log('%c[DawAudioEngine] init() completed successfully!', 'color: #10b981;');

    if (this.project) {
      console.log('[DawAudioEngine] Wiring up initial project after init()...');
      this.loadProject(this.project);
    }
  }

  public loadProject(project: DawProject): void {
    this.project = project;
    console.log('[DawAudioEngine] loadProject called:', project.name, 'tempo:', project.tempo, 'tracks:', project.tracks.length);

    if (!this.isInitialized) {
      console.log('[DawAudioEngine] Engine not yet initialized; project will be fully wired on init()');
      return;
    }

    Tone.getTransport().bpm.value = project.tempo;

    // Configure loop region
    if (project.loopRegion.enabled) {
      Tone.getTransport().loop = true;
      Tone.getTransport().loopStart = `${ticksToSeconds(project.loopRegion.startTick, project.tempo)}s`;
      Tone.getTransport().loopEnd = `${ticksToSeconds(project.loopRegion.endTick, project.tempo)}s`;
    } else {
      Tone.getTransport().loop = false;
    }

    // Sync master volume
    if (this.masterGain) {
      const masterLinear = Math.pow(10, project.masterTrack.volume / 20);
      this.masterGain.gain.rampTo(masterLinear, 0.02);
    }

    // Sync / instantiate tracks
    const activeTrackIds = new Set(project.tracks.map((t) => t.id));

    // Remove obsolete tracks
    for (const [id, nodes] of this.trackNodeMap.entries()) {
      if (!activeTrackIds.has(id)) {
        this.disposeTrackNodes(nodes);
        this.trackNodeMap.delete(id);
      }
    }

    // Create or update tracks
    for (const track of project.tracks) {
      let nodes = this.trackNodeMap.get(track.id);
      if (!nodes) {
        nodes = this.createTrackNodes(track);
        this.trackNodeMap.set(track.id, nodes);
      }
      this.updateTrackNodes(track, nodes);
    }

    console.log('[DawAudioEngine] Successfully wired up', this.trackNodeMap.size, 'track nodes in audio graph!');
  }

  private createTrackNodes(track: TimelineTrack): TrackNodes {
    const inputNode = new Tone.Gain(1);
    const pannerNode = new Tone.Panner(track.pan);
    const gainNode = new Tone.Gain(Math.pow(10, track.volume / 20));

    const sendAGain = new Tone.Gain(Math.pow(10, (track.sends?.sendA ?? -60) / 20));
    const sendBGain = new Tone.Gain(Math.pow(10, (track.sends?.sendB ?? -60) / 20));

    // Signal Flow:
    // Instruments -> inputNode -> gainNode -> pannerNode -> masterGain -> Destination!
    inputNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.masterGain);

    // Aux Sends
    inputNode.connect(sendAGain);
    sendAGain.connect(this.busAReverb);

    inputNode.connect(sendBGain);
    sendBGain.connect(this.busBDelay);

    const fxNodes = new Map<string, any>();

    // Build instruments based on type
    const nodes: TrackNodes = {
      inputNode,
      pannerNode,
      gainNode,
      sendAGain,
      sendBGain,
      fxNodes,
    };

    if (track.type === 'midi') {
      if (track.instrument.type === 'poly-synth') {
        const polySynth = new PolySubtractiveSynth(track.instrument.subtractive);
        polySynth.output.connect(inputNode);
        nodes.polySynth = polySynth;
      }

      // Always create a chip synth as voice or fallback for melodic / sampler tracks
      const chipSynth = new Tone.Synth({
        oscillator: { type: track.instrument.waveform || 'square' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1 },
      });
      chipSynth.connect(inputNode);
      nodes.chipSynth = chipSynth;
    } else if (track.type === 'drum_rack') {
      const drumKick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4 });
      const drumSnare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.15, sustain: 0 } });
      const drumHiHatClosed = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.04, sustain: 0 } });
      const drumHiHatOpen = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.25, sustain: 0 } });
      const drumZap = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
      });

      drumKick.connect(inputNode);
      drumSnare.connect(inputNode);
      drumHiHatClosed.connect(inputNode);
      drumHiHatOpen.connect(inputNode);
      drumZap.connect(inputNode);

      nodes.drumKick = drumKick;
      nodes.drumSnare = drumSnare;
      nodes.drumHiHatClosed = drumHiHatClosed;
      nodes.drumHiHatOpen = drumHiHatOpen;
      nodes.drumZap = drumZap;
    }

    return nodes;
  }

  private updateTrackNodes(track: TimelineTrack, nodes: TrackNodes): void {
    const anySolo = this.project?.tracks.some((t) => t.solo) ?? false;
    const isMuted = track.muted || (anySolo && !track.solo);

    const targetGain = isMuted ? 0 : Math.pow(10, track.volume / 20);
    nodes.gainNode.gain.rampTo(targetGain, 0.02);
    nodes.pannerNode.pan.rampTo(track.pan, 0.02);

    const sendALinear = Math.pow(10, (track.sends?.sendA ?? -60) / 20);
    const sendBLinear = Math.pow(10, (track.sends?.sendB ?? -60) / 20);
    nodes.sendAGain.gain.rampTo(sendALinear, 0.02);
    nodes.sendBGain.gain.rampTo(sendBLinear, 0.02);

    if (nodes.polySynth && track.instrument.subtractive) {
      nodes.polySynth.updateParams(track.instrument.subtractive);
    }
  }

  private disposeTrackNodes(nodes: TrackNodes): void {
    try {
      nodes.inputNode.dispose();
      nodes.pannerNode.dispose();
      nodes.gainNode.dispose();
      nodes.sendAGain.dispose();
      nodes.sendBGain.dispose();
      nodes.polySynth?.dispose();
      nodes.chipSynth?.dispose();
      nodes.drumKick?.dispose();
      nodes.drumSnare?.dispose();
      nodes.drumHiHatClosed?.dispose();
      nodes.drumHiHatOpen?.dispose();
      nodes.drumZap?.dispose();
      nodes.fxNodes.forEach((fx) => fx.dispose?.());
    } catch {}
  }

  public async play(): Promise<void> {
    console.log('%c[DawAudioEngine] play() called', 'color: #10b981; font-weight: bold;', {
      isPlaying: this.isPlaying,
      currentTick: this.currentTick,
      tracksInMap: this.trackNodeMap.size,
      transportState: Tone.getTransport().state
    });

    await this.init();
    if (this.project && this.trackNodeMap.size === 0) {
      console.log('[DawAudioEngine] Project had 0 track nodes wired; loading now...');
      this.loadProject(this.project);
    }

    if (this.isPlaying) {
      console.log('[DawAudioEngine] Already playing, skipping.');
      return;
    }

    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (rawCtx?.state === 'suspended') {
      await rawCtx.resume();
    }

    // 1. Diagnostics Log: Log every parameter of the Web Audio graph
    const dest = Tone.getDestination() as any;
    console.log('%c[AUDIO DIAGNOSTICS]', 'background: #0f172a; color: #38bdf8; font-weight: bold; padding: 4px; border: 1px solid #38bdf8;', {
      audioContextState: rawCtx?.state,
      audioContextSampleRate: rawCtx?.sampleRate,
      audioContextCurrentTime: rawCtx?.currentTime.toFixed(3),
      toneNow: Tone.now().toFixed(3),
      toneDestinationMute: dest?.mute,
      toneDestinationVolume: dest?.volume?.value,
      masterGainValue: this.masterGain?.gain?.value,
      tracksInMap: this.trackNodeMap.size,
      trackLevels: Array.from(this.trackNodeMap.entries()).map(([id, n]) => ({
        trackId: id,
        gainLinear: n.gainNode.gain.value.toFixed(3),
        pan: n.pannerNode.pan.value.toFixed(2),
      })),
    });

    // 2. Hardware Test Sound 1: Pure native Web Audio oscillator straight to rawCtx.destination
    try {
      const osc = rawCtx.createOscillator();
      const beepGain = rawCtx.createGain();
      beepGain.gain.setValueAtTime(0.35, rawCtx.currentTime);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, rawCtx.currentTime); // 880Hz A5 beep
      osc.connect(beepGain);
      beepGain.connect(rawCtx.destination);
      osc.start(rawCtx.currentTime);
      osc.stop(rawCtx.currentTime + 0.15);
      console.log('%c[DawAudioEngine] 🔔 Sound 1: Native Hardware Beep emitted (880Hz, rawCtx.destination)', 'color: #38bdf8; font-weight: bold;');
    } catch (e) {
      console.error('[DawAudioEngine] Sound 1 error:', e);
    }

    // 3. Hardware Test Sound 2: Tone Synth directly to Tone.getDestination()
    try {
      const directTone = new Tone.Synth().toDestination();
      directTone.volume.value = 0;
      directTone.triggerAttackRelease(523.25, 0.15, Tone.now() + 0.01, 0.9);
      setTimeout(() => directTone.dispose(), 1500);
      console.log('%c[DawAudioEngine] 🎹 Sound 2: Direct Tone.Synth emitted (C5 523Hz, Tone.Destination)', 'color: #f59e0b; font-weight: bold;');
    } catch (e) {
      console.error('[DawAudioEngine] Sound 2 error:', e);
    }

    // 4. Hardware Test Sound 3: Tone Synth through masterGain
    try {
      const masterSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.05 },
      }).connect(this.masterGain);
      masterSynth.volume.value = 0;
      masterSynth.triggerAttackRelease(659.25, 0.15, Tone.now() + 0.02, 0.9);
      setTimeout(() => masterSynth.dispose(), 1500);
      console.log('%c[DawAudioEngine] 🎛️ Sound 3: MasterGain Synth emitted (E5 659Hz, masterGain)', 'color: #a855f7; font-weight: bold;');
    } catch (err) {
      console.warn('[DawAudioEngine] Sound 3 error:', err);
    }

    this.stopAudioSources();
    Tone.getTransport().cancel();

    // Schedule playback lookahead
    this.scheduleTimelineEvents();

    if (this.currentTick === 0) {
      Tone.getTransport().seconds = 0;
    } else {
      Tone.getTransport().seconds = ticksToSeconds(this.currentTick, this.project?.tempo || 120);
    }

    Tone.getTransport().start();
    this.isPlaying = true;
    console.log('%c[DawAudioEngine] Tone.Transport started!', 'color: #10b981; font-weight: bold;', {
      state: Tone.getTransport().state,
      seconds: Tone.getTransport().seconds,
      bpm: Tone.getTransport().bpm.value,
      loop: Tone.getTransport().loop,
    });

    // 5. Periodic VU meter check (inspects master waveform amplitude every second)
    if (this.meterInterval) clearInterval(this.meterInterval);
    this.meterInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const data = new Float32Array(this.masterAnalyser.fftSize);
      this.masterAnalyser.getFloatTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
      }
      console.log(
        `%c[DawAudioEngine VU Meter] Master RMS Peak: ${peak.toFixed(4)}`,
        peak > 0.001 ? 'color: #10b981; font-weight: bold;' : 'color: #ef4444; font-weight: bold;'
      );
    }, 1000);
  }

  public pause(): void {
    console.log('%c[DawAudioEngine] pause() called', 'color: #f59e0b; font-weight: bold;');
    if (this.meterInterval) clearInterval(this.meterInterval);
    Tone.getTransport().pause();
    this.stopAudioSources();
    this.isPlaying = false;
  }

  public stop(): void {
    console.log('%c[DawAudioEngine] stop() called', 'color: #ef4444; font-weight: bold;');
    if (this.meterInterval) clearInterval(this.meterInterval);
    Tone.getTransport().stop();
    this.stopAudioSources();
    this.currentTick = 0;
    this.isPlaying = false;
    this.notifyPlayhead(0, 0);
  }

  public seek(tick: number): void {
    if (!this.project) return;
    this.currentTick = Math.max(0, tick);
    const seconds = ticksToSeconds(this.currentTick, this.project.tempo);
    console.log('[DawAudioEngine] seek to tick:', tick, 'seconds:', seconds.toFixed(2));
    Tone.getTransport().seconds = seconds;
    this.notifyPlayhead(this.currentTick, seconds);
  }

  private scheduleTimelineEvents(): void {
    if (!this.project) return;

    const tempo = this.project.tempo;
    console.log('[DawAudioEngine] scheduleTimelineEvents() started for project:', this.project.name);

    // High frequency tick runner for 60fps playhead tracking
    this.transportEventId = Tone.getTransport().scheduleRepeat((time) => {
      Tone.getDraw().schedule(() => {
        const currentSeconds = Tone.getTransport().seconds;
        const currentTick = secondsToTicks(currentSeconds, tempo);
        this.currentTick = currentTick;
        this.notifyPlayhead(currentTick, currentSeconds);
      }, time);
    }, '64n');

    let totalNotesScheduled = 0;
    let totalDrumsScheduled = 0;
    let totalAudioClipsScheduled = 0;

    // Schedule all clips on the timeline
    for (const track of this.project.tracks) {
      const nodes = this.trackNodeMap.get(track.id);
      if (!nodes) {
        console.warn('[DawAudioEngine] No audio nodes found for track:', track.name, track.id);
        continue;
      }

      for (const clip of track.clips) {
        if (clip.type === 'midi') {
          const midiClip = clip as MidiClip;
          totalNotesScheduled += midiClip.notes?.length || 0;
          totalDrumsScheduled += midiClip.drumSteps?.length || 0;
          this.scheduleMidiClip(midiClip, track, nodes, tempo);
        } else if (clip.type === 'audio') {
          totalAudioClipsScheduled++;
          this.scheduleAudioClip(clip as AudioClip, track, nodes, tempo);
        }
      }
    }

    console.log('[DawAudioEngine] scheduleTimelineEvents() complete:', {
      totalNotesScheduled,
      totalDrumsScheduled,
      totalAudioClipsScheduled,
    });
  }

  private scheduleMidiClip(
    clip: MidiClip,
    track: TimelineTrack,
    nodes: TrackNodes,
    tempo: number
  ): void {
    for (const note of clip.notes) {
      const absoluteTick = clip.startTick + note.startTick;
      const noteSeconds = ticksToSeconds(absoluteTick, tempo);
      const durationSeconds = ticksToSeconds(note.durationTicks, tempo);

      Tone.getTransport().schedule((time) => {
        const scheduledTime = Math.max(Tone.now() + 0.005, time + (note.microTiming || 0) / 1000);
        console.log('[DawAudioEngine] 🎵 EVENT FIRED -> Note:', note.pitch, 'track:', track.name, 'time:', scheduledTime.toFixed(3));
        this.triggerNoteSound(track, nodes, note, scheduledTime, durationSeconds);
      }, Math.max(0, noteSeconds));
    }

    // Schedule drum steps if present
    if (clip.drumSteps) {
      for (const step of clip.drumSteps) {
        const absoluteTick = clip.startTick + step.tick;
        const stepSeconds = ticksToSeconds(absoluteTick, tempo);

        Tone.getTransport().schedule((time) => {
          const scheduledTime = Math.max(Tone.now() + 0.005, time);
          console.log('[DawAudioEngine] 🥁 EVENT FIRED -> Drum step on:', track.name, 'time:', scheduledTime.toFixed(3));
          if (step.kick && nodes.drumKick) nodes.drumKick.triggerAttackRelease('C1', '8n', scheduledTime, step.velocity);
          if (step.snare && nodes.drumSnare) nodes.drumSnare.triggerAttackRelease('16n', scheduledTime, step.velocity);
          if (step.hihat_closed && nodes.drumHiHatClosed) nodes.drumHiHatClosed.triggerAttackRelease('32n', scheduledTime, step.velocity * 0.7);
          if (step.hihat_open && nodes.drumHiHatOpen) nodes.drumHiHatOpen.triggerAttackRelease('8n', scheduledTime, step.velocity * 0.8);
          if (step.zap && nodes.drumZap) nodes.drumZap.triggerAttackRelease('G5', '32n', scheduledTime, step.velocity * 0.6);
        }, Math.max(0, stepSeconds));
      }
    }
  }

  private triggerNoteSound(
    track: TimelineTrack,
    nodes: TrackNodes,
    note: NoteEvent,
    time: number,
    duration: number
  ): void {
    const freq = note.freq || getFreqForNote(this.project?.activeScale || 'pelog', note.pitch);
    console.log('[DawAudioEngine] 🔊 Playing Note:', note.pitch, `${freq.toFixed(1)}Hz`, 'dur:', duration.toFixed(2), 'inst:', track.instrument.type);

    if (track.instrument.type === 'poly-synth' && nodes.polySynth) {
      nodes.polySynth.triggerAttackRelease(freq, duration, time, note.velocity);
    } else if (track.instrument.type === 'sampler' && track.instrument.samplePreset) {
      const played = hybridSampleEngine.triggerSample(
        track.instrument.samplePreset,
        freq,
        duration,
        time,
        note.velocity,
        nodes.inputNode
      );
      if (!played && nodes.chipSynth) {
        console.log('[DawAudioEngine] Sample fallback to chipSynth');
        nodes.chipSynth.triggerAttackRelease(freq, duration, time, note.velocity);
      }
    } else if (nodes.chipSynth) {
      nodes.chipSynth.triggerAttackRelease(freq, duration, time, note.velocity);
    }
  }

  private scheduleAudioClip(
    clip: AudioClip,
    track: TimelineTrack,
    nodes: TrackNodes,
    tempo: number
  ): void {
    const clipStartSeconds = ticksToSeconds(clip.startTick, tempo);
    const clipDurationSeconds = ticksToSeconds(clip.durationTicks, tempo);

    Tone.getTransport().schedule((time) => {
      const buffer = audioBufferCache.get(clip.audioBufferId);
      if (!buffer) return;

      try {
        const bufferSource = new Tone.ToneBufferSource(buffer);
        const clipGain = new Tone.Gain(clip.gain);

        bufferSource.connect(clipGain);
        clipGain.connect(nodes.inputNode);

        if (clip.fadeInTicks > 0) {
          bufferSource.fadeIn = ticksToSeconds(clip.fadeInTicks, tempo);
        }
        if (clip.fadeOutTicks > 0) {
          bufferSource.fadeOut = ticksToSeconds(clip.fadeOutTicks, tempo);
        }

        bufferSource.start(time, clip.offsetSeconds, clipDurationSeconds);
        this.activeAudioSources.push(bufferSource);

        bufferSource.onended = () => {
          try {
            clipGain.dispose();
            bufferSource.dispose();
          } catch {}
          const idx = this.activeAudioSources.indexOf(bufferSource);
          if (idx !== -1) this.activeAudioSources.splice(idx, 1);
        };
      } catch (err) {
        console.warn('Error scheduling audio clip:', err);
      }
    }, `${clipStartSeconds}s`);
  }

  private stopAudioSources(): void {
    for (const source of this.activeAudioSources) {
      try {
        if (typeof source.stop === 'function') source.stop();
        if (typeof source.dispose === 'function') source.dispose();
        else if (typeof source.disconnect === 'function') source.disconnect();
      } catch {
        // Source already stopped
      }
    }
    this.activeAudioSources = [];
  }

  // Real-time auditioning / MIDI trigger for armed track
  public liveNoteOn(trackId: string, freq: number, velocity: number = 0.8): void {
    const nodes = this.trackNodeMap.get(trackId);
    if (!nodes) return;

    if (nodes.polySynth) {
      nodes.polySynth.triggerAttack(freq, velocity);
    } else {
      const track = this.project?.tracks.find((t) => t.id === trackId);
      let played = false;
      if (track?.instrument.samplePreset) {
        played = hybridSampleEngine.triggerSample(
          track.instrument.samplePreset,
          freq,
          1.0,
          Tone.now() + 0.005,
          velocity,
          nodes.inputNode
        );
      }
      if (!played && nodes.chipSynth) {
        nodes.chipSynth.triggerAttack(freq, undefined, velocity);
      }
    }
  }

  public liveNoteOff(trackId: string, freq: number): void {
    const nodes = this.trackNodeMap.get(trackId);
    if (!nodes) return;

    if (nodes.polySynth) {
      nodes.polySynth.triggerRelease(freq);
    } else if (nodes.chipSynth) {
      nodes.chipSynth.triggerRelease();
    }
  }

  public subscribePlayhead(callback: DawPlayheadCallback): () => void {
    this.playheadSubscribers.add(callback);
    return () => {
      this.playheadSubscribers.delete(callback);
    };
  }

  private notifyPlayhead(currentTick: number, currentSeconds: number): void {
    for (const sub of this.playheadSubscribers) {
      sub(currentTick, currentSeconds);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.masterAnalyser || null;
  }

  public get active(): boolean {
    return this.isPlaying;
  }

  public dispose(): void {
    if (this.meterInterval) clearInterval(this.meterInterval);
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    this.stopAudioSources();
    this.trackNodeMap.forEach((nodes) => this.disposeTrackNodes(nodes));
    this.trackNodeMap.clear();
    this.playheadSubscribers.clear();
  }
}

export const dawAudioEngine = new DawAudioEngine();
