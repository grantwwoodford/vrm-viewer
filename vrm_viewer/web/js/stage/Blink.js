export class Blink {
  constructor() {
    this.blinking = false;
    this.progress = 0;
    this.sinceLast = 0;
    this.nextAt = this.nextDelay();
  }

  nextDelay() { return 1 + Math.random() * 5; }

  update(vrm, delta) {
    const manager = vrm.expressionManager;
    if (!manager) return;
    this.sinceLast += delta;
    if (!this.blinking && this.sinceLast >= this.nextAt) {
      this.blinking = true;
      this.progress = 0;
    }
    if (!this.blinking) return;
    this.progress += delta / 0.2;
    manager.setValue('blink', Math.sin(Math.PI * Math.min(1, this.progress)));
    if (this.progress >= 1) {
      this.blinking = false;
      this.sinceLast = 0;
      this.nextAt = this.nextDelay();
      manager.setValue('blink', 0);
    }
  }
}
