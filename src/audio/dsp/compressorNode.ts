import * as Tone from 'tone';
import type { CompressorParams } from '../../types/daw';

export class DynamicCompressorNode {
  public input: Tone.Gain;
  public output: Tone.Gain;
  private compressor: Tone.Compressor;
  private makeupGainNode: Tone.Gain;

  constructor(initialParams?: Partial<CompressorParams>) {
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    this.makeupGainNode = new Tone.Gain(1);

    const params: CompressorParams = {
      threshold: -24,
      ratio: 4,
      attack: 0.01,
      release: 0.25,
      knee: 10,
      makeupGain: 0,
      ...initialParams,
    };

    this.compressor = new Tone.Compressor({
      threshold: params.threshold,
      ratio: params.ratio,
      attack: params.attack,
      release: params.release,
      knee: params.knee,
    });

    // makeup gain: dB to linear
    const linearGain = Math.pow(10, params.makeupGain / 20);
    this.makeupGainNode.gain.value = linearGain;

    // Connect: input -> compressor -> makeupGainNode -> output
    this.input.connect(this.compressor);
    this.compressor.connect(this.makeupGainNode);
    this.makeupGainNode.connect(this.output);
  }

  public updateParams(params: Partial<CompressorParams>): void {
    if (params.threshold !== undefined) this.compressor.threshold.value = params.threshold;
    if (params.ratio !== undefined) this.compressor.ratio.value = params.ratio;
    if (params.attack !== undefined) this.compressor.attack.value = params.attack;
    if (params.release !== undefined) this.compressor.release.value = params.release;
    if (params.knee !== undefined) this.compressor.knee.value = params.knee;
    if (params.makeupGain !== undefined) {
      this.makeupGainNode.gain.value = Math.pow(10, params.makeupGain / 20);
    }
  }

  /**
   * Returns current gain reduction in decibels (0 to -30 dB)
   */
  public getGainReduction(): number {
    const raw = (this.compressor as any).reduction;
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw.value === 'number') return raw.value;
    return 0;
  }

  public dispose(): void {
    this.input.dispose();
    this.compressor.dispose();
    this.makeupGainNode.dispose();
    this.output.dispose();
  }
}
