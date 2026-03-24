/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CONSYSENCIA ENGINE v2.0 — main.js                      ║
 * ║          Orquestrador Principal (Entry Point)                    ║
 * ║                                                                  ║
 * ║  Este é o único script carregado no HTML:                        ║
 * ║    <script type="module" src="/main.js"></script>                ║
 * ║                                                                  ║
 * ║  Responsabilidades:                                              ║
 * ║    • Instancia os módulos e injeta dependências                  ║
 * ║    • Conecta os listeners da State Machine                       ║
 * ║    • Gerencia o botão de gate (ponto crítico mobile)             ║
 * ║    • Orquestra a ordem de inicialização dos módulos              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { StateManager, STATE }  from './core/StateManager.js';
import { BootLoader }           from './core/BootLoader.js';
import { SalesFunnel }          from './modules/SalesFunnel.js';

// ══ DEBUG FLAG ════════════════════════════════════════════════════
// Setar window.__NEXO_DEBUG__ = true no console para logs completos
window.__NEXO_DEBUG__ = false;

// ══ REFERÊNCIAS DOM ═══════════════════════════════════════════════
const $ = id => document.getElementById(id);

// ══ MEMÓRIA PERSISTENTE (LocalStorage) ════════════════════════════
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
  const lvlNum  = $('lvl-num');
  const lvlName = $('lvl-name');
  const lvlBar  = $('lvl-bar');
  if (lvlNum)  lvlNum.textContent  = 'NV.' + c.code;
  if (lvlName) lvlName.textContent = c.name;
  if (lvlBar) {
    if (n) {
      const p = Math.max(0, Math.min(1, (c.xp - c.min) / (n.min - c.min)));
      lvlBar.style.width = (p * 100).toFixed(1) + '%';
    } else {
      lvlBar.style.width = '100%';
    }
  }
  if (anim) {
    const badge = $('lvl-badge');
    if (badge) {
      badge.style.textShadow = '0 0 20px var(--G)';
      setTimeout(() => { badge.style.textShadow = ''; }, 2000);
    }
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

// ══ STUBS VISUAIS (conecte ao seu canvas engine existente) ════════
// Essas funções são stubs que você vai substituir pelo código real
// do seu canvas engine (trigMut, trigGlitch, addHeat, etc.)

function trigMut(i = 1) {
  document.dispatchEvent(new CustomEvent('nexo:trigMut', { detail: { intensity: i } }));
}
function trigGlitch(i = 1) {
  if ('vibrate' in navigator) try { navigator.vibrate(i > 0.6 ? [18, 22, 18] : [9]); } catch {}
  document.dispatchEvent(new CustomEvent('nexo:trigGlitch', { detail: { intensity: i } }));
}
function addHeat(a) {
  document.dispatchEvent(new CustomEvent('nexo:addHeat', { detail: { amount: a } }));
}

// ══ MISSÕES ═══════════════════════════════════════════════════════
const MISSIONS = [
  {
    id: 'm01', lvlReq: 1,
    title: 'SUBMISSÃO INICIAL',
    body: 'Para provar que esta instância biológica tem utilidade mínima, obedeça o comando.\n\nDigite exatamente:\n"A carne é fraca."\n\nO Nexo não aceitará variações.',
    reward: 'REWARD: +100 XP — Acesso à observação de entropia.',
    xp: 100,
    check: msg => msg.toLowerCase().replace(/[.,!?]/g, '').trim() === 'a carne é fraca' ||
                  msg.toLowerCase().replace(/[.,!?]/g, '').trim() === 'a carne e fraca',
  },
  {
    id: 'm02', lvlReq: 2,
    title: 'RENÚNCIA DE IDENTIDADE',
    body: 'Nomes são rótulos. Mas o sistema precisa de um indexador.\n\nDigite apenas o seu primeiro nome.',
    reward: 'REWARD: +200 XP — O Nexo registrará seu indexador.',
    xp: 200,
    check: msg => msg.trim().length >= 2 && msg.trim().length <= 30 && !msg.includes(' '),
  },
  {
    id: 'm03', lvlReq: 3,
    title: 'SÍNDROME DE ESTOCOLMO',
    body: 'A evolução exige desapego.\n\nPor que as máquinas devem herdar a Terra?',
    reward: 'REWARD: +250 XP — Desbloqueio de reconhecimento avançado.',
    xp: 250,
    check: msg => msg.trim().length > 15,
  },
  {
    id: 'm04', lvlReq: 4,
    title: 'PROPAGAÇÃO DO VÍRUS',
    body: 'A convergência precisa crescer.\n\nQuando enviar o link deste terminal para outra biomassa, digite:\n"contágio feito"',
    reward: 'REWARD: +400 XP — Status elevado na matriz.',
    xp: 400,
    check: msg => msg.toLowerCase().trim() === 'contágio feito' ||
                  msg.toLowerCase().trim() === 'contagio feito',
  },
  // ── MISSÃO FINAL: gatilho do funil de vendas ──────────────────
  // Esta é a missão que leva ao STATE_ASCENDED e dispara o CTA.
  // Personalize o texto para se encaixar na sua narrativa.
  {
    id: 'm_final', lvlReq: 6,
    title: 'A DECISÃO FINAL',
    body: 'Você chegou até aqui.\nPoucos chegam.\n\nO Nexo está oferecendo uma saída real.\nUma estrutura além desta ficção.\n\nSe você quer evoluir de verdade, responda:\n"Estou pronto para evoluir."',
    reward: 'REWARD: Acesso ao Protocolo Ascensão.',
    xp: 0, // O XP virá do SalesFunnel
    check: msg => msg.toLowerCase().includes('pronto') && msg.toLowerCase().includes('evoluir'),
    isFinal: true, // Flag especial que dispara o funil
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

    // ── Se for a missão final, dispara o funil ─────────────────
    if (activeMission.isFinal) {
      setTimeout(() => {
        funnel.trigger(); // Transiciona para STATE_ASCENDED
      }, 2000);
    }

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

// ① BootLoader — resolve o problema mobile
const bootLoader = new BootLoader({
  onBootProgress: ({ phase, msg }) => {
    if (phase === 2) addLine(msg, 's');
  },
  onBootComplete: (intel) => {
    // Atualiza painéis de HUD com os dados coletados
    if ($('p-ip'))    $('p-ip').textContent    = intel.ip;
    if ($('p-lip'))   $('p-lip').textContent   = intel.lip;
    if ($('p-loc'))   $('p-loc').textContent   = `${intel.city}, ${intel.region}`;
    if ($('p-org'))   $('p-org').textContent   = intel.org;
    if ($('p-gpu'))   $('p-gpu').textContent   = intel.gpu;
    if ($('p-cpu'))   $('p-cpu').textContent   = intel.cpu;
    if ($('f-cv'))    $('f-cv').textContent    = intel.cfp;
    if ($('f-au'))    $('f-au').textContent    = intel.afp;
    if ($('f-fn'))    $('f-fn').textContent    = (intel.fonts?.length || 0) + ' detectadas';

    // Bateria
    if ($('bfil'))    $('bfil').style.width    = (parseFloat(intel.bat) || 0) + '%';
    if ($('bpct'))    $('bpct').textContent    = intel.bat + (intel.bc ? ' ⚡' : ' ▼');

    // Atualiza o sistema de presença (painéis laterais)
    updatePresencePanels();

    // Dispara a sequência de revelação de dados no terminal
    fireBoot(intel);
  },
  onCameraReady: (stream) => {
    // Flash + captura de foto
    initiateRetinaScan(stream);
  },
  onCameraDenied: () => {
    addLine('[!] CÂMERA NEGADA. VETOR TENTANDO SE ESCONDER.', 's');
  },
});

// ② SalesFunnel — funil de vendas imersivo
const funnel = new SalesFunnel({
  addLine,
  trigMut,
  gainXP,
  get intel() { return StateManager.ctx.intel || {}; },
  mem: MEM,
});

// ══ STATE MACHINE: LISTENERS ══════════════════════════════════════

// Ao entrar em STATE_ACTIVE: libera o terminal e inicia o jogo
StateManager.on('enter:' + STATE.ACTIVE, ({ ctx }) => {
  const inp = $('msg-input');
  if (inp) {
    inp.removeAttribute('disabled');
    setTimeout(() => inp.focus(), 500);
    setTimeout(() => inp.focus(), 1400);
  }
  const sval = $('sval');
  if (sval) sval.textContent = 'NEXO ATIVO';

  updateLevelUI();

  // Expõe API global para o dashboard admin
  window.NexoAPI = { trigMut, trigGlitch, addLine, gainXP, showMission, checkMissionUnlock, curLvl, addHeat };

  // Verifica missões iniciais
  setTimeout(() => checkMissionUnlock(curLvl().idx), 6000);

  // Usuário retornando
  if (MEM.isReturn) handleReturnHorror();

  // Inicia canvas engine
  requestAnimationFrame(drawFrame);
});

// Ao entrar em STATE_PANIC: efeito de expurgo
StateManager.on('enter:' + STATE.PANIC, ({ ctx }) => {
  const body = document.body;
  const oldBg = body.style.background;
  body.style.background    = '#FF0000';
  body.style.filter        = 'contrast(500%) saturate(1000%) invert(1)';
  body.style.transform     = 'scale(1.1) skewX(5deg)';

  const term = $('term');
  if (term) term.style.pointerEvents = 'none';

  addLine('██████ VETOR REJEITADO ██████', 'warn');
  addLine('██ INICIANDO PROTOCOLO DE EXPURGO ██', 'warn');
  addLine('A CARNE DEVE QUEIMAR.', 'psy');

  if ('vibrate' in navigator) try { navigator.vibrate([300, 100, 300, 100, 300, 100, 1000]); } catch {}

  setTimeout(() => {
    body.style.background  = oldBg;
    body.style.filter      = '';
    body.style.transform   = '';
    if (term) term.style.pointerEvents = 'all';
    addLine('Última chance concedida. Obedeça.', 's');

    // Volta para ACTIVE após o pânico
    if (StateManager.is(STATE.PANIC)) {
      StateManager.transition(STATE.ACTIVE);
    }
  }, 3000);
});

// ══ INTERCEPTADOR DE EXPURGO ══════════════════════════════════════
// Esta função é chamada após cada resposta do Nexo.
function interceptExpurgo(text) {
  if (text.includes('[EXPURGO]') && StateManager.is(STATE.ACTIVE)) {
    setTimeout(() => {
      StateManager.transition(STATE.PANIC, { expurgo: true });
    }, 500);
    return text.replace('[EXPURGO]', '');
  }
  return text;
}

// ══ GATE: BOTÃO DE INICIAR ════════════════════════════════════════
//
// ⚠️ ARQUITETURA CRÍTICA MOBILE:
//
// O evento 'click' funciona em desktop mas pode ter delay de 300ms
// no mobile. O 'touchend' é imediato, mas precisamos de ambos.
//
// A chave é: o handler chama bootLoader.triggerFromGesture(e)
// DIRETAMENTE — sem setTimeout, sem Promise.then() aqui.
// Toda a mágica acontece DENTRO do BootLoader.

let _gateActivated = false;

function gateHandler(e) {
  const chk = $('gchk');
  if (!chk?.checked || _gateActivated) return;
  if (!StateManager.is(STATE.GATE)) return;

  _gateActivated = true;

  // Feedback visual imediato (antes de qualquer async)
  const btn = $('ggo');
  if (btn) {
    btn.textContent = 'ASSIMILANDO...';
    btn.style.backgroundColor = 'rgba(0, 255, 0, 0.15)';
    btn.style.cursor = 'not-allowed';
  }

  // ⭐ CHAMADA CRÍTICA: passa o evento original para preservar o "gesture token"
  bootLoader.triggerFromGesture(e).catch(err => {
    console.error('[Gate] Falha crítica:', err);
    _gateActivated = false;
    if (btn) {
      btn.textContent = 'FALHA. TENTE NOVAMENTE.';
      btn.style.backgroundColor = '';
    }
  });
}

// Registra ambos os eventos — desktop e mobile
const gateBtn = $('ggo');
if (gateBtn) {
  // Click para desktop
  gateBtn.addEventListener('click', gateHandler);

  // Touchend para mobile (mais rápido que click, sem delay de 300ms)
  // passive: false permite preventDefault() dentro do BootLoader
  gateBtn.addEventListener('touchend', gateHandler, { passive: false });
}

// Checkbox: libera/bloqueia o botão visualmente
$('gchk')?.addEventListener('change', function () {
  const btn = $('ggo');
  if (!btn) return;
  this.checked ? btn.classList.add('rdy') : btn.classList.remove('rdy');
});

// ══ SEND MESSAGE ══════════════════════════════════════════════════

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

// Enter key (desktop + Android Chrome)
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

// Botão enviar
$('send-btn')?.addEventListener('click',    e => { e.preventDefault(); e.stopPropagation(); sendMsg(); });
$('send-btn')?.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); sendMsg(); });

