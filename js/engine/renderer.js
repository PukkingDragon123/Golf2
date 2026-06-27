/* ===========================================================================
 * renderer.js  —  Compact WebGL1 renderer.
 *
 * One forward shader does it all: directional + ambient light, Blinn-Phong
 * specular, vertex colors, optional texture, alpha-tested cutouts, exponential
 * fog, emissive, per-draw tint/opacity, and an unlit path for sky/UI props.
 *
 * Meshes are plain buffer bundles created with createMesh(); geometry comes
 * from mesh.js. No VAOs — attributes are bound per draw (mesh count is small).
 * =========================================================================== */
(function (G) {
  'use strict';

  const VERT_SRC = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    attribute vec2 aUV;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform mat3 uNormalMat;
    uniform vec2 uUVScale;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec2 vUV;
    varying vec3 vWorldPos;
    varying float vViewDist;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorldPos = world.xyz;
      vec4 viewPos = uView * world;
      vViewDist = -viewPos.z;
      vNormal = normalize(uNormalMat * aNormal);
      vColor = aColor;
      vUV = aUV * uUVScale;
      gl_Position = uProjection * viewPos;
    }
  `;

  const FRAG_SRC = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec2 vUV;
    varying vec3 vWorldPos;
    varying float vViewDist;
    uniform vec3 uLightDir;     // direction toward light (normalized)
    uniform vec3 uLightColor;
    uniform vec3 uAmbient;
    uniform vec3 uTint;
    uniform vec3 uEmissive;
    uniform float uOpacity;
    uniform float uUseTexture;
    uniform float uUnlit;
    uniform float uAlphaTest;
    uniform float uSpecular;
    uniform vec3 uCameraPos;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uRim;
    uniform sampler2D uTexture;
    void main() {
      vec3 base = vColor * uTint;
      float alpha = uOpacity;
      if (uUseTexture > 0.5) {
        vec4 t = texture2D(uTexture, vUV);
        base *= t.rgb;
        alpha *= t.a;
      }
      if (uAlphaTest > 0.5 && alpha < 0.45) discard;
      vec3 col;
      if (uUnlit > 0.5) {
        col = base + uEmissive;
      } else {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        float diff = max(dot(N, L), 0.0);
        // soft half-lambert fill so shadowed sides aren't pure black
        float wrap = diff * 0.85 + 0.15;
        vec3 Vd = normalize(uCameraPos - vWorldPos);
        vec3 H = normalize(L + Vd);
        float spec = pow(max(dot(N, H), 0.0), 28.0) * uSpecular * diff;
        float rim = pow(1.0 - max(dot(N, Vd), 0.0), 3.0) * uRim;
        col = base * (uAmbient + uLightColor * wrap)
            + uLightColor * spec
            + uLightColor * rim
            + uEmissive;
      }
      float fd = uFogDensity * vViewDist;
      float fog = clamp(exp(-fd * fd), 0.0, 1.0);
      col = mix(uFogColor, col, fog);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh) + '\n' + src);
    }
    return sh;
  }

  class Renderer {
    constructor(canvas) {
      const opts = { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' };
      const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('WebGL is not supported by this browser.');
      this.canvas = canvas;
      this.gl = gl;

      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
      gl.bindAttribLocation(prog, 0, 'aPosition');
      gl.bindAttribLocation(prog, 1, 'aNormal');
      gl.bindAttribLocation(prog, 2, 'aColor');
      gl.bindAttribLocation(prog, 3, 'aUV');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
      }
      this.prog = prog;
      gl.useProgram(prog);

      this.attr = {
        position: gl.getAttribLocation(prog, 'aPosition'),
        normal: gl.getAttribLocation(prog, 'aNormal'),
        color: gl.getAttribLocation(prog, 'aColor'),
        uv: gl.getAttribLocation(prog, 'aUV')
      };
      const U = (n) => gl.getUniformLocation(prog, n);
      this.u = {
        projection: U('uProjection'), view: U('uView'), model: U('uModel'),
        normalMat: U('uNormalMat'), uvScale: U('uUVScale'),
        lightDir: U('uLightDir'), lightColor: U('uLightColor'), ambient: U('uAmbient'),
        tint: U('uTint'), emissive: U('uEmissive'), opacity: U('uOpacity'),
        useTexture: U('uUseTexture'), unlit: U('uUnlit'), alphaTest: U('uAlphaTest'),
        specular: U('uSpecular'), cameraPos: U('uCameraPos'),
        fogColor: U('uFogColor'), fogDensity: U('uFogDensity'), rim: U('uRim'),
        texture: U('uTexture')
      };

      this.extUint = gl.getExtension('OES_element_index_uint');
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      gl.uniform1i(this.u.texture, 0);

      this._normalMat = new Float32Array(9);
      this._tmp = G.M.create();
      this.env = null;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.resize();
    }

    resize() {
      const c = this.canvas;
      const w = Math.max(1, Math.floor(c.clientWidth * this.pixelRatio));
      const h = Math.max(1, Math.floor(c.clientHeight * this.pixelRatio));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      this.gl.viewport(0, 0, c.width, c.height);
      this.aspect = c.width / c.height;
    }

    /* --------- buffers ---------- */
    createMesh(geo) {
      const gl = this.gl;
      const mk = (data, type) => {
        const b = gl.createBuffer();
        gl.bindBuffer(type, b);
        gl.bufferData(type, data, gl.STATIC_DRAW);
        return b;
      };
      const n = geo.position.length / 3;
      const colors = geo.color || (() => { const a = new Float32Array(n * 3); a.fill(1); return a; })();
      const uvs = geo.uv || new Float32Array(n * 2);
      const normals = geo.normal || (() => { const a = new Float32Array(n * 3); for (let i = 1; i < a.length; i += 3) a[i] = 1; return a; })();
      const mesh = {
        position: mk(geo.position, gl.ARRAY_BUFFER),
        normal: mk(normals, gl.ARRAY_BUFFER),
        color: mk(colors, gl.ARRAY_BUFFER),
        uv: mk(uvs, gl.ARRAY_BUFFER),
        index: null,
        indexType: gl.UNSIGNED_SHORT,
        count: 0
      };
      if (geo.index) {
        let idx = geo.index;
        if (idx instanceof Uint32Array) {
          if (this.extUint) { mesh.indexType = gl.UNSIGNED_INT; }
          else {
            // no 32-bit index support: safe only if every index fits in 16 bits
            for (let i = 0; i < idx.length; i++) {
              if (idx[i] > 65535) { console.warn('Mesh exceeds 16-bit index range without OES_element_index_uint; geometry may be corrupt.'); break; }
            }
            idx = Uint16Array.from(idx);
          }
        }
        mesh.index = mk(idx, gl.ELEMENT_ARRAY_BUFFER);
        mesh.count = idx.length;
      } else {
        mesh.count = n;
      }
      return mesh;
    }

    createTexture(source, opts = {}) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY !== false ? true : false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      const repeat = opts.repeat !== false;
      const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS != null ? opts.wrapS : wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT != null ? opts.wrapT : (repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE));
      if (opts.mipmap !== false) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    }

    /* --------- frame ---------- */
    beginFrame(camera, env) {
      const gl = this.gl;
      this.resize();
      this.env = env;
      gl.clearColor(env.clearColor[0], env.clearColor[1], env.clearColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      camera.updateProjection(this.aspect);
      gl.uniformMatrix4fv(this.u.projection, false, camera.projection);
      gl.uniformMatrix4fv(this.u.view, false, camera.view);
      gl.uniform3fv(this.u.cameraPos, camera.position);
      gl.uniform3fv(this.u.lightDir, env.lightDir);
      gl.uniform3fv(this.u.lightColor, env.lightColor);
      gl.uniform3fv(this.u.ambient, env.ambient);
      gl.uniform3fv(this.u.fogColor, env.fogColor);
      gl.uniform1f(this.u.fogDensity, env.fogDensity);
    }

    _bind(mesh) {
      const gl = this.gl, a = this.attr;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
      gl.enableVertexAttribArray(a.position);
      gl.vertexAttribPointer(a.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
      gl.enableVertexAttribArray(a.normal);
      gl.vertexAttribPointer(a.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.color);
      gl.enableVertexAttribArray(a.color);
      gl.vertexAttribPointer(a.color, 3, gl.FLOAT, false, 0, 0);
      if (a.uv >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
        gl.enableVertexAttribArray(a.uv);
        gl.vertexAttribPointer(a.uv, 2, gl.FLOAT, false, 0, 0);
      }
    }

    draw(mesh, model, o = {}) {
      const gl = this.gl, u = this.u;
      gl.uniformMatrix4fv(u.model, false, model);
      G.M.normalMat3(this._normalMat, model);
      gl.uniformMatrix3fv(u.normalMat, false, this._normalMat);

      const tint = o.tint || WHITE;
      const emissive = o.emissive || BLACK;
      gl.uniform3fv(u.tint, tint);
      gl.uniform3fv(u.emissive, emissive);
      gl.uniform1f(u.opacity, o.opacity != null ? o.opacity : 1);
      gl.uniform1f(u.specular, o.specular != null ? o.specular : 0.0);
      gl.uniform1f(u.rim, o.rim != null ? o.rim : 0.0);
      gl.uniform1f(u.unlit, o.unlit ? 1 : 0);
      gl.uniform1f(u.alphaTest, o.alphaTest ? 1 : 0);
      gl.uniform2f(u.uvScale, o.uvScale ? o.uvScale[0] : 1, o.uvScale ? o.uvScale[1] : 1);

      if (o.texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, o.texture);
        gl.uniform1f(u.useTexture, 1);
      } else {
        gl.uniform1f(u.useTexture, 0);
      }

      // state
      if (o.cull === false) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
      if (o.blend) {
        gl.enable(gl.BLEND);
        if (o.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.disable(gl.BLEND);
      }
      gl.depthMask(o.depthWrite === false ? false : true);
      gl.depthFunc(o.depthFunc || gl.LEQUAL);

      this._bind(mesh);
      if (mesh.index) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
        gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      }

      // restore defaults that other systems assume
      if (o.depthWrite === false) gl.depthMask(true);
      if (o.blend) gl.disable(gl.BLEND);
    }

    // Sky: unlit, fog-free, drawn centered on camera with depth writes off.
    drawSky(mesh, model, texture, tint) {
      const gl = this.gl, u = this.u;
      const savedFog = this.env.fogDensity;
      gl.uniform1f(u.fogDensity, 0.0);
      this.draw(mesh, model, {
        texture, tint: tint || WHITE, unlit: true,
        cull: false, depthWrite: false, depthFunc: gl.LEQUAL
      });
      gl.uniform1f(u.fogDensity, savedFog);
    }
  }

  const WHITE = new Float32Array([1, 1, 1]);
  const BLACK = new Float32Array([0, 0, 0]);

  G.Renderer = Renderer;
})(window.GOLF = window.GOLF || {});
