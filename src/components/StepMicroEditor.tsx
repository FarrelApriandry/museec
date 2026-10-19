import React from 'react';
import type { StepModifier, TrackData, ScaleId } from '../types/sequencer';
import { getScaleNotes } from '../audio/tuningEngine';
import { retroAudioEngine } from '../audio/retroAudioEngine';
import { Play, X, Zap } from 'lucide-react';

interface StepMicroEditorProps {
  track: TrackData;
  stepIndex: number;
  step: StepModifier;
  scaleId: ScaleId;
  onUpdateStep: (updated: StepModifier) => void;
  onClose: () => void;
}

export const StepMicroEditor: React.FC<StepMicroEditorProps> = ({
  track,
  stepIndex,
  step,
  scaleId,
  onUpdateStep,
  onClose,
}) => {
  const isMelodic = track.type !== 'drums';
  const availableNotes = getScaleNotes(scaleId, [2, 3, 4, 5]);

  const handleAudition = () => {
    if (isMelodic) {
      const freq = step.freq || 440;
      retroAudioEngine.previewNote(freq, track.type);
    } else {
      retroAudioEngine.previewDrum('kick');
    }
  };

  const handleNoteSelect = (noteLabel: string, freq: number) => {
    onUpdateStep({
      ...step,
      active: true,
      note: noteLabel,
      freq,
    });
    retroAudioEngine.previewNote(freq, track.type);
  };

  const handleToggleDrumVoice = (voice: 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'zap') => {
    const current = step.drumSounds || {
      kick: false,
      snare: false,
      hihat_closed: false,
      hihat_open: false,
      zap: false,
    };
    const updated = { ...current, [voice]: !current[voice] };
    const isAnyActive = Object.values(updated).some(Boolean);
    onUpdateStep({
      ...step,
      active: isAnyActive,
      drumSounds: updated,
    });
    if (updated[voice]) {
      retroAudioEngine.previewDrum(voice);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-retro-surface border-2 border-cyan-500/80 rounded-xl w-full max-w-sm p-4 font-mono text-gray-200 shadow-glow-cyan text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-retro-border">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: track.color }}
            />
            <div>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                STEP {stepIndex + 1} &bull; MICRO-DYNAMICS EDITOR
              </span>
              <span className="text-white font-bold">{track.name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Active & Audition Bar */}
        <div className="flex items-center justify-between bg-black/60 p-2 rounded-lg border border-retro-border mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateStep({ ...step, active: !step.active })}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                step.active
                  ? 'bg-cyan-500 text-black shadow-glow-cyan'
                  : 'bg-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              {step.active ? 'ACTIVE [ON]' : 'MUTED [OFF]'}
            </button>
            {isMelodic && (
              <span className="text-cyan-300 font-bold text-sm">
                {step.note} {step.freq ? `(${step.freq.toFixed(1)}Hz)` : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleAudition}
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded hover:bg-cyan-900 transition-colors text-[11px] font-bold"
          >
            <Play className="w-3 h-3 fill-current" />
            TEST
          </button>
        </div>

        {/* Scale Lock Note Selector (Melodic Tracks) */}
        {isMelodic ? (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1 text-[10px] text-gray-400">
              <span className="font-bold uppercase">SCALE-LOCKED PITCH</span>
              <span className="text-cyan-400">Scale: {scaleId.toUpperCase()}</span>
            </div>
            <div className="max-h-28 overflow-y-auto bg-black/40 p-1.5 rounded border border-retro-border grid grid-cols-4 gap-1">
              {availableNotes.map((n) => {
                const isSelected = step.note === n.label;
                return (
                  <button
                    key={n.label}
                    onClick={() => handleNoteSelect(n.label, n.freq)}
                    className={`py-1 px-1 rounded text-center text-[10px] font-bold border transition-colors truncate ${
                      isSelected
                        ? 'bg-pink-500 text-white border-pink-400 shadow-glow-magenta'
                        : 'bg-retro-card text-gray-300 border-retro-border hover:bg-retro-border'
                    }`}
                    title={`${n.traditionalName || n.label} - ${n.freq} Hz`}
                  >
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Drum Voices Trigger Matrix */
          <div className="mb-3 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">
              DRUM VOICES TRIGGER
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'kick', label: 'BD: Kick' },
                { id: 'snare', label: 'SD: Snare' },
                { id: 'hihat_closed', label: 'CH: Hat' },
                { id: 'hihat_open', label: 'OH: Open' },
                { id: 'zap', label: 'ZP: Zap' },
              ].map(({ id, label }) => {
                const isActive = step.drumSounds?.[id as keyof typeof step.drumSounds] ?? false;
                return (
                  <button
                    key={id}
                    onClick={() => handleToggleDrumVoice(id as 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'zap')}
                    className={`py-1.5 px-2 rounded font-bold text-[10px] border transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-black border-amber-300 shadow-glow-amber'
                        : 'bg-retro-card text-gray-400 border-retro-border hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Micro-Parameters: Velocity, Gate, Micro-Timing, Glide */}
        <div className="space-y-2 bg-black/40 p-2.5 rounded border border-retro-border mb-3">
          {/* Velocity */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>VELOCITY</span>
              <span className="text-cyan-300 font-bold">{Math.round((step.velocity || 0.8) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={step.velocity || 0.8}
              onChange={(e) => onUpdateStep({ ...step, velocity: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 h-1 bg-gray-800 rounded cursor-pointer"
            />
          </div>

          {/* Gate Length */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>GATE LENGTH</span>
              <span className="text-pink-300 font-bold">{Math.round((step.gate || 0.6) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.05"
              value={step.gate || 0.6}
              onChange={(e) => onUpdateStep({ ...step, gate: parseFloat(e.target.value) })}
              className="w-full accent-pink-400 h-1 bg-gray-800 rounded cursor-pointer"
            />
          </div>

          {/* Micro-Timing Offset (-25ms to +25ms) */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>HUMAN MICRO-TIMING</span>
              <span className="text-yellow-300 font-bold">
                {(step.microTiming || 0) > 0 ? `+${step.microTiming}ms` : `${step.microTiming || 0}ms`}
              </span>
            </div>
            <input
              type="range"
              min="-25"
              max="25"
              step="1"
              value={step.microTiming || 0}
              onChange={(e) => onUpdateStep({ ...step, microTiming: parseInt(e.target.value, 10) })}
              className="w-full accent-yellow-400 h-1 bg-gray-800 rounded cursor-pointer"
            />
          </div>

          {/* Glide / Portamento Toggle */}
          {isMelodic && (
            <div className="flex items-center justify-between pt-1 border-t border-retro-border/60">
              <span className="text-[10px] text-gray-400 flex items-center gap-1 font-bold">
                <Zap className="w-3 h-3 text-cyan-400" />
                PORTAMENTO GLIDE
              </span>
              <button
                onClick={() => onUpdateStep({ ...step, glide: !step.glide })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  step.glide ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-500'
                }`}
              >
                {step.glide ? 'ENABLED' : 'OFF'}
              </button>
            </div>
          )}
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded transition-colors shadow-glow-cyan"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
