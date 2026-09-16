import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../../util/brand.js';
import { makeCanvas, canvasTexture, font, roundRect } from '../../util/canvas.js';
import { Hologram } from './Hologram.js';

/** Website & Mobile App: a laptop and phone on a turntable with live scrolling screens. Tap to swap devices. */
export class WebMobileHolo extends Hologram {
  constructor(color, toast, renderer) {
    super(color, toast);
    this.turntable = new THREE.Group();
    this.turntable.position.y = 0.03;
    this.content.add(this.turntable);

    const siteTex = canvasTexture(siteCanvas(), renderer);
    siteTex.wrapT = THREE.RepeatWrapping;
    siteTex.repeat.y = 0.45;
    this.siteTex = siteTex;
    const appTex = canvasTexture(appCanvas(), renderer);
    appTex.wrapT = THREE.RepeatWrapping;
    appTex.repeat.y = 0.55;
    this.appTex = appTex;

    const shell = new THREE.MeshStandardMaterial({ color: '#d9d4e2', metalness: 0.55, roughness: 0.3, emissive: '#3a0070', emissiveIntensity: 0.25 });

    // laptop
    const laptop = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.13), shell);
    base.position.y = 0.004;
    laptop.add(base);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.008, -0.065);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.005), shell);
    lid.position.y = 0.065;
    hinge.add(lid);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.188, 0.118), new THREE.MeshBasicMaterial({ map: siteTex }));
    screen.position.set(0, 0.065, 0.003);
    hinge.add(screen);
    hinge.rotation.x = -0.18;
    laptop.add(hinge);
    laptop.position.set(-0.03, 0, -0.02);
    this.turntable.add(laptop);
    this.tappable(screen, 'laptop');
    this.laptop = laptop;

    // phone
    const phone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.118, 0.007), shell);
    phone.add(body);
    const pscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.106), new THREE.MeshBasicMaterial({ map: appTex }));
    pscreen.position.z = 0.0036;
    phone.add(pscreen);
    phone.position.set(0.1, 0.075, 0.05);
    phone.rotation.y = -0.4;
    this.turntable.add(phone);
    this.tappable(pscreen, 'phone');
    this.phone = phone;

    // glow disc
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.13, 64).rotateX(-Math.PI / 2), this.mat(color, 0.9));
    disc.position.y = 0.002;
    this.content.add(disc);
    this.front = 'laptop';
  }

  onTap() {
    // swap which device is in the spotlight
    this.front = this.front === 'laptop' ? 'phone' : 'laptop';
    const phoneFront = this.front === 'phone';
    gsap.to(this.phone.position, { x: phoneFront ? 0 : 0.1, y: phoneFront ? 0.1 : 0.075, z: phoneFront ? 0.08 : 0.05, duration: 0.8, ease: 'back.out(1.4)' });
    gsap.to(this.phone.scale, { x: phoneFront ? 1.6 : 1, y: phoneFront ? 1.6 : 1, z: phoneFront ? 1.6 : 1, duration: 0.8, ease: 'back.out(1.4)' });
    gsap.to(this.phone.rotation, { y: phoneFront ? 0 : -0.4, duration: 0.8 });
    gsap.to(this.laptop.position, { x: phoneFront ? -0.02 : -0.03, z: phoneFront ? -0.08 : -0.02, duration: 0.8, ease: 'power3.out' });
    gsap.to(this.laptop.scale, { x: phoneFront ? 0.8 : 1, y: phoneFront ? 0.8 : 1, z: phoneFront ? 0.8 : 1, duration: 0.8 });
    this.toast('WEBSITE & MOBILE APP', this.front === 'phone'
      ? 'iOS & Android — one beautiful app experience across every device.'
      : 'Responsive websites and design systems that look great on every screen.');
  }

  update(dt, t, cameraLocal) {
    this.siteTex.offset.y = (t * 0.05) % 1;
    this.appTex.offset.y = (t * 0.07) % 1;
    // keep the screens toward the viewer, with a gentle sway
    const yaw = cameraLocal ? Math.atan2(cameraLocal.x, cameraLocal.z) : 0;
    this.turntable.rotation.y = THREE.MathUtils.damp(this.turntable.rotation.y, yaw + Math.sin(t * 0.6) * 0.25, 3, dt);
  }
}

function siteCanvas() {
  const [c, g] = makeCanvas(512, 1024);
  g.fillStyle = '#0d0a12';
  g.fillRect(0, 0, 512, 1024);
  for (let s = 0; s < 2; s++) {
    const o = s * 512;
    const grad = g.createLinearGradient(0, o, 512, o + 220);
    grad.addColorStop(0, COLORS.purple);
    grad.addColorStop(1, COLORS.pink);
    g.fillStyle = grad;
    g.fillRect(0, o, 512, 220);
    g.fillStyle = '#fff';
    g.font = font(900, 44);
    g.fillText('ORIONIS', 30, o + 90);
    g.font = font(600, 22);
    g.fillText('Technology that scales', 30, o + 130);
    roundRect(g, 30, o + 155, 150, 40, 20);
    g.fill();
    for (let k = 0; k < 3; k++) {
      g.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(g, 20 + k * 164, o + 250, 148, 120, 12);
      g.fill();
      g.fillStyle = [COLORS.orange, COLORS.lilac, COLORS.pink][k];
      g.fillRect(40 + k * 164, o + 272, 50, 50);
    }
    g.fillStyle = 'rgba(255,255,255,0.2)';
    for (let l = 0; l < 5; l++) g.fillRect(30, o + 400 + l * 22, 420 - l * 40, 10);
  }
  return c;
}

function appCanvas() {
  const [c, g] = makeCanvas(256, 1024);
  g.fillStyle = '#f4f0fa';
  g.fillRect(0, 0, 256, 1024);
  for (let s = 0; s < 2; s++) {
    const o = s * 512;
    g.fillStyle = COLORS.purple;
    g.fillRect(0, o, 256, 120);
    g.fillStyle = '#fff';
    g.font = font(800, 26);
    g.fillText('Book a visit', 18, o + 70);
    for (let k = 0; k < 5; k++) {
      g.fillStyle = '#fff';
      roundRect(g, 14, o + 140 + k * 72, 228, 60, 12);
      g.fill();
      g.fillStyle = [COLORS.orange, COLORS.pink, COLORS.purpleDeep][k % 3];
      g.beginPath();
      g.arc(46, o + 170 + k * 72, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#bbb';
      g.fillRect(76, o + 160 + k * 72, 130, 10);
      g.fillRect(76, o + 178 + k * 72, 90, 8);
    }
  }
  return c;
}
