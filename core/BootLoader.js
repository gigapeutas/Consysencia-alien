/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CONSYSENCIA ENGINE v2.0 — BootLoader.js                ║
 * ║          Sequência de Boot Mobile-Safe                          ║
 * ║                                                                  ║
 * ║  PROBLEMA RESOLVIDO:                                             ║
 * ║  iOS Safari e Android WebViews bloqueiam AudioContext e          ║
 * ║  getUserMedia se não chamados DIRETAMENTE dentro de um           ║
 * ║  user gesture handler (click/touchend).                          ║
 * ║                                                                  ║
 * ║  SOLUÇÃO: Pipeline assíncrona em 3 fases, toda encadeada         ║
 * ║  a partir do mesmo evento de gesto do usuário, usando            ║
 * ║  a técnica de "gesture token" + desacoplamento via RAF/timeout.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { StateManager, STATE } from './StateManager.js';

// ══ CONSTANTES ═════════════════════════════════════════════════════

const BOOT_TIMEOUT_MS = 15_000; // Timeout máximo da fase de boot

// ══ BOOT PHASES ════════════════════════════════════════════════════
//
//  FASE 0 — Gesture Capture (síncrono, dentro do handler de clique)
//    └─ AudioContext.resume()   ← DEVE estar aqui (iOS Safari exige)
//    └─ getUserMedia()          ← DEVE estar aqui (iOS Safari exige)
//
//  FASE 1 — Visual Transition (RAF, desacoplado da thread de evento)
//    └─ Oculta o #gate
//    └─ Mostra a UI do terminal
//
//  FASE 2 — Heavy Harvest (Promise.allSettled, paralelo e não-bloqueante)
//    └─ Canvas Fingerprint
//    └─ Audio Fingerprint
//    └─ WebRTC IP local
//    └─ Battery API
//    └─ IP externo (fetch)
//
//  FASE 3 — Transição para STATE_ACTIVE
//    └─ Dispara fireBoot() com todos os dados coletados

// ══ MÓDULO ═════════════════════════════════════════════════════════

export class BootLoader {
  #audioCtx     = null;   // Referência ao AudioContext inicializado
  #cameraStream = null;   // Referência ao MediaStream da câmera
  #onBootDone   = null;   // Callback chamado ao finalizar
  #aborted      = false;  // Flag de segurança

  /**
   * @param {object} options
   * @param {function} options.onBootComplete   - Callback com (intel) quando o boot terminar
   * @param {function} options.onBootProgress   - Callback com { phase, msg } para UI feedback
   * @param {function} options.onCameraReady    - Callback com (stream) quando câmera autorizada
   * @param {function} options.onCameraDenied   - Callback quando câmera for negada
   */
  constructor({ onBootComplete, onBootProgress, onCameraReady, onCameraDenied }) {
    this.#onBootDone    = onBootComplete;
    this._onProgress    = onBootProgress   || (() => {});
    this._onCamReady    = onCameraReady    || (() => {});
    this._onCamDenied   = onCameraDenied   || (() => {});
  }

  // ── API Pública ────────────────────────────────────────────────

  /**
   * Ponto de entrada PRINCIPAL — deve ser chamado DIRETAMENTE
   * dentro do event listener de click ou touchend do botão de gate.
   *
   * ⚠️ REGRA DE OURO MOBILE:
   * O AudioContext e getUserMedia precisam ser chamados na mesma
   * call stack do evento de gesto do usuário. Esta função garante isso.
   *
   * @param {Event} gestureEvent - O evento original (click/touchend)
   */
  async triggerFromGesture(gestureEvent) {
    // Previne duplo disparo
    if (!StateManager.is(STATE.GATE)) return;

    // Cancela o comportamento padrão do evento (essencial no iOS)
    gestureEvent.preventDefault();
    gestureEvent.stopPropagation();

    // ── FASE 0: Gesture-bound (SÍNCRONO) ────────────────────────
    // Tudo aqui está na mesma call stack do evento de clique.
    // O iOS Safari libera AudioContext e getUserMedia APENAS aqui.
    const phase0Results = this.#phase0_GestureBound();

    // Transição de estado IMEDIATA
    StateManager.transition(STATE.BOOTING, { bootStarted: Date.now() });

    // ── FASE 1: Visual (Próximo frame de animação) ───────────────
    // Desacopla a visibilidade do gate da thread de evento para
    // evitar congelamento visual no mobile.
    requestAnimationFrame(() => {
      this.#phase1_Visual();
    });

    // ── FASES 2 e 3: Assíncronas (não-bloqueantes) ──────────────
    // Timeout de segurança global para o boot nunca travar infinitamente
    const bootPromise = this.#phase2and3_Async(phase0Results);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('BOOT_TIMEOUT')), BOOT_TIMEOUT_MS)
    );

