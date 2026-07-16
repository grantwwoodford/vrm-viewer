import { DirectionalLight, HemisphereLight } from 'three';
import { VrmStage } from './stage/VrmStage.js';
import { VisemeDriver } from './viseme.js';

const desktop = document.documentElement.classList.contains('desktop');
const elements = Object.fromEntries([
  'status', 'text', 'emotion', 'voice', 'speed', 'speak', 'stop', 'message',
  'model-button', 'animation-button', 'model-file', 'animation-file',
].map((id) => [id, document.getElementById(id)]));

const stage = new VrmStage(document.getElementById('scene'), { transparent: true, frameBody: desktop });
const fill = new HemisphereLight(0xf4f1dd, 0x25272e, desktop ? 1.05 : 0.85);
const key = new DirectionalLight(0xffe3c4, 1.35);
key.position.set(-1.3, 2.1, -1.7);
stage.scene.add(fill, key);
stage.start();

const viseme = new VisemeDriver();
stage.setVisemeSource(viseme.level);
let source;
let request;
let modelUrl;
let animationUrl;
let speechGeneration = 0;

function setStatus(text, kind = '') {
  elements.status.textContent = text;
  elements.status.className = `status ${kind}`;
}

function setMessage(text, error = false) {
  elements.message.textContent = text;
  elements.message.className = error ? 'error' : '';
}

function stop() {
  speechGeneration += 1;
  request?.abort();
  request = undefined;
  if (source) source.onended = null;
  try { source?.stop(); } catch (_) {}
  source = undefined;
  elements.stop.disabled = true;
  elements.speak.disabled = false;
  setStatus('ready', 'ready');
}

async function speak() {
  const text = elements.text.value.trim();
  if (!text) return;
  stop();
  const generation = speechGeneration;
  stage.setExpression(elements.emotion.value);
  const context = viseme.context();
  await context.resume();
  const controller = new AbortController();
  request = controller;
  elements.speak.disabled = true;
  elements.stop.disabled = false;
  setStatus('synthesizing speech');
  setMessage('Kokoro is generating audio. The first request also downloads and loads the model.');
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: elements.voice.value, speed: Number(elements.speed.value) }),
      signal: controller.signal,
    });
    if (generation !== speechGeneration) return;
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `TTS returned ${response.status}`);
    }
    const encoded = await response.arrayBuffer();
    if (generation !== speechGeneration) return;
    const buffer = await context.decodeAudioData(encoded);
    if (generation !== speechGeneration) return;
    const playback = context.createBufferSource();
    source = playback;
    playback.buffer = buffer;
    playback.connect(viseme.analyser);
    playback.onended = () => {
      if (generation !== speechGeneration || source !== playback) return;
      source = undefined;
      elements.stop.disabled = true;
      elements.speak.disabled = false;
      setStatus('ready', 'ready');
      setMessage('Speech complete.');
    };
    playback.start();
    setStatus('speaking', 'ready');
    setMessage(`Speaking with ${elements.emotion.value} expression.`);
  } catch (error) {
    if (error.name === 'AbortError' || generation !== speechGeneration) return;
    elements.stop.disabled = true;
    elements.speak.disabled = false;
    setStatus('TTS error', 'error');
    setMessage(error.message, true);
  }
}

async function loadModel(url, label) {
  setStatus(`loading ${label}`);
  const installed = await stage.loadModel(url);
  if (!installed) return false;
  stage.setExpression(elements.emotion.value);
  setStatus('ready', 'ready');
  return true;
}

async function loadAnimation(url, label) {
  setStatus(`loading ${label}`);
  const installed = await stage.playAnimation(url);
  if (!installed) return false;
  setStatus('ready', 'ready');
  return true;
}

elements.speak.addEventListener('click', speak);
elements.stop.addEventListener('click', stop);
elements.text.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    speak();
  }
});
elements.emotion.addEventListener('change', () => stage.setExpression(elements.emotion.value));
elements['model-button'].addEventListener('click', () => elements['model-file'].click());
elements['animation-button'].addEventListener('click', () => elements['animation-file'].click());
elements['model-file'].addEventListener('change', async () => {
  const file = elements['model-file'].files[0];
  if (!file) return;
  if (modelUrl) URL.revokeObjectURL(modelUrl);
  modelUrl = URL.createObjectURL(file);
  try {
    if (await loadModel(modelUrl, file.name)) {
      await loadAnimation(animationUrl || '/models/idle.vrma', 'idle animation');
    }
  } catch (error) {
    setStatus('model error', 'error');
    setMessage(error.message, true);
  }
});
elements['animation-file'].addEventListener('change', async () => {
  const file = elements['animation-file'].files[0];
  if (!file) return;
  if (animationUrl) URL.revokeObjectURL(animationUrl);
  animationUrl = URL.createObjectURL(file);
  try { await loadAnimation(animationUrl, file.name); }
  catch (error) { setStatus('animation error', 'error'); setMessage(error.message, true); }
});

if (desktop) document.getElementById('scene').classList.add('pywebview-drag-region');

try {
  await loadModel('/models/avatar.vrm', 'bundled avatar');
  await loadAnimation('/models/idle.vrma', 'idle animation');
  setMessage('Ready. Enter text or load your own VRM model.');
} catch (error) {
  setStatus('avatar error', 'error');
  setMessage(error.message, true);
}
