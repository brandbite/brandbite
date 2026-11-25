// -----------------------------------------------------------------------------
// @file: lib/mockups/devices.ts
// @purpose: Mockup Studio's devices, built from three.js shapes: a generic
//           phone, tablet and laptop that look real without copying any one
//           brand's design.
//
//           Everything the studio needs from a device is the `DeviceModel`
//           below. A device loaded from a 3D file can replace a built one by
//           returning the same shape: a group to show, the mesh that carries
//           the screenshot, and that screen's width ÷ height.
// -----------------------------------------------------------------------------

import * as THREE from "three";

import type { DeviceKind } from "./options";

export type DeviceModel = {
  /** Centered on the origin, facing +Z. Sizes are in centimetres. */
  group: THREE.Group;
  /** The screen: an unlit mesh whose material's `map` is the screenshot. */
  screen: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Screen width ÷ height. */
  screenAspect: number;
  /** Where the shadow sits: the lowest point of the device. */
  floorY: number;
  /** Rough footprint, for the size of the shadow. */
  footprint: { width: number; depth: number };
};

const METAL = () =>
  new THREE.MeshStandardMaterial({ color: 0xc8cace, metalness: 1, roughness: 0.3 });
const DARK_METAL = () =>
  new THREE.MeshStandardMaterial({ color: 0x2b2c30, metalness: 0.9, roughness: 0.4 });
const GLASS = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x060607,
    metalness: 0,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
const LENS = () =>
  new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.4, roughness: 0.2 });

function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** A rounded slab with softened edges, centered, its faces on ±depth/2. */
function slab(width: number, height: number, depth: number, radius: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(
    roundedRect(width - bevel * 2, height - bevel * 2, Math.max(radius - bevel, 0.01)),
    {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 5,
      curveSegments: 24,
    },
  );
  geometry.center();
  return geometry;
}

/** A flat rounded panel whose texture coordinates run 0..1 across it. */
function panel(width: number, height: number, radius: number) {
  const geometry = new THREE.ShapeGeometry(roundedRect(width, height, radius), 24);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) / width + 0.5, position.getY(i) / height + 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

function screenMesh(width: number, height: number, radius: number) {
  // Unlit and outside tone mapping, so a screenshot keeps its exact colors.
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  return new THREE.Mesh(panel(width, height, radius), material);
}

function cameraDot(radius: number) {
  return new THREE.Mesh(new THREE.CircleGeometry(radius, 32), LENS());
}

/** Body, black glass and screen stacked on the front face of a slab. */
function slate({
  width,
  height,
  depth,
  radius,
  bezel,
  camera,
}: {
  width: number;
  height: number;
  depth: number;
  radius: number;
  bezel: number;
  camera: { y: number; radius: number } | null;
}) {
  const group = new THREE.Group();
  const front = depth / 2;

  group.add(new THREE.Mesh(slab(width, height, depth, radius, 0.1), METAL()));

  const glass = new THREE.Mesh(panel(width - 0.14, height - 0.14, radius - 0.07), GLASS());
  glass.position.z = front + 0.012;
  group.add(glass);

  const screenWidth = width - bezel * 2;
  const screenHeight = height - bezel * 2;
  const screen = screenMesh(screenWidth, screenHeight, Math.max(radius - bezel, 0.1));
  screen.position.z = front + 0.024;
  group.add(screen);

  if (camera) {
    const dot = cameraDot(camera.radius);
    dot.position.set(0, camera.y, front + 0.036);
    group.add(dot);
  }

  return { group, screen, screenAspect: screenWidth / screenHeight };
}

function buildPhone(): DeviceModel {
  const width = 7.2;
  const height = 14.9;
  const depth = 0.82;
  const { group, screen, screenAspect } = slate({
    width,
    height,
    depth,
    radius: 1.15,
    bezel: 0.26,
    camera: { y: height / 2 - 0.75, radius: 0.17 },
  });

  // Side buttons: power on the right, volume on the left.
  const button = (x: number, y: number, length: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, length, 0.3), METAL());
    mesh.position.set(x, y, 0);
    group.add(mesh);
  };
  button(width / 2 + 0.02, 2.2, 1.7);
  button(-width / 2 - 0.02, 3.4, 1.0);
  button(-width / 2 - 0.02, 2.0, 1.0);

  // A plain camera island on the back, so the back isn't a blank slab.
  const island = new THREE.Mesh(slab(2.6, 2.6, 0.24, 0.7, 0.06), DARK_METAL());
  island.position.set(-width / 2 + 1.9, height / 2 - 1.9, -depth / 2 - 0.1);
  group.add(island);
  for (const [dx, dy] of [
    [-0.55, 0.55],
    [0.55, -0.55],
  ]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 32), LENS());
    lens.rotation.x = Math.PI / 2;
    lens.position.set(island.position.x + dx, island.position.y + dy, island.position.z - 0.15);
    group.add(lens);
  }

  return { group, screen, screenAspect, floorY: -height / 2, footprint: { width, depth: 3 } };
}