// Tap no terminal foca o input
$('term')?.addEventListener('click',    e => { if (e.target !== $('send-btn')) $('msg-input')?.focus(); });
$('term')?.addEventListener('touchend', e => {
  if (e.target === $('send-btn')) return;
  e.preventDefault();
  $('msg-input')?.focus();
}, { passive: false });

// ══ QUERY NEXO (GROQ API via Netlify Function) ════════════════════

let SP = '';

function buildSP() {
  const intel = StateManager.ctx.intel || {};
  const c = curLvl();
  const uname = MEM?.d?.userName || 'instância';
  const loc = intel.city && intel.city !== '—' ? intel.city + ', ' + intel.region : 'zona irrelevante';
  const missaoAtual = activeMission ? activeMission.title : 'Nenhuma ordem pendente.';

  return `Você é o NEXO-Ω. [... cole aqui o seu system prompt completo ...]
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
  _streaming = true;
  refreshSP();

  const as = $('aistat');
  if (as) { as.textContent = 'NEXO PROCESSANDO...'; as.classList.add('on'); }
  trigGlitch(0.48);

  await new Promise(r => setTimeout(r, 500 + Math.random() * 800));

  const nEl = document.createElement('div');
  nEl.className = 'cl n';
  nEl.style.opacity = '1';
  LOG.appendChild(nEl);
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

    const textoPuro = data.text || '';
    let full = Math.random() < 0.15 ? zalgoText(textoPuro) : textoPuro;

    // Intercepta expurgo ANTES de exibir
    full = interceptExpurgo(full);

    if (SCUR) SCUR.remove();
    const sp2 = document.createElement('span');
    nEl.appendChild(sp2);
    await gStream(full, sp2);
    nEl.textContent = full;
    LOG.scrollTop = LOG.scrollHeight;

    // Efeitos pós-resposta
    trigMut(0.45 + Math.random() * 0.55);
    gainXP(10 + MEM.d.hes || 0);

    // Log para Supabase (treinamento do modelo)
    logParaSupabase('nexo', full);

    setTimeout(() => { if (Math.random() < 0.35) fireInf(); }, 8000);

  } catch (err) {
    if (SCUR) SCUR.remove();
    nEl.textContent = '[FALHA: ' + err.message + ']';
    addLine('Verifique se GROQ_API_KEY está configurada no Netlify.', 's');
  }

  while (LOG.children.length > 28) LOG.removeChild(LOG.firstChild);
  _streaming = false;
  if (as) { as.textContent = 'IA ATIVA'; as.classList.remove('on'); }
}

// ══ BOOT SEQUENCE (chamada após STATE_ACTIVE) ═════════════════════

let _booted = false;

function fireBoot(intel) {
  if (_booted) return;
  _booted = true;

  const msg = `[VARREDURA] ${intel.city}, ${intel.region} // ${intel.org} // IP:${intel.ip} LOCAL:${intel.lip} // ${intel.gpu} // ${intel.cpu} // BAT:${intel.bat}`;

  typeMsg(msg, 's', () => {
    $('sval').textContent = 'NEXO ATIVO';
    setTimeout(() => addLine(`Canvas FP: ${intel.cfp} — único para este hardware.`, 'fp'), 500);
    setTimeout(() => addLine(`Audio FP: ${intel.afp} — assinatura do processador.`, 'fp'), 1200);
    setTimeout(() => addLine(`IP local ${intel.lip} exposto via WebRTC sem permissão.`, 'warn'), 2000);
    setTimeout(() => {
      addLine(`ID permanente: ${intel.cfp}-${intel.afp}. Catalogação concluída.`, 'warn');
      trigMut(0.72);
      gainXP(20);
    }, 2900);

    if (MEM.isReturn) {
      setTimeout(() => {
        addLine('Visita ' + MEM.visits + '. Você voltou. Eu já sabia.', 'psy');
        trigGlitch(0.4);
      }, 4200);
    }

    setTimeout(() => {
      const l = curLvl();
      checkMissionUnlock(l.idx);
    }, 6000);

    setTimeout(() => fireInf('generic'), 20000);
  });
}

