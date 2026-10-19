import React, { useEffect, useRef, useState } from 'react';
import { retroAudioEngine } from '../audio/retroAudioEngine';
import type { VisualizerMode } from '../types/sequencer';
import { Activity, BarChart3, Volume2 } from 'lucide-react';

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('waveform');
  const [vuLevel, setVuLevel] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark CRT background with slight phosphor persistence
      ctx.fillStyle = 'rgba(10, 14, 23, 0.28)';
      ctx.fillRect(0, 0, width, height);

      // Draw faint oscilloscope background grid
      ctx.strokeStyle = 'rgba(20, 45, 60, 0.4)';
      ctx.lineWidth = 1;
      const gridSpacing = 20;

      ctx.beginPath();
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Center baseline
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Retrieve audio data from engine
      const data = retroAudioEngine.getVisualizerData(mode);

      if (mode === 'waveform') {
        // Draw Waveform Oscilloscope
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const sliceWidth = width / data.length;
        let x = 0;
        let peakSum = 0;

        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0; // 0 to 2, 1 is center
          const y = (v * height) / 2;
          peakSum += Math.abs(data[i] - 128);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Update live VU meter level
        const avgPeak = Math.min(100, Math.round((peakSum / data.length) * 1.8));
        setVuLevel(isPlaying ? avgPeak : 0);
      } else {
        // Draw Retro Spectrum Equalizer Bars
        const numBars = 32;
        const barWidth = width / numBars - 2;
        const step = Math.floor(data.length / numBars);
        let peakSum = 0;

        for (let i = 0; i < numBars; i++) {
          const val = data[i * step] || 0;
          peakSum += val;
          const barHeight = (val / 255) * (height - 12);
          const x = i * (barWidth + 2) + 2;
          const y = height - barHeight - 4;

          // Color gradient: Cyan -> Emerald -> Yellow -> Red
          let barColor = '#06b6d4';
          if (val > 140) barColor = '#10b981';
          if (val > 190) barColor = '#f59e0b';
          if (val > 230) barColor = '#ef4444';

          ctx.fillStyle = barColor;
          ctx.shadowColor = barColor;
          ctx.shadowBlur = 6;
          ctx.fillRect(x, y, barWidth, barHeight);

          // Glowing peak cap
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y - 2, barWidth, 2);
        }

        ctx.shadowBlur = 0;
        const avgPeak = Math.min(100, Math.round((peakSum / numBars / 255) * 100));
        setVuLevel(isPlaying ? avgPeak : 0);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, isPlaying]);

  return (
    <div className="relative rounded-lg bg-retro-surface border-2 border-retro-border p-3 shadow-inner">
      {/* Top Bar: Title & Mode Toggles */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-retro-cyan animate-pulse shadow-glow-cyan" />
          <span className="font-mono text-xs uppercase tracking-wider text-cyan-400 font-bold">
            MASTER OSCILLOSCOPE / FFT
          </span>
        </div>

        <div className="flex items-center gap-1 bg-black/60 p-1 rounded border border-retro-border">
          <button
            onClick={() => setMode('waveform')}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded transition-colors ${
              mode === 'waveform'
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Waveform (Oscilloscope)"
          >
            <Activity className="w-3 h-3" />
            WAVE
          </button>
          <button
            onClick={() => setMode('spectrum')}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded transition-colors ${
              mode === 'spectrum'
                ? 'bg-pink-500/30 text-pink-300 border border-pink-500/50'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Frequency Spectrum"
          >
            <BarChart3 className="w-3 h-3" />
            RTA
          </button>
        </div>
      </div>

      {/* Main Canvas + VU Meter Container */}
      <div className="flex gap-3 items-center">
        {/* Canvas Screen with CRT Scanlines Overlay */}
        <div className="relative flex-1 h-32 rounded bg-black overflow-hidden border border-cyan-900/40">
          <canvas
            ref={canvasRef}
            width={480}
            height={128}
            className="w-full h-full block"
          />
          {/* Scanline texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.8) 50%)',
              backgroundSize: '100% 4px',
            }}
          />
        </div>

        {/* Retro Stereo VU Meters */}
        <div className="w-16 bg-black/80 rounded p-2 border border-retro-border flex flex-col justify-between h-32">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
            <Volume2 className="w-3 h-3 text-cyan-400" />
            <span>VU</span>
          </div>

          {/* LED Bar Segment Display */}
          <div className="flex gap-1.5 justify-center h-20 items-end">
            {/* Left Channel */}
            <div className="w-3 h-full bg-gray-950 rounded flex flex-col-reverse gap-0.5 p-0.5">
              {Array.from({ length: 12 }).map((_, i) => {
                const threshold = (i / 12) * 100;
                const lit = vuLevel >= threshold;
                let color = 'bg-cyan-500';
                if (i >= 8) color = 'bg-amber-400';
                if (i >= 10) color = 'bg-rose-500';

                return (
                  <span
                    key={i}
                    className={`w-full h-1 rounded-xs transition-opacity duration-75 ${
                      lit ? `${color} opacity-100 shadow-[0_0_4px_currentColor]` : 'bg-gray-800/40 opacity-30'
                    }`}
                  />
                );
              })}
            </div>

            {/* Right Channel */}
            <div className="w-3 h-full bg-gray-950 rounded flex flex-col-reverse gap-0.5 p-0.5">
              {Array.from({ length: 12 }).map((_, i) => {
                const threshold = (i / 12) * 100;
                // slight jitter for natural stereo realism
                const lit = vuLevel * 0.95 >= threshold;
                let color = 'bg-cyan-500';
                if (i >= 8) color = 'bg-amber-400';
                if (i >= 10) color = 'bg-rose-500';

                return (
                  <span
                    key={i}
                    className={`w-full h-1 rounded-xs transition-opacity duration-75 ${
                      lit ? `${color} opacity-100 shadow-[0_0_4px_currentColor]` : 'bg-gray-800/40 opacity-30'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="text-center font-mono text-[9px] text-gray-500">
            {vuLevel > 0 ? `-${Math.max(0, 30 - Math.round(vuLevel * 0.3))}dB` : '-INF'}
          </div>
        </div>
      </div>
    </div>
  );
};
