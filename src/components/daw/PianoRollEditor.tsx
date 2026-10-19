import React, { useState, useRef, useEffect } from 'react';
import type { MidiClip, NoteEvent, ScaleId } from '../../types/daw';
import { PPQ, snapTickToGrid } from '../../audio/timeUtils';
import { getFreqForNote, getScaleNotes, SCALES } from '../../audio/tuningEngine';
import { dawAudioEngine } from '../../audio/dawAudioEngine';
import { Plus, Trash2, Sparkles, Volume2 } from 'lucide-react';

interface PianoRollEditorProps {
  clip: MidiClip | null;
  trackId: string | null;
  activeScale: ScaleId;
  onUpdateClip: (updatedNotes: NoteEvent[]) => void;
}

export const PianoRollEditor: React.FC<PianoRollEditorProps> = ({
  clip,
  trackId,
  activeScale,
  onUpdateClip,
}) => {
  const [pixelsPerTick, setPixelsPerTick] = useState<number>(0.4);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Get notes for active scale across 4 octaves (Octaves 2, 3, 4, 5)
  const scaleNotes = getScaleNotes(activeScale, [2, 3, 4, 5]);
  // Reverse so higher pitches are at top
  const rowNotes = [...scaleNotes].reverse();

  const rowHeightPx = 22;
  const clipLengthTicks = clip?.durationTicks || PPQ * 4;
  const gridWidthPx = Math.max(600, clipLengthTicks * pixelsPerTick);

  // Audition key sound
  const handleKeyAudition = (pitch: string, freq: number) => {
    if (!trackId) return;
    dawAudioEngine.liveNoteOn(trackId, freq, 0.8);
    setTimeout(() => {
      dawAudioEngine.liveNoteOff(trackId, freq);
    }, 250);
  };

  // Add or Remove note on grid click
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const rowIndex = Math.floor(clickY / rowHeightPx);
    if (rowIndex < 0 || rowIndex >= rowNotes.length) return;

    const targetNote = rowNotes[rowIndex];
    const rawTick = clickX / pixelsPerTick;
    const snappedStart = snapTickToGrid(rawTick, '1/16');

    // Check if clicking existing note to select/delete
    const existingIndex = clip.notes.findIndex(
      (n) => n.pitch === targetNote.label && Math.abs(n.startTick - snappedStart) < 24
    );

    if (existingIndex !== -1) {
      // Remove note
      const updatedNotes = clip.notes.filter((_, idx) => idx !== existingIndex);
      onUpdateClip(updatedNotes);
      return;
    }

    // Otherwise add new note
    const newNote: NoteEvent = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pitch: targetNote.label,
      freq: targetNote.freq,
      startTick: snappedStart,
      durationTicks: 48, // 16th note default length
      velocity: 0.8,
    };

    handleKeyAudition(targetNote.label, targetNote.freq);
    onUpdateClip([...clip.notes, newNote]);
    setSelectedNoteId(newNote.id);
  };

  // Update note velocity
  const handleVelocityChange = (noteId: string, newVel: number) => {
    if (!clip) return;
    const clampedVel = Math.max(0.1, Math.min(1.0, newVel));
    const updated = clip.notes.map((n) => (n.id === noteId ? { ...n, velocity: clampedVel } : n));
    onUpdateClip(updated);
  };

  if (!clip) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-gray-950 text-gray-500 font-mono text-xs select-none">
        <Sparkles className="w-6 h-6 mb-2 text-gray-600" />
        <p>Double-click any MIDI clip on the timeline to edit notes in the Piano Roll</p>
      </div>
    );
  }

  return (
    <div className="h-72 flex flex-col bg-gray-950 border-t border-gray-800 select-none">
      {/* Top Piano Roll Action Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-b border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-cyan-400">🎹 Clip: {clip.name}</span>
          <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">
            {clip.notes.length} Notes • Scale Lock: {activeScale.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateClip([])}
            className="text-[10px] text-gray-400 hover:text-red-400 flex items-center gap-1"
            title="Clear all notes in clip"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Main Roll Area: Left Piano Keys | Right Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Keyboard */}
        <div className="w-32 min-w-[128px] bg-gray-900 border-r border-gray-800 overflow-y-auto shrink-0 scrollbar-none">
          {rowNotes.map((note) => (
            <button
              key={`${note.label}-${note.freq}`}
              onClick={() => handleKeyAudition(note.label, note.freq)}
              style={{ height: `${rowHeightPx}px` }}
              className="w-full flex items-center justify-between px-2 text-[10px] font-mono border-b border-gray-800/60 bg-gray-850 hover:bg-cyan-950/60 hover:text-cyan-300 text-gray-300 transition-colors"
            >
              <span className="font-bold">{note.label}</span>
              <span className="text-[8px] text-gray-500">{Math.round(note.freq)}Hz</span>
            </button>
          ))}
        </div>

        {/* Right Scrollable Note Grid */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-gray-950 scrollbar-thin scrollbar-thumb-gray-800">
          <div
            onClick={handleGridClick}
            style={{ width: `${gridWidthPx}px`, height: `${rowNotes.length * rowHeightPx}px` }}
            className="relative cursor-crosshair"
          >
            {/* Horizontal Row Guides */}
            {rowNotes.map((note, idx) => (
              <div
                key={idx}
                style={{
                  top: `${idx * rowHeightPx}px`,
                  height: `${rowHeightPx}px`,
                  backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                }}
                className="absolute left-0 right-0 border-b border-gray-850 pointer-events-none"
              />
            ))}

            {/* Vertical 16th Gridlines */}
            {Array.from({ length: Math.ceil(clipLengthTicks / 48) }, (_, i) => {
              const tick = i * 48;
              const isQuarter = tick % PPQ === 0;
              return (
                <div
                  key={i}
                  style={{ left: `${tick * pixelsPerTick}px` }}
                  className={`absolute top-0 bottom-0 pointer-events-none ${
                    isQuarter ? 'border-l border-gray-700' : 'border-l border-gray-850'
                  }`}
                />
              );
            })}

            {/* Placed Notes */}
            {clip.notes.map((note) => {
              const rowIndex = rowNotes.findIndex((n) => n.label === note.pitch);
              if (rowIndex === -1) return null;

              const topPx = rowIndex * rowHeightPx;
              const leftPx = note.startTick * pixelsPerTick;
              const widthPx = Math.max(12, note.durationTicks * pixelsPerTick);
              const isSelected = selectedNoteId === note.id;

              return (
                <div
                  key={note.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNoteId(note.id);
                    handleKeyAudition(note.pitch, note.freq);
                  }}
                  style={{
                    top: `${topPx + 1}px`,
                    left: `${leftPx}px`,
                    width: `${widthPx}px`,
                    height: `${rowHeightPx - 2}px`,
                  }}
                  className={`absolute rounded px-1 flex items-center justify-between text-[9px] font-mono font-bold text-black select-none shadow-md transition-transform ${
                    isSelected
                      ? 'bg-amber-400 ring-2 ring-white scale-[1.02] z-20'
                      : 'bg-cyan-400 hover:bg-cyan-300 z-10'
                  }`}
                >
                  <span className="truncate">{note.pitch}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Velocity Lane */}
      <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center px-3 gap-2 overflow-x-auto scrollbar-none">
        <div className="w-28 text-[9px] font-mono text-gray-500 uppercase flex items-center gap-1 shrink-0">
          <Volume2 className="w-3 h-3 text-cyan-400" />
          <span>Velocity</span>
        </div>

        <div style={{ width: `${gridWidthPx}px` }} className="h-full relative shrink-0">
          {clip.notes.map((note) => {
            const leftPx = note.startTick * pixelsPerTick;
            const heightPercent = Math.round((note.velocity || 0.8) * 100);

            return (
              <div
                key={note.id}
                style={{ left: `${leftPx}px` }}
                className="absolute bottom-1 w-2 flex flex-col items-center group cursor-ns-resize"
                title={`Velocity: ${Math.round((note.velocity || 0.8) * 100)}%`}
              >
                <div
                  style={{ height: `${(heightPercent / 100) * 36}px` }}
                  className="w-1.5 bg-cyan-400 group-hover:bg-amber-400 rounded-t transition-all"
                />
                <div className="w-2 h-2 bg-white rounded-full -mb-1 shadow-xs" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
