import type { AudioClip } from '../types/daw';

// In-memory cache of decoded AudioBuffers for playback
export const audioBufferCache = new Map<string, AudioBuffer>();

/**
 * Extracts normalized peak amplitudes from an AudioBuffer for fast waveform rendering
 */
export function extractAudioPeaks(audioBuffer: AudioBuffer, targetPeakCount: number = 200): number[] {
  const channelData = audioBuffer.getChannelData(0); // Take first channel (or mix)
  const totalSamples = channelData.length;
  const blockSize = Math.floor(totalSamples / targetPeakCount);
  const peaks: number[] = [];

  for (let i = 0; i < targetPeakCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let max = 0;

    for (let j = start; j < end; j++) {
      const absVal = Math.abs(channelData[j]);
      if (absVal > max) max = absVal;
    }
    peaks.push(Math.min(1.0, max));
  }

  return peaks;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording: boolean = false;
  private recordStartTime: number = 0;

  public async start(): Promise<void> {
    if (this.isRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // 100ms chunk slices
    this.isRecording = true;
    this.recordStartTime = performance.now();
  }

  public async stop(
    trackId: string,
    startTick: number,
    ticksPerSecond: number
  ): Promise<AudioClip | null> {
    if (!this.isRecording || !this.mediaRecorder) return null;

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return resolve(null);

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          this.recordedChunks = [];

          // Release mic stream tracks
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const decodedAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

          const clipId = `clip-audio-${Date.now()}`;
          const bufferId = `buf-${clipId}`;

          // Cache audio buffer
          audioBufferCache.set(bufferId, decodedAudioBuffer);

          const durationSeconds = decodedAudioBuffer.duration;
          const durationTicks = Math.round(durationSeconds * ticksPerSecond);
          const peaks = extractAudioPeaks(decodedAudioBuffer, 200);

          const audioClip: AudioClip = {
            id: clipId,
            type: 'audio',
            name: `Mic Rec ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            trackId,
            startTick,
            durationTicks,
            durationSeconds,
            offsetSeconds: 0,
            gain: 1.0,
            fadeInTicks: 24,
            fadeOutTicks: 24,
            peaks,
            color: '#f97316', // Orange
          };

          this.isRecording = false;
          resolve(audioClip);
        } catch (err) {
          this.isRecording = false;
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  public get recording(): boolean {
    return this.isRecording;
  }
}

export const audioRecorder = new AudioRecorder();
