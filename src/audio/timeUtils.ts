import type { GridSnapType } from '../types/daw';

export const PPQ = 192; // Pulses (ticks) per quarter note

/**
 * Converts ticks to a musical position [bar, beat, tick]
 * Bars and beats are 1-indexed (e.g. Bar 1, Beat 1, Tick 0)
 */
export function ticksToBarBeatTick(
  ticks: number,
  timeSignature: [number, number] = [4, 4]
): { bar: number; beat: number; tick: number; formatted: string } {
  const [beatsPerBar, beatValue] = timeSignature;
  // Calculate ticks per beat (e.g. 4/4 => 192 ticks/beat; 6/8 => 96 ticks/beat)
  const ticksPerBeat = (4 / beatValue) * PPQ;
  const ticksPerBar = ticksPerBeat * beatsPerBar;

  const safeTicks = Math.max(0, Math.floor(ticks));
  const bar = Math.floor(safeTicks / ticksPerBar) + 1;
  const remainderAfterBar = safeTicks % ticksPerBar;
  const beat = Math.floor(remainderAfterBar / ticksPerBeat) + 1;
  const tick = Math.floor(remainderAfterBar % ticksPerBeat);

  const formatted = `${bar}.${beat}.${String(tick).padStart(3, '0')}`;
  return { bar, beat, tick, formatted };
}

/**
 * Converts bar, beat, tick to absolute ticks
 */
export function barBeatTickToTicks(
  bar: number,
  beat: number,
  tick: number,
  timeSignature: [number, number] = [4, 4]
): number {
  const [beatsPerBar, beatValue] = timeSignature;
  const ticksPerBeat = (4 / beatValue) * PPQ;
  const ticksPerBar = ticksPerBeat * beatsPerBar;

  return (bar - 1) * ticksPerBar + (beat - 1) * ticksPerBeat + tick;
}

/**
 * Converts ticks to seconds based on tempo BPM
 */
export function ticksToSeconds(ticks: number, tempoBpm: number): number {
  const secondsPerQuarterNote = 60 / tempoBpm;
  const secondsPerTick = secondsPerQuarterNote / PPQ;
  return ticks * secondsPerTick;
}

/**
 * Converts seconds to ticks based on tempo BPM
 */
export function secondsToTicks(seconds: number, tempoBpm: number): number {
  const secondsPerQuarterNote = 60 / tempoBpm;
  const ticksPerSecond = PPQ / secondsPerQuarterNote;
  return Math.round(seconds * ticksPerSecond);
}

/**
 * Returns how many ticks constitute a given snap interval
 */
export function getSnapIntervalTicks(snap: GridSnapType): number {
  switch (snap) {
    case '1/4':
      return PPQ;             // 192
    case '1/8':
      return PPQ / 2;         // 96
    case '1/16':
      return PPQ / 4;         // 48
    case '1/32':
      return PPQ / 8;         // 24
    case '1/8t':
      return Math.round((PPQ * 2) / 3); // 128
    case '1/16t':
      return Math.round(PPQ / 3);       // 64
    case 'off':
    default:
      return 1;
  }
}

/**
 * Snaps a tick position to the nearest grid line
 */
export function snapTickToGrid(tick: number, snap: GridSnapType): number {
  if (snap === 'off') return Math.max(0, Math.round(tick));
  const interval = getSnapIntervalTicks(snap);
  return Math.max(0, Math.round(tick / interval) * interval);
}

/**
 * Formats seconds into mm:ss.ms
 */
export function formatTimeSeconds(seconds: number): string {
  const totalSecs = Math.max(0, seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  const millis = Math.floor((totalSecs % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}
