import React from 'react';
import type { MidiClip, DrumStepEvent } from '../../types/daw';
import { Radio, Volume2 } from 'lucide-react';

interface StepSequencerViewProps {
  clip: MidiClip | null;
  onUpdateDrumSteps: (updatedSteps: DrumStepEvent[]) => void;
}

export const StepSequencerView: React.FC<StepSequencerViewProps> = ({
  clip,
  onUpdateDrumSteps,
}) => {
  if (!clip) {
    return (
      <div className="h-72 flex items-center justify-center bg-gray-950 text-gray-500 font-mono text-xs select-none">
        Select a Drum clip on the timeline to program beats in the Step Matrix
      </div>
    );
  }

  const stepCount = 16;
  const currentSteps = clip.drumSteps || [];

  const drumVoices = [
    { id: 'kick', label: 'Kick Drum (Kendang Ageng)', color: 'bg-red-500' },
    { id: 'snare', label: 'Snare Drum (Ketipung)', color: 'bg-amber-400' },
    { id: 'hihat_closed', label: 'Hi-Hat Closed (Kemanak)', color: 'bg-cyan-400' },
    { id: 'hihat_open', label: 'Hi-Hat Open', color: 'bg-emerald-400' },
    { id: 'zap', label: '16-Bit Zap / Perc', color: 'bg-purple-400' },
  ];

  const handleStepToggle = (voiceKey: string, stepIndex: number) => {
    const tick = stepIndex * 48; // 16th note = 48 ticks
    let existingIndex = currentSteps.findIndex((s) => s.tick === tick);

    let updated = [...currentSteps];
    if (existingIndex !== -1) {
      const step = { ...updated[existingIndex] };
      (step as any)[voiceKey] = !(step as any)[voiceKey];
      updated[existingIndex] = step;
    } else {
      const newStep: DrumStepEvent = {
        tick,
        kick: voiceKey === 'kick',
        snare: voiceKey === 'snare',
        hihat_closed: voiceKey === 'hihat_closed',
        hihat_open: voiceKey === 'hihat_open',
        zap: voiceKey === 'zap',
        velocity: 0.8,
      };
      updated.push(newStep);
    }

    onUpdateDrumSteps(updated);
  };

  return (
    <div className="h-72 bg-gray-950 border-t border-gray-800 flex flex-col select-none p-3 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-400">🥁 Step Matrix: {clip.name}</span>
          <span className="text-[10px] text-gray-400 font-mono">16-Step Pattern Sequencer</span>
        </div>
      </div>

      {/* 16-Step Grid Rows */}
      <div className="flex-1 pt-3 flex flex-col gap-2">
        {drumVoices.map((voice) => (
          <div key={voice.id} className="flex items-center gap-2">
            {/* Voice Label */}
            <div className="w-44 text-[11px] font-mono text-gray-300 flex items-center gap-1.5 shrink-0 truncate">
              <span className={`w-2 h-2 rounded-full ${voice.color}`} />
              <span className="truncate">{voice.label}</span>
            </div>

            {/* 16 Step Buttons */}
            <div className="flex items-center gap-1 flex-1">
              {Array.from({ length: stepCount }).map((_, stepIdx) => {
                const tick = stepIdx * 48;
                const step = currentSteps.find((s) => s.tick === tick);
                const isActive = step ? !!(step as any)[voice.id] : false;
                const isQuarter = stepIdx % 4 === 0;

                return (
                  <button
                    key={stepIdx}
                    onClick={() => handleStepToggle(voice.id, stepIdx)}
                    className={`h-7 flex-1 rounded font-mono text-[9px] font-bold transition-all flex items-center justify-center ${
                      isActive
                        ? `${voice.color} text-black shadow-md scale-95`
                        : isQuarter
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-500 border border-gray-700/50'
                        : 'bg-gray-900 hover:bg-gray-800 text-gray-600'
                    }`}
                  >
                    {stepIdx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
