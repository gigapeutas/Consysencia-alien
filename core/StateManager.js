/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CONSYSENCIA ENGINE v2.0 — StateManager.js              ║
 * ║          Máquina de Estados Explícita (FSM)                     ║
 * ║                                                                  ║
 * ║  Arquiteto: Principal Software Engineer                          ║
 * ║  Padrão: Finite State Machine com Observer Pattern              ║
 * ║                                                                  ║
 * ║  Estados:                                                        ║
 * ║    GATE     → Tela inicial, aguardando consentimento             ║
 * ║    BOOTING  → Sequência assíncrona de inicialização             ║
 * ║    ACTIVE   → Terminal liberado, engine de comportamento ativa   ║
 * ║    PANIC    → [EXPURGO] ou intervenção admin                    ║
 * ║    ASCENDED → Missões completas, CTA de vendas apresentado      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ══ DEFINIÇÃO DOS ESTADOS ══════════════════════════════════════════

/** @readonly @enum {string} */
export const STATE = Object.freeze({
  GATE:      'STATE_GATE',
  BOOTING:   'STATE_BOOTING',
  ACTIVE:    'STATE_ACTIVE',
  PANIC:     'STATE_PANIC',
  ASCENDED:  'STATE_ASCENDED',
});

/**
 * Mapa de transições válidas.
 * Chave: estado atual. Valor: array de estados para os quais pode transicionar.
 * Qualquer transição não listada aqui será bloqueada com erro.
 */
const TRANSITIONS = {
  [STATE.GATE]:     [STATE.BOOTING],
  [STATE.BOOTING]:  [STATE.ACTIVE, STATE.PANIC],
  [STATE.ACTIVE]:   [STATE.PANIC, STATE.ASCENDED],
  [STATE.PANIC]:    [STATE.ACTIVE],          // Recuperação pós-expurgo
  [STATE.ASCENDED]: [],                      // Estado terminal — sem retorno
};

// ══ STATE MANAGER (SINGLETON) ══════════════════════════════════════

class StateManagerClass {
  #state       = STATE.GATE;  // Estado inicial privado
  #listeners   = new Map();   // Mapa de observers: { eventKey → Set<fn> }
  #history     = [];          // Histórico de transições (debug & analytics)
  #context     = {};          // Dados compartilhados entre módulos (payload)

  constructor() {
    // Garante que a instância expõe o estado atual imediatamente
    this.#history.push({ from: null, to: STATE.GATE, ts: Date.now() });
  }

  // ── Getters ──────────────────────────────────────────────────────

  /** Estado atual da máquina */
  get current() { return this.#state; }

  /** Snapshot do contexto compartilhado (imutável externamente) */
  get ctx() { return { ...this.#context }; }

  /** Histórico completo de transições */
  get history() { return [...this.#history]; }

  // ── Transição de Estado ──────────────────────────────────────────

  /**
   * Transiciona para um novo estado.
   * @param {string} nextState - Um dos valores de STATE
   * @param {object} [payload] - Dados opcionais passados aos listeners
   * @throws {Error} Se a transição não for permitida pelo mapa
   */
  transition(nextState, payload = {}) {
    const allowed = TRANSITIONS[this.#state];

    // Guarda de segurança: bloqueia transições inválidas
    if (!allowed || !allowed.includes(nextState)) {
      const msg = `[NEXO-FSM] Transição inválida: ${this.#state} → ${nextState}`;
      console.error(msg);
      throw new Error(msg);
    }

    const prevState = this.#state;
    this.#state = nextState;

    // Mescla payload no contexto compartilhado
    if (payload && typeof payload === 'object') {
      this.#context = { ...this.#context, ...payload };
    }

    // Registra no histórico
    this.#history.push({ from: prevState, to: nextState, ts: Date.now(), payload });

    // Notifica listeners (saída do estado anterior + entrada no novo)
    this.#emit(`exit:${prevState}`, { from: prevState, to: nextState, ctx: this.ctx });
    this.#emit(`enter:${nextState}`, { from: prevState, to: nextState, ctx: this.ctx });
    this.#emit('change',             { from: prevState, to: nextState, ctx: this.ctx });

    // Log visual no console (dev mode)
    if (typeof window !== 'undefined' && window.__NEXO_DEBUG__) {
      console.log(`%c[NEXO-FSM] %c${prevState}%c → %c${nextState}`,
        'color:#00cc44;font-weight:bold',
        'color:#009922', 'color:#555', 'color:#00ff44;font-weight:bold',
        payload
      );
    }
  }

  // ── Observer API ─────────────────────────────────────────────────

  /**
   * Registra um listener para um evento de estado.
   *
   * Eventos disponíveis:
   *   'change'         → qualquer transição
   *   'enter:STATE_X'  → ao entrar em STATE_X
   *   'exit:STATE_X'   → ao sair de STATE_X
   *
   * @param {string} event
   * @param {function} fn
   * @returns {function} Função de cleanup (chame para remover o listener)
   */
  on(event, fn) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(fn);

    // Retorna função de limpeza (padrão de cleanup moderno)
    return () => this.off(event, fn);
  }

  /**
   * Remove um listener específico.
   * @param {string} event
   * @param {function} fn
   */
  off(event, fn) {
    this.#listeners.get(event)?.delete(fn);
  }

  /**
   * Registra um listener que dispara apenas UMA vez.
   * @param {string} event
   * @param {function} fn
   */
  once(event, fn) {
    const wrapper = (...args) => {
      fn(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  // ── Helpers de Estado ────────────────────────────────────────────

  /** @returns {boolean} Se o estado atual é o informado */
  is(state) { return this.#state === state; }

  /** @returns {boolean} Se o estado atual é um dos informados */
  isAny(...states) { return states.includes(this.#state); }

  /**
   * Atualiza o contexto compartilhado sem trocar de estado.
   * Útil para módulos gravarem dados (INTEL, MEM, BEH) de forma centralizada.
   * @param {object} patch
   */
  setCtx(patch) {
    if (patch && typeof patch === 'object') {
      this.#context = { ...this.#context, ...patch };
    }
  }

  // ── Privado ──────────────────────────────────────────────────────

  #emit(event, data) {
    const fns = this.#listeners.get(event);
    if (!fns || fns.size === 0) return;
    // Itera em microtask para não bloquear a thread de transição
    fns.forEach(fn => {
      try { fn(data); }
      catch (err) { console.error(`[NEXO-FSM] Erro no listener "${event}":`, err); }
    });
  }
}

// ══ EXPORTA O SINGLETON ═══════════════════════════════════════════
// Um único StateManager é a fonte de verdade de toda a engine.
export const StateManager = new StateManagerClass();

// Expõe globalmente para debug em produção (acesso pelo console do browser)
if (typeof window !== 'undefined') {
  window.__NEXO_SM__ = StateManager;
}
