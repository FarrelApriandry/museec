import React from 'react';
import { Download, FileAudio, X, Play } from 'lucide-react';

interface AudioRecordingModalProps {
  wavBlob: Blob | null;
  webmBlob: Blob;
  onClose: () => void;
}

export const AudioRecordingModal: React.FC<AudioRecordingModalProps> = ({
  wavBlob,
  webmBlob,
  onClose,
}) => {
  const wavUrl = wavBlob ? URL.createObjectURL(wavBlob) : null;
  const webmUrl = URL.createObjectURL(webmBlob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-retro-surface border-2 border-retro-cyan rounded-xl w-full max-w-md p-6 font-mono text-gray-200 shadow-glow-cyan">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-retro-border">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              SESSION RECORDING COMPLETE
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Preview Player */}
        <div className="bg-black/60 p-4 rounded-lg border border-retro-border mb-5">
          <div className="text-[11px] text-gray-400 mb-2 flex items-center gap-1.5">
            <FileAudio className="w-4 h-4 text-cyan-400" />
            <span>PLAYBACK AUDIO PREVIEW:</span>
          </div>
          <audio controls src={wavUrl || webmUrl} className="w-full h-10 accent-cyan-400" />
        </div>

        {/* Export Options */}
        <div className="space-y-3 mb-5">
          {wavBlob && (
            <a
              href={wavUrl!}
              download={`chiptune-16bit-${timestamp}.wav`}
              className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/20 border border-cyan-400/60 hover:bg-cyan-500/30 transition-all text-cyan-300 font-bold text-xs group"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
                <div>
                  <div className="text-white">Download Lossless 16-Bit WAV</div>
                  <div className="text-[10px] text-cyan-400/80 font-normal">
                    44.1 kHz &bull; 16-Bit PCM &bull; Studio Master Quality
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] border border-cyan-700">
                .WAV
              </span>
            </a>
          )}

          <a
            href={webmUrl}
            download={`chiptune-stream-${timestamp}.webm`}
            className="flex items-center justify-between p-3 rounded-lg bg-retro-card border border-retro-border hover:bg-retro-border/60 transition-all text-gray-300 font-bold text-xs group"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-gray-400 group-hover:translate-y-0.5 transition-transform" />
              <div>
                <div className="text-white">Download Compressed WebM</div>
                <div className="text-[10px] text-gray-400 font-normal">
                  Standard Web Media Container
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-black text-gray-400 text-[10px] border border-gray-700">
              .WEBM
            </span>
          </a>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-800 text-gray-300 font-bold text-xs rounded hover:bg-gray-700 transition-colors"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};
