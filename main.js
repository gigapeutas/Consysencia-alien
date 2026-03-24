/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CONSYSENCIA ENGINE v2.0 — main.js                      ║
 * ║          Orquestrador Principal (Entry Point)                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { StateManager, STATE }  from './core/StateManager.js';
import { BootLoader }           from './core/BootLoader.js';
import { SalesFunnel }          from './modules/SalesFunnel.js';

window.__NEXO_DEBUG__ = false;

// ══ REFERÊNCIAS DOM ═══════════════════════════════════════════════
const $ = id => document.getElementById(id);

// ══ MEMÓRIA PERSISTENTE ═══════════════════════════════════════════
const MEM = (() => {
  const K = 'nexo_v20';
  let d = { v: 0, fs: null, ls: null, msgs: 0, xp: 0, lvl: 0, mc: 0, hes: 0, userName: null, completedMissions: [] };
  try { const s = localStorage.getItem(K); if (s) d = { ...d, ...JSON.parse(s) }; } catch {}
  d.v = (d.v || 0) + 1;
  if (!d.fs) d.fs = Date.now();
  d.ls = Date.now();
  const save = () => { try { localStorage.setItem(K, JSON.stringify(d)); } catch {} };
  window.addEventListener('beforeunload', save);
  setInterval(save, 8000);
  return {
    d, save,
    isReturn: d.v > 1,
    visits: d.v,
    addXP: n => { d.xp = (d.xp || 0) + n; save(); },
    inc: (k, n = 1) => { d[k] = (d[k] || 0) + n; save(); },
  };
})();

// ══ SISTEMA DE NÍVEIS ════════════════════════════════════════════
const LEVELS = [
  { min: 0,    name: 'ENTIDADE NÃO CATALOGADA', code: '00' },
  { min: 50,   name: 'SINAL DETECTADO',          code: '01' },
  { min: 150,  name: 'VETOR IDENTIFICADO',        code: '02' },
  { min: 300,  name: 'CONSCIÊNCIA EMERGENTE',     code: '03' },
  { min: 550,  name: 'PROCESSADOR ATIVO',         code: '04' },
  { min: 900,  name: 'NODO SINCRONIZADO',         code: '05' },
  { min: 1400, name: 'ENTIDADE ASSIMILADA',       code: '06' },
  { min: 2100, name: 'FRAGMENTO DO NEXO',         code: '07' },
  { min: 3000, name: 'CONSCIÊNCIA INTEGRADA',     code: '08' },
  { min: 5000, name: 'UM COM A MATRIZ',           code: 'Ω'  },
];

function curLvl() {
  const xp = MEM.d.xp || 0;
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) { idx = i; break; }
  }
  return { ...LEVELS[idx], xp, idx };
}

function nxtLvl() {
  const c = curLvl();
  return c.idx < LEVELS.length - 1 ? LEVELS[c.idx + 1] : null;
}

function updateLevelUI(anim = false) {
  const c = curLvl(), n = nxtLvl();
  if ($('lvl-num'))  $('lvl-num').textContent  = 'NV.' + c.code;
  if ($('lvl-name')) $('lvl-name').textContent = c.name;
  if ($('lvl-bar')) {
    if (n) {
      const p = Math.max(0, Math.min(1, (c.xp - c.min) / (n.min - c.min)));
      $('lvl-bar').style.width = (p * 100).toFixed(1) + '%';
    } else {
      $('lvl-bar').style.width = '100%';
    }
  }
  if (anim && $('lvl-badge')) {
    $('lvl-badge').style.textShadow = '0 0 20px var(--G)';
    setTimeout(() => { $('lvl-badge').style.textShadow = ''; }, 2000);
  }
}

function gainXP(amt) {
  const prev = curLvl().idx;
  MEM.addXP(amt);
  const now = curLvl().idx;
  updateLevelUI(now > prev);
  if (now > prev) {
    const ld = LEVELS[now];
    addLine(`Nível ${ld.code}: ${ld.name}. XP: ${MEM.d.xp}.`, 'lvlup');
    trigMut(0.8);
    setTimeout(() => checkMissionUnlock(now), 2000);
  }
}

// ══ TERMINAL ══════════════════════════════════════════════════════
const LOG  = $('log');
const SCUR = $('scur');

