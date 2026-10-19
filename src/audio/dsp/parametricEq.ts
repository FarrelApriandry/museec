import * as Tone from 'tone';
import type { Eq4Params } from '../../types/daw';

export class ParametricEqNode {
  public input: Tone.Gain;
  public output: Tone.Gain;

  private lowShelf: Tone.Filter;
  private mid1Bell: Tone.BiquadFilter;
  private mid2Bell: Tone.BiquadFilter;
  private highShelf: Tone.Filter;

  constructor(initialParams?: Partial<Eq4Params>) {
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);

    const params: Eq4Params = {
      lowGain: 0,
      lowFreq: 100,
      mid1Gain: 0,
      mid1Freq: 800,
      mid1Q: 1.0,
      mid2Gain: 0,
      mid2Freq: 3000,
      mid2Q: 1.0,
      highGain: 0,
      highFreq: 10000,
      ...initialParams,
    };

    // Low Shelf Filter
    this.lowShelf = new Tone.Filter({
      type: 'lowshelf',
      frequency: params.lowFreq,
      gain: params.lowGain,
    });

    // Mid 1 Peaking / Bell Filter
    this.mid1Bell = new Tone.BiquadFilter({
      type: 'peaking',
      frequency: params.mid1Freq,
      gain: params.mid1Gain,
      Q: params.mid1Q,
    });

    // Mid 2 Peaking / Bell Filter
    this.mid2Bell = new Tone.BiquadFilter({
      type: 'peaking',
      frequency: params.mid2Freq,
      gain: params.mid2Gain,
      Q: params.mid2Q,
    });

    // High Shelf Filter
    this.highShelf = new Tone.Filter({
      type: 'highshelf',
      frequency: params.highFreq,
      gain: params.highGain,
    });

    // Connect in series: input -> lowShelf -> mid1 -> mid2 -> highShelf -> output
    this.input.connect(this.lowShelf);
    this.lowShelf.connect(this.mid1Bell);
    this.mid1Bell.connect(this.mid2Bell);
    this.mid2Bell.connect(this.highShelf);
    this.highShelf.connect(this.output);
  }

  public updateParams(params: Partial<Eq4Params>): void {
    if (params.lowGain !== undefined) this.lowShelf.gain.value = params.lowGain;
    if (params.lowFreq !== undefined) this.lowShelf.frequency.value = params.lowFreq;

    if (params.mid1Gain !== undefined) this.mid1Bell.gain.value = params.mid1Gain;
    if (params.mid1Freq !== undefined) this.mid1Bell.frequency.value = params.mid1Freq;
    if (params.mid1Q !== undefined) this.mid1Bell.Q.value = params.mid1Q;

    if (params.mid2Gain !== undefined) this.mid2Bell.gain.value = params.mid2Gain;
    if (params.mid2Freq !== undefined) this.mid2Bell.frequency.value = params.mid2Freq;
    if (params.mid2Q !== undefined) this.mid2Bell.Q.value = params.mid2Q;

    if (params.highGain !== undefined) this.highShelf.gain.value = params.highGain;
    if (params.highFreq !== undefined) this.highShelf.frequency.value = params.highFreq;
  }

  public dispose(): void {
    this.input.dispose();
    this.lowShelf.dispose();
    this.mid1Bell.dispose();
    this.mid2Bell.dispose();
    this.highShelf.dispose();
    this.output.dispose();
  }
}
