// -----------------------------------------------------------------------------
// @file: lib/mockups/scene.ts
// @purpose: Mockup Studio's 3D scene: one device, lit by a neutral studio,
//           with the visitor's screenshot on its screen. Draws only when
//           something changes, and can render the same picture at any size
//           for export. Browser only (WebGL); no React in here.
//
//           The canvas is transparent. The background is painted behind it
//           (CSS in the preview, a 2D canvas on export), so brand colors stay
//           exact and a transparent PNG needs nothing special.
// -----------------------------------------------------------------------------

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { buildDevice, disposeDevice, type DeviceModel } from "./devices";
import {
  coverFit,
  motionPose,
  recordingSeconds,
  VIDEO,
  videoType,
  VIEWS,
  WATERMARK_TEXT,
  type Background,
  type DeviceKind,
  type MotionId,
  type ViewId,
} from "./options";

const FOV = 28;

/** A soft dark blob to lay under the device. */
function shadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.42)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.14)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** What the screen shows before a screenshot is chosen. */
function placeholderTexture(aspect: number): THREE.CanvasTexture {
  const height = 1024;
  const width = Math.round(height * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff0e9");
  gradient.addColorStop(1, "#f0edff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#5c5f66";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(Math.min(width, height) * 0.07)}px system-ui, sans-serif`;
  ctx.fillText("Your screenshot", width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class MockupScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 500);
  private controls: OrbitControls;
  private environment: THREE.Texture;
  private device: DeviceModel | null = null;
  private deviceKind: DeviceKind = "phone";
  private view: ViewId = "front";
  private screenshot: THREE.Texture | null = null;
  /** The playing video behind the screen texture, when the screen shows one. */
  private screenVideo: HTMLVideoElement | null = null;
  private placeholder: THREE.Texture | null = null;
  private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private distance = 40;
  private deviceHeight = 1;
  private frame = 0;
  private disposed = false;
  private motion: MotionId = "none";
  /** performance.now() when Play was pressed; null while paused. */
  private playingSince: number | null = null;
  private recording = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      // Lets the picture be copied out of the canvas for export.
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // A neutral lit room, generated here: no image files to download.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.environment;

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(12, 22, 26);
    this.scene.add(key);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(35);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(100);
    this.controls.addEventListener("change", this.requestRender);

    this.setDevice("phone");
  }

  /** Draw on the next frame; several calls in one frame draw once. */
  requestRender = () => {
    // A recording draws its own frames; nothing else may touch the canvas meanwhile.
    if (this.frame || this.disposed || this.recording) return;
    this.frame = requestAnimationFrame((now) => {
      this.frame = 0;
      if (this.playingSince !== null) {
        this.applyPose((now - this.playingSince) / 1000);
        this.requestRender();
      }
      // A video on the screen needs a fresh picture every frame.
      if (this.screenVideo && !this.screenVideo.paused) this.requestRender();
      // Damping keeps the camera gliding for a few frames after a drag.
      if (this.controls.update()) this.requestRender();
      this.renderer.render(this.scene, this.camera);
    });
  };

  /** Put the device where its motion has it `seconds` in. */
  private applyPose(seconds: number) {
    if (!this.device) return;
    // In a recording longer than one loop, "Slide in" arrives once and stays.
    const at =
      this.motion === "slide" && this.recording
        ? Math.min(seconds, VIDEO.seconds - 0.001)
        : seconds;
    const pose = motionPose(this.motion, at);
    const group = this.device.group;
    group.rotation.set(pose.rotateX, pose.rotateY, 0);
    group.position.y = pose.lift * this.deviceHeight;
    // The shadow stays on the floor and tightens a little as the device rises.
    const spread = 1 + Math.max(pose.lift, 0) * 2;
    const { width, depth } = this.device.footprint;
    this.shadow.scale.set(width * 1.7 * spread, depth * 2.2 * spread, 1);
    // No shadow until the device is nearly in place: while it is still below
    // the floor, the shadow would be drawn across it.
    this.shadow.material.opacity = THREE.MathUtils.clamp(1 + pose.lift * 8, 0, 1);
  }

  /** Choose a motion. The device shows the motion's first moment until Play. */
  setMotion(id: MotionId) {
    this.motion = id;
    if (id === "none") this.playingSince = null;
    else if (this.playingSince !== null) this.playingSince = performance.now();
    // "Slide in" starts off-screen; resting on its last moment shows the device.
    this.applyPose(id === "slide" && this.playingSince === null ? VIDEO.seconds - 0.001 : 0);
    this.requestRender();
  }

  play() {
    if (this.motion === "none") return;
    this.playingSince = performance.now();
    this.requestRender();
  }

  pause() {
    this.playingSince = null;
  }

  /** Match the canvas to its box on the page. */
  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  setDevice(kind: DeviceKind) {
    if (this.device) {
      this.scene.remove(this.device.group);
      disposeDevice(this.device);
    }
    this.placeholder?.dispose();
    this.placeholder = null;

    this.deviceKind = kind;
    this.device = buildDevice(kind);
    this.scene.add(this.device.group);

    // Stand far enough back that the whole device fits with some air around it.
    const box = new THREE.Box3().setFromObject(this.device.group);
    const size = box.getSize(new THREE.Vector3());
    this.deviceHeight = size.y;
    const tall = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    const wide = size.x / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (16 / 9));
    this.distance = Math.max(tall, wide) * 1.25 + size.z;
    // Keep the depth range tight around the device: its glass and screen sit
    // a hair apart, and a loose range makes them flicker through each other.
    this.camera.near = this.distance * 0.25;
    this.camera.far = this.distance * 4;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.distance * 0.6;
    this.controls.maxDistance = this.distance * 1.8;

    const { width, depth } = this.device.footprint;
    this.shadow.scale.set(width * 1.7, depth * 2.2, 1);
    this.shadow.position.set(0, this.device.floorY - 0.6, 0);

    this.applyScreen();
    this.applyPose(
      this.motion === "slide" && this.playingSince === null ? VIDEO.seconds - 0.001 : 0,
    );
    // Each device stands at its own distance, so look at it again from the same angle.
    this.setView(this.view);
  }

  /**
   * Put an image or a playing video on the screen, or pass null to go back to
   * the placeholder. The caller owns the video element and its file.
   */
  setScreenshot(image: HTMLImageElement | ImageBitmap | HTMLVideoElement | null) {
    this.screenshot?.dispose();
    this.screenshot = null;
    this.screenVideo = null;
    if (image instanceof HTMLVideoElement) {
      const texture = new THREE.VideoTexture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.screenshot = texture;
      this.screenVideo = image;
    } else if (image) {
      const texture = new THREE.Texture(image);
      // WebGL can't flip an ImageBitmap on upload, so the studio hands one in
      // already flipped (createImageBitmap's imageOrientation: "flipY").
      texture.flipY = !(typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      this.screenshot = texture;
    }
    this.applyScreen();
    this.requestRender();
  }

  private applyScreen() {
    if (!this.device) return;
    const material = this.device.screen.material;
    if (this.screenshot) {
      const image = this.screenVideo
        ? { width: this.screenVideo.videoWidth, height: this.screenVideo.videoHeight }
        : (this.screenshot.image as { width: number; height: number });
      const fit = coverFit(image.width / image.height, this.device.screenAspect);
      this.screenshot.repeat.set(fit.repeatX, fit.repeatY);
      this.screenshot.offset.set(fit.offsetX, fit.offsetY);
      material.map = this.screenshot;
    } else {
      this.placeholder ??= placeholderTexture(this.device.screenAspect);
      material.map = this.placeholder;
    }
    material.needsUpdate = true;
  }

  setView(id: ViewId) {
    this.view = id;
    const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    const spherical = new THREE.Spherical(
      this.distance,
      THREE.MathUtils.degToRad(view.polar),
      THREE.MathUtils.degToRad(view.azimuth),
    );
    this.camera.position.setFromSpherical(spherical);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.requestRender();
  }

  setShadow(visible: boolean) {
    this.shadow.visible = visible;
    this.requestRender();
  }

  get currentDevice(): DeviceKind {
    return this.deviceKind;
  }

  /**
   * The current picture at an exact size, on its background, as a PNG.
   * Renders once at that size, then puts the canvas back as it was.
   */
  async exportPng({
    width,
    height,
    background,
    watermark,
  }: {
    width: number;
    height: number;
    background: Background;
    watermark: boolean;
  }): Promise<Blob> {
    const previous = this.renderer.getSize(new THREE.Vector2());
    const previousRatio = this.renderer.getPixelRatio();
    const previousAspect = this.camera.aspect;

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d")!;
    paintBackground(ctx, width, height, background);
    ctx.drawImage(this.canvas, 0, 0, width, height);
    if (watermark) drawWatermark(ctx, width, height);

    this.renderer.setPixelRatio(previousRatio);
    this.renderer.setSize(previous.x, previous.y, false);
    this.camera.aspect = previousAspect;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    return new Promise<Blob>((resolve, reject) => {
      output.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
        "image/png",
      );
    });
  }

  /** How long a video download will run, in seconds. */
  get videoSeconds(): number {
    return recordingSeconds(this.screenVideo ? this.screenVideo.duration : null);
  }

  /** The screen shows a video rather than a still image. */
  get hasScreenVideo(): boolean {
    return this.screenVideo !== null;
  }

  /**
   * One loop of the current motion as a video, recorded as it plays (so it
   * takes VIDEO.seconds). Video has no transparency: a transparent background
   * is recorded as white. Rejects when the browser can't record video.
   */
  async recordVideo({
    background,
    watermark,
    onProgress,
  }: {
    background: Background;
    watermark: boolean;
    onProgress?: (fraction: number) => void;
  }): Promise<{ blob: Blob; extension: string }> {
    const type =
      typeof MediaRecorder === "undefined"
        ? null
        : videoType((mime) => MediaRecorder.isTypeSupported(mime));
    if (!type) throw new Error("This browser can't record video.");

    const { width, height, fps, bitsPerSecond } = VIDEO;
    const seconds = this.videoSeconds;
    const previous = this.renderer.getSize(new THREE.Vector2());
    const previousRatio = this.renderer.getPixelRatio();
    const previousAspect = this.camera.aspect;
    const wasPlaying = this.playingSince !== null;

    this.recording = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d")!;
    const backdrop: Background =
      background.kind === "transparent" ? { kind: "solid", color: "#ffffff" } : background;

    const drawFrame = (at: number) => {
      this.applyPose(at);
      this.renderer.render(this.scene, this.camera);
      paintBackground(ctx, width, height, backdrop);
      ctx.drawImage(this.canvas, 0, 0, width, height);
      if (watermark) drawWatermark(ctx, width, height);
    };

    const restore = () => {
      this.recording = false;
      this.renderer.setPixelRatio(previousRatio);
      this.renderer.setSize(previous.x, previous.y, false);
      this.camera.aspect = previousAspect;
      this.camera.updateProjectionMatrix();
      this.playingSince = wasPlaying ? performance.now() : null;
      this.applyPose(
        this.motion === "slide" && this.playingSince === null ? VIDEO.seconds - 0.001 : 0,
      );
      this.requestRender();
    };

    try {
      if (this.screenVideo) {
        // Start the screen recording from its beginning, so the video opens on its first frame.
        this.screenVideo.currentTime = 0;
        await this.screenVideo.play().catch(() => {});
      }
      drawFrame(0);
      const stream = output.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: type.mime,
        videoBitsPerSecond: bitsPerSecond,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const stopped = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error("The recording failed."));
      });

      recorder.start();
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          if (this.disposed) return resolve();
          const at = (now - startedAt) / 1000;
          if (at >= seconds) return resolve();
          drawFrame(at);
          onProgress?.(at / seconds);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      onProgress?.(1);
      return {
        blob: new Blob(chunks, { type: type.mime.split(";")[0] }),
        extension: type.extension,
      };
    } finally {
      if (!this.disposed) restore();
    }
  }

  dispose() {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.controls.removeEventListener("change", this.requestRender);
    this.controls.dispose();
    if (this.device) disposeDevice(this.device);
    this.screenshot?.dispose();
    this.placeholder?.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.map?.dispose();
    this.shadow.material.dispose();
    this.environment.dispose();
    this.renderer.dispose();
  }
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: Background,
) {
  if (background.kind === "solid") {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
  } else if (background.kind === "gradient") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, background.from);
    gradient.addColorStop(1, background.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }
}

/** A small pill in the bottom-right corner; sized from the picture, so it reads the same at any size. */
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const fontSize = Math.round(height * 0.024);
  const padX = fontSize * 0.9;
  const pillHeight = fontSize * 2.1;
  const margin = Math.round(height * 0.035);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const pillWidth = ctx.measureText(WATERMARK_TEXT).width + padX * 2;
  const x = width - margin - pillWidth;
  const y = height - margin - pillHeight;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.beginPath();
  ctx.roundRect(x, y, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.fillStyle = "#292827";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(WATERMARK_TEXT, x + padX, y + pillHeight / 2 + fontSize * 0.04);
}