function buildTablet(): DeviceModel {
  const width = 18;
  const height = 24.8;
  const { group, screen, screenAspect } = slate({
    width,
    height,
    depth: 0.62,
    radius: 1.2,
    bezel: 0.8,
    camera: { y: height / 2 - 0.4, radius: 0.1 },
  });
  return { group, screen, screenAspect, floorY: -height / 2, footprint: { width, depth: 4 } };
}

/** A keyboard drawn once onto a small canvas: rows of keys on a dark well. */
function keyboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1b1c20";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2c2d33";
  const rows = 5;
  const columns = 14;
  const gap = 8;
  const keyWidth = (canvas.width - gap * (columns + 1)) / columns;
  const keyHeight = (canvas.height - gap * (rows + 1)) / rows;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // The bottom row gets one long space bar across the middle.
      if (row === rows - 1 && column >= 4 && column <= 8) {
        if (column === 4) {
          ctx.beginPath();
          ctx.roundRect(
            gap + column * (keyWidth + gap),
            gap + row * (keyHeight + gap),
            keyWidth * 5 + gap * 4,
            keyHeight,
            8,
          );
          ctx.fill();
        }
        continue;
      }
      ctx.beginPath();
      ctx.roundRect(
        gap + column * (keyWidth + gap),
        gap + row * (keyHeight + gap),
        keyWidth,
        keyHeight,
        8,
      );
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function buildLaptop(): DeviceModel {
  const width = 30.4;
  const baseDepth = 21.2;
  const baseThickness = 0.8;
  const lidHeight = 20.4;
  const lidThickness = 0.42;
  const lean = THREE.MathUtils.degToRad(14);
  const group = new THREE.Group();

  // Base: built upright, then laid flat.
  const base = new THREE.Mesh(slab(width, baseDepth, baseThickness, 1.2, 0.12), METAL());
  base.rotation.x = -Math.PI / 2;
  group.add(base);

  const deck = baseThickness / 2 + 0.012;
  const keyboard = new THREE.Mesh(
    panel(26.6, 10.4, 0.5),
    new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.75, metalness: 0.1 }),
  );
  keyboard.rotation.x = -Math.PI / 2;
  keyboard.position.set(0, deck, -3.6);
  group.add(keyboard);

  const trackpad = new THREE.Mesh(
    panel(11.4, 6.4, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xb9bbc0, metalness: 0.9, roughness: 0.42 }),
  );
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.set(0, deck, 6.2);
  group.add(trackpad);

  // Lid: hinged on the base's back edge, leaning back.
  const hinge = new THREE.Group();
  hinge.position.set(0, baseThickness / 2, -baseDepth / 2 + lidThickness / 2);
  hinge.rotation.x = -lean;
  group.add(hinge);

  const lid = new THREE.Mesh(slab(width, lidHeight, lidThickness, 1.2, 0.1), METAL());
  lid.position.y = lidHeight / 2;
  hinge.add(lid);

  const front = lidThickness / 2;
  const glass = new THREE.Mesh(panel(width - 0.2, lidHeight - 0.2, 1.1), GLASS());
  glass.position.set(0, lidHeight / 2, front + 0.012);
  hinge.add(glass);

  const screenWidth = width - 1.1;
  const screenHeight = lidHeight - 1.5;
  const screen = screenMesh(screenWidth, screenHeight, 0.35);
  screen.position.set(0, lidHeight / 2 - 0.1, front + 0.024);
  hinge.add(screen);

  const dot = cameraDot(0.09);
  dot.position.set(0, lidHeight - 0.42, front + 0.036);
  hinge.add(dot);

  // Sit the whole laptop around the origin so it frames like the others.
  const lift = lidHeight / 2 - 2;
  group.position.set(0, -lift, 3.5);
  const wrapper = new THREE.Group();
  wrapper.add(group);

  return {
    group: wrapper,
    screen,
    screenAspect: screenWidth / screenHeight,
    floorY: -lift - baseThickness / 2,
    footprint: { width, depth: baseDepth },
  };
}

export function buildDevice(kind: DeviceKind): DeviceModel {
  switch (kind) {
    case "phone":
      return buildPhone();
    case "tablet":
      return buildTablet();
    case "laptop":
      return buildLaptop();
  }
}

/** Free everything a device holds on the GPU. */
export function disposeDevice(device: DeviceModel) {
  device.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const map = (material as THREE.MeshBasicMaterial).map;
      // The screenshot texture belongs to the studio, not to the device.
      if (map && object !== device.screen) map.dispose();
      material.dispose();
    }
  });
}
