import * as THREE from 'three';

/**
 * Textured material whose visible arc sweeps around the texture centre (0 → 1),
 * used to "draw in" the hologram rings during the intro.
 */
export function sweepMaterial(map, { additive = false, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uProgress: { value: 0 },
      uOpacity: { value: opacity },
      uStart: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uProgress;
      uniform float uOpacity;
      uniform float uStart;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float a = fract(atan(p.y, p.x) / 6.2831853 + 0.5 - uStart);
        float edge = smoothstep(uProgress, uProgress - 0.02, a);
        vec4 c = texture2D(map, vUv);
        gl_FragColor = vec4(c.rgb, c.a * uOpacity * edge);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Glowing unlit hologram material. */
export function holoMaterial(color, opacity = 0.85, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Tween-friendly opacity setter for all materials under an object. */
export function setOpacity(obj, value) {
  obj.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.uniforms?.uOpacity ? m.uniforms.uOpacity.value : m.opacity;
      const v = m.userData.baseOpacity * value;
      if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = v;
      else {
        m.opacity = v;
        m.transparent = true;
      }
    }
  });
}
