import type { ScaleDefinition, ScaleId, ScaleNote } from '../types/sequencer';

export const SCALES: Record<ScaleId, ScaleDefinition> = {
  'slendro': {
    id: 'slendro',
    name: 'True Gamelan Slendro (5-Tone Microtonal)',
    description: 'Equidistant ~240 cent Javanese gamelan scale (1 Panunggul, 2 Gulu, 3 Dada, 5 Lima, 6 Nem).',
    tuningType: 'microtonal',
    notesPerOctave: 5,
    baseFrequency: 261.63, // C4 equivalent base
    intervalsCents: [0, 240, 480, 720, 960],
    degreeNames: ['1. Panunggul (Ji)', '2. Gulu (Ro)', '3. Dada (Lu)', '5. Lima (Ma)', '6. Nem (Nem)'],
  },
  'pelog': {
    id: 'pelog',
    name: 'True Gamelan Pelog (7-Tone Non-Equal)',
    description: 'Authentic 7-tone non-equal Javanese gamelan scale with narrow and wide intervals.',
    tuningType: 'microtonal',
    notesPerOctave: 7,
    baseFrequency: 261.63,
    intervalsCents: [0, 130, 285, 540, 675, 810, 1090],
    degreeNames: [
      '1. Bem / Panunggul',
      '2. Gulu',
      '3. Dada',
      '4. Pelog',
      '5. Lima',
      '6. Nem',
      '7. Barang',
    ],
  },
  'pentatonic-minor': {
    id: 'pentatonic-minor',
    name: 'Minor Pentatonic (12-TET)',
    description: 'Classic versatile pentatonic scale (Root, Min 3rd, 4th, 5th, Min 7th).',
    tuningType: '12tet',
    notesPerOctave: 5,
    baseFrequency: 220.0, // A3
    intervalsCents: [0, 300, 500, 700, 1000],
    degreeNames: ['A', 'C', 'D', 'E', 'G'],
  },
  'dorian': {
    id: 'dorian',
    name: 'Dorian Mode (12-TET)',
    description: 'Folk & RPG adventure mode with bright Major 6th and nostalgic Minor 3rd.',
    tuningType: '12tet',
    notesPerOctave: 7,
    baseFrequency: 220.0, // A3
    intervalsCents: [0, 200, 300, 500, 700, 900, 1000],
    degreeNames: ['A', 'B', 'C', 'D', 'E', 'F#', 'G'],
  },
  'chromatic': {
    id: 'chromatic',
    name: 'Full Chromatic (12-TET)',
    description: 'Standard 12-Tone Equal Temperament containing all semitones.',
    tuningType: '12tet',
    notesPerOctave: 12,
    baseFrequency: 261.63, // C4
    intervalsCents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
    degreeNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  },
};

export const SCALES_LIST = Object.values(SCALES);

export function centsToFreq(baseFreq: number, cents: number): number {
  return baseFreq * Math.pow(2, cents / 1200);
}

/**
 * Returns available notes for a given scale across selected octaves (default: octaves 2 to 5)
 */
export function getScaleNotes(
  scaleId: ScaleId,
  octaves: number[] | number = [2, 3, 4, 5]
): ScaleNote[] {
  const scale = SCALES[scaleId] || SCALES['pentatonic-minor'];
  const result: ScaleNote[] = [];

  const octList: number[] = Array.isArray(octaves)
    ? octaves
    : typeof octaves === 'number'
    ? Array.from({ length: octaves }, (_, i) => i + 2)
    : [2, 3, 4, 5];

  octList.forEach((oct) => {
    // Octave 4 is reference octave multiplier 1.0 (2^(4-4) = 1)
    const octaveMultiplier = Math.pow(2, oct - 4);
    const octaveBaseFreq = scale.baseFrequency * octaveMultiplier;

    scale.intervalsCents.forEach((cents, degreeIdx) => {
      const freq = centsToFreq(octaveBaseFreq, cents);
      const degreeName = scale.degreeNames[degreeIdx];

      let label: string;
      if (scale.tuningType === 'microtonal') {
        const shortName = degreeName.split('.')[0] || `${degreeIdx + 1}`;
        label = `${scale.id === 'slendro' ? 'SL' : 'PL'}${shortName}-${oct}`;
      } else {
        label = `${degreeName}${oct}`;
      }

      result.push({
        label,
        traditionalName: degreeName,
        freq: Math.round(freq * 100) / 100,
        centOffset: cents,
        degree: degreeIdx + 1,
        octave: oct,
      });
    });
  });

  return result;
}

/**
 * Resolve frequency for a given note label and scale (order-independent)
 */
export function getFreqForNote(paramA: string, paramB?: string): number {
  let scaleId: ScaleId = 'pelog';
  let noteLabel = 'C4';

  if (paramA && paramA in SCALES) {
    scaleId = paramA as ScaleId;
    noteLabel = paramB || 'C4';
  } else if (paramB && paramB in SCALES) {
    scaleId = paramB as ScaleId;
    noteLabel = paramA || 'C4';
  } else {
    noteLabel = paramA || 'C4';
  }

  const allNotes = getScaleNotes(scaleId, [1, 2, 3, 4, 5, 6]);
  const found = allNotes.find((n) => n.label === noteLabel);
  if (found) return found.freq;

  // Fallback 12-TET standard note parser e.g. "C4", "A#4"
  const match = noteLabel.match(/^([A-G]#?)([0-9])$/);
  if (match) {
    const note = match[1];
    const oct = parseInt(match[2], 10);
    const semitonesFromA4: Record<string, number> = {
      C: -9,
      'C#': -8,
      D: -7,
      'D#': -6,
      E: -5,
      F: -4,
      'F#': -3,
      G: -2,
      'G#': -1,
      A: 0,
      'A#': 1,
      B: 2,
    };
    const semi = (semitonesFromA4[note] ?? 0) + (oct - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
  }

  return 440;
}
