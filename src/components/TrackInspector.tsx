import React from 'react';
import type { TrackData, WaveformType, ArpSettings, TrackInstrumentMode, SamplePresetId } from '../types/sequencer';
import { Volume2, VolumeX, Radio, Sparkles, Sliders, Play, RotateCcw, Shuffle, Layers } from 'lucide-react';
import { retroAudioEngine } from '../audio/retroAudioEngine';

interface TrackInspectorProps {
  track: TrackData;
  onUpdateTrack: (updated: TrackData) => void;
  onClose?: () => void;
}

export const TrackInspector: React.FC<TrackInspectorProps> = ({
  track,
  onUpdateTrack,
  onClose,
}) => {
  const isMelodic = track.type !== 'drums';

  const updateEnvelope = (field: keyof TrackData['envelope'], value: number) => {
    const updated: TrackData = {
      ...track,
      envelope: {
        ...track.envelope,
        [field]: value,
      },
    };
    onUpdateTrack(updated);
  };

  const updateArp = (field: keyof ArpSettings, value: unknown) => {
    const updated: TrackData = {
      ...track,
      arp: {
        ...track.arp,
        [field]: value,
      },
    };
    onUpdateTrack(updated);
  };

  const handlePreview = () => {
    if (track.type === 'drums') {
      retroAudioEngine.previewDrum('kick');
    } else {
      retroAudioEngine.previewNote(440, track.type);
    }
  };

  return (
    <div className="bg-retro-surface border-2 border-retro-border rounded-lg p-3 text-gray-200 text-xs font-mono shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-retro-border">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: track.color }}
          />
          <h3 className="font-bold text-xs tracking-wider uppercase text-white">
            {track.name} &bull; Channel {track.channelNumber}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 rounded hover:bg-cyan-600/50 transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            AUDITION
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Column 1: Instrument Engine (Hybrid Sampler vs Chip Synth) */}
        <div className="space-y-2.5 bg-black/40 p-2.5 rounded border border-retro-border">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[11px]">
              SOUND ENGINE
            </span>
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          {/* Instrument Mode Selector */}
          {isMelodic ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 bg-retro-card p-1 rounded border border-retro-border">
                <button
                  onClick={() => onUpdateTrack({ ...track, instrumentMode: 'synth' })}
                  className={`py-1 rounded text-[10px] font-bold transition-colors ${
                    track.instrumentMode === 'synth'
                      ? 'bg-cyan-500 text-black shadow-glow-cyan'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  CHIP SYNTH
                </button>
                <button
                  onClick={() =>
                    onUpdateTrack({
                      ...track,
                      instrumentMode: 'sampler',
                      samplePreset: track.samplePreset === 'none' ? 'saron' : track.samplePreset,
                    })
                  }
                  className={`py-1 rounded text-[10px] font-bold transition-colors ${
                    track.instrumentMode === 'sampler'
                      ? 'bg-pink-500 text-white shadow-glow-magenta'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ACOUSTIC SAMPLER
                </button>
              </div>

              {/* Sampler Instrument Selector */}
              {track.instrumentMode === 'sampler' ? (
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">ACOUSTIC PRESET</label>
                  <select
                    value={track.samplePreset}
                    onChange={(e) =>
                      onUpdateTrack({
                        ...track,
                        samplePreset: e.target.value as SamplePresetId,
                      })
                    }
                    className="w-full bg-retro-card border border-retro-border rounded px-2 py-1 text-pink-300 font-bold"
                  >
                    <option value="saron">Saron (Bronze Metallophone)</option>
                    <option value="bonang">Bonang (Kettle Gong)</option>
                    <option value="suling">Suling (Bamboo Flute)</option>
                    <option value="siter">Siter (Plucked Zither)</option>
                  </select>
                </div>
              ) : (
                /* Waveform selector */
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">CHIP OSCILLATOR</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['square', 'pulse', 'triangle', 'sawtooth', 'sine'] as WaveformType[]).map(
                      (wave) => (
                        <button
                          key={wave}
                          onClick={() => onUpdateTrack({ ...track, waveform: wave })}
                          className={`py-1 px-1 rounded text-[10px] font-bold uppercase border transition-colors ${
                            track.waveform === wave
                              ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400'
                              : 'bg-retro-card text-gray-400 border-retro-border hover:text-white'
                          }`}
                        >
                          {wave}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Octave Shift */}
              <div className="flex items-center justify-between pt-1 border-t border-retro-border/60">
                <span className="text-gray-400 text-[10px]">Octave Transpose</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      onUpdateTrack({
                        ...track,
                        octaveOffset: Math.max(-2, track.octaveOffset - 1),
                      })
                    }
                    className="w-5 h-5 bg-retro-card rounded border border-retro-border text-white text-xs"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-cyan-300 font-bold">
                    {track.octaveOffset >= 0 ? `+${track.octaveOffset}` : track.octaveOffset}
                  </span>
                  <button
                    onClick={() =>
                      onUpdateTrack({
                        ...track,
                        octaveOffset: Math.min(2, track.octaveOffset + 1),
                      })
                    }
                    className="w-5 h-5 bg-retro-card rounded border border-retro-border text-white text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-[10px] space-y-1">
              <p>Ethnic & Retro Drum Voice Generator</p>
              <p className="text-amber-300">&bull; Dhung (Kendang Ageng kick)</p>
              <p className="text-amber-300">&bull; Tak (Ketipung rim slap)</p>
              <p className="text-amber-300">&bull; Bamboo & Ceng-ceng Shaker</p>
              <p className="text-amber-300">&bull; Kentongan Woodblock</p>
            </div>
          )}
        </div>

        {/* Column 2: ADSR Envelope */}
        <div className="space-y-2 bg-black/40 p-2.5 rounded border border-retro-border">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[11px]">
              ADSR ENVELOPE
            </span>
            <Sliders className="w-3.5 h-3.5 text-pink-400" />
          </div>

          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Attack</span>
                <span className="text-pink-300 font-bold">{(track.envelope.attack * 1000).toFixed(0)}ms</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.4"
                step="0.005"
                value={track.envelope.attack}
                onChange={(e) => updateEnvelope('attack', parseFloat(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-gray-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Decay</span>
                <span className="text-pink-300 font-bold">{(track.envelope.decay * 1000).toFixed(0)}ms</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.8"
                step="0.01"
                value={track.envelope.decay}
                onChange={(e) => updateEnvelope('decay', parseFloat(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-gray-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Sustain</span>
                <span className="text-pink-300 font-bold">{Math.round(track.envelope.sustain * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={track.envelope.sustain}
                onChange={(e) => updateEnvelope('sustain', parseFloat(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-gray-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Release</span>
                <span className="text-pink-300 font-bold">{(track.envelope.release * 1000).toFixed(0)}ms</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.8"
                step="0.01"
                value={track.envelope.release}
                onChange={(e) => updateEnvelope('release', parseFloat(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-gray-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Arpeggiator & Track Gain */}
        <div className="space-y-2.5 bg-black/40 p-2.5 rounded border border-retro-border">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[11px]">
              FAST ARPEGGIATOR
            </span>
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          </div>

          <div className="flex items-center justify-between bg-retro-card p-1.5 rounded border border-retro-border">
            <span className="text-[10px] font-bold text-gray-300">Fast Arp</span>
            <button
              onClick={() => updateArp('enabled', !track.arp.enabled)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                track.arp.enabled
                  ? 'bg-yellow-500 text-black shadow-glow-amber'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {track.arp.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-gray-400 text-[9px] block mb-0.5">RATE</label>
              <select
                value={track.arp.rate}
                onChange={(e) => updateArp('rate', e.target.value)}
                className="w-full bg-retro-card border border-retro-border rounded px-1.5 py-0.5 text-white text-[10px]"
              >
                <option value="1/16">1/16</option>
                <option value="1/32">1/32</option>
                <option value="1/64">1/64</option>
                <option value="60Hz">60Hz</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-[9px] block mb-0.5">PATTERN</label>
              <select
                value={track.arp.pattern}
                onChange={(e) => updateArp('pattern', e.target.value)}
                className="w-full bg-retro-card border border-retro-border rounded px-1.5 py-0.5 text-white text-[10px]"
              >
                <option value="minor">Minor 3rd</option>
                <option value="major">Major 3rd</option>
                <option value="octave">Octaves</option>
                <option value="fifth">Fifth</option>
                <option value="up">Up</option>
              </select>
            </div>
          </div>

          {/* Volume & Pan */}
          <div className="pt-1.5 border-t border-retro-border/60 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-400">Track Gain</span>
              <span className="text-cyan-400 font-bold">{track.volume} dB</span>
            </div>
            <input
              type="range"
              min="-24"
              max="6"
              step="1"
              value={track.volume}
              onChange={(e) => onUpdateTrack({ ...track, volume: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 h-1 bg-gray-800 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
