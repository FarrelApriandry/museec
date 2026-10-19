export type MidiNoteListener = (event: {
  type: 'noteon' | 'noteoff';
  noteNumber: number;
  pitch: string;
  velocity: number;
}) => void;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiNumberToNoteName(noteNumber: number): string {
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteName = NOTE_NAMES[noteNumber % 12];
  return `${noteName}${octave}`;
}

export function midiNumberToFrequency(noteNumber: number): number {
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

export class WebMidiManager {
  private midiAccess: any = null;
  private isSupported: boolean = false;
  private listeners: Set<MidiNoteListener> = new Set();
  private connectedDeviceNames: string[] = [];

  public async init(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.requestMIDIAccess) {
      this.isSupported = false;
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.isSupported = true;
      this.setupInputs();

      this.midiAccess.onstatechange = () => {
        this.setupInputs();
      };

      return true;
    } catch {
      this.isSupported = false;
      return false;
    }
  }

  private setupInputs(): void {
    if (!this.midiAccess) return;

    this.connectedDeviceNames = [];
    const inputs = this.midiAccess.inputs.values();

    for (const input of inputs) {
      this.connectedDeviceNames.push(input.name || 'MIDI Controller');
      input.onmidimessage = this.handleMidiMessage.bind(this);
    }
  }

  private handleMidiMessage(event: any): void {
    const [status, noteNumber, velocity] = event.data;
    const command = status >> 4;

    // 9 = Note On (velocity > 0), 8 = Note Off (or Note On with velocity 0)
    if (command === 9 && velocity > 0) {
      const pitch = midiNumberToNoteName(noteNumber);
      const vel = velocity / 127;
      this.listeners.forEach((listener) =>
        listener({ type: 'noteon', noteNumber, pitch, velocity: vel })
      );
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      const pitch = midiNumberToNoteName(noteNumber);
      this.listeners.forEach((listener) =>
        listener({ type: 'noteoff', noteNumber, pitch, velocity: 0 })
      );
    }
  }

  public subscribe(listener: MidiNoteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getDevices(): string[] {
    return this.connectedDeviceNames;
  }

  public get supported(): boolean {
    return this.isSupported;
  }
}

export const webMidiManager = new WebMidiManager();
