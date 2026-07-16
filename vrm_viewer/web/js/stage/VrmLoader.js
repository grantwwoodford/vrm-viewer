import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { Box3, Group, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from '/vendor/loaders/GLTFLoader.js';

let loader;

export function getLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  loader.crossOrigin = 'anonymous';
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  return loader;
}

export async function loadVrm(url) {
  const gltf = await getLoader().loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('The selected file is not a VRM model');
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);
  vrm.scene.traverse((object) => { object.frustumCulled = false; });
  if (vrm.lookAt) {
    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'lookAtQuaternionProxy';
    vrm.scene.add(proxy);
  }
  const group = new Group();
  group.add(vrm.scene);
  if (vrm.lookAt) {
    const rotation = new Quaternion().setFromUnitVectors(
      vrm.lookAt.faceFront.clone().normalize(), new Vector3(0, 0, -1),
    );
    group.quaternion.premultiply(rotation);
  }
  vrm.springBoneManager?.reset();
  group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(vrm.scene);
  const center = bounds.getCenter(new Vector3());
  const head = vrm.humanoid?.getNormalizedBoneNode('head');
  const eyeHeight = head ? head.getWorldPosition(new Vector3()).y : center.y;
  return { vrm, group, center, eyeHeight };
}