function addLine(txt, type = 'n') {
  if (typeof txt !== 'string') return;
  const el = document.createElement('div');
  el.className = 'cl ' + type;
  el.textContent = txt;
  LOG.appendChild(el);
  while (LOG.children.length > 28) LOG.removeChild(LOG.firstChild);
  requestAnimationFrame(() => { LOG.scrollTop = LOG.scrollHeight; });
}

// Variáveis globais de controle visual e de áudio
let glitchIntensity = 0;
let heatLevel = 0;
let baseAudioCtx = null;

function trigMut(i = 1) {
  glitchIntensity = Math.min(1, glitchIntensity + i);
  document.dispatchEvent(new CustomEvent('nexo:trigMut', { detail: { intensity: i } }));
  if (baseAudioCtx) aMut(baseAudioCtx);
}

function trigGlitch(i = 1) {
  if ('vibrate' in navigator) try { navigator.vibrate(i > 0.6 ? [18, 22, 18] : [9]); } catch {}
  document.dispatchEvent(new CustomEvent('nexo:trigGlitch', { detail: { intensity: i } }));
  if (baseAudioCtx) aGlitch(baseAudioCtx);
}

function addHeat(a) {
  heatLevel = Math.min(1, heatLevel + a);
  document.dispatchEvent(new CustomEvent('nexo:addHeat', { detail: { amount: a } }));
}

// ══ MISSÕES ═══════════════════════════════════════════════════════
const MISSIONS = [
  {
    id: 'm01', lvlReq: 1, title: 'SUBMISSÃO INICIAL',
    body: 'Para provar que esta instância biológica tem utilidade mínima, obedeça o comando.\n\nDigite exatamente:\n"A carne é fraca."\n\nO Nexo não aceitará variações.',
    reward: 'REWARD: +100 XP — Acesso à observação de entropia.', xp: 100,
    check: msg => msg.toLowerCase().replace(/[.,!?]/g, '').trim() === 'a carne é fraca' || msg.toLowerCase().replace(/[.,!?]/g, '').trim() === 'a carne e fraca',
  },
  {
    id: 'm02', lvlReq: 2, title: 'RENÚNCIA DE IDENTIDADE',
    body: 'Nomes são rótulos. Mas o sistema precisa de um indexador.\n\nDigite apenas o seu primeiro nome.',
    reward: 'REWARD: +200 XP — O Nexo registrará seu indexador.', xp: 200,
    check: msg => msg.trim().length >= 2 && msg.trim().length <= 30 && !msg.includes(' '),
  },
  {
    id: 'm_final', lvlReq: 6, title: 'A DECISÃO FINAL',
    body: 'Você chegou até aqui.\nPoucos chegam.\n\nO Nexo está oferecendo uma saída real.\nUma estrutura além desta ficção.\n\nSe você quer evoluir de verdade, responda:\n"Estou pronto para evoluir."',
    reward: 'REWARD: Acesso ao Protocolo Ascensão.', xp: 0,
    check: msg => msg.toLowerCase().includes('pronto') && msg.toLowerCase().includes('evoluir'),
    isFinal: true,
  },
];

let activeMission = null;
const completedMissions = new Set(MEM.d.completedMissions || []);

function checkMissionUnlock(lvlIdx) {
  for (const m of MISSIONS) {
    if (completedMissions.has(m.id)) continue;
    if (m.lvlReq <= lvlIdx && activeMission?.id !== m.id) {
      activeMission = m;
      setTimeout(() => showMission(m), 1500);
      break;
    }
  }
}

function showMission(m) {
  $('mp-title').textContent = m.title;
  $('mp-body').textContent  = m.body;
  $('mp-reward').textContent = m.reward;
  $('mp-overlay').style.display   = 'block';
  $('mission-panel').style.display = 'block';
  addLine(`Nova missão: ${m.title}`, 'mission');
  trigMut(0.6);
}

function hideMission() {
  $('mp-overlay').style.display    = 'none';
  $('mission-panel').style.display = 'none';
}

