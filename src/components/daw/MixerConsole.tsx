import React from 'react';
import type { DawProject, TimelineTrack } from '../../types/daw';
import { Volume2, VolumeX, Sliders, Mic, Radio, Music } from 'lucide-react';

interface MixerConsoleProps {
  project: DawProject;
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, updated: Partial<TimelineTrack>) => void;
  onUpdateMaster: (volDb: number) => void;
  onOpenDevices: (trackId: string) => void;
}

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  project,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onUpdateMaster,
  onOpenDevices,
}) => {
  return (
    <div className="h-72 bg-gray-950 border-t border-gray-800 flex overflow-x-auto select-none p-3 gap-2 scrollbar-thin scrollbar-thumb-gray-800">
      {/* 1. Track Channel Strips */}
      {project.tracks.map((track) => {
        const isSelected = selectedTrackId === track.id;

        return (
          <div
            key={track.id}
            onClick={() => onSelectTrack(track.id)}
            className={`w-32 min-w-[128px] h-full rounded-lg border flex flex-col justify-between p-2 cursor-pointer transition-colors ${
              isSelected
                ? 'bg-gray-850 border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/30'
                : 'bg-gray-900 hover:bg-gray-850/60 border-gray-800'
            }`}
          >
            {/* Top: Name & Instrument */}
            <div className="flex flex-col gap-0.5 border-b border-gray-800 pb-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-200 truncate" title={track.name}>
                  {track.name}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: track.color }}
                />
              </div>
              <span className="text-[9px] text-gray-400 font-mono truncate">
                {track.instrument.type === 'poly-synth' && 'PolySynth'}
                {track.instrument.type === 'sampler' && (track.instrument.presetName || 'Sampler')}
                {track.instrument.type === 'chiptune' && 'Chip'}
                {track.instrument.type === 'drum_rack' && 'Drum Rack'}
              </span>
            </div>

            {/* Aux Sends A & B */}
            <div className="flex items-center justify-between gap-1 py-1 bg-black/40 px-1.5 rounded border border-gray-800/60 text-[9px] font-mono">
              <div className="flex flex-col items-center">
                <span className="text-indigo-400">Rev</span>
                <input
                  type="range"
                  min={-40}
                  max={0}
                  step={1}
                  value={track.sends?.sendA ?? -60}
                  onChange={(e) =>
                    onUpdateTrack(track.id, {
                      sends: { ...track.sends, sendA: Number(e.target.value) },
                    })
                  }
                  className="w-10 h-1 accent-indigo-400 bg-gray-700 rounded cursor-pointer"
                  title={`Reverb Send: ${track.sends?.sendA}dB`}
                />
              </div>

              <div className="flex flex-col items-center">
                <span className="text-pink-400">Dly</span>
                <input
                  type="range"
                  min={-40}
                  max={0}
                  step={1}
                  value={track.sends?.sendB ?? -60}
                  onChange={(e) =>
                    onUpdateTrack(track.id, {
                      sends: { ...track.sends, sendB: Number(e.target.value) },
                    })
                  }
                  className="w-10 h-1 accent-pink-400 bg-gray-700 rounded cursor-pointer"
                  title={`Delay Send: ${track.sends?.sendB}dB`}
                />
              </div>
            </div>

            {/* Fader & Meter Section */}
            <div className="flex items-center justify-center gap-2 flex-1 my-1">
              {/* Simulated LED VU Meter */}
              <div className="w-2 h-28 bg-black rounded-sm overflow-hidden flex flex-col-reverse p-0.5 gap-0.5 border border-gray-800">
                {Array.from({ length: 12 }).map((_, i) => {
                  const isHot = i > 9;
                  const isMid = i > 6;
                  const active = Math.random() > 0.4;
                  return (
                    <div
                      key={i}
                      className={`w-full h-1 rounded-[1px] transition-opacity ${
                        active
                          ? isHot
                            ? 'bg-red-500'
                            : isMid
                            ? 'bg-yellow-400'
                            : 'bg-emerald-400'
                          : 'bg-gray-800/40'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Vertical Fader */}
              <div className="flex flex-col items-center h-28 justify-between">
                <span className="text-[8px] font-mono text-gray-500">+6</span>
                <input
                  type="range"
                  min={-36}
                  max={6}
                  step={0.5}
                  value={track.volume}
                  onChange={(e) => onUpdateTrack(track.id, { volume: Number(e.target.value) })}
                  className="h-20 w-1.5 accent-cyan-400 bg-gray-700 rounded cursor-pointer [writing-mode:bt-lr] -rotate-90 origin-center my-auto"
                />
                <span className="text-[8px] font-mono text-gray-500">-36</span>
              </div>
            </div>

            {/* Volume readout & Pan knob */}
            <div className="flex items-center justify-between font-mono text-[9px] text-gray-400 px-1">
              <span>{track.volume > 0 ? `+${track.volume}` : track.volume}dB</span>
              <span>
                {track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(Math.abs(track.pan) * 100)}`}
              </span>
            </div>

            {/* Bottom Buttons: M, S, Arm, FX */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-800">
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { muted: !track.muted });
                  }}
                  className={`w-5 h-5 text-[9px] font-bold rounded flex items-center justify-center ${
                    track.muted ? 'bg-amber-600 text-black font-extrabold' : 'bg-gray-800 text-gray-400'
                  }`}
                  title="Mute"
                >
                  M
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { solo: !track.solo });
                  }}
                  className={`w-5 h-5 text-[9px] font-bold rounded flex items-center justify-center ${
                    track.solo ? 'bg-yellow-400 text-black font-extrabold' : 'bg-gray-800 text-gray-400'
                  }`}
                  title="Solo"
                >
                  S
                </button>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDevices(track.id);
                }}
                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-purple-400 text-[9px] rounded font-mono"
                title="Open FX Rack"
              >
                FX
              </button>
            </div>
          </div>
        );
      })}

      {/* 2. Aux Return Busses (Bus A: Reverb, Bus B: Delay) */}
      <div className="w-28 min-w-[112px] h-full rounded-lg border border-indigo-900/60 bg-indigo-950/20 flex flex-col justify-between p-2">
        <div className="border-b border-indigo-800/40 pb-1 text-center">
          <span className="text-[10px] font-bold text-indigo-300">AUX A (Reverb)</span>
        </div>

        <div className="flex items-center justify-center gap-1 flex-1">
          <input
            type="range"
            min={-36}
            max={6}
            defaultValue={0}
            className="h-20 w-1.5 accent-indigo-400 bg-gray-700 rounded cursor-pointer -rotate-90 origin-center my-auto"
          />
        </div>

        <span className="text-[9px] font-mono text-center text-indigo-300">0.0dB</span>
      </div>

      <div className="w-28 min-w-[112px] h-full rounded-lg border border-pink-900/60 bg-pink-950/20 flex flex-col justify-between p-2">
        <div className="border-b border-pink-800/40 pb-1 text-center">
          <span className="text-[10px] font-bold text-pink-300">AUX B (Delay)</span>
        </div>

        <div className="flex items-center justify-center gap-1 flex-1">
          <input
            type="range"
            min={-36}
            max={6}
            defaultValue={0}
            className="h-20 w-1.5 accent-pink-400 bg-gray-700 rounded cursor-pointer -rotate-90 origin-center my-auto"
          />
        </div>

        <span className="text-[9px] font-mono text-center text-pink-300">0.0dB</span>
      </div>

      {/* 3. Master Bus Strip */}
      <div className="w-36 min-w-[144px] h-full rounded-lg border-2 border-amber-500/70 bg-gradient-to-b from-gray-900 to-amber-950/20 flex flex-col justify-between p-2 ml-auto shadow-xl">
        <div className="border-b border-amber-500/40 pb-1 text-center">
          <span className="text-xs font-black text-amber-400 tracking-wider">MASTER BUS</span>
        </div>

        <div className="flex items-center justify-center gap-2 flex-1 my-1">
          {/* Dual Stereo Master VU Meter */}
          <div className="flex gap-0.5">
            <div className="w-1.5 h-28 bg-black rounded-xs overflow-hidden flex flex-col-reverse p-0.5 gap-0.5 border border-gray-800">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-full h-1 rounded-[1px] ${
                    i > 11 ? 'bg-red-500' : i > 8 ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                />
              ))}
            </div>
            <div className="w-1.5 h-28 bg-black rounded-xs overflow-hidden flex flex-col-reverse p-0.5 gap-0.5 border border-gray-800">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-full h-1 rounded-[1px] ${
                    i > 11 ? 'bg-red-500' : i > 8 ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Master Fader */}
          <input
            type="range"
            min={-36}
            max={6}
            step={0.5}
            value={project.masterTrack.volume}
            onChange={(e) => onUpdateMaster(Number(e.target.value))}
            className="h-20 w-2 accent-amber-400 bg-gray-700 rounded cursor-pointer -rotate-90 origin-center my-auto"
          />
        </div>

        <div className="text-center font-mono text-[10px] text-amber-300 font-bold">
          {project.masterTrack.volume > 0 ? `+${project.masterTrack.volume}` : project.masterTrack.volume} dB
        </div>
      </div>
    </div>
  );
};
