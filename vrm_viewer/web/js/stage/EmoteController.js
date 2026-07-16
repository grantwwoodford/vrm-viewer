const EMOTIONS = new Map([
  ['happy', { values: [['happy', 0.7]], duration: 0.4 }],
  ['sad', { values: [['sad', 0.7], ['oh', 0.15]], duration: 0.4 }],
  ['angry', { values: [['angry', 0.7], ['ee', 0.3]], duration: 0.3 }],
  ['surprised', { values: [['surprised', 0.8], ['oh', 0.4]], duration: 0.15 }],
  ['neutral', { values: [['neutral', 1]], duration: 0.6 }],
  ['relaxed', { values: [['relaxed', 0.75]], duration: 0.5 }],
  ['shy', { values: [['sad', 0.25], ['happy', 0.3], ['relaxed', 0.35]], duration: 0.45 }],
  ['thinking', { values: [['relaxed', 0.45], ['ee', 0.12]], duration: 0.5 }],
  ['playful', { values: [['happy', 0.6], ['surprised', 0.2]], duration: 0.25 }],
  ['tender', { values: [['relaxed', 0.6], ['happy', 0.25]], duration: 0.55 }],
]);

const ease = (t) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

export class EmoteController {
  constructor(vrm) {
    this.vrm = vrm;
    this.state = undefined;
    this.progress = 1;
    this.start = new Map();
    this.target = new Map();
  }

  setEmotion(name) {
    const state = EMOTIONS.get(name);
    if (!state) return;
    this.state = state;
    this.progress = 0;
    this.start.clear();
    this.target.clear();
    const manager = this.vrm.expressionManager;
    if (!manager) return;
    for (const expression of Object.keys(manager.expressionMap)) {
      if (expression === 'blink' || expression === 'aa') continue;
      this.start.set(expression, manager.getValue(expression) ?? 0);
      this.target.set(expression, 0);
    }
    for (const [expression, value] of state.values) {
      const resolved = Object.keys(manager.expressionMap).find(
        (candidate) => candidate === expression,
      ) ?? Object.keys(manager.expressionMap).find(
        (candidate) => candidate.toLowerCase() === expression.toLowerCase(),
      );
      if (resolved) this.target.set(resolved, value);
    }
  }

  update(delta) {
    if (!this.state) return;
    if (this.progress < 1) this.progress = Math.min(1, this.progress + delta / this.state.duration);
    const amount = ease(this.progress);
    for (const [name, target] of this.target) {
      const start = this.start.get(name) ?? 0;
      this.vrm.expressionManager?.setValue(name, start + (target - start) * amount);
    }
  }
}
