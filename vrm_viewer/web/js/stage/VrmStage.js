import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { VRMUtils } from '@pixiv/three-vrm';
import {
  ACESFilmicToneMapping, AnimationMixer, LoopRepeat, MathUtils, PerspectiveCamera,
  Scene, Vector3, VectorKeyframeTrack, WebGLRenderer,
} from 'three';
import { Blink } from './Blink.js';
import { EmoteController } from './EmoteController.js';
import { GazeController } from './GazeController.js';
import { getLoader, loadVrm } from './VrmLoader.js';

export class VrmStage {
  constructor(container, { transparent = false, frameBody = false } = {}) {
    this.container = container;
    this.frameBody = frameBody;
    this.scene = new Scene();
    this.renderer = new WebGLRenderer({ antialias: true, alpha: transparent });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.camera = new PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 60);
    this.camera.position.set(0, 1.2, -2.2);
    this.cameraHome = this.camera.position.clone();
    this.cameraTarget = new Vector3(0, 1.1, 0);
    this.parallax = { x: 0, y: 0 };
    this.blink = new Blink();
    this.loadId = 0;
    this.animationLoadId = 0;
    this.lastTime = performance.now();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (event) => {
      this.parallax.x = event.clientX / innerWidth * 2 - 1;
      this.parallax.y = event.clientY / innerHeight * 2 - 1;
    });
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  async loadModel(url) {
    const loadId = ++this.loadId;
    const loaded = await loadVrm(url);
    if (loadId !== this.loadId) {
      VRMUtils.deepDispose(loaded.vrm.scene);
      return false;
    }
    if (this.group) {
      this.scene.remove(this.group);
      this.mixer?.stopAllAction();
      this.mixer?.uncacheRoot(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.vrm = loaded.vrm;
    this.animationLoadId += 1;
    this.group = loaded.group;
    this.scene.add(loaded.group);
    this.emote = new EmoteController(loaded.vrm);
    this.gaze = new GazeController(this.camera, loaded.eyeHeight);
    this.mixer = new AnimationMixer(loaded.vrm.scene);
    loaded.group.updateMatrixWorld(true);
    this.restHip = loaded.vrm.humanoid?.getNormalizedBoneNode('hips')
      ?.getWorldPosition(new Vector3()).clone();
    const head = loaded.eyeHeight || loaded.center.y;
    const hips = loaded.vrm.humanoid?.getNormalizedBoneNode('hips')
      ?.getWorldPosition(new Vector3()).y ?? head - 0.55;
    const top = head + 0.18;
    const bottom = this.frameBody ? -0.03 : hips - 0.36;
    const middle = (top + bottom) / 2;
    const distance = (top - bottom) / 2 / Math.tan(MathUtils.degToRad(this.camera.fov / 2)) + 0.25;
    this.cameraHome.set(this.frameBody ? 0 : 0.13, middle, -distance);
    this.cameraTarget.set(0, middle, 0);
    this.camera.position.copy(this.cameraHome);
    this.camera.lookAt(this.cameraTarget);
    return true;
  }

  async playAnimation(url) {
    if (!this.vrm || !this.mixer) throw new Error('Load a model first');
    const loadId = ++this.animationLoadId;
    const vrm = this.vrm;
    const mixer = this.mixer;
    const gltf = await getLoader().loadAsync(url);
    if (loadId !== this.animationLoadId || vrm !== this.vrm) return false;
    const animation = gltf.userData.vrmAnimations?.[0];
    if (!animation) throw new Error('The selected file is not a VRM animation');
    const clip = createVRMAnimationClip(animation, vrm);
    this.reAnchorHips(clip);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    mixer.stopAllAction();
    action.reset().fadeIn(0.3).play();
    return true;
  }

  reAnchorHips(clip) {
    const hips = this.vrm?.humanoid?.getNormalizedBoneNode('hips');
    if (!hips) return;
    hips.updateMatrixWorld(true);
    const rest = this.restHip ?? hips.getWorldPosition(new Vector3());
    const track = clip.tracks.find((item) => item instanceof VectorKeyframeTrack && item.name === `${hips.name}.position`);
    if (!track) return;
    const delta = new Vector3(track.values[0], track.values[1], track.values[2]).sub(rest);
    for (const item of clip.tracks) {
      if (!(item instanceof VectorKeyframeTrack) || !item.name.endsWith('.position')) continue;
      for (let index = 0; index < item.values.length; index += 3) {
        item.values[index] -= delta.x;
        item.values[index + 1] -= delta.y;
        item.values[index + 2] -= delta.z;
      }
    }
  }

  setExpression(name) { this.emote?.setEmotion(name); }
  setVisemeSource(source) { this.visemeSource = source; }

  start() {
    const tick = () => {
      const now = performance.now();
      this.update(Math.min((now - this.lastTime) / 1000, 0.05));
      this.lastTime = now;
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  update(delta) {
    this.camera.position.x += (this.cameraHome.x + this.parallax.x * 0.06 - this.camera.position.x) * 0.05;
    this.camera.position.y += (this.cameraHome.y - this.parallax.y * 0.035 - this.camera.position.y) * 0.05;
    this.camera.lookAt(this.cameraTarget);
    if (!this.vrm) return;
    this.mixer?.update(delta);
    this.vrm.materials?.forEach((material) => material.update?.(delta));
    this.vrm.humanoid?.update();
    this.gaze?.update(this.vrm, delta);
    this.blink.update(this.vrm, delta);
    this.emote?.update(delta);
    this.vrm.expressionManager?.setValue('aa', this.visemeSource?.() ?? 0);
    this.vrm.expressionManager?.update();
    this.vrm.nodeConstraintManager?.update();
    this.vrm.springBoneManager?.update(delta);
  }
}