    try {
      await Promise.race([bootPromise, timeoutPromise]);
    } catch (err) {
      console.error('[BootLoader] Falha no boot:', err.message);
      // Mesmo com falha, transiciona para ACTIVE com dados parciais
      if (!this.#aborted && StateManager.is(STATE.BOOTING)) {
        this.#onBootDone?.({ error: err.message, ...StateManager.ctx });
        StateManager.transition(STATE.ACTIVE, { bootError: err.message });
      }
    }
  }

  // ── Getters ────────────────────────────────────────────────────

  get audioContext() { return this.#audioCtx; }
  get cameraStream() { return this.#cameraStream; }

  // ── Fase 0: Síncronos ligados ao gesto ────────────────────────

  #phase0_GestureBound() {
    const results = { audioUnlocked: false, cameraPromise: null };

    // ① Inicializa AudioContext (iOS exige dentro do gesto)
    try {
      this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Resume imediatamente — no iOS o contexto nasce como 'suspended'
      this.#audioCtx.resume().catch(() => {});
      results.audioUnlocked = true;
      StateManager.setCtx({ audioCtx: this.#audioCtx });
    } catch (e) {
      console.warn('[BootLoader] AudioContext falhou:', e.message);
    }

    // ② Solicita câmera (iOS exige dentro do gesto)
    // Guardamos a Promise — não esperamos aqui para não bloquear
    results.cameraPromise = navigator.mediaDevices?.getUserMedia({ video: true })
      .then(stream => {
        this.#cameraStream = stream;
        StateManager.setCtx({ cameraGranted: true, cameraStream: stream });
        this._onCamReady(stream);
        return stream;
      })
      .catch(err => {
        StateManager.setCtx({ cameraGranted: false, cameraDeniedReason: err.name });
        this._onCamDenied(err);
        return null;
      });

    return results;
  }

  // ── Fase 1: Transição Visual ────────────────────────────────────

  #phase1_Visual() {
    const gate = document.getElementById('gate');
    if (gate) {
      gate.style.transition = 'opacity 0.4s ease';
      gate.style.opacity = '0';
      gate.style.pointerEvents = 'none';
      // Remove do DOM após a transição para liberar memória
      setTimeout(() => gate.remove(), 450);
    }
    this._onProgress({ phase: 1, msg: 'ASSIMILANDO VETOR...' });
  }

  // ── Fases 2 e 3: Coleta de dados + Transição final ─────────────

  async #phase2and3_Async(phase0Results) {
    this._onProgress({ phase: 2, msg: 'VARRENDO HARDWARE...' });

    // ① Aguarda resultado da câmera (já foi solicitada na Fase 0)
    const cameraStream = await phase0Results.cameraPromise.catch(() => null);

    // ② Coleta todos os dados em paralelo (não-bloqueante)
    this._onProgress({ phase: 2, msg: 'EXTRAINDO IMPRESSÃO DIGITAL...' });

    const [cfpResult, afpResult, lipResult, batResult, ipResult] = await Promise.allSettled([
      this.#collectCanvasFingerprint(),
      this.#collectAudioFingerprint(),
      this.#collectLocalIP(),
      this.#collectBattery(),
      this.#collectExternalIP(),
    ]);

    // ③ Consolida o objeto INTEL
    const intel = {
      // Câmera
      cam: !!cameraStream,
      cameraStream,

      // Fingerprints
      cfp: cfpResult.status === 'fulfilled'  ? cfpResult.value  : 'ERR',
      afp: afpResult.status === 'fulfilled'  ? afpResult.value  : 'ERR',

      // Rede
      lip: lipResult.status === 'fulfilled'  ? lipResult.value  : 'BLOQUEADO',

      // Bateria
      bat: batResult.status === 'fulfilled'  ? batResult.value.level : '—',
      bc:  batResult.status === 'fulfilled'  ? batResult.value.charging : false,
      batObj: batResult.status === 'fulfilled' ? batResult.value.obj : null,

      // Geolocalização por IP
      ip:      ipResult.status === 'fulfilled' ? ipResult.value.ip      : '—',
      city:    ipResult.status === 'fulfilled' ? ipResult.value.city    : '—',
      region:  ipResult.status === 'fulfilled' ? ipResult.value.region  : '—',
      country: ipResult.status === 'fulfilled' ? ipResult.value.country : '—',
      org:     ipResult.status === 'fulfilled' ? ipResult.value.org     : '—',

      // Hardware (coleta síncrona — sempre disponível)
      gpu: this.#collectGPU(),
      cpu: (navigator.hardwareConcurrency || '?') + ' cores',
      ram: navigator.deviceMemory ? navigator.deviceMemory + 'GB' : '—',
      tz:  Intl.DateTimeFormat().resolvedOptions().timeZone,
      lang: (navigator.languages || [navigator.language]).join(', '),

      // Fontes (micro-delay para não bloquear)
      fonts: await this.#collectFonts(),

      ready: true,
    };

    // Persiste no contexto global da state machine
    StateManager.setCtx({ intel });

    this._onProgress({ phase: 3, msg: 'CATALOGAÇÃO CONCLUÍDA.' });

    // ④ Notifica e transiciona para ACTIVE
    this.#onBootDone?.(intel);

    if (StateManager.is(STATE.BOOTING)) {
      StateManager.transition(STATE.ACTIVE, { intel, bootComplete: Date.now() });
    }
  }

  // ── Coletores de Hardware/Rede ──────────────────────────────────

  #collectGPU() {
    try {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!g) return 'UNKNOWN';
      const ext = g.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return 'GPU MASKED';
      const r = g.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
      const m = r.match(/ANGLE \([^,]+,\s*(.+?)\s*(Direct3D|OpenGL|Metal|Vulkan|\/|,)/) || r.match(/ANGLE \((.+?)\)/);
      return ((m ? m[1].trim() : r).slice(0, 44)) || 'UNKNOWN';
    } catch { return 'N/A'; }
  }

  async #collectCanvasFingerprint() {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 40;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 200, 40);
    x.font = '11px Arial'; x.fillStyle = '#0f0'; x.fillText('NEXO-Ω γδεζ∑∂', 5, 16);
    x.font = '9px Courier New'; x.fillStyle = '#070'; x.fillText('∫∇×±∞◆', 5, 30);
    const dd = c.toDataURL();
    let h = 0x6b84f412;
    for (let i = 0; i < dd.length; i++) {
      h = Math.imul(h ^ dd.charCodeAt(i), 0x9e3779b9);
      h ^= h >>> 16;
    }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  async #collectAudioFingerprint() {
    // Usa OfflineAudioContext — NÃO requer gesto do usuário
    // (É diferente do AudioContext principal que requer gesto)
    const a = new OfflineAudioContext(1, 4096, 44100);
    const o = a.createOscillator();
    const cp = a.createDynamicsCompressor();
    o.type = 'triangle'; o.frequency.value = 10000;
    cp.threshold.value = -50; cp.knee.value = 40;
    cp.ratio.value = 12; cp.attack.value = 0; cp.release.value = 0.25;
    o.connect(cp); cp.connect(a.destination); o.start(0);
    const buf = await a.startRendering();
    const dd = buf.getChannelData(0);
    let s = 0;
    for (let i = 0; i < 500; i++) s += Math.abs(dd[i]);
    return Math.floor(s * 1e9).toString(16).toUpperCase().slice(0, 8).padStart(8, '0');
  }

  async #collectLocalIP() {
    return new Promise(resolve => {
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.onicecandidate = e => {
          if (!e?.candidate) return;
          const m = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          if (m && !m[1].startsWith('0.')) { resolve(m[1]); pc.close(); }
        };
        pc.createOffer().then(o => pc.setLocalDescription(o));
        setTimeout(() => resolve('BLOQUEADO'), 2200);
      } catch { resolve('N/A'); }
    });
  }

  async #collectBattery() {
    if (!navigator.getBattery) return { level: '—', charging: false, obj: null };
    const b = await navigator.getBattery();
    return {
      level:    Math.round(b.level * 100) + '%',
      charging: b.charging,
      obj:      b,
    };
  }

  async #collectExternalIP() {
    try {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      return {
        ip:      d.ip      || '—',
        city:    d.city    || '—',
        region:  d.region  || '—',
        country: d.country_name || '—',
        org:     (d.org || d.isp || '—').slice(0, 40),
      };
    } catch {
      return { ip: '—', city: 'OFUSCADO', region: '—', country: '—', org: 'ROTA ANÔNIMA' };
    }
  }

  async #collectFonts() {
    // Usa yield implícito com setTimeout(0) para não bloquear render
    await new Promise(r => setTimeout(r, 0));
    const probes = ['Arial','Helvetica','Times New Roman','Courier New','Georgia',
                    'Verdana','Tahoma','Consolas','Menlo','Calibri','Segoe UI'];
    const cc = document.createElement('canvas');
    const xx = cc.getContext('2d');
    xx.font = '72px monospace';
    const bw = xx.measureText('mmmmmmmmmmlli').width;
    return probes.filter(fn => {
      xx.font = `72px '${fn}',monospace`;
      return xx.measureText('mmmmmmmmmmlli').width !== bw;
    });
  }
}
