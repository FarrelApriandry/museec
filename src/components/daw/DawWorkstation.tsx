import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import type { DawProject, TimelineTrack, TimelineClip, GridSnapType, ScaleId, DawActiveDockTab, MidiClip, AudioClip } from '../../types/daw';
import { getDemoProject } from '../../data/demoSongs';
import { convertSongProjectToDaw } from '../../audio/projectConverter';
import { dawAudioEngine } from '../../audio/dawAudioEngine';
import { PPQ, snapTickToGrid, ticksToBarBeatTick, formatTimeSeconds } from '../../audio/timeUtils';
import { audioRecorder } from '../../audio/audioRecorder';
import { webMidiManager, midiNumberToFrequency } from '../../audio/midiEngine';
import { renderDawOffline, renderAllStems } from '../../audio/dawStemExporter';

import { TransportHeader } from './TransportHeader';
import { ArrangementTimeline } from './ArrangementTimeline';
import { PianoRollEditor } from './PianoRollEditor';
import { MixerConsole } from './MixerConsole';
import { DeviceRack } from './DeviceRack';
import { StepSequencerView } from './StepSequencerView';

export default function DawWorkstation() {
  // 1. Root DAW Project State (Initialized with full arrangement demo)
  const [project, setProject] = useState<DawProject>(() => {
    const demo = getDemoProject('mataram-slow-living');
    return convertSongProjectToDaw(demo);
  });

  // 2. Playback & Recording States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [gridSnap, setGridSnap] = useState<GridSnapType>('1/16');

  // 3. Selection States
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('track-1');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeDockTab, setActiveDockTab] = useState<DawActiveDockTab>('piano-roll');

  // Export / Progress State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Hidden File Input for JSON import
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ref to track project in callbacks
  const projectRef = useRef<DawProject>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Active track & clip helpers
  const selectedTrack = project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0] || null;
  const selectedClip = selectedTrack?.clips.find((c) => c.id === selectedClipId) || selectedTrack?.clips[0] || null;

  // 4. Initialize Audio Engine & High-Performance 60fps Playhead Subscriber
  useEffect(() => {
    dawAudioEngine.loadProject(project);

    // Fast 60fps Playhead updater: Directly manipulates DOM transforms and text content
    const unsubscribePlayhead = dawAudioEngine.subscribePlayhead((tick, seconds) => {
      // 1. Update playhead line position
      const playheadEl = document.getElementById('daw-playhead-line');
      if (playheadEl) {
        // Calculate px offset based on current zoom (default ~0.35px/tick)
        // Note: ArrangementTimeline reads transform
        const px = tick * 0.35;
        playheadEl.style.transform = `translateX(${px}px)`;
      }

      // 2. Update LCD Bar / Beat counter
      const barEl = document.getElementById('daw-lcd-bar');
      if (barEl) {
        const { formatted } = ticksToBarBeatTick(tick, projectRef.current.timeSignature);
        barEl.textContent = formatted;
      }

      // 3. Update LCD Time display
      const timeEl = document.getElementById('daw-lcd-time');
      if (timeEl) {
        timeEl.textContent = formatTimeSeconds(seconds);
      }
    });

    // Initialize Web MIDI Access
    webMidiManager.init().then((supported) => {
      if (supported) {
        console.log('Web MIDI Initialized! Connected devices:', webMidiManager.getDevices());
      }
    });

    // Listen to hardware MIDI keyboard events and route to record-armed track
    const unsubscribeMidi = webMidiManager.subscribe((event) => {
      const armedTrack = projectRef.current.tracks.find((t) => t.armed) || projectRef.current.tracks[0];
      if (!armedTrack) return;

      const freq = midiNumberToFrequency(event.noteNumber);
      if (event.type === 'noteon') {
        dawAudioEngine.liveNoteOn(armedTrack.id, freq, event.velocity);
      } else {
        dawAudioEngine.liveNoteOff(armedTrack.id, freq);
      }
    });

    return () => {
      unsubscribePlayhead();
      unsubscribeMidi();
    };
  }, []);

  // Synchronously resume AudioContext on user gesture for Chromium/Brave
  useEffect(() => {
    const resumeAudio = async () => {
      if (Tone.getContext().state !== 'running') {
        console.log('[DawWorkstation] Resuming AudioContext on user gesture...');
        await Tone.start();
        const raw = Tone.getContext().rawContext as AudioContext;
        if (raw?.state === 'suspended') await raw.resume();
      }
    };
    window.addEventListener('pointerdown', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    return () => {
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, []);

  // Update audio engine whenever project settings change
  useEffect(() => {
    dawAudioEngine.loadProject(project);
  }, [project]);

  // 5. Transport Controls
  const handlePlay = async () => {
    console.log('%c[DawWorkstation] handlePlay() called', 'color: #10b981; font-weight: bold;');
    try {
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
        const raw = Tone.getContext().rawContext as AudioContext;
        if (raw?.state === 'suspended') await raw.resume();
      }
      await dawAudioEngine.play();
      setIsPlaying(true);
      console.log('%c[DawWorkstation] Playback started successfully, isPlaying=true', 'color: #10b981;');
    } catch (err) {
      console.error('[DawWorkstation] Error starting playback:', err);
    }
  };

  const handlePause = () => {
    console.log('%c[DawWorkstation] handlePause() called', 'color: #f59e0b; font-weight: bold;');
    dawAudioEngine.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    console.log('%c[DawWorkstation] handleStop() called', 'color: #ef4444; font-weight: bold;');
    dawAudioEngine.stop();
    setIsPlaying(false);
  };

  const handleSeek = (tick: number) => {
    console.log('[DawWorkstation] handleSeek() tick:', tick);
    dawAudioEngine.seek(tick);
  };

  const handleLoopToggle = () => {
    setProject((prev) => ({
      ...prev,
      loopRegion: {
        ...prev.loopRegion,
        enabled: !prev.loopRegion.enabled,
      },
    }));
  };

  // 6. Live Microphone Recording into Audio Track
  const handleRecordToggle = async () => {
    if (!isRecording) {
      try {
        await audioRecorder.start();
        setIsRecording(true);
        if (!isPlaying) await handlePlay();
      } catch (err: any) {
        alert(err.message || 'Microphone access failed');
      }
    } else {
      // Find armed track or create audio track
      let targetTrack = project.tracks.find((t) => t.armed && t.type === 'audio');
      if (!targetTrack) {
        targetTrack = project.tracks.find((t) => t.type === 'audio') || project.tracks[0];
      }

      const ticksPerSec = (PPQ * project.tempo) / 60;
      const audioClip = await audioRecorder.stop(targetTrack.id, 0, ticksPerSec);

      setIsRecording(false);

      if (audioClip) {
        setProject((prev) => ({
          ...prev,
          tracks: prev.tracks.map((t) =>
            t.id === targetTrack.id ? { ...t, clips: [...t.clips, audioClip] } : t
          ),
        }));
        setSelectedTrackId(targetTrack.id);
        setSelectedClipId(audioClip.id);
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) handlePause();
        else handlePlay();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleRecordToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording]);

  // 7. Add Track Handler
  const handleAddTrack = (type: 'midi' | 'audio' | 'drum_rack') => {
    const trackCount = project.tracks.length + 1;
    const colors = ['#38bdf8', '#34d399', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
    const trackColor = colors[trackCount % colors.length];

    const newTrack: TimelineTrack = {
      id: `track-${Date.now()}`,
      name:
        type === 'audio'
          ? `Audio Track ${trackCount}`
          : type === 'drum_rack'
          ? `Drums ${trackCount}`
          : `Synth ${trackCount}`,
      type,
      color: trackColor,
      volume: 0,
      pan: 0,
      muted: false,
      solo: false,
      armed: false,
      instrument: {
        type: type === 'audio' ? 'sampler' : type === 'drum_rack' ? 'drum_rack' : 'poly-synth',
        presetName: type === 'poly-synth' ? 'Warm Poly Lead' : 'Default',
        octaveOffset: 0,
        subtractive:
          type === 'poly-synth'
            ? {
                osc1Type: 'sawtooth',
                osc2Type: 'square',
                osc2Detune: 6,
                osc2Mix: 0.5,
                subOscGain: 0.2,
                filterType: 'lowpass',
                filterCutoff: 4000,
                filterResonance: 2,
                filterEnvAmount: 0.4,
                attack: 0.02,
                decay: 0.2,
                sustain: 0.7,
                release: 0.3,
                lfoRate: 4,
                lfoAmount: 0.1,
                lfoTarget: 'filter',
              }
            : undefined,
      },
      fxChain: [],
      sends: { sendA: -12, sendB: -18 },
      clips: [],
    };

    setProject((prev) => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
    setSelectedTrackId(newTrack.id);
  };

  // 8. Offline Export Handlers
  const handleExportMasterWav = async () => {
    setIsExporting(true);
    setExportNotice('Rendering uncompressed master WAV offline...');
    try {
      const wavBlob = await renderDawOffline(project);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_master.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setExportNotice('Master WAV exported successfully!');
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 3000);
    }
  };

  const handleExportStems = async () => {
    setIsExporting(true);
    setExportNotice('Rendering isolated track stems...');
    try {
      const stems = await renderAllStems(project, (status) => {
        setExportNotice(`Rendering stem ${status.trackIndex}/${status.totalTracks}: ${status.trackName}...`);
      });

      for (const [filename, blob] of stems.entries()) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      setExportNotice(`Successfully exported ${stems.size} stems!`);
    } catch (err: any) {
      alert('Stem export failed: ' + err.message);
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 3500);
    }
  };

  const handleExportProjectJson = () => {
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {/* 1. Global Transport Bar & Header */}
      <TransportHeader
        project={project}
        isPlaying={isPlaying}
        isRecording={isRecording}
        gridSnap={gridSnap}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRecordToggle={handleRecordToggle}
        onLoopToggle={handleLoopToggle}
        onTempoChange={(bpm) => setProject((p) => ({ ...p, tempo: bpm }))}
        onScaleChange={(scaleId) => setProject((p) => ({ ...p, activeScale: scaleId }))}
        onGridSnapChange={setGridSnap}
        onMasterVolumeChange={(vol) =>
          setProject((p) => ({ ...p, masterTrack: { ...p.masterTrack, volume: vol } }))
        }
        onAddTrack={handleAddTrack}
        onExportMasterWav={handleExportMasterWav}
        onExportStems={handleExportStems}
        onExportProjectJson={handleExportProjectJson}
        activeDockTab={activeDockTab}
        onSelectDockTab={setActiveDockTab}
      />

      {/* Export notification badge */}
      {exportNotice && (
        <div className="bg-amber-500 text-black px-4 py-1.5 text-xs font-bold text-center animate-bounce shadow-md z-50">
          {exportNotice}
        </div>
      )}

      {/* 2. Main Workstation Area: Arrangement Timeline */}
      <ArrangementTimeline
        project={project}
        gridSnap={gridSnap}
        selectedTrackId={selectedTrackId}
        selectedClipId={selectedClipId}
        onSelectTrack={setSelectedTrackId}
        onSelectClip={(clip) => {
          setSelectedTrackId(clip.trackId);
          setSelectedClipId(clip.id);
        }}
        onDoubleClickClip={(clip) => {
          setSelectedTrackId(clip.trackId);
          setSelectedClipId(clip.id);
          if (clip.type === 'midi') {
            const track = project.tracks.find((t) => t.id === clip.trackId);
            if (track?.type === 'drum_rack') {
              setActiveDockTab('step-sequencer');
            } else {
              setActiveDockTab('piano-roll');
            }
          }
        }}
        onUpdateProject={setProject}
        onSeek={handleSeek}
      />

      {/* 3. Bottom Contextual Dock */}
      <div className="shrink-0 bg-gray-950">
        {activeDockTab === 'piano-roll' && (
          <PianoRollEditor
            clip={selectedClip?.type === 'midi' ? (selectedClip as MidiClip) : null}
            trackId={selectedTrackId}
            activeScale={project.activeScale}
            onUpdateClip={(updatedNotes) => {
              if (!selectedTrackId || !selectedClipId) return;
              setProject((prev) => ({
                ...prev,
                tracks: prev.tracks.map((t) =>
                  t.id === selectedTrackId
                    ? {
                        ...t,
                        clips: t.clips.map((c) =>
                          c.id === selectedClipId ? { ...c, notes: updatedNotes } : c
                        ),
                      }
                    : t
                ),
              }));
            }}
          />
        )}

        {activeDockTab === 'mixer' && (
          <MixerConsole
            project={project}
            selectedTrackId={selectedTrackId}
            onSelectTrack={setSelectedTrackId}
            onUpdateTrack={(trackId, updated) => {
              setProject((prev) => ({
                ...prev,
                tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...updated } : t)),
              }));
            }}
            onUpdateMaster={(vol) =>
              setProject((prev) => ({
                ...prev,
                masterTrack: { ...prev.masterTrack, volume: vol },
              }))
            }
            onOpenDevices={(trackId) => {
              setSelectedTrackId(trackId);
              setActiveDockTab('devices');
            }}
          />
        )}

        {activeDockTab === 'devices' && (
          <DeviceRack
            track={selectedTrack}
            onUpdateTrack={(updated) => {
              if (!selectedTrackId) return;
              setProject((prev) => ({
                ...prev,
                tracks: prev.tracks.map((t) => (t.id === selectedTrackId ? { ...t, ...updated } : t)),
              }));
            }}
          />
        )}

        {activeDockTab === 'step-sequencer' && (
          <StepSequencerView
            clip={selectedClip?.type === 'midi' ? (selectedClip as MidiClip) : null}
            onUpdateDrumSteps={(updatedSteps) => {
              if (!selectedTrackId || !selectedClipId) return;
              setProject((prev) => ({
                ...prev,
                tracks: prev.tracks.map((t) =>
                  t.id === selectedTrackId
                    ? {
                        ...t,
                        clips: t.clips.map((c) =>
                          c.id === selectedClipId ? { ...c, drumSteps: updatedSteps } : c
                        ),
                      }
                    : t
                ),
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}
