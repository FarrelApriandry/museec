import React, { useRef, useEffect } from 'react';
import type { DawProject, GridSnapType, ScaleId } from '../../types/daw';
import { SCALES } from '../../audio/tuningEngine';
import {
  Play,
  Pause,
  Square,
  Circle,
  Repeat,
  Volume2,
  Download,
  Plus,
  Layers,
  Sliders,
  Music,
  Radio,
  FileCode,
} from 'lucide-react';

interface TransportHeaderProps {
  project: DawProject;
  isPlaying: boolean;
  isRecording: boolean;
  gridSnap: GridSnapType;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecordToggle: () => void;
  onLoopToggle: () => void;
  onTempoChange: (bpm: number) => void;
  onScaleChange: (scaleId: ScaleId) => void;
  onGridSnapChange: (snap: GridSnapType) => void;
  onMasterVolumeChange: (volDb: number) => void;
  onAddTrack: (type: 'midi' | 'audio' | 'drum_rack') => void;
  onExportMasterWav: () => void;
  onExportStems: () => void;
  onExportProjectJson: () => void;
  activeDockTab: string;
  onSelectDockTab: (tab: any) => void;
}

export const TransportHeader: React.FC<TransportHeaderProps> = ({
  project,
  isPlaying,
  isRecording,
  gridSnap,
  onPlay,
  onPause,
  onStop,
  onRecordToggle,
  onLoopToggle,
  onTempoChange,
  onScaleChange,
  onGridSnapChange,
  onMasterVolumeChange,
  onAddTrack,
  onExportMasterWav,
  onExportStems,
  onExportProjectJson,
  activeDockTab,
  onSelectDockTab,
}) => {
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const barDisplayRef = useRef<HTMLSpanElement | null>(null);

  return (
    <header className="bg-gray-950 border-b border-gray-800 text-gray-200 select-none">
      {/* Top Main Transport Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 gap-3">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-emerald-500 text-black px-2.5 py-1 rounded font-black text-xs tracking-wider shadow-sm">
            <span>MUSEEC</span>
            <span className="bg-black/80 text-amber-300 px-1 py-0.5 rounded text-[10px] font-mono">DAW v3</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-100 flex items-center gap-1.5">
              <span>{project.name}</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              PPQ 192 • Multi-Track Hybrid Engine
            </p>
          </div>
        </div>

        {/* Center: Transport Controls & LCD Readout */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg shadow-inner">
          {/* Play / Pause / Stop */}
          <button
            onClick={() => {
              console.log('%c[TransportHeader] Button Clicked -> ' + (isPlaying ? 'PAUSE' : 'PLAY'), 'color: #10b981; font-weight: bold;');
              if (isPlaying) onPause();
              else onPlay();
            }}
            className={`p-2 rounded-md font-bold transition-all flex items-center justify-center ${
              isPlaying
                ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>

          <button
            onClick={() => {
              console.log('%c[TransportHeader] Button Clicked -> STOP', 'color: #ef4444; font-weight: bold;');
              onStop();
            }}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
            title="Stop & Reset to Start"
          >
            <Square className="w-4 h-4" />
          </button>

          {/* Record Button */}
          <button
            onClick={onRecordToggle}
            className={`p-2 rounded-md transition-all flex items-center justify-center ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse shadow-[0_0_14px_rgba(220,38,38,0.7)]'
                : 'bg-gray-800 hover:bg-red-950/60 text-red-400 hover:text-red-300'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record Audio / Mic onto Armed Track'}
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'fill-white' : 'fill-red-500'}`} />
          </button>

          {/* Loop Region Toggle */}
          <button
            onClick={onLoopToggle}
            className={`p-2 rounded-md transition-colors flex items-center justify-center ${
              project.loopRegion.enabled
                ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-400'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
            title="Loop Active Region"
          >
            <Repeat className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-gray-700 mx-1" />

          {/* LCD Time Counter */}
          <div className="bg-black/90 border border-gray-800 px-3 py-1 rounded font-mono text-center min-w-[120px]">
            <div id="daw-lcd-bar" ref={barDisplayRef} className="text-cyan-400 text-sm font-bold tracking-widest">
              1.1.000
            </div>
            <div id="daw-lcd-time" ref={timeDisplayRef} className="text-[10px] text-gray-400 tracking-wider">
              00:00.00
            </div>
          </div>

          <div className="h-6 w-px bg-gray-700 mx-1" />

          {/* Tempo BPM */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider">BPM</span>
            <input
              type="number"
              min={40}
              max={240}
              value={project.tempo}
              onChange={(e) => onTempoChange(Math.max(40, Math.min(240, Number(e.target.value))))}
              className="w-16 bg-black border border-gray-700 text-amber-300 font-mono text-center text-xs py-0.5 rounded focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Time Signature */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider">Sig</span>
            <span className="text-xs font-mono font-bold text-gray-300 bg-black px-2 py-0.5 rounded border border-gray-800">
              {project.timeSignature[0]}/{project.timeSignature[1]}
            </span>
          </div>

          {/* Grid Snap */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider">Snap</span>
            <select
              value={gridSnap}
              onChange={(e) => onGridSnapChange(e.target.value as GridSnapType)}
              className="bg-black border border-gray-700 text-gray-200 text-xs py-0.5 px-1 rounded font-mono focus:border-cyan-500 focus:outline-none"
            >
              <option value="1/4">1/4 Bar</option>
              <option value="1/8">1/8 Beat</option>
              <option value="1/16">1/16 Beat</option>
              <option value="1/32">1/32 Beat</option>
              <option value="1/8t">1/8 Triplet</option>
              <option value="1/16t">1/16 Triplet</option>
              <option value="off">Off (Free)</option>
            </select>
          </div>
        </div>

        {/* Right: Scale Lock, Master Volume & Export */}
        <div className="flex items-center gap-3">
          {/* Tuning Scale Selector */}
          <div className="flex flex-col">
            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span>Tuning</span>
            </span>
            <select
              value={project.activeScale}
              onChange={(e) => onScaleChange(e.target.value as ScaleId)}
              className="bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs py-1 px-2 rounded font-mono focus:border-amber-400 focus:outline-none"
            >
              {Object.values(SCALES).map((s) => (
                <option key={s.id} value={s.id} className="bg-gray-900 text-gray-200">
                  {s.name} ({s.tuningType === 'microtonal' ? 'Microtonal' : '12-TET'})
                </option>
              ))}
            </select>
          </div>

          {/* Master Fader */}
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-2 py-1 rounded">
            <Volume2 className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="range"
              min={-36}
              max={6}
              step={0.5}
              value={project.masterTrack.volume}
              onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
              className="w-20 accent-amber-500 h-1.5 bg-gray-700 rounded cursor-pointer"
              title={`Master Volume: ${project.masterTrack.volume} dB`}
            />
            <span className="text-[10px] font-mono text-gray-300 w-10 text-right">
              {project.masterTrack.volume > 0 ? `+${project.masterTrack.volume}` : project.masterTrack.volume}dB
            </span>
          </div>

          {/* Add Track Actions */}
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded p-0.5">
            <button
              onClick={() => onAddTrack('midi')}
              className="px-2 py-1 text-xs hover:bg-gray-800 text-cyan-400 rounded flex items-center gap-1"
              title="Add Polyphonic / MIDI Synth Track"
            >
              <Plus className="w-3 h-3" />
              <span>MIDI</span>
            </button>
            <button
              onClick={() => onAddTrack('audio')}
              className="px-2 py-1 text-xs hover:bg-gray-800 text-emerald-400 rounded flex items-center gap-1 border-l border-gray-800"
              title="Add Audio Track (for Recording & WAV Clips)"
            >
              <Plus className="w-3 h-3" />
              <span>Audio</span>
            </button>
            <button
              onClick={() => onAddTrack('drum_rack')}
              className="px-2 py-1 text-xs hover:bg-gray-800 text-amber-400 rounded flex items-center gap-1 border-l border-gray-800"
              title="Add Drum Machine Track"
            >
              <Plus className="w-3 h-3" />
              <span>Drums</span>
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-1 w-44 hidden group-hover:block z-50 text-xs">
              <button
                onClick={onExportMasterWav}
                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-200 flex items-center gap-2"
              >
                <Music className="w-3.5 h-3.5 text-emerald-400" />
                <span>Master (.WAV)</span>
              </button>
              <button
                onClick={onExportStems}
                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-200 flex items-center gap-2 border-t border-gray-800"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>All Track Stems</span>
              </button>
              <button
                onClick={onExportProjectJson}
                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-200 flex items-center gap-2 border-t border-gray-800"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>DAW Project (.JSON)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-Dock Tab Switcher Bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-gray-900/80 border-t border-gray-800 text-xs font-mono">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 uppercase mr-2 tracking-wider">Bottom Dock:</span>
          {[
            { id: 'piano-roll', label: '🎹 Piano Roll', color: 'text-cyan-400' },
            { id: 'mixer', label: '🎛️ Mixer Console', color: 'text-amber-400' },
            { id: 'devices', label: '⚡ Device & FX Rack', color: 'text-purple-400' },
            { id: 'step-sequencer', label: '🥁 Step Matrix', color: 'text-emerald-400' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectDockTab(tab.id)}
              className={`px-3 py-1 rounded transition-colors ${
                activeDockTab === tab.id
                  ? 'bg-gray-800 border border-gray-700 ' + tab.color + ' font-bold shadow-inner'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-gray-500 flex items-center gap-3">
          <span>Shortcuts: <kbd className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">Space</kbd> Play/Pause</span>
          <span><kbd className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">R</kbd> Record</span>
        </div>
      </div>
    </header>
  );
};
