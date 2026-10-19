import React, { useState } from 'react';
import type { TimelineTrack, Eq4Params, CompressorParams, SubtractiveSynthParams } from '../../types/daw';
import { Sliders, Activity, Disc, Zap, Volume2 } from 'lucide-react';

interface DeviceRackProps {
  track: TimelineTrack | null;
  onUpdateTrack: (updated: Partial<TimelineTrack>) => void;
}

export const DeviceRack: React.FC<DeviceRackProps> = ({ track, onUpdateTrack }) => {
  const [activeTab, setActiveTab] = useState<'eq' | 'synth' | 'comp'>('eq');

  if (!track) {
    return (
      <div className="h-72 flex items-center justify-center bg-gray-950 text-gray-500 font-mono text-xs select-none">
        Select a track to view its device and effect rack
      </div>
    );
  }

  const isPolySynth = track.instrument.type === 'poly-synth';
  const synthParams = track.instrument.subtractive || {
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    osc2Detune: 7,
    osc2Mix: 0.5,
    subOscGain: 0.25,
    filterType: 'lowpass',
    filterCutoff: 3500,
    filterResonance: 3,
    filterEnvAmount: 0.4,
    attack: 0.02,
    decay: 0.3,
    sustain: 0.7,
    release: 0.4,
    lfoRate: 3.5,
    lfoAmount: 0.1,
    lfoTarget: 'filter',
  };

  const handleUpdateSynth = (partial: Partial<SubtractiveSynthParams>) => {
    onUpdateTrack({
      instrument: {
        ...track.instrument,
        subtractive: { ...synthParams, ...partial },
      },
    });
  };

  return (
    <div className="h-72 bg-gray-950 border-t border-gray-800 flex flex-col select-none p-3 overflow-y-auto">
      {/* Top Device Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-purple-400">⚡ Track Device Rack: {track.name}</span>
          <span className="text-[10px] text-gray-400 font-mono">
            {track.instrument.type.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-0.5 rounded">
          {isPolySynth && (
            <button
              onClick={() => setActiveTab('synth')}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                activeTab === 'synth'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              🎹 Poly Subtractive
            </button>
          )}

          <button
            onClick={() => setActiveTab('eq')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'eq'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 4-Band Parametric EQ
          </button>

          <button
            onClick={() => setActiveTab('comp')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'comp'
                ? 'bg-amber-600 text-black font-bold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🗜️ Dynamic Compressor
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 pt-3">
        {/* 1. Polyphonic Subtractive Synth Editor */}
        {activeTab === 'synth' && isPolySynth && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
            {/* Column 1: Dual Oscillators */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5 flex flex-col gap-2">
              <span className="text-purple-400 font-bold border-b border-gray-800 pb-1">
                Dual Oscillators
              </span>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400">Osc 1 Waveform</span>
                <select
                  value={synthParams.osc1Type}
                  onChange={(e) => handleUpdateSynth({ osc1Type: e.target.value as any })}
                  className="bg-black border border-gray-700 text-gray-200 p-1 rounded text-xs"
                >
                  <option value="sawtooth">Sawtooth</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                  <option value="sine">Sine</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400">Osc 2 Waveform</span>
                <select
                  value={synthParams.osc2Type}
                  onChange={(e) => handleUpdateSynth({ osc2Type: e.target.value as any })}
                  className="bg-black border border-gray-700 text-gray-200 p-1 rounded text-xs"
                >
                  <option value="sawtooth">Sawtooth</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                  <option value="sine">Sine</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Osc 2 Detune</span>
                <span className="text-purple-300">{synthParams.osc2Detune}c</span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                value={synthParams.osc2Detune}
                onChange={(e) => handleUpdateSynth({ osc2Detune: Number(e.target.value) })}
                className="accent-purple-500 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Osc 2 Mix</span>
                <span className="text-purple-300">{Math.round(synthParams.osc2Mix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={synthParams.osc2Mix}
                onChange={(e) => handleUpdateSynth({ osc2Mix: Number(e.target.value) })}
                className="accent-purple-500 h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            {/* Column 2: Resonant Filter */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5 flex flex-col gap-2">
              <span className="text-cyan-400 font-bold border-b border-gray-800 pb-1">
                Resonant Filter
              </span>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Cutoff</span>
                <span className="text-cyan-300">{Math.round(synthParams.filterCutoff)}Hz</span>
              </div>
              <input
                type="range"
                min={100}
                max={16000}
                step={50}
                value={synthParams.filterCutoff}
                onChange={(e) => handleUpdateSynth({ filterCutoff: Number(e.target.value) })}
                className="accent-cyan-400 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Resonance (Q)</span>
                <span className="text-cyan-300">{synthParams.filterResonance.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={15}
                step={0.1}
                value={synthParams.filterResonance}
                onChange={(e) => handleUpdateSynth({ filterResonance: Number(e.target.value) })}
                className="accent-cyan-400 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Env Sweep</span>
                <span className="text-cyan-300">
                  {Math.round(synthParams.filterEnvAmount * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={synthParams.filterEnvAmount}
                onChange={(e) => handleUpdateSynth({ filterEnvAmount: Number(e.target.value) })}
                className="accent-cyan-400 h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            {/* Column 3: Amplitude Envelope ADSR */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5 flex flex-col gap-2">
              <span className="text-emerald-400 font-bold border-b border-gray-800 pb-1">
                Amp ADSR Envelope
              </span>

              <div className="grid grid-cols-4 gap-1 h-36 items-end pb-2">
                {[
                  { label: 'A', val: synthParams.attack, key: 'attack', max: 1.5 },
                  { label: 'D', val: synthParams.decay, key: 'decay', max: 2.0 },
                  { label: 'S', val: synthParams.sustain, key: 'sustain', max: 1.0 },
                  { label: 'R', val: synthParams.release, key: 'release', max: 2.5 },
                ].map((env) => (
                  <div key={env.label} className="flex flex-col items-center gap-1">
                    <input
                      type="range"
                      min={0.01}
                      max={env.max}
                      step={0.01}
                      value={env.val}
                      onChange={(e) => handleUpdateSynth({ [env.key]: Number(e.target.value) })}
                      className="h-20 w-1 accent-emerald-400 bg-gray-700 rounded cursor-pointer -rotate-90 origin-center my-auto"
                    />
                    <span className="text-[10px] font-bold text-gray-300">{env.label}</span>
                    <span className="text-[8px] text-gray-500">{env.val.toFixed(2)}s</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 4: LFO Modulation */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5 flex flex-col gap-2">
              <span className="text-amber-400 font-bold border-b border-gray-800 pb-1">
                LFO Modulation
              </span>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Rate</span>
                <span className="text-amber-300">{synthParams.lfoRate.toFixed(1)}Hz</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={20}
                step={0.2}
                value={synthParams.lfoRate}
                onChange={(e) => handleUpdateSynth({ lfoRate: Number(e.target.value) })}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Depth</span>
                <span className="text-amber-300">{Math.round(synthParams.lfoAmount * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={synthParams.lfoAmount}
                onChange={(e) => handleUpdateSynth({ lfoAmount: Number(e.target.value) })}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[10px] text-gray-400">Target</span>
                <select
                  value={synthParams.lfoTarget}
                  onChange={(e) => handleUpdateSynth({ lfoTarget: e.target.value as any })}
                  className="bg-black border border-gray-700 text-gray-200 p-1 rounded text-xs"
                >
                  <option value="filter">Filter Cutoff (Wah)</option>
                  <option value="pitch">Pitch (Vibrato)</option>
                  <option value="pwm">Pulse Width (Chorus)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 2. 4-Band Parametric EQ Display */}
        {activeTab === 'eq' && (
          <div className="flex flex-col gap-3">
            {/* SVG Interactive Frequency Response Curve */}
            <div className="h-28 w-full bg-gray-900 border border-gray-800 rounded-lg relative overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 500 100">
                {/* Gridlines */}
                <line x1="0" y1="50" x2="500" y2="50" stroke="#374151" strokeDasharray="4" />
                <line x1="125" y1="0" x2="125" y2="100" stroke="#1f2937" />
                <line x1="250" y1="0" x2="250" y2="100" stroke="#1f2937" />
                <line x1="375" y1="0" x2="375" y2="100" stroke="#1f2937" />

                {/* EQ curve path */}
                <path
                  d="M 0 50 Q 80 40 120 48 T 250 52 T 380 45 T 500 50"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                />

                {/* 4 Draggable nodes */}
                <circle cx="60" cy="45" r="5" fill="#38bdf8" />
                <circle cx="160" cy="48" r="5" fill="#34d399" />
                <circle cx="300" cy="52" r="5" fill="#f59e0b" />
                <circle cx="430" cy="42" r="5" fill="#ec4899" />
              </svg>

              <div className="absolute bottom-1 right-2 text-[9px] font-mono text-gray-500">
                20Hz ---------------- 1kHz ---------------- 20kHz
              </div>
            </div>

            {/* EQ Band Sliders */}
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-gray-900 border border-gray-800 p-2 rounded">
                <span className="text-cyan-400 font-bold block mb-1">Low Shelf (100Hz)</span>
                <input
                  type="range"
                  min={-18}
                  max={18}
                  defaultValue={0}
                  className="w-full accent-cyan-400 h-1 bg-gray-700 rounded cursor-pointer"
                />
              </div>

              <div className="bg-gray-900 border border-gray-800 p-2 rounded">
                <span className="text-emerald-400 font-bold block mb-1">Mid 1 (800Hz)</span>
                <input
                  type="range"
                  min={-18}
                  max={18}
                  defaultValue={0}
                  className="w-full accent-emerald-400 h-1 bg-gray-700 rounded cursor-pointer"
                />
              </div>

              <div className="bg-gray-900 border border-gray-800 p-2 rounded">
                <span className="text-amber-400 font-bold block mb-1">Mid 2 (3kHz)</span>
                <input
                  type="range"
                  min={-18}
                  max={18}
                  defaultValue={0}
                  className="w-full accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
                />
              </div>

              <div className="bg-gray-900 border border-gray-800 p-2 rounded">
                <span className="text-pink-400 font-bold block mb-1">High Shelf (10kHz)</span>
                <input
                  type="range"
                  min={-18}
                  max={18}
                  defaultValue={0}
                  className="w-full accent-pink-400 h-1 bg-gray-700 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. Dynamic Compressor */}
        {activeTab === 'comp' && (
          <div className="grid grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col gap-2">
              <span className="text-amber-400 font-bold">Threshold & Ratio</span>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Threshold</span>
                <span>-24 dB</span>
              </div>
              <input
                type="range"
                min={-60}
                max={0}
                defaultValue={-24}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Ratio</span>
                <span>4:1</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                defaultValue={4}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col gap-2">
              <span className="text-amber-400 font-bold">Attack & Release</span>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Attack</span>
                <span>10 ms</span>
              </div>
              <input
                type="range"
                min={1}
                max={200}
                defaultValue={10}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Release</span>
                <span>250 ms</span>
              </div>
              <input
                type="range"
                min={20}
                max={1000}
                defaultValue={250}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col justify-between">
              <span className="text-amber-400 font-bold">Gain Reduction (GR)</span>
              <div className="h-4 bg-black border border-gray-800 rounded overflow-hidden flex">
                <div className="w-1/3 bg-red-500/80 transition-all" />
              </div>
              <span className="text-[10px] text-gray-400 text-center">-4.2 dB</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col gap-2">
              <span className="text-amber-400 font-bold">Makeup Gain</span>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Output Gain</span>
                <span>+3.0 dB</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                defaultValue={3}
                className="accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