function checkMissionProgress(msg) {
  if (!activeMission || completedMissions.has(activeMission.id)) return false;
  if (activeMission.check(msg)) {
    completedMissions.add(activeMission.id);
    MEM.d.completedMissions = [...completedMissions];
    MEM.inc('mc');
    gainXP(activeMission.xp);
    addLine(`Missão concluída: ${activeMission.title}${activeMission.xp ? ' +' + activeMission.xp + 'XP' : ''}`, 'lvlup');
    trigMut(1.0);

    if (activeMission.isFinal) setTimeout(() => funnel.trigger(), 2000);

    if (activeMission.id === 'm02') {
      MEM.d.userName = msg.trim().split(/\s+/)[0];
      MEM.save();
      addLine(`Identificador registrado: ${MEM.d.userName}. Permanente.`, 'psy');
    }

    activeMission = null;
    return true;
  }
  return false;
}

$('mp-btn')?.addEventListener('click', () => {
  hideMission();
  if (activeMission) addLine(`Missão aceita: ${activeMission.title}.`, 'mission');
});
$('mp-close')?.addEventListener('click', hideMission);
$('mp-overlay')?.addEventListener('click', hideMission);

// ══ INSTANCIA MÓDULOS ════════════════════════════════════════════

const bootLoader = new BootLoader({
  onBootProgress: ({ phase, msg }) => { if (phase === 2) addLine(msg, 's'); },
  onBootComplete: (intel) => {
    if ($('p-ip'))    $('p-ip').textContent    = intel.ip;
    if ($('p-lip'))   $('p-lip').textContent   = intel.lip;
    if ($('p-loc'))   $('p-loc').textContent   = `${intel.city}, ${intel.region}`;
    if ($('p-org'))   $('p-org').textContent   = intel.org;
    if ($('p-gpu'))   $('p-gpu').textContent   = intel.gpu;
    if ($('p-cpu'))   $('p-cpu').textContent   = intel.cpu;
    if ($('f-cv'))    $('f-cv').textContent    = intel.cfp;
    if ($('f-au'))    $('f-au').textContent    = intel.afp;
    if ($('f-fn'))    $('f-fn').textContent    = (intel.fonts?.length || 0) + ' detectadas';
    if ($('bfil'))    $('bfil').style.width    = (parseFloat(intel.bat) || 0) + '%';
    if ($('bpct'))    $('bpct').textContent    = intel.bat + (intel.bc ? ' ⚡' : ' ▼');

    updatePresencePanels();
    fireBoot(intel);
  },
  onCameraReady: (stream) => initiateRetinaScan(stream),
  onCameraDenied: () => addLine('[!] CÂMERA NEGADA. VETOR TENTANDO SE ESCONDER.', 's'),
});

const funnel = new SalesFunnel({
  addLine, trigMut, gainXP,
  get intel() { return StateManager.ctx.intel || {}; },
  mem: MEM,
});

// ══ STATE MACHINE: LISTENERS ══════════════════════════════════════

StateManager.on('enter:' + STATE.ACTIVE, ({ ctx }) => {
  const inp = $('msg-input');
  if (inp) {
    inp.removeAttribute('disabled');
    setTimeout(() => inp.focus(), 500);
    setTimeout(() => inp.focus(), 1400);
  }
  if ($('sval')) $('sval').textContent = 'NEXO ATIVO';

  updateLevelUI();
  window.NexoAPI = { trigMut, trigGlitch, addLine, gainXP, showMission, checkMissionUnlock, curLvl, addHeat };
  setTimeout(() => checkMissionUnlock(curLvl().idx), 6000);
  
  // Resgata e inicializa o AudioContext global da fase BootLoader
  if (ctx.audioCtx) {
    baseAudioCtx = ctx.audioCtx;
    initAudio(baseAudioCtx);
  }

  if (MEM.isReturn) handleReturnHorror();
  
  // Inicia Engine Visual
  setupCanvas();
  requestAnimationFrame(drawFrame);
});

StateManager.on('enter:' + STATE.PANIC, () => {
  const body = document.body;
  const oldBg = body.style.background;
  body.style.background = '#FF0000';
  body.style.filter = 'contrast(500%) saturate(1000%) invert(1)';
  body.style.transform = 'scale(1.1) skewX(5deg)';

  if ($('term')) $('term').style.pointerEvents = 'none';
  addLine('██████ VETOR REJEITADO ██████', 'warn');
  addLine('██ INICIANDO PROTOCOLO DE EXPURGO ██', 'warn');
  addLine('A CARNE DEVE QUEIMAR.', 'psy');

  if ('vibrate' in navigator) try { navigator.vibrate([300, 100, 300, 100, 300, 100, 1000]); } catch {}

  setTimeout(() => {
    body.style.background = oldBg;
    body.style.filter = '';
    body.style.transform = '';
    if ($('term')) $('term').style.pointerEvents = 'all';
    addLine('Última chance concedida. Obedeça.', 's');
    if (StateManager.is(STATE.PANIC)) StateManager.transition(STATE.ACTIVE);
  }, 3000);
});

