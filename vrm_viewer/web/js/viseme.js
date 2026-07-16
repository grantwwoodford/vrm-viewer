const SILENCE_GATE = 0.04;
const WEIGHT_CAP = 0.7;
const CURVE = 0.7;
const ATTACK = 50;
const RELEASE = 30;
const GAIN = 5;

export class VisemeDriver {
  constructor() {
    this.ctx = undefined;
    this.analyser = undefined;
    this.samples = undefined;
    this.value = 0;
    this.lastTime = performance.now();
  }

  context() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(this.ctx.destination);
      this.samples = new Float32Array(this.analyser.fftSize);
    }
    return this.ctx;
  }

  level = () => {
    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) sum += sample * sample;
    const rms = Math.sqrt(sum / this.samples.length);
    let target = Math.pow(Math.min(1, rms * GAIN), CURVE);
    if (target < SILENCE_GATE) target = 0;
    target = Math.min(target, WEIGHT_CAP);
    const rate = target > this.value ? ATTACK : RELEASE;
    this.value += (target - this.value) * Math.min(1, rate * delta);
    if (this.value < 0.001) this.value = 0;
    return this.value;
  };
}
