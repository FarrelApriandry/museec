import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  SongProject,
  PatternData,
  TrackData,
  StepModifier,
  ScaleId,
  MasterFxSettings,
  AmbientTrackSettings,
} from '../types/sequencer';
import { DEMO_PROJECTS, getDemoProject } from '../data/demoSongs';
import { SCALES } from '../audio/tuningEngine';
import { retroAudioEngine } from '../audio/retroAudioEngine';
import { AudioVisualizer } from './AudioVisualizer';
import { TrackInspector } from './TrackInspector';
import { StepMicroEditor } from './StepMicroEditor';
import { PatternChainBar } from './PatternChainBar';
import { AudioRecordingModal } from './AudioRecordingModal';
import {
  Play,
  Pause,
  Square,
  Circle,
  Download,
  Upload,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  RotateCcw,
  Music,
  Plus,
  Minus,
  Radio,
  FileCode,
  Layers,
  CloudRain,
  Compass,
} from 'lucide-react';

export default function ChiptuneSequencer() {
  // Main Project State
  const [project, setProject] = useState<SongProject>(() => getDemoProject('mataram-slow-living'));
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);

  // Inspector & Popover Editor States
  const [activeInspectorTrackId, setActiveInspectorTrackId] = useState<string | null>('track-1');
  const [microEditorState, setMicroEditorState] = useState<{
    trackId: string;
    stepIndex: number;
  } | null>(null);

  // Export / Offline Render States
  const [isExportingOffline, setIsExportingOffline] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [recordingResult, setRecordingResult] = useState<{
    wavBlob: Blob | null;
    webmBlob: Blob;
  } | null>(null);

  // References for Zero-Lag Audio Playhead (Decoupled from React Renders)
  const stepLedRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stepButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeStepDisplayRef = useRef<HTMLSpanElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize and Sync Audio Engine
  useEffect(() => {
    retroAudioEngine.loadProject(project);

    // Fast 60fps Playhead Subscriber: Directly updates DOM classes for ultra-smooth 60fps tracking
    const unsubscribe = retroAudioEngine.subscribePlayhead((stepIdx) => {
      // 1. Update active step LCD readout
      if (activeStepDisplayRef.current) {
        activeStepDisplayRef.current.textContent = `${String(stepIdx + 1).padStart(2, '0')}`;
      }

      // 2. Update Top LED bar
      stepLedRefs.current.forEach((el, idx) => {
        if (!el) return;
        if (idx === stepIdx) {
          el.classList.add('bg-cyan-400', 'shadow-[0_0_10px_#22d3ee]', 'scale-110');
          el.classList.remove('bg-gray-800', 'bg-gray-600');
        } else {
          el.classList.remove('bg-cyan-400', 'shadow-[0_0_10px_#22d3ee]', 'scale-110');
          if (idx % 4 === 0) {
            el.classList.add('bg-gray-600');
          } else {
            el.classList.add('bg-gray-800');
          }
        }
      });
    });

    return () => {
      unsubscribe();
      retroAudioEngine.dispose();
    };
  }, []);

  // Update engine whenever project settings change
  useEffect(() => {
    retroAudioEngine.loadProject(project);
  }, [project]);

  // Active Pattern Helper
  const activePattern = project.patterns[project.activePatternId] || Object.values(project.patterns)[0];

  // Transport Handlers
  const handlePlay = async () => {
    await retroAudioEngine.init();
    setIsAudioReady(true);
    await retroAudioEngine.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    retroAudioEngine.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    retroAudioEngine.stop();
    setIsPlaying(false);
    if (activeStepDisplayRef.current) activeStepDisplayRef.current.textContent = '01';
  };

  // Keyboard Shortcuts (Space for Play/Pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) handlePause();
        else handlePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Tempo Adjustment
  const handleBpmChange = (newBpm: number) => {
    const clamped = Math.max(60, Math.min(180, Math.round(newBpm)));
    setProject((prev) => ({ ...prev, tempo: clamped }));
    retroAudioEngine.setBpm(clamped);
  };

  // Scale Change
  const handleScaleChange = (scaleId: ScaleId) => {
    setProject((prev) => ({ ...prev, activeScale: scaleId }));
  };

  // Pattern Switcher
  const handleSelectPattern = (patternId: string) => {
    setProject((prev) => ({ ...prev, activePatternId: patternId }));
  };

  // Step Count Switcher (16 / 32 / 64)
  const handleUpdateStepCount = (newCount: 16 | 32 | 64) => {
    if (!activePattern) return;
    setProject((prev) => {
      const currentPat = prev.patterns[prev.activePatternId];
      if (!currentPat) return prev;

      const updatedTracks = currentPat.tracks.map((t) => {
        let newSteps = [...t.steps];
        if (newSteps.length < newCount) {
          // Extend steps with empty or repeated pattern
          const diff = newCount - newSteps.length;
          const extra = Array.from({ length: diff }, () => ({
            active: false,
            note: t.steps[0]?.note || 'A4',
            freq: t.steps[0]?.freq || 440,
            velocity: 0.8,
            gate: 0.6,
            microTiming: 0,
            glide: false,
            drumSounds: {
              kick: false,
              snare: false,
              hihat_closed: false,
              hihat_open: false,
              zap: false,
            },
          }));
          newSteps = [...newSteps, ...extra];
        } else if (newSteps.length > newCount) {
          newSteps = newSteps.slice(0, newCount);
        }
        return { ...t, steps: newSteps };
      });

      const updatedPattern: PatternData = {
        ...currentPat,
        stepCount: newCount,
        tracks: updatedTracks,
      };

      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [prev.activePatternId]: updatedPattern,
        },
      };
    });
  };

  // Duplicate / Add Pattern
  const handleAddPattern = (copyFromId?: string) => {
    const nextKey = `pattern-${String.fromCharCode(97 + Object.keys(project.patterns).length)}`;
    const source = copyFromId ? project.patterns[copyFromId] : activePattern;
    const clonedTracks: TrackData[] = JSON.parse(JSON.stringify(source.tracks));

    const newPat: PatternData = {
      id: nextKey,
      name: `Pattern ${nextKey.replace('pattern-', '').toUpperCase()}: Variation`,
      stepCount: source.stepCount,
      tracks: clonedTracks,
    };

    setProject((prev) => ({
      ...prev,
      patterns: {
        ...prev.patterns,
        [nextKey]: newPat,
      },
      activePatternId: nextKey,
    }));
  };

  // Step Toggle in Main Grid
  const handleToggleMelodicStep = (trackId: string, stepIdx: number) => {
    if (!activePattern) return;
    setProject((prev) => {
      const pat = prev.patterns[prev.activePatternId];
      if (!pat) return prev;

      const updatedTracks = pat.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const newSteps = [...t.steps];
        const step = newSteps[stepIdx];
        const newActive = !step.active;
        newSteps[stepIdx] = { ...step, active: newActive };

        if (newActive) {
          retroAudioEngine.previewNote(step.freq || 440, t.type);
        }
        return { ...t, steps: newSteps };
      });

      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [prev.activePatternId]: { ...pat, tracks: updatedTracks },
        },
      };
    });
  };

  // Toggle Drum Voice
  const handleToggleDrumVoice = (stepIdx: number, voice: 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'zap') => {
    if (!activePattern) return;
    setProject((prev) => {
      const pat = prev.patterns[prev.activePatternId];
      if (!pat) return prev;

      const updatedTracks = pat.tracks.map((t) => {
        if (t.type !== 'drums') return t;
        const newSteps = [...t.steps];
        const step = newSteps[stepIdx];
        const currentSounds = step.drumSounds || {
          kick: false,
          snare: false,
          hihat_closed: false,
          hihat_open: false,
          zap: false,
        };
        const newState = !currentSounds[voice];
        const updatedSounds = { ...currentSounds, [voice]: newState };
        const isAny = Object.values(updatedSounds).some(Boolean);

        newSteps[stepIdx] = {
          ...step,
          active: isAny,
          drumSounds: updatedSounds,
        };

        if (newState) {
          retroAudioEngine.previewDrum(voice);
        }
        return { ...t, steps: newSteps };
      });

      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [prev.activePatternId]: { ...pat, tracks: updatedTracks },
        },
      };
    });
  };

  // Update Track
  const handleUpdateTrack = useCallback((updatedTrack: TrackData) => {
    setProject((prev) => {
      const pat = prev.patterns[prev.activePatternId];
      if (!pat) return prev;
      const updatedTracks = pat.tracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t));
      retroAudioEngine.updateTrackSettings(updatedTrack);
      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [prev.activePatternId]: { ...pat, tracks: updatedTracks },
        },
      };
    });
  }, []);

  // Update Step from Micro-Editor
  const handleUpdateStepModifier = (updatedStep: StepModifier) => {
    if (!microEditorState || !activePattern) return;
    const { trackId, stepIndex } = microEditorState;

    setProject((prev) => {
      const pat = prev.patterns[prev.activePatternId];
      if (!pat) return prev;

      const updatedTracks = pat.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const newSteps = [...t.steps];
        newSteps[stepIndex] = updatedStep;
        return { ...t, steps: newSteps };
      });

      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [prev.activePatternId]: { ...pat, tracks: updatedTracks },
        },
      };
    });
  };

  // Master FX
  const handleUpdateMasterFx = (newFx: MasterFxSettings) => {
    setProject((prev) => ({ ...prev, masterFx: newFx }));
    retroAudioEngine.updateMasterFx(newFx);
  };

  // Ambient Layer
  const handleUpdateAmbient = (newAmbient: AmbientTrackSettings) => {
    setProject((prev) => ({ ...prev, ambientTrack: newAmbient }));
    retroAudioEngine.updateAmbient(newAmbient);
  };

  // High-Quality Offline WAV Export
  const handleOfflineWavExport = async () => {
    setIsExportingOffline(true);
    setExportProgress(10);
    try {
      await retroAudioEngine.init();
      const wavBlob = await retroAudioEngine.exportProjectWav((pct) => {
        setExportProgress(pct);
      });
      setRecordingResult({ wavBlob, webmBlob: wavBlob });
    } catch (e) {
      alert('Error rendering offline WAV: ' + e);
    } finally {
      setIsExportingOffline(false);
    }
  };

  // Export Project JSON
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Project JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as SongProject;
        if (parsed.patterns && parsed.tempo) {
          setProject(parsed);
          handleStop();
        } else {
          alert('Invalid Sequencer Project JSON format.');
        }
      } catch (err) {
        alert('Could not parse JSON project: ' + err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeTrack = activePattern?.tracks.find((t) => t.id === activeInspectorTrackId);

  return (
    <div className="min-h-screen bg-retro-bg text-gray-200 font-mono p-3 sm:p-5 select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJson}
        accept=".json"
        className="hidden"
      />

      {/* Top Header Bar */}
      <header className="max-w-7xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-retro-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
            <Music className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 uppercase">
              CHIPTUNE-16 PRO
            </h1>
            <p className="text-[10px] text-gray-400 tracking-wider">
              ORGANIC &bull; GAMELAN MICROTONAL &bull; HYBRID SAMPLER &bull; 64-STEP
            </p>
          </div>
        </div>

        {/* Project Selector, Scale Lock & Export Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Project Selector */}
          <select
            value={project.id}
            onChange={(e) => {
              const loaded = getDemoProject(e.target.value);
              setProject(loaded);
              handleStop();
            }}
            className="bg-retro-surface text-cyan-300 font-bold text-xs px-2.5 py-1.5 rounded border border-retro-border"
          >
            {DEMO_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Scale Lock Selector */}
          <div className="flex items-center gap-1 bg-retro-surface px-2 py-1 rounded border border-retro-border">
            <Compass className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-[10px] text-gray-400 font-bold uppercase">SCALE:</span>
            <select
              value={project.activeScale}
              onChange={(e) => handleScaleChange(e.target.value as ScaleId)}
              className="bg-retro-card text-pink-300 font-bold text-xs px-1.5 py-0.5 rounded border border-retro-border"
            >
              {Object.values(SCALES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Offline WAV Render Button */}
          <button
            onClick={handleOfflineWavExport}
            disabled={isExportingOffline}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-400/60 rounded text-xs font-bold transition-all"
            title="Render Offline Studio Quality 16-Bit WAV"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingOffline ? `RENDERING ${exportProgress}%` : 'RENDER WAV'}
          </button>

          {/* JSON Tools */}
          <button
            onClick={handleExportJson}
            className="px-2.5 py-1.5 bg-retro-surface hover:bg-retro-card text-gray-300 rounded border border-retro-border text-xs"
            title="Save Project JSON"
          >
            EXPORT
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-retro-surface hover:bg-retro-card text-gray-300 rounded border border-retro-border text-xs"
            title="Open Project JSON"
          >
            IMPORT
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto space-y-4">
        {/* LCD Status Screen & Master Transport Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LCD Digital Display Screen */}
          <div className="lg:col-span-7 bg-black/90 rounded-lg p-3.5 border-2 border-cyan-900/60 shadow-inner flex flex-col justify-between relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.7) 50%)',
                backgroundSize: '100% 4px',
              }}
            />

            <div className="flex items-center justify-between text-xs text-cyan-400 mb-2 border-b border-cyan-900/40 pb-1.5">
              <span className="flex items-center gap-2 font-bold tracking-widest uppercase text-[11px]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                STATUS: {isPlaying ? 'RUNNING (TRANSPORT ACTIVE)' : 'STANDBY (READY)'}
              </span>
              <span className="text-[10px] text-gray-400">
                TUNING: {SCALES[project.activeScale].name}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
              <div className="bg-cyan-950/40 p-2 rounded border border-cyan-800/40">
                <span className="text-[9px] text-gray-400 block uppercase">PATTERN</span>
                <span className="text-xs font-bold text-cyan-300 truncate block">
                  {activePattern ? activePattern.name : 'Pattern A'}
                </span>
              </div>
              <div className="bg-cyan-950/40 p-2 rounded border border-cyan-800/40">
                <span className="text-[9px] text-gray-400 block uppercase">TEMPO / SWING</span>
                <span className="text-xs font-bold text-yellow-300 block">
                  {project.tempo} BPM &bull; {Math.round(project.swing * 100)}%
                </span>
              </div>
              <div className="bg-cyan-950/40 p-2 rounded border border-cyan-800/40">
                <span className="text-[9px] text-gray-400 block uppercase">ACTIVE STEP</span>
                <span className="text-xs font-bold text-pink-300 block">
                  <span ref={activeStepDisplayRef}>01</span> / {activePattern?.stepCount || 16}
                </span>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between">
              <span>[SPACE] Play/Pause &bull; Click step to toggle &bull; Double click for micro-tuning</span>
              <span className="text-cyan-400 font-bold">60FPS ZERO-LAG SYNC</span>
            </div>
          </div>

          {/* Master Transport & BPM Controls */}
          <div className="lg:col-span-5 bg-retro-surface rounded-lg p-3.5 border-2 border-retro-border flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2.5">
              {isPlaying ? (
                <button
                  onClick={handlePause}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-xs transition-all shadow-glow-amber"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  PAUSE
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded text-xs transition-all shadow-glow-cyan"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  PLAY
                </button>
              )}

              <button
                onClick={handleStop}
                className="px-3 py-2.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/50 rounded font-bold"
                title="Stop & Reset"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>

            {/* Tempo Slider */}
            <div className="bg-black/50 p-2 rounded border border-retro-border">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400 font-bold text-[11px]">BPM TEMPO</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleBpmChange(project.tempo - 1)}
                    className="w-5 h-5 bg-retro-card rounded text-gray-300 hover:text-white border border-retro-border flex items-center justify-center text-xs"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-yellow-300">
                    {project.tempo}
                  </span>
                  <button
                    onClick={() => handleBpmChange(project.tempo + 1)}
                    className="w-5 h-5 bg-retro-card rounded text-gray-300 hover:text-white border border-retro-border flex items-center justify-center text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                step="1"
                value={project.tempo}
                onChange={(e) => handleBpmChange(parseFloat(e.target.value))}
                className="w-full accent-yellow-400 h-1 bg-gray-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Pattern Chain Bar (16/32/64 Step Toggle + Chain Sequencer) */}
        <PatternChainBar
          project={project}
          activePatternId={project.activePatternId}
          onSelectPattern={handleSelectPattern}
          onUpdateStepCount={handleUpdateStepCount}
          onUpdateChain={(newChain) => setProject((prev) => ({ ...prev, patternChain: newChain }))}
          onToggleChainMode={(enabled) => setProject((prev) => ({ ...prev, chainMode: enabled }))}
          onAddPattern={handleAddPattern}
        />

        {/* Visualizer & Spatial FX Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Oscilloscope Visualizer */}
          <div className="lg:col-span-5">
            <AudioVisualizer isPlaying={isPlaying} />
          </div>

          {/* Master Reverb, Delay, Bitcrusher & Ambient Layer Deck */}
          <div className="lg:col-span-7 bg-retro-surface rounded-lg p-3 border-2 border-retro-border space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-retro-border">
              <span className="font-bold text-xs uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                SPATIAL FX & ATMOSPHERIC LAYERS
              </span>
              <span className="text-[10px] text-gray-400">ANALOG + CONVOLUTION</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {/* 1. Algorithmic Reverb */}
              <div className="bg-black/50 p-2 rounded border border-retro-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-300">REVERB</span>
                  <button
                    onClick={() =>
                      handleUpdateMasterFx({
                        ...project.masterFx,
                        reverb: {
                          ...project.masterFx.reverb,
                          enabled: !project.masterFx.reverb.enabled,
                        },
                      })
                    }
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      project.masterFx.reverb.enabled ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {project.masterFx.reverb.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>ROOM</span>
                    <span className="text-pink-300 font-bold">{Math.round(project.masterFx.reverb.wet * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={project.masterFx.reverb.wet}
                    onChange={(e) =>
                      handleUpdateMasterFx({
                        ...project.masterFx,
                        reverb: { ...project.masterFx.reverb, wet: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-pink-400 h-1 bg-gray-800 rounded"
                  />
                </div>
              </div>

              {/* 2. Stereo Delay */}
              <div className="bg-black/50 p-2 rounded border border-retro-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-300">DELAY</span>
                  <button
                    onClick={() =>
                      handleUpdateMasterFx({
                        ...project.masterFx,
                        delay: {
                          ...project.masterFx.delay,
                          enabled: !project.masterFx.delay.enabled,
                        },
                      })
                    }
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      project.masterFx.delay.enabled ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {project.masterFx.delay.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>ECHO</span>
                    <span className="text-cyan-300 font-bold">{Math.round(project.masterFx.delay.wet * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={project.masterFx.delay.wet}
                    onChange={(e) =>
                      handleUpdateMasterFx({
                        ...project.masterFx,
                        delay: { ...project.masterFx.delay, wet: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-cyan-400 h-1 bg-gray-800 rounded"
                  />
                </div>
              </div>

              {/* 3. Bitcrusher */}
              <div className="bg-black/50 p-2 rounded border border-retro-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-300">BITCRUSH</span>
                  <button
                    onClick={() =>
                      handleUpdateMasterFx({
                        ...project.masterFx,
                        bitcrusher: {
                          ...project.masterFx.bitcrusher,
                          enabled: !project.masterFx.bitcrusher.enabled,
                        },
                      })
                    }
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      project.masterFx.bitcrusher.enabled ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {project.masterFx.bitcrusher.enabled ? `${project.masterFx.bitcrusher.bits}b` : 'OFF'}
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>BITS</span>
                    <span className="text-pink-300 font-bold">{project.masterFx.bitcrusher.bits}-BIT</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    step="1"
                    value={project.masterFx.bitcrusher.bits}
                    onChange={(e) =>
                      handleUpdateMasterFx({
                        ...project.masterFx,
                        bitcrusher: { ...project.masterFx.bitcrusher, bits: parseInt(e.target.value, 10) },
                      })
                    }
                    className="w-full accent-pink-400 h-1 bg-gray-800 rounded"
                  />
                </div>
              </div>

              {/* 4. Ambient Track Layer (Rain / Crickets / River) */}
              <div className="bg-black/50 p-2 rounded border border-retro-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                    <CloudRain className="w-3 h-3 text-cyan-400" />
                    AMBIENCE
                  </span>
                  <button
                    onClick={() =>
                      handleUpdateAmbient({
                        ...project.ambientTrack,
                        enabled: !project.ambientTrack.enabled,
                      })
                    }
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      project.ambientTrack.enabled ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {project.ambientTrack.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div>
                  <select
                    value={project.ambientTrack.soundType}
                    onChange={(e) =>
                      handleUpdateAmbient({
                        ...project.ambientTrack,
                        soundType: e.target.value as any,
                      })
                    }
                    className="w-full bg-retro-card text-[10px] text-cyan-300 rounded border border-retro-border py-0.5"
                  >
                    <option value="crickets">Crickets (Night)</option>
                    <option value="rain">Tropical Rain</option>
                    <option value="river">River Stream</option>
                    <option value="off">Off (Silent)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 16 / 32 / 64 Multi-Step Sequencer Grid */}
        {activePattern && (
          <div className="bg-retro-surface rounded-lg p-3 border-2 border-retro-border overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Step Lights Row (Synchronized at 60fps via DOM Refs) */}
              <div className="flex items-center mb-2 pl-[185px] pr-2">
                <div
                  className="grid gap-1 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${activePattern.stepCount}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: activePattern.stepCount }).map((_, stepIdx) => {
                    const isMeasureStart = stepIdx % 4 === 0;
                    return (
                      <div key={stepIdx} className="flex flex-col items-center gap-0.5">
                        <div
                          ref={(el) => {
                            stepLedRefs.current[stepIdx] = el;
                          }}
                          className={`w-full h-1.5 rounded-xs transition-transform ${
                            isMeasureStart ? 'bg-gray-600' : 'bg-gray-800'
                          }`}
                        />
                        <span className={`text-[8px] font-mono ${isMeasureStart ? 'text-gray-400 font-bold' : 'text-gray-600'}`}>
                          {stepIdx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Track Channel Strips */}
              <div className="space-y-2.5">
                {activePattern.tracks.map((track) => {
                  const isMelodic = track.type !== 'drums';
                  const isInspectorOpen = activeInspectorTrackId === track.id;

                  return (
                    <div
                      key={track.id}
                      className="bg-black/40 rounded-lg p-2 border border-retro-border hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {/* Track Control Strip */}
                        <div className="w-[185px] shrink-0 flex items-center justify-between pr-2 border-r border-retro-border">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: track.color }}
                            />
                            <div className="truncate">
                              <span className="text-xs font-bold text-white block truncate">
                                {track.name}
                              </span>
                              <span className="text-[9px] text-gray-400 block uppercase">
                                {track.instrumentMode === 'sampler' ? `SAMPLE: ${track.samplePreset}` : track.waveform}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateTrack({ ...track, muted: !track.muted })}
                              className={`w-5 h-5 rounded text-[10px] font-bold ${
                                track.muted ? 'bg-rose-500 text-white' : 'bg-retro-card text-gray-400 hover:text-white'
                              }`}
                              title="Mute"
                            >
                              M
                            </button>
                            <button
                              onClick={() => handleUpdateTrack({ ...track, solo: !track.solo })}
                              className={`w-5 h-5 rounded text-[10px] font-bold ${
                                track.solo ? 'bg-amber-400 text-black font-bold' : 'bg-retro-card text-gray-400 hover:text-white'
                              }`}
                              title="Solo"
                            >
                              S
                            </button>
                            <button
                              onClick={() => setActiveInspectorTrackId(isInspectorOpen ? null : track.id)}
                              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center ${
                                isInspectorOpen ? 'bg-cyan-500 text-black font-bold' : 'bg-retro-card text-gray-400 hover:text-white'
                              }`}
                              title="Track Settings"
                            >
                              <Sliders className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Step Grid for Track */}
                        <div className="flex-1">
                          {isMelodic ? (
                            /* Melodic Track (16, 32, 64 steps) */
                            <div
                              className="grid gap-1 w-full"
                              style={{
                                gridTemplateColumns: `repeat(${activePattern.stepCount}, minmax(0, 1fr))`,
                              }}
                            >
                              {track.steps.slice(0, activePattern.stepCount).map((step, stepIdx) => {
                                const isMeasureStart = stepIdx % 4 === 0;

                                return (
                                  <div key={stepIdx} className="relative group">
                                    <button
                                      onClick={() => handleToggleMelodicStep(track.id, stepIdx)}
                                      onDoubleClick={() => setMicroEditorState({ trackId: track.id, stepIndex: stepIdx })}
                                      className={`w-full h-10 rounded flex flex-col items-center justify-center border text-[9px] font-bold transition-all ${
                                        step.active
                                          ? 'bg-cyan-900/60 border-cyan-400 text-cyan-200 shadow-glow-cyan'
                                          : isMeasureStart
                                          ? 'bg-retro-card/80 border-retro-border text-gray-500 hover:border-gray-500'
                                          : 'bg-black/60 border-retro-border/60 text-gray-600 hover:border-gray-500'
                                      }`}
                                      title="Click to toggle. Double click to micro-edit velocity, gate, microtiming, and glide."
                                    >
                                      {step.active ? (
                                        <>
                                          <span className="text-[9px] text-white truncate max-w-full px-0.5">
                                            {step.note}
                                          </span>
                                          <span className="text-[7px] text-cyan-400 opacity-75">
                                            {step.glide ? '~' : ''}
                                            {step.microTiming !== 0 ? `${step.microTiming > 0 ? '+' : ''}${step.microTiming}ms` : ''}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-[8px] text-gray-700">&bull;</span>
                                      )}
                                    </button>

                                    {/* Popover opener pill */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMicroEditorState({ trackId: track.id, stepIndex: stepIdx });
                                      }}
                                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      title="Micro-Dynamics & Tuning"
                                    >
                                      &Delta;
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Drum Track Sub-lanes */
                            <div className="space-y-1">
                              {(
                                [
                                  { id: 'kick', label: 'BD: Kick' },
                                  { id: 'snare', label: 'SD: Snare' },
                                  { id: 'hihat_closed', label: 'CH: Hat' },
                                  { id: 'hihat_open', label: 'OH: Open' },
                                  { id: 'zap', label: 'ZP: Zap' },
                                ] as const
                              ).map((drumVoice) => (
                                <div key={drumVoice.id} className="flex items-center gap-1.5">
                                  <span className="w-16 text-[8px] text-gray-400 uppercase font-mono truncate">
                                    {drumVoice.label}
                                  </span>
                                  <div
                                    className="grid gap-1 flex-1"
                                    style={{
                                      gridTemplateColumns: `repeat(${activePattern.stepCount}, minmax(0, 1fr))`,
                                    }}
                                  >
                                    {track.steps.slice(0, activePattern.stepCount).map((step, stepIdx) => {
                                      const isVoiceActive = step.drumSounds?.[drumVoice.id] ?? false;
                                      const isMeasureStart = stepIdx % 4 === 0;

                                      return (
                                        <button
                                          key={stepIdx}
                                          onClick={() => handleToggleDrumVoice(stepIdx, drumVoice.id)}
                                          onDoubleClick={() => setMicroEditorState({ trackId: track.id, stepIndex: stepIdx })}
                                          className={`h-4 rounded text-[7px] font-bold border transition-all ${
                                            isVoiceActive
                                              ? 'bg-amber-500 border-amber-300 text-black shadow-glow-amber'
                                              : isMeasureStart
                                              ? 'bg-retro-card/80 border-retro-border hover:border-gray-500'
                                              : 'bg-black/60 border-retro-border/60 hover:border-gray-500'
                                          }`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Collapsible Track Inspector Panel */}
                      {isInspectorOpen && (
                        <div className="mt-2.5 pt-2.5 border-t border-retro-border">
                          <TrackInspector
                            track={track}
                            onUpdateTrack={handleUpdateTrack}
                            onClose={() => setActiveInspectorTrackId(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step Micro-Dynamics Popover Editor */}
        {microEditorState && activePattern && (
          <StepMicroEditor
            track={activePattern.tracks.find((t) => t.id === microEditorState.trackId)!}
            stepIndex={microEditorState.stepIndex}
            step={
              activePattern.tracks.find((t) => t.id === microEditorState.trackId)!.steps[
                microEditorState.stepIndex
              ]
            }
            scaleId={project.activeScale}
            onUpdateStep={handleUpdateStepModifier}
            onClose={() => setMicroEditorState(null)}
          />
        )}

        {/* Studio Recording / Offline WAV Export Modal */}
        {recordingResult && (
          <AudioRecordingModal
            wavBlob={recordingResult.wavBlob}
            webmBlob={recordingResult.webmBlob}
            onClose={() => setRecordingResult(null)}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-6 pt-3 border-t border-retro-border/60 text-center text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span>Chiptune-16 Pro Sequencer</span> &bull;{' '}
          <span className="text-cyan-400">Microtonal Gamelan (Slendro/Pelog)</span> &bull;{' '}
          <span className="text-pink-400">Hybrid Sampler</span>
        </div>
        <div className="text-[10px] text-gray-600">
          Astro &bull; React 19 &bull; Tone.js 15 &bull; 60fps RAF Decoupled
        </div>
      </footer>
    </div>
  );
}
