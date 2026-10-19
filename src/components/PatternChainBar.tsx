import React, { useEffect, useRef } from 'react';
import type { SongProject, PatternData } from '../types/sequencer';
import { retroAudioEngine } from '../audio/retroAudioEngine';
import { Play, Repeat, Plus, Trash2, Layers } from 'lucide-react';

interface PatternChainBarProps {
  project: SongProject;
  activePatternId: string;
  onSelectPattern: (patternId: string) => void;
  onUpdateStepCount: (stepCount: 16 | 32 | 64) => void;
  onUpdateChain: (chain: string[]) => void;
  onToggleChainMode: (enabled: boolean) => void;
  onAddPattern: (copyFromId?: string) => void;
}

export const PatternChainBar: React.FC<PatternChainBarProps> = ({
  project,
  activePatternId,
  onSelectPattern,
  onUpdateStepCount,
  onUpdateChain,
  onToggleChainMode,
  onAddPattern,
}) => {
  const chainItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 60fps Playhead subscription for zero-lag chain item highlight without full React re-renders!
  useEffect(() => {
    const unsubscribe = retroAudioEngine.subscribePlayhead((_step, _patId, chainIdx) => {
      chainItemRefs.current.forEach((el, idx) => {
        if (!el) return;
        if (project.chainMode && idx === chainIdx) {
          el.classList.add('border-cyan-400', 'bg-cyan-950/80', 'shadow-[0_0_8px_#06b6d4]');
        } else {
          el.classList.remove('border-cyan-400', 'bg-cyan-950/80', 'shadow-[0_0_8px_#06b6d4]');
        }
      });
    });
    return () => unsubscribe();
  }, [project.chainMode]);

  const activePattern = project.patterns[activePatternId] || Object.values(project.patterns)[0];
  const patternIds = Object.keys(project.patterns);

  const handleAppendToChain = (pid: string) => {
    onUpdateChain([...project.patternChain, pid]);
  };

  const handleRemoveFromChain = (index: number) => {
    const updated = [...project.patternChain];
    updated.splice(index, 1);
    onUpdateChain(updated);
  };

  return (
    <div className="bg-retro-surface rounded-lg p-3 border-2 border-retro-border text-xs font-mono space-y-2.5">
      {/* Top: Pattern Selectors & Step Count Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-retro-border">
        {/* Pattern Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-gray-400 font-bold uppercase mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            PATTERNS:
          </span>
          {patternIds.map((pid) => {
            const pat = project.patterns[pid];
            const isSelected = pid === activePatternId;
            return (
              <button
                key={pid}
                onClick={() => onSelectPattern(pid)}
                className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                  isSelected
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-glow-cyan'
                    : 'bg-retro-card text-gray-300 border-retro-border hover:bg-retro-border'
                }`}
              >
                {pat.name.split(':')[0] || pid.toUpperCase()} ({pat.stepCount}s)
              </button>
            );
          })}
          {patternIds.length < 6 && (
            <button
              onClick={() => onAddPattern(activePatternId)}
              className="px-2 py-1 bg-retro-card hover:bg-retro-border text-gray-400 hover:text-white rounded border border-dashed border-gray-600 flex items-center gap-1 text-[10px]"
              title="Duplicate & Add New Pattern"
            >
              <Plus className="w-3 h-3" />
              NEW PATTERN
            </button>
          )}
        </div>

        {/* Step Count (16 / 32 / 64) */}
        {activePattern && (
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded border border-retro-border">
            <span className="text-[10px] text-gray-400 uppercase font-bold pl-1 mr-1">
              LENGTH:
            </span>
            {([16, 32, 64] as const).map((count) => (
              <button
                key={count}
                onClick={() => onUpdateStepCount(count)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  activePattern.stepCount === count
                    ? 'bg-pink-500 text-white shadow-glow-magenta'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {count} STEPS
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Pattern Chain Sequencer Arranger */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          {/* Mode Toggle Button */}
          <button
            onClick={() => onToggleChainMode(!project.chainMode)}
            className={`px-2.5 py-1 rounded font-bold text-xs flex items-center gap-1.5 border transition-all ${
              project.chainMode
                ? 'bg-amber-500 text-black border-amber-400 shadow-glow-amber'
                : 'bg-retro-card text-gray-400 border-retro-border hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {project.chainMode ? 'CHAIN MODE [ACTIVE]' : 'SINGLE LOOP'}
          </button>

          {/* Chain Items Flow */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 flex-1">
            {project.patternChain.length === 0 ? (
              <span className="text-gray-500 text-[11px] italic">
                Chain empty. Append patterns below to arrange your song structure.
              </span>
            ) : (
              project.patternChain.map((pid, idx) => {
                const pat = project.patterns[pid];
                return (
                  <div
                    key={`${pid}-${idx}`}
                    ref={(el) => {
                      chainItemRefs.current[idx] = el;
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-retro-card border border-retro-border shrink-0 transition-all text-[11px]"
                  >
                    <span className="font-bold text-white">
                      {idx + 1}. {pat ? pat.name.split(':')[0] : pid}
                    </span>
                    <button
                      onClick={() => handleRemoveFromChain(idx)}
                      className="text-gray-500 hover:text-rose-400 ml-1"
                    >
                      &times;
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Append Pattern Quick Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-gray-400 uppercase">APPEND:</span>
          {patternIds.map((pid) => (
            <button
              key={pid}
              onClick={() => handleAppendToChain(pid)}
              className="px-2 py-0.5 bg-black/60 hover:bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded text-[10px] font-bold"
            >
              +{pid.replace('pattern-', '').toUpperCase()}
            </button>
          ))}
          {project.patternChain.length > 0 && (
            <button
              onClick={() => onUpdateChain([])}
              className="px-1.5 py-0.5 text-gray-500 hover:text-rose-400 text-[10px]"
              title="Clear Chain"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