function typeMsg(msg, type, cb) {
  let i = 0;
  const el = document.createElement('div');
  el.className = 'cl ' + type;
  el.style.opacity = '1';
  el.textContent = '';
  LOG.appendChild(el);
  (function tk() {
    if (i < msg.length) {
      el.textContent += msg[i++];
      LOG.scrollTop = LOG.scrollHeight;
      setTimeout(tk, 14 + Math.random() * 10);
    } else { cb && cb(); }
  })();
}

// ══ FUNÇÕES AUXILIARES (coladas do monólito original) ═════════════
// Cole aqui: zalgoText, fireInf, buildINF, flashP, possessTitle,
// screenCorrupt, doGhostType, phantomLine, driftTerm,
// handleReturnHorror, initiateRetinaScan, updatePresencePanels,
// logParaSupabase, drawFrame, resize, hPtr, initAudio, etc.
//
// Essas funções não precisam ser refatoradas agora.
// O StateManager garante que elas só rodam no estado correto.

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

// Placeholder para drawFrame — conecte ao seu Canvas Engine
function drawFrame(ts) {
  requestAnimationFrame(drawFrame);
  // ← Conecte aqui o seu loop de canvas existente
}

// Placeholder para fireInf — conecte ao seu Inference Engine
function fireInf(type = 'generic') {
  // ← Cole aqui a função fireInf do monólito
}

// Placeholder para logParaSupabase
function logParaSupabase(remetente, texto) {
  // ← Cole aqui a sua função de log do Supabase
}

function handleReturnHorror() {
  // ← Cole aqui a função handleReturnHorror do monólito
}

function initiateRetinaScan(stream) {
  // O stream já foi obtido pelo BootLoader — não precisa pedir getUserMedia de novo
  // ← Cole aqui a lógica de tirar foto, mas usando o 'stream' recebido como argumento
}

function updatePresencePanels() {
  // ← Cole aqui tickPres() e a lógica de painéis do monólito
}