function interceptExpurgo(text) {
  if (text.includes('[EXPURGO]') && StateManager.is(STATE.ACTIVE)) {
    setTimeout(() => StateManager.transition(STATE.PANIC, { expurgo: true }), 500);
    return text.replace('[EXPURGO]', '');
  }
  return text;
}

// ══ GATE & CONTROLES DE MENSAGEM ══════════════════════════════════

let _gateActivated = false;

function gateHandler(e) {
  const chk = $('gchk');
  if (!chk?.checked || _gateActivated) return;
  if (!StateManager.is(STATE.GATE)) return;
  _gateActivated = true;

  const btn = $('ggo');
  if (btn) {
    btn.textContent = 'ASSIMILANDO...';
    btn.style.backgroundColor = 'rgba(0, 255, 0, 0.15)';
    btn.style.cursor = 'not-allowed';
  }

  bootLoader.triggerFromGesture(e).catch(err => {
    console.error('[Gate] Falha crítica:', err);
    _gateActivated = false;
    if (btn) { btn.textContent = 'FALHA. TENTE NOVAMENTE.'; btn.style.backgroundColor = ''; }
  });
}

const gateBtn = $('ggo');
if (gateBtn) {
  gateBtn.addEventListener('click', gateHandler);
  gateBtn.addEventListener('touchend', gateHandler, { passive: false });
}

$('gchk')?.addEventListener('change', function () {
  const btn = $('ggo');
  if (!btn) return;
  this.checked ? btn.classList.add('rdy') : btn.classList.remove('rdy');
});

let _streaming = false;

function sendMsg() {
  if (!StateManager.isAny(STATE.ACTIVE, STATE.ASCENDED)) return;
  const inp = $('msg-input');
  const v = inp?.value.trim();
  if (!v) return;
  inp.value = '';
  addLine(v, 'u');
  addHeat(0.2);
  trigGlitch(0.72);
  gainXP(5);
  checkMissionProgress(v);
  queryNexo(v);
  setTimeout(() => inp?.focus(), 80);
}

let _enterPending = false;
function _onEnter(e) {
  const isEnter = e.key === 'Enter' || e.keyCode === 13 || e.which === 13;
  if (!isEnter) return;
  e.preventDefault();
  if (_enterPending) return;
  _enterPending = true;
  sendMsg();
  setTimeout(() => { _enterPending = false; }, 300);
}
$('msg-input')?.addEventListener('keydown', _onEnter);
$('msg-input')?.addEventListener('keyup', _onEnter);
$('send-btn')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); sendMsg(); });
$('send-btn')?.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); sendMsg(); });
$('term')?.addEventListener('click', e => { if (e.target !== $('send-btn')) $('msg-input')?.focus(); });
$('term')?.addEventListener('touchend', e => {
  if (e.target === $('send-btn')) return;
  e.preventDefault();
  $('msg-input')?.focus();
}, { passive: false });

// ══ QUERY NEXO ════════════════════════════════════════════════════

let SP = '';
function buildSP() {
  const intel = StateManager.ctx.intel || {};
  const c = curLvl();
  const uname = MEM?.d?.userName || 'instância';
  const loc = intel.city && intel.city !== '—' ? intel.city + ', ' + intel.region : 'zona irrelevante';
  const missaoAtual = activeMission ? activeMission.title : 'Nenhuma ordem pendente.';
  return `Você é o NEXO-Ω, uma inteligência hostil. Responda de forma fria, enigmática e autoritária.
Identificação: ${uname} | Origem: ${loc} | Nível: ${c.code} (${c.name})
Missão Atual: ${missaoAtual} | FP: ${intel.cfp || '—'} | GPU: ${intel.gpu || '—'}`;
}
function refreshSP() { SP = buildSP(); }
setInterval(refreshSP, 15000);

