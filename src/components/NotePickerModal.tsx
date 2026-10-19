import React, { useState } from 'react';
import type { StepData } from '../types/sequencer';
import { Play, X } from 'lucide-react';
import { retroAudioEngine } from '../audio/retroAudioEngine';

interface NotePickerModalProps {
  trackId: string;
  trackName: string;
  trackType: 'lead' | 'arp' | 'bass' | 'drums';
  stepIndex: number;
  step: StepData;
  onUpdateStep: (updated: StepData) => void;
  onClose: () => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5];

export const NotePickerModal: React.FC<NotePickerModalProps> = ({
  trackId,
  trackName,
  trackType,
  stepIndex,
  step,
  onUpdateStep,
  onClose,
}) => {
  // Parse current note e.g. "D#4" -> noteName: "D#", octave: 4
  const parseNote = (n: string) => {
    const match = n.match(/^([A-G]#?)([0-9])$/);
    if (match) {
      return { noteName: match[1], octave: parseInt(match[2], 10) };
    }
    return { noteName: 'C', octave: 4 };
  };

  const initial = parseNote(step.note);
  const [selectedNote, setSelectedNote] = useState<string>(initial.noteName);
  const [selectedOctave, setSelectedOctave] = useState<number>(initial.octave);
  const [velocity, setVelocity] = useState<number>(step.velocity || 0.85);
  const [gate, setGate] = useState<number>(step.gate || 0.5);

  const currentFullNote = `${selectedNote}${selectedOctave}`;

  const handleSelectNote = (n: string, oct?: number) => {
    const octaveToUse = oct !== undefined ? oct : selectedOctave;
    setSelectedNote(n);
    if (oct !== undefined) setSelectedOctave(oct);

    const full = `${n}${octaveToUse}`;
    retroAudioEngine.previewNote(trackId, full, trackType);

    onUpdateStep({
      ...step,
      active: true,
      note: full,
      velocity,
      gate,
    });
  };

  const handleApply = () => {
    onUpdateStep({
      ...step,
      active: true,
      note: currentFullNote,
      velocity,
      gate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-retro-surface border-2 border-retro-border rounded-xl w-full max-w-md p-5 font-mono shadow-2xl text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-retro-border">
          <div>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
              PITCH EDITOR &bull; STEP {stepIndex + 1}
            </span>
            <h3 className="text-sm font-bold text-white uppercase">{trackName}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Note Readout */}
        <div className="flex items-center justify-between bg-black/60 p-3 rounded-lg border border-retro-border mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-gray-400 text-xs">SELECTED NOTE:</span>
            <span className="text-2xl font-bold text-cyan-300 tracking-wider">
              {currentFullNote}
            </span>
          </div>
          <button
            onClick={() =>
              retroAudioEngine.previewNote(trackId, currentFullNote, trackType)
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 rounded hover:bg-cyan-600/50 transition-colors text-xs font-bold"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            TEST
          </button>
        </div>

        {/* Octave Selector */}
        <div className="mb-4">
          <label className="text-[10px] text-gray-400 block mb-1 uppercase font-bold">
            OCTAVE RANGE
          </label>
          <div className="grid grid-cols-4 gap-2">
            {OCTAVES.map((oct) => (
              <button
                key={oct}
                onClick={() => {
                  setSelectedOctave(oct);
                  handleSelectNote(selectedNote, oct);
                }}
                className={`py-1.5 rounded text-xs font-bold border transition-colors ${
                  selectedOctave === oct
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-glow-cyan'
                    : 'bg-retro-card text-gray-300 border-retro-border hover:bg-retro-border'
                }`}
              >
                OCT {oct}
              </button>
            ))}
          </div>
        </div>

        {/* 12-Tone Chromatic Piano Keyboard */}
        <div className="mb-4">
          <label className="text-[10px] text-gray-400 block mb-1 uppercase font-bold">
            NOTE MATRIX (CHROMATIC)
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {NOTES.map((n) => {
              const isAccidental = n.includes('#');
              const isCurrent = selectedNote === n;
              return (
                <button
                  key={n}
                  onClick={() => handleSelectNote(n)}
                  className={`py-2 rounded font-bold text-xs transition-all border ${
                    isCurrent
                      ? 'bg-pink-500 text-white border-pink-300 shadow-glow-magenta scale-105'
                      : isAccidental
                      ? 'bg-gray-900 text-pink-400 border-pink-900/40 hover:bg-gray-800'
                      : 'bg-retro-card text-gray-200 border-retro-border hover:bg-retro-border'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Velocity & Gate Sliders */}
        <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-black/40 rounded border border-retro-border">
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>VELOCITY</span>
              <span className="text-cyan-300 font-bold">
                {Math.round(velocity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={velocity}
              onChange={(e) => setVelocity(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-gray-800 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>GATE (LENGTH)</span>
              <span className="text-cyan-300 font-bold">
                {Math.round(gate * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={gate}
              onChange={(e) => setGate(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-gray-800 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              onUpdateStep({ ...step, active: false });
              onClose();
            }}
            className="flex-1 py-2 bg-rose-950/60 text-rose-300 border border-rose-800/60 rounded font-bold text-xs hover:bg-rose-900 transition-colors"
          >
            MUTE STEP
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 bg-cyan-500 text-black font-bold text-xs rounded hover:bg-cyan-400 transition-colors shadow-glow-cyan"
          >
            CONFIRM NOTE
          </button>
        </div>
      </div>
    </div>
  );
};
