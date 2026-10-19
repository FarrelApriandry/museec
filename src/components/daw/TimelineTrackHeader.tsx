import React from 'react';
import type { TimelineTrack } from '../../types/daw';
import { Volume2, VolumeX, Trash2, Mic, Radio, Music } from 'lucide-react';

interface TimelineTrackHeaderProps {
  track: TimelineTrack;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTrack: (updated: Partial<TimelineTrack>) => void;
  onDeleteTrack: () => void;
}

export const TimelineTrackHeader: React.FC<TimelineTrackHeaderProps> = ({
  track,
  isSelected,
  onSelect,
  onUpdateTrack,
  onDeleteTrack,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`h-24 w-60 min-w-[240px] flex flex-col justify-between p-2 border-b border-r select-none transition-colors cursor-pointer ${
        isSelected
          ? 'bg-gray-850 border-cyan-500/50 shadow-inner'
          : 'bg-gray-900 hover:bg-gray-850/80 border-gray-800'
      }`}
      style={{ borderLeft: `4px solid ${track.color}` }}
    >
      {/* Top: Name & Type Badge */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {track.type === 'audio' && <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          {track.type === 'midi' && <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
          {track.type === 'drum_rack' && <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span className="text-xs font-bold text-gray-200 truncate" title={track.name}>
            {track.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className="text-[9px] uppercase font-mono px-1 py-0.5 rounded text-black font-extrabold"
            style={{ backgroundColor: track.color }}
          >
            {track.type === 'drum_rack' ? 'DRUMS' : track.type.toUpperCase()}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTrack();
            }}
            className="p-1 hover:text-red-400 text-gray-500 transition-colors"
            title="Delete Track"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Center: Instrument / Mode Info */}
      <div className="text-[10px] text-gray-400 font-mono truncate">
        {track.instrument.type === 'poly-synth' && '🎹 Polyphonic Subtractive'}
        {track.instrument.type === 'sampler' && `🎋 ${track.instrument.presetName || 'Sampler'}`}
        {track.instrument.type === 'chiptune' && `⚡ Chip (${track.instrument.waveform})`}
        {track.instrument.type === 'drum_rack' && '🥁 5-Piece Drum Kit'}
      </div>

      {/* Bottom: M/S/Arm Buttons & Volume / Pan sliders */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800/80">
        {/* Buttons: Mute, Solo, Record Arm */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateTrack({ muted: !track.muted });
            }}
            className={`w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center transition-colors ${
              track.muted
                ? 'bg-amber-600 text-black font-extrabold'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
            }`}
            title="Mute Track"
          >
            M
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateTrack({ solo: !track.solo });
            }}
            className={`w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center transition-colors ${
              track.solo
                ? 'bg-yellow-400 text-black font-extrabold shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
            }`}
            title="Solo Track"
          >
            S
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateTrack({ armed: !track.armed });
            }}
            className={`w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center transition-colors ${
              track.armed
                ? 'bg-red-600 text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                : 'bg-gray-800 hover:bg-red-950/40 text-red-500'
            }`}
            title="Record Arm (Mic/MIDI)"
          >
            ●
          </button>
        </div>

        {/* Mini Volume & Pan */}
        <div className="flex items-center gap-1.5 font-mono text-[9px]">
          <span className="text-gray-500">Vol</span>
          <input
            type="range"
            min={-36}
            max={6}
            step={0.5}
            value={track.volume}
            onChange={(e) => onUpdateTrack({ volume: Number(e.target.value) })}
            onClick={(e) => e.stopPropagation()}
            className="w-14 accent-cyan-500 h-1 bg-gray-700 rounded cursor-pointer"
            title={`Volume: ${track.volume} dB`}
          />

          <span className="text-gray-500 ml-1">Pan</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={track.pan}
            onChange={(e) => onUpdateTrack({ pan: Number(e.target.value) })}
            onClick={(e) => e.stopPropagation()}
            className="w-10 accent-amber-400 h-1 bg-gray-700 rounded cursor-pointer"
            title={`Pan: ${Math.round(track.pan * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
};
