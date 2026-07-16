import { Object3D, Vector3 } from 'three';

export class GazeController {
  constructor(camera, eyeHeight) {
    this.camera = camera;
    this.eyeHeight = eyeHeight;
    this.desired = new Vector3();
    this.offset = new Vector3();
    this.targetNode = undefined;
    this.sinceSaccade = 0;
    this.nextSaccadeAt = 0;
  }

  update(vrm, delta) {
    if (!vrm.lookAt) return;
    if (!this.targetNode) {
      this.targetNode = new Object3D();
      this.targetNode.position.set(0, this.eyeHeight, -1);
      vrm.lookAt.target = this.targetNode;
    }
    this.sinceSaccade += delta;
    if (this.sinceSaccade >= this.nextSaccadeAt) {
      this.sinceSaccade = 0;
      this.nextSaccadeAt = 0.4 + Math.random() * 2;
      this.offset.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2, 0);
    }
    this.camera.getWorldPosition(this.desired).add(this.offset);
    this.targetNode.position.lerp(this.desired, 0.18);
    vrm.lookAt.update(delta);
  }
}
