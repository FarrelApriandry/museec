import React, { useRef, useState, useEffect } from 'react';
import type { DawProject, TimelineTrack, TimelineClip, GridSnapType, MidiClip, AudioClip } from '../../types/daw';
import { PPQ, snapTickToGrid, ticksToBarBeatTick, formatTimeSeconds, ticksToSeconds } from '../../audio/timeUtils';
import { TimelineTrackHeader } from './TimelineTrackHeader';
import { TimelineClipView } from './TimelineClipView';
import { audioBufferCache, extractAudioPeaks } from '../../audio/audioRecorder';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ArrangementTimelineProps {
  project: DawProject;
  gridSnap: GridSnapType;
  selectedTrackId: string | null;
  selectedClipId: string | null;
  onSelectTrack: (trackId: string) => void;
  onSelectClip: (clip: TimelineClip) => void;
  onDoubleClickClip: (clip: TimelineClip) => void;
  onUpdateProject: (updated: DawProject) => void;
  onSeek: (tick: number) => void;
}

export const ArrangementTimeline: React.FC<ArrangementTimelineProps> = ({
  project,
  gridSnap,
  selectedTrackId,
  selectedClipId,
  onSelectTrack,
  onSelectClip,
  onDoubleClickClip,
  onUpdateProject,
  onSeek,
}) => {
  // Zoom level: pixels per tick (at 192 PPQ, 0.4 means ~76.8px per quarter note beat)
  const [pixelsPerTick, setPixelsPerTick] = useState<number>(0.35);

  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const playheadLineRef = useRef<HTMLDivElement | null>(null);

  // Total ticks on timeline (at least 16 bars)
  const totalTicks = Math.max(
    PPQ * 4 * 16, // 16 bars of 4/4
    ...project.tracks.flatMap((t) => t.clips.map((c) => c.startTick + c.durationTicks + PPQ * 4))
  );

  const timelineWidthPx = totalTicks * pixelsPerTick;

  // Sync playhead smoothly via DOM ID or ref
  useEffect(() => {
    const handleLcdUpdate = (e: any) => {
      // Audio engine updates DOM elements directly for 60fps tracking
    };
    window.addEventListener('daw-playhead-tick', handleLcdUpdate);
    return () => window.removeEventListener('daw-playhead-tick', handleLcdUpdate);
  }, []);

  // Handle timeline ruler click/scrub
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawTick = clickX / pixelsPerTick;
    const snappedTick = snapTickToGrid(rawTick, gridSnap);
    onSeek(snappedTick);
  };

  // Move clip handler
  const handleMoveClip = (trackId: string, clipId: string, newStartTick: number) => {
    const snappedStart = snapTickToGrid(newStartTick, gridSnap);
    const updatedTracks = project.tracks.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.map((c) => (c.id === clipId ? { ...c, startTick: snappedStart } : c)),
      };
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
  };

  // Resize clip handler
  const handleResizeClip = (trackId: string, clipId: string, newDurationTicks: number) => {
    const snappedDuration = Math.max(48, snapTickToGrid(newDurationTicks, gridSnap));
    const updatedTracks = project.tracks.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.map((c) => (c.id === clipId ? { ...c, durationTicks: snappedDuration } : c)),
      };
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
  };

  // Duplicate clip handler
  const handleDuplicateClip = (trackId: string, clipId: string) => {
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const sourceClip = track.clips.find((c) => c.id === clipId);
    if (!sourceClip) return;

    const newClip: TimelineClip = {
      ...sourceClip,
      id: `clip-${Date.now()}`,
      name: `${sourceClip.name} (Copy)`,
      startTick: sourceClip.startTick + sourceClip.durationTicks,
    };

    const updatedTracks = project.tracks.map((t) => {
      if (t.id !== trackId) return t;
      return { ...t, clips: [...t.clips, newClip] };
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
  };

  // Delete clip handler
  const handleDeleteClip = (trackId: string, clipId: string) => {
    const updatedTracks = project.tracks.map((track) => {
      if (track.id !== trackId) return track;
      return { ...track, clips: track.clips.filter((c) => c.id !== clipId) };
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
  };

  // Create new blank MIDI clip on double-click empty space
  const handleTrackLaneDoubleClick = (trackId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTick = snapTickToGrid(clickX / pixelsPerTick, gridSnap);
    const clipDuration = PPQ * 4; // 1 bar (4 beats)

    const targetTrack = project.tracks.find((t) => t.id === trackId);
    if (!targetTrack) return;

    const newClip: MidiClip = {
      id: `clip-${Date.now()}`,
      name: `New ${targetTrack.name} Pattern`,
      type: 'midi',
      trackId,
      startTick: clickTick,
      durationTicks: clipDuration,
      color: targetTrack.color,
      notes: [],
    };

    const updatedTracks = project.tracks.map((t) => {
      if (t.id !== trackId) return t;
      return { ...t, clips: [...t.clips, newClip] };
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
    onSelectClip(newClip);
  };

  // Drag and Drop Audio File onto timeline
  const handleAudioDrop = async (trackId: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    if (!file.type.includes('audio') && !file.name.match(/\.(wav|mp3|ogg|flac|m4a)$/i)) {
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const bufferId = `buf-${Date.now()}-${file.name}`;
      audioBufferCache.set(bufferId, decodedBuffer);

      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const startTick = snapTickToGrid(dropX / pixelsPerTick, gridSnap);

      const ticksPerSec = (PPQ * project.tempo) / 60;
      const durationTicks = Math.round(decodedBuffer.duration * ticksPerSec);
      const peaks = extractAudioPeaks(decodedBuffer, 200);

      const targetTrack = project.tracks.find((t) => t.id === trackId) || project.tracks[0];

      const newAudioClip: AudioClip = {
        id: `clip-audio-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'audio',
        trackId: targetTrack.id,
        startTick,
        durationTicks,
        durationSeconds: decodedBuffer.duration,
        offsetSeconds: 0,
        gain: 1.0,
        fadeInTicks: 24,
        fadeOutTicks: 24,
        peaks,
        color: '#10b981',
      };

      const updatedTracks = project.tracks.map((t) => {
        if (t.id !== targetTrack.id) return t;
        return { ...t, clips: [...t.clips, newAudioClip] };
      });

      onUpdateProject({ ...project, tracks: updatedTracks });
      onSelectClip(newAudioClip);
    } catch (err) {
      console.error('Failed to decode dropped audio file:', err);
    }
  };

  // Render Bar Markers for Ruler
  const ticksPerBar = PPQ * project.timeSignature[0];
  const barCount = Math.ceil(totalTicks / ticksPerBar);
  const bars = Array.from({ length: barCount }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden relative select-none">
      {/* Zoom Bar & Actions */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-900/90 border-b border-gray-800 text-[11px] text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-300">Arrangement Timeline</span>
          <span className="text-[10px] text-gray-500 font-mono">
            {project.tracks.length} Tracks • {project.tracks.reduce((acc, t) => acc + t.clips.length, 0)} Clips
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPixelsPerTick((prev) => Math.max(0.1, prev - 0.08))}
            className="p-1 hover:bg-gray-800 rounded text-gray-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPixelsPerTick((prev) => Math.min(1.2, prev + 0.08))}
            className="p-1 hover:bg-gray-800 rounded text-gray-300"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPixelsPerTick(0.35)}
            className="p-1 hover:bg-gray-800 rounded text-gray-300"
            title="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split: Left Track Headers | Right Timeline Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers Column */}
        <div className="w-60 min-w-[240px] flex flex-col border-r border-gray-800 bg-gray-900 z-10 overflow-y-auto">
          {/* Header Spacer matching top ruler height */}
          <div className="h-8 border-b border-gray-800 bg-gray-950 px-3 flex items-center justify-between text-[10px] font-mono text-gray-500">
            <span>TRACK LIST</span>
            <span>VOL / PAN</span>
          </div>

          {/* Track Headers List */}
          <div className="flex-1 flex flex-col">
            {project.tracks.map((track) => (
              <TimelineTrackHeader
                key={track.id}
                track={track}
                isSelected={selectedTrackId === track.id}
                onSelect={() => onSelectTrack(track.id)}
                onUpdateTrack={(updated) => {
                  const updatedTracks = project.tracks.map((t) =>
                    t.id === track.id ? { ...t, ...updated } : t
                  );
                  onUpdateProject({ ...project, tracks: updatedTracks });
                }}
                onDeleteTrack={() => {
                  if (project.tracks.length <= 1) return;
                  const updatedTracks = project.tracks.filter((t) => t.id !== track.id);
                  onUpdateProject({ ...project, tracks: updatedTracks });
                }}
              />
            ))}
          </div>
        </div>

        {/* Right Timeline Grid Column */}
        <div
          ref={timelineContainerRef}
          className="flex-1 flex flex-col overflow-x-auto overflow-y-auto relative bg-gray-950 scrollbar-thin scrollbar-thumb-gray-800"
        >
          {/* Time Ruler (Bars / Beats / Loop Region) */}
          <div
            onClick={handleRulerClick}
            style={{ width: `${timelineWidthPx}px` }}
            className="h-8 bg-gray-950 border-b border-gray-800 relative cursor-pointer select-none shrink-0"
          >
            {/* Loop Region Highlight */}
            {project.loopRegion.enabled && (
              <div
                style={{
                  left: `${project.loopRegion.startTick * pixelsPerTick}px`,
                  width: `${(project.loopRegion.endTick - project.loopRegion.startTick) * pixelsPerTick}px`,
                }}
                className="absolute top-0 bottom-0 bg-cyan-500/20 border-l-2 border-r-2 border-cyan-400 pointer-events-none"
              >
                <div className="absolute top-0 left-1 text-[9px] font-mono text-cyan-300 font-bold">
                  LOOP
                </div>
              </div>
            )}

            {/* Bar Numbers and Tick Divisions */}
            {bars.map((bar) => {
              const barTick = (bar - 1) * ticksPerBar;
              const barLeft = barTick * pixelsPerTick;
              return (
                <div
                  key={bar}
                  style={{ left: `${barLeft}px` }}
                  className="absolute top-0 bottom-0 border-l border-gray-700/80 px-1 flex flex-col justify-between pointer-events-none"
                >
                  <span className="text-[10px] font-mono font-bold text-gray-400">{bar}</span>
                  <div className="flex gap-2 text-[8px] text-gray-600 font-mono">
                    <span>.1</span>
                    <span>.2</span>
                    <span>.3</span>
                    <span>.4</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Track Rows Grid */}
          <div style={{ width: `${timelineWidthPx}px` }} className="relative flex-1">
            {/* 60fps Playhead Line */}
            <div
              id="daw-playhead-line"
              ref={playheadLineRef}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_10px_#f59e0b] z-30 pointer-events-none"
              style={{ transform: 'translateX(0px)' }}
            >
              <div className="w-2.5 h-2.5 bg-amber-400 -translate-x-[4px] -top-1 rotate-45" />
            </div>

            {/* Track Lanes */}
            {project.tracks.map((track) => (
              <div
                key={track.id}
                onDoubleClick={(e) => handleTrackLaneDoubleClick(track.id, e)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleAudioDrop(track.id, e)}
                className={`h-24 relative border-b border-gray-800/80 transition-colors ${
                  selectedTrackId === track.id ? 'bg-gray-900/40' : 'bg-gray-950 hover:bg-gray-900/20'
                }`}
              >
                {/* Vertical Bar Gridlines */}
                {bars.map((bar) => {
                  const barTick = (bar - 1) * ticksPerBar;
                  return (
                    <div
                      key={bar}
                      style={{ left: `${barTick * pixelsPerTick}px` }}
                      className="absolute top-0 bottom-0 border-l border-gray-850 pointer-events-none"
                    />
                  );
                })}

                {/* Clips Container */}
                {track.clips.map((clip) => (
                  <TimelineClipView
                    key={clip.id}
                    clip={clip}
                    pixelsPerTick={pixelsPerTick}
                    isSelected={selectedClipId === clip.id}
                    onSelect={() => {
                      onSelectTrack(track.id);
                      onSelectClip(clip);
                    }}
                    onDoubleClick={() => onDoubleClickClip(clip)}
                    onMove={(newStart) => handleMoveClip(track.id, clip.id, newStart)}
                    onResize={(newDur) => handleResizeClip(track.id, clip.id, newDur)}
                    onDuplicate={() => handleDuplicateClip(track.id, clip.id)}
                    onDelete={() => handleDeleteClip(track.id, clip.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
