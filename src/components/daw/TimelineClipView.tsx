import React, { useRef, useEffect } from 'react';
import type { TimelineClip, MidiClip, AudioClip } from '../../types/daw';
import { Copy, Trash2, Mic, Music } from 'lucide-react';

interface TimelineClipViewProps {
  clip: TimelineClip;
  pixelsPerTick: number;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onMove: (newStartTick: number) => void;
  onResize: (newDurationTicks: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const TimelineClipView: React.FC<TimelineClipViewProps> = ({
  clip,
  pixelsPerTick,
  isSelected,
  onSelect,
  onDoubleClick,
  onMove,
  onResize,
  onDuplicate,
  onDelete,
}) => {
  const isAudio = clip.type === 'audio';
  const leftPx = clip.startTick * pixelsPerTick;
  const widthPx = Math.max(24, clip.durationTicks * pixelsPerTick);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render waveform for Audio Clips
  useEffect(() => {
    if (!isAudio || !canvasRef.current) return;
    const audioClip = clip as AudioClip;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const peaks = audioClip.peaks || [];
    if (peaks.length === 0) return;

    ctx.fillStyle = '#34d399'; // Emerald wave
    const barWidth = Math.max(1, w / peaks.length);

    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * (h / 2) * 0.9;
      const x = i * barWidth;
      const y = h / 2 - amp;
      ctx.fillRect(x, y, barWidth - 0.5, amp * 2);
    }
  }, [isAudio, clip, widthPx]);

  // Handle Drag Move
  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    const startX = e.clientX;
    const initialStartTick = clip.startTick;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaTicks = Math.round(deltaPx / pixelsPerTick);
      const newStartTick = Math.max(0, initialStartTick + deltaTicks);
      onMove(newStartTick);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Right Edge Resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialDuration = clip.durationTicks;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaTicks = Math.round(deltaPx / pixelsPerTick);
      const newDuration = Math.max(48, initialDuration + deltaTicks);
      onResize(newDuration);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        backgroundColor: `${clip.color}25`,
        borderColor: isSelected ? '#38bdf8' : `${clip.color}80`,
      }}
      className={`absolute top-1 bottom-1 rounded-md border text-xs select-none overflow-hidden group cursor-pointer transition-shadow ${
        isSelected ? 'ring-2 ring-cyan-400 shadow-lg z-20' : 'z-10 hover:border-gray-400'
      }`}
    >
      {/* Clip Header Strip (Draggable Handle) */}
      <div
        onMouseDown={handleDragStart}
        style={{ backgroundColor: clip.color }}
        className="h-5 px-1.5 flex items-center justify-between text-black font-bold cursor-move"
      >
        <div className="flex items-center gap-1 truncate text-[10px]">
          {isAudio ? <Mic className="w-3 h-3" /> : <Music className="w-3 h-3" />}
          <span className="truncate">{clip.name}</span>
        </div>

        {/* Quick Duplicate & Delete Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-0.5 hover:bg-black/20 rounded text-black"
            title="Duplicate Clip"
          >
            <Copy className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-0.5 hover:bg-black/20 rounded text-black"
            title="Delete Clip"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Clip Interior Preview: Waveform Canvas or MIDI Mini-Notes */}
      <div className="relative h-16 w-full p-1 overflow-hidden pointer-events-none">
        {isAudio ? (
          <canvas
            ref={canvasRef}
            width={Math.max(40, widthPx)}
            height={60}
            className="w-full h-full object-fill opacity-80"
          />
        ) : (
          <div className="relative w-full h-full">
            {/* Draw mini note lines */}
            {(clip as MidiClip).notes?.map((n) => {
              const noteLeft = (n.startTick / clip.durationTicks) * 100;
              const noteWidth = Math.max(1.5, (n.durationTicks / clip.durationTicks) * 100);
              // Normalize pitch for vertical position
              const yPercent = Math.max(5, Math.min(85, ((n.freq || 440) % 600) / 7));

              return (
                <div
                  key={n.id}
                  style={{
                    left: `${noteLeft}%`,
                    width: `${noteWidth}%`,
                    top: `${yPercent}%`,
                    backgroundColor: clip.color,
                  }}
                  className="absolute h-1 rounded-sm opacity-80 shadow-xs"
                />
              );
            })}

            {/* Draw drum hit dots */}
            {(clip as MidiClip).drumSteps?.map((ds, idx) => {
              const dotLeft = (ds.tick / clip.durationTicks) * 100;
              return (
                <div
                  key={idx}
                  style={{ left: `${dotLeft}%` }}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full opacity-90"
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Right Edge Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 bottom-0 w-2 hover:bg-cyan-400/50 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to resize clip duration"
      />
    </div>
  );
};