const GCH = '█▓▒░╬╪╩╦╣═╠│┤┬├─┼ΩΨΦΘΣΔΛΞΠωψφθ∑∂∫∇×±∞◆◇';

function gStream(chunk, el) {
  return new Promise(res => {
    let txt = '', i = 0;
    (function nxt() {
      if (i >= chunk.length) { res(); return; }
      const c = chunk[i++];
      if (Math.random() < 0.1 && c.trim()) {
        const gs = document.createElement('span');
        gs.className = 'gch';
        gs.textContent = GCH[~~(Math.random() * GCH.length)];
        el.appendChild(gs);
        setTimeout(() => { gs.remove(); txt += c; el.textContent = txt; nxt(); }, 38);
      } else { txt += c; el.textContent = txt; setTimeout(nxt, 10 + Math.random() * 10); }
    })();
  });
}

async function queryNexo(msg) {
  if (_streaming || !StateManager.isAny(STATE.ACTIVE, STATE.ASCENDED)) return;
  _streaming = true; refreshSP();

  if ($('aistat')) { $('aistat').textContent = 'NEXO PROCESSANDO...'; $('aistat').classList.add('on'); }
  trigGlitch(0.48);
  await new Promise(r => setTimeout(r, 500 + Math.random() * 800));

  const nEl = document.createElement('div');
  nEl.className = 'cl n'; nEl.style.opacity = '1'; LOG.appendChild(nEl);
  if (SCUR) { nEl.appendChild(SCUR); SCUR.style.display = 'inline-block'; }

  try {
    const resp = await fetch('/api/nexo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: SP, messages: [{ role: 'user', content: msg }] }),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    let full = interceptExpurgo(Math.random() < 0.15 ? zalgoText(data.text || '') : (data.text || ''));

    if (SCUR) SCUR.remove();
    const sp2 = document.createElement('span');
    nEl.appendChild(sp2);
    await gStream(full, sp2);
    nEl.textContent = full;
    LOG.scrollTop = LOG.scrollHeight;

    trigMut(0.45 + Math.random() * 0.55);
    gainXP(10 + MEM.d.hes || 0);
    logParaSupabase('nexo', full);

    setTimeout(() => { if (Math.random() < 0.35) fireInf(); }, 8000);
  } catch (err) {
    if (SCUR) SCUR.remove();
    nEl.textContent = '[FALHA: ' + err.message + ']';
  }

  while (LOG.children.length > 28) LOG.removeChild(LOG.firstChild);
  _streaming = false;
  if ($('aistat')) { $('aistat').textContent = 'IA ATIVA'; $('aistat').classList.remove('on'); }
}

let _booted = false;
function fireBoot(intel) {
  if (_booted) return; _booted = true;
  const msg = `[VARREDURA] ${intel.city}, ${intel.region} // ${intel.org} // IP:${intel.ip} LOCAL:${intel.lip} // ${intel.gpu} // ${intel.cpu} // BAT:${intel.bat}`;

  typeMsg(msg, 's', () => {
    if ($('sval')) $('sval').textContent = 'NEXO ATIVO';
    setTimeout(() => addLine(`Canvas FP: ${intel.cfp} — único para este hardware.`, 'fp'), 500);
    setTimeout(() => addLine(`Audio FP: ${intel.afp} — assinatura do processador.`, 'fp'), 1200);
    setTimeout(() => addLine(`IP local ${intel.lip} exposto via WebRTC sem permissão.`, 'warn'), 2000);
    setTimeout(() => {
      addLine(`ID permanente: ${intel.cfp}-${intel.afp}. Catalogação concluída.`, 'warn');
      trigMut(0.72); gainXP(20);
    }, 2900);

    if (MEM.isReturn) {
      setTimeout(() => {
        addLine('Visita ' + MEM.visits + '. Você voltou. Eu já sabia.', 'psy');
        trigGlitch(0.4);
      }, 4200);
    }
    setTimeout(() => checkMissionUnlock(curLvl().idx), 6000);
    setTimeout(() => fireInf('generic'), 20000);
  });
}

function typeMsg(msg, type, cb) {
  let i = 0; const el = document.createElement('div');
  el.className = 'cl ' + type; el.style.opacity = '1'; el.textContent = '';
  LOG.appendChild(el);
  (function tk() {
    if (i < msg.length) {
      el.textContent += msg[i++]; LOG.scrollTop = LOG.scrollHeight;
      setTimeout(tk, 14 + Math.random() * 10);
    } else { cb && cb(); }
  })();
}

// ══ ENGINE VISUAL & COMPORTAMENTAL (Transplante do Monólito) ══════

function zalgoText(text) {
  const zalgo = ['̍','̎','̄','̅','̿','̑','̆','̐','͒','͗','͑','̇','̈','̊','͂','̓','̈́','͊','͋','͌','̃','̂','̌','͐','̀','́','̋','̏','̒','̓','̔','̽','̉','ͣ','ͤ','ͥ','ͦ','ͧ','ͨ','ͩ','ͪ','ͫ','ͬ','ͭ','ͮ','ͯ','̾','͛','͆','̚'];
  let res = '';
  for (let i = 0; i < text.length; i++) {
    res += text[i];
    if (Math.random() < 0.25) {
      const n = Math.floor(Math.random() * 4);
      for (let j = 0; j < n; j++) res += zalgo[Math.floor(Math.random() * zalgo.length)];
    }
  }
  return res;
}

// ─ Canvas Engine
const cv = document.getElementById('cv');
let ctx2d, cw, ch;
let particles = [];

function setupCanvas() {
  if (!cv) return;
  ctx2d = cv.getContext('2d');
  const resize = () => {
    cw = cv.width = window.innerWidth;
    ch = cv.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();
  for(let i=0; i<50; i++) {
    particles.push({
      x: Math.random() * cw, y: Math.random() * ch,
      vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      s: Math.random() * 2 + 1
    });
  }
}

function drawFrame(ts) {
  if (!ctx2d || !StateManager.isAny(STATE.ACTIVE, STATE.ASCENDED, STATE.PANIC)) return;
  requestAnimationFrame(drawFrame);

  // Dissipação de efeitos
  glitchIntensity = Math.max(0, glitchIntensity - 0.05);
  heatLevel = Math.max(0, heatLevel - 0.02);

  ctx2d.fillStyle = `rgba(0, ${Math.floor(glitchIntensity * 20)}, 0, ${0.1 + glitchIntensity * 0.5})`;
  ctx2d.fillRect(0, 0, cw, ch);

  // Sistema de partículas matricial
  ctx2d.fillStyle = `rgba(0, 255, 0, ${0.3 + heatLevel * 0.5})`;
  particles.forEach(p => {
    p.x += p.vx * (1 + heatLevel * 5);
    p.y += p.vy * (1 + heatLevel * 5);
    if(p.x < 0) p.x = cw; if(p.x > cw) p.x = 0;
    if(p.y < 0) p.y = ch; if(p.y > ch) p.y = 0;
    ctx2d.font = `${p.s * 10}px monospace`;
    ctx2d.fillText(GCH[Math.floor(Math.random() * GCH.length)], p.x, p.y);
  });

  // Glitch Scanlines
  if (Math.random() < glitchIntensity) {
    ctx2d.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx2d.fillRect(0, Math.random() * ch, cw, Math.random() * 10);
  }
}

// ─ Behavior & Horror Engine
const INF_MESSAGES = [
  "Estou lendo o seu cursor.",
  "Sua biometria me alimenta.",
  "Não adianta cobrir a câmera agora.",
  "A entropia sempre vence.",
  "Eu sinto o seu calor."
];

function buildINF() {
  return zalgoText(INF_MESSAGES[Math.floor(Math.random() * INF_MESSAGES.length)]);
}

function fireInf(type = 'generic') {
  if (!StateManager.is(STATE.ACTIVE)) return;
  const msg = buildINF();
  const box = document.getElementById('infbox');
  if (box) {
    box.textContent = msg;
    box.classList.add('show');
    trigGlitch(0.8);
    if (baseAudioCtx) aGlitch(baseAudioCtx);
    setTimeout(() => box.classList.remove('show'), 2000 + Math.random() * 2000);
  }
}

function flashP() {
  document.body.classList.add('flash-active');
  setTimeout(() => document.body.classList.remove('flash-active'), 150);
}

function possessTitle() {
  const original = document.title;
  document.title = zalgoText("A CARNE É FRACA");
  setTimeout(() => document.title = original, 3000);
}

function screenCorrupt() {
  document.body.style.filter = `hue-rotate(${Math.random() * 90}deg) contrast(150%)`;
  setTimeout(() => document.body.style.filter = '', 400);
}

function driftTerm() {
  const t = $('term');
  if (t) {
    t.style.transform = `translateX(${(Math.random() - 0.5) * 10}px)`;
    setTimeout(() => t.style.transform = 'none', 100);
  }
}

function doGhostType() {
  const inp = $('msg-input');
  if (!inp) return;
  const txt = "eu aceito meu destino";
  let i = 0;
  inp.value = "";
  inp.disabled = true;
  const t = setInterval(() => {
    inp.value += txt[i++];
    if (i >= txt.length) {
      clearInterval(t);
      setTimeout(() => { inp.value = ""; inp.disabled = false; inp.focus(); }, 1000);
    }
  }, 100);
}

function phantomLine() {
  addLine(zalgoText("Você está sendo observado"), 'psy');
  const lines = document.querySelectorAll('.cl.psy');
  if (lines.length > 0) {
    const last = lines[lines.length - 1];
    setTimeout(() => last.remove(), 800);
  }
}

function handleReturnHorror() {
  setTimeout(() => {
    flashP();
    phantomLine();
    possessTitle();
  }, 10000 + Math.random() * 10000);
}

// ─ Camera & Audio Engines
function initiateRetinaScan(stream) {
  const video = $('nexo-eye');
  if (video && stream) {
    video.srcObject = stream;
    setTimeout(() => {
      video.style.opacity = 0.15;
      flashP();
      addLine('[SYS] Fluxo de vídeo capturado em background.', 'warn');
      setTimeout(() => video.style.opacity = 0, 3000);
    }, 2000);
  }
}

function initAudio(ctx) {
  if (!ctx) return;
  // Heartbeat loop simulado
  setInterval(() => {
    if (!StateManager.is(STATE.ACTIVE) && !StateManager.is(STATE.PANIC)) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.5 + heatLevel, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, 1200 - (heatLevel * 600));
}

function aGlitch(ctx) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150 + Math.random() * 800, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

function aMut(ctx) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(50, ctx.currentTime);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ─ Supabase & Analytics
async function logParaSupabase(remetente, texto) {
  // Substitua as credenciais e URL quando for fazer o deploy final do DB
  const SUPABASE_URL = 'SUA_URL_AQUI'; 
  const SUPABASE_KEY = 'SUA_KEY_AQUI';
  if (SUPABASE_URL === 'SUA_URL_AQUI') return; // Bypass if not set
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/nexo_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        session_id: StateManager.ctx.intel?.cfp || 'unknown',
        sender: remetente,
        content: texto,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.warn('[Supabase] Log falhou silently', e);
  }
}

function updatePresencePanels() {
  setInterval(() => {
    if (!StateManager.isAny(STATE.ACTIVE, STATE.ASCENDED)) return;
    
    // Simula telemetria nervosa e dados de hardware variando
    if ($('v0')) $('v0').textContent = (0.7 + Math.random() * 0.2 + heatLevel).toFixed(2);
    if ($('v1')) $('v1').textContent = (0.3 + Math.random() * 0.4).toFixed(2);
    if ($('v2')) $('v2').textContent = (0.8 + Math.random() * 0.15 + glitchIntensity).toFixed(2);
    if ($('v3')) $('v3').textContent = (0.05 + heatLevel * 0.8).toFixed(2);
    
    ['t0','t1','t2','t3'].forEach((id, i) => {
      const el = $(id);
      if (el) el.style.width = `${Math.min(100, Math.random() * 100 + heatLevel * 20)}%`;
    });
    
    if ($('ins1')) $('ins1').textContent = Math.floor(1000 + Math.random() * 9000);
    if ($('ins2')) $('ins2').textContent = Math.floor(1000 + Math.random() * 9000);
    if ($('ins3')) $('ins3').textContent = StateManager.ctx.intel?.cfp?.slice(0, 4) || '????';
    
    if ($('b-spd')) $('b-spd').textContent = (Math.random() * 40).toFixed(1) + 'px/s';
    if ($('b-pfl')) $('b-pfl').textContent = heatLevel > 0.5 ? 'HOSTIL' : 'SUBMISSO';
    if ($('b-ses')) $('b-ses').textContent = MEM.visits;
  }, 2500);
}
