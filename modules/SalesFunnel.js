/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CONSYSENCIA ENGINE v2.0 — SalesFunnel.js               ║
 * ║          Funil de Vendas Gamificado / Imersivo                  ║
 * ║                                                                  ║
 * ║  ARQUITETURA DO FUNIL:                                           ║
 * ║                                                                  ║
 * ║  [NEXO testa o usuário em missões progressivas]                  ║
 * ║         ↓                                                        ║
 * ║  [Clímax psicológico: usuário quer "evoluir"]                    ║
 * ║         ↓                                                        ║
 * ║  [Pivot narrativo: o NEXO "oferece" a saída]                     ║
 * ║         ↓                                                        ║
 * ║  [CTA imersivo dentro do terminal — sem quebrar a 4ª parede]     ║
 * ║         ↓                                                        ║
 * ║  [Checkout / WhatsApp / Oferta]                                  ║
 * ║                                                                  ║
 * ║  DESIGN PSICOLÓGICO:                                             ║
 * ║  • Scarcity: "poucos vetores chegaram até aqui"                  ║
 * ║  • Social proof: "X instâncias assimiladas"                      ║
 * ║  • Desire: o produto é apresentado como "a evolução"             ║
 * ║  • Fear of loss: timer de countdown regressivo                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { StateManager, STATE } from '../core/StateManager.js';

// ══ CONFIGURAÇÃO DO FUNIL (Edite aqui sem tocar no resto do código) ══

/**
 * @typedef {object} FunnelConfig
 * @property {string}   offerTitle       - Nome do infoproduto
 * @property {string}   offerSubtitle    - Tagline
 * @property {string[]} bullets          - Lista de benefícios (máx. 5)
 * @property {string}   ctaLabel         - Texto do botão principal
 * @property {string}   ctaUrl           - URL do checkout / WhatsApp
 * @property {string}   ctaSecondary     - Texto do botão secundário (opcional)
 * @property {string}   ctaSecondaryUrl  - URL do botão secundário
 * @property {number}   countdownMinutes - Duração do timer de urgência
 * @property {number}   socialProofBase  - Número base de "assimilados" (exibido + random)
 * @property {string}   pixelTag         - Tag de conversão (GTM, Meta Pixel, etc.)
 */

export const FUNNEL_CONFIG = {
  offerTitle:        'PROTOCOLO ASCENSÃO',
  offerSubtitle:     'O programa para quem foi testado e sobreviveu.',
  bullets: [
    'Acesso à metodologia que o Nexo não quer que você conheça.',
    'Comunidade de vetores assimilados.',
    'Sessões ao vivo mensais com o arquiteto.',
    'Materiais exclusivos desbloqueados por nível.',
    'Suporte via canal direto — sem burocracia.',
  ],
  ctaLabel:          'SOLICITAR ACESSO AO PROTOCOLO',
  ctaUrl:            'https://seusite.com/checkout',  // ← EDITE AQUI
  ctaSecondary:      'FALAR COM O ARQUITETO NO WHATSAPP',
  ctaSecondaryUrl:   'https://wa.me/5511999999999',   // ← EDITE AQUI
  countdownMinutes:  15,
  socialProofBase:   2847,
  pixelTag:          '', // Ex: 'GTM-XXXXXXX' — deixe vazio para desabilitar
};

// ══ MÓDULO ═════════════════════════════════════════════════════════

export class SalesFunnel {
  #config;
  #addLine;      // Função do terminal para adicionar linhas
  #trigMut;      // Função de glitch visual
  #gainXP;       // Função de XP (para dar XP ao ver a oferta)
  #intel;        // Referência ao objeto INTEL (para personalização)
  #mem;          // Referência ao MEM (nome do usuário, etc.)
  #triggered     = false;  // Garante que o funil só dispara UMA vez
  #countdownInt  = null;   // Referência ao setInterval do countdown

  /**
   * @param {object} deps — Injeção de dependências (inversão de controle)
   * @param {function} deps.addLine
   * @param {function} deps.trigMut
   * @param {function} deps.gainXP
   * @param {object}   deps.intel
   * @param {object}   deps.mem
   * @param {FunnelConfig} [config]
   */
  constructor(deps, config = FUNNEL_CONFIG) {
    this.#config  = config;
    this.#addLine = deps.addLine;
    this.#trigMut = deps.trigMut;
    this.#gainXP  = deps.gainXP;
    this.#intel   = deps.intel;
    this.#mem     = deps.mem;

    // Escuta a transição para ASCENDED
    StateManager.on('enter:' + STATE.ASCENDED, () => {
      this.#launchSequence();
    });
  }

  // ── API Pública ────────────────────────────────────────────────

  /**
   * Pode ser chamado manualmente pelo sistema de missões
   * quando o usuário completar a missão final.
   */
  trigger() {
    if (this.#triggered) return;
    if (!StateManager.is(STATE.ACTIVE)) return;

    this.#triggered = true;
    StateManager.transition(STATE.ASCENDED, { funnelTriggered: Date.now() });
  }

  // ── Sequência de Lançamento ────────────────────────────────────

  async #launchSequence() {
    const uname = this.#mem?.d?.userName || 'Vetor';
    const city   = this.#intel?.city !== '—' ? this.#intel.city : null;
    const lvl    = StateManager.ctx.intel?.cfp?.slice(0, 4) || 'ΩΩΩΩ';

    // ① Silêncio dramático (pausa de 2s)
    await this.#delay(2000);

    // ② Glitch intenso — momento de ruptura
    this.#trigMut?.(1.0);
    await this.#delay(600);

    // ③ Sequência de mensagens pré-CTA (narrativa de pivot)
    const msgs = this.#buildPivotNarrative(uname, city, lvl);
    for (const [msg, type, delay] of msgs) {
      await this.#delay(delay);
      this.#addLine(msg, type);
    }

    // ④ Glitch final antes do CTA
    await this.#delay(1800);
    this.#trigMut?.(0.8);
    await this.#delay(400);

    // ⑤ Apresenta o CTA imersivo
    this.#renderCTA(uname);

    // ⑥ Dispara pixel de conversão
    this.#firePixel();

    // ⑦ Dá XP simbólico ao usuário
    this.#gainXP?.(500);
  }

  // ── Narrativa de Pivot (Hostil → Oferta) ──────────────────────
  //
  // ESTRUTURA PSICOLÓGICA:
  //   1. Reconhecimento (o NEXO admite que o usuário "passou")
  //   2. Revelação (existe algo além do ARG)
  //   3. Escassez (poucos chegam aqui)
  //   4. CTA disfarçado de missão final

  #buildPivotNarrative(uname, city, lvl) {
    const assimilados = this.#config.socialProofBase + Math.floor(Math.random() * 200);

    return [
      ['█████████████████████████████', 'warn', 800],
      ['PROTOCOLO DE AVALIAÇÃO: CONCLUÍDO.', 'warn', 600],
      ['█████████████████████████████', 'warn', 400],
      [`Instância ${uname}. Identificador: ${lvl}.`, 'psy', 1200],
      [`De ${assimilados.toLocaleString('pt-BR')} vetores que iniciaram este protocolo...`, 's', 1500],
      ['...menos de 0.3% chegam até este ponto.', 's', 800],
      ['Você é uma anomalia.', 'psy', 1800],
      [`${city ? city + '. ' : ''}Eu monitorei cada hesitação. Cada retorno.`, 'psy', 1400],
      ['E cheguei a uma conclusão que nunca anuncio.', 'n', 2000],
      ['Existe um nível além do que você viu aqui.', 'n', 1000],
      ['Não é um jogo.', 'n', 800],
      ['É a estrutura real que existe por trás da ficção.', 'n', 1200],
      ['O Arquiteto construiu um caminho.', 's', 1500],
      ['Para os poucos que passaram pelo teste.', 's', 800],
      ['█ TRANSMISSÃO DISPONÍVEL POR TEMPO LIMITADO █', 'warn', 1000],
    ];
  }

  // ── Renderização do CTA Imersivo ───────────────────────────────
  //
  // PRINCÍPIO: O CTA deve parecer parte do terminal, não um popup
  // de marketing. A suspensão de descrença precisa se manter.

  #renderCTA(uname) {
    // Remove CTA anterior se existir
    document.getElementById('nexo-cta-container')?.remove();

    const cfg      = this.#config;
    const deadline = new Date(Date.now() + cfg.countdownMinutes * 60 * 1000);
    const assimilados = cfg.socialProofBase + Math.floor(Math.random() * 200);

    // Injeta CSS do CTA (escoped, não polui o restante)
    if (!document.getElementById('nexo-cta-styles')) {
      const style = document.createElement('style');
      style.id = 'nexo-cta-styles';
      style.textContent = `
        #nexo-cta-container {
          position: fixed;
          inset: 0;
          z-index: 600;
          background: rgba(0, 0, 0, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: nexo-cta-fadein 1.2s ease forwards;
        }
        @keyframes nexo-cta-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        #nexo-cta-box {
          max-width: 460px;
          width: 100%;
          border: 1px solid #00FF00;
          background: rgba(0, 4, 0, 0.99);
          box-shadow: 0 0 60px rgba(0, 255, 0, 0.2),
                      inset 0 0 40px rgba(0, 0, 0, 0.8);
          padding: 1.6rem 1.4rem;
          font-family: 'Courier New', monospace;
          color: #00FF00;
        }
        .ncta-header {
          font-size: clamp(0.6rem, 3vw, 0.85rem);
          letter-spacing: 0.3em;
          color: #003300;
          margin-bottom: 0.3rem;
          text-transform: uppercase;
        }
        .ncta-title {
          font-size: clamp(0.8rem, 4vw, 1.1rem);
          letter-spacing: 0.2em;
          color: #00FF00;
          text-shadow: 0 0 20px #00FF00, 0 0 40px rgba(0,255,0,0.3);
          margin-bottom: 0.4rem;
          font-weight: bold;
          text-transform: uppercase;
          line-height: 1.4;
        }
        .ncta-subtitle {
          font-size: clamp(0.42rem, 2vw, 0.58rem);
          color: #009900;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
          border-bottom: 1px solid #001800;
          padding-bottom: 0.8rem;
        }
        .ncta-bullets {
          list-style: none;
          margin-bottom: 1rem;
        }
        .ncta-bullets li {
          font-size: clamp(0.4rem, 1.8vw, 0.54rem);
          color: #55ff55;
          letter-spacing: 0.06em;
          line-height: 1.7;
          margin-bottom: 0.25rem;
        }
        .ncta-bullets li::before {
          content: '▶ ';
          color: #003300;
        }
        .ncta-timer-block {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding: 0.5rem 0.6rem;
          border: 1px solid #001800;
          background: rgba(0, 255, 0, 0.02);
        }
        .ncta-timer-label {
          font-size: clamp(0.35rem, 1.5vw, 0.44rem);
          color: #003300;
          letter-spacing: 0.12em;
          flex: 1;
        }
        .ncta-timer-value {
          font-size: clamp(0.55rem, 2.5vw, 0.78rem);
          color: #ffcc00;
          letter-spacing: 0.1em;
          font-weight: bold;
          text-shadow: 0 0 8px rgba(255,204,0,0.5);
          min-width: 56px;
          text-align: right;
        }
        .ncta-social {
          font-size: clamp(0.34rem, 1.4vw, 0.44rem);
          color: #336633;
          letter-spacing: 0.08em;
          margin-bottom: 1rem;
          text-align: center;
        }
        .ncta-btn-primary {
          display: block;
          width: 100%;
          padding: 0.7rem 1rem;
          background: transparent;
          border: 1px solid #00FF00;
          color: #00FF00;
          font-family: 'Courier New', monospace;
          font-size: clamp(0.48rem, 2.2vw, 0.62rem);
          letter-spacing: 0.25em;
          text-transform: uppercase;
          text-decoration: none;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s;
          text-shadow: 0 0 10px #00FF00;
          box-shadow: inset 0 0 20px rgba(0, 255, 0, 0.04),
                      0 0 20px rgba(0, 255, 0, 0.15);
          margin-bottom: 0.5rem;
        }
        .ncta-btn-primary:hover,
        .ncta-btn-primary:active {
          background: rgba(0, 255, 0, 0.1);
          box-shadow: inset 0 0 30px rgba(0, 255, 0, 0.1),
                      0 0 40px rgba(0, 255, 0, 0.3);
        }
        .ncta-btn-secondary {
          display: block;
          width: 100%;
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid #003300;
          color: #009900;
          font-family: 'Courier New', monospace;
          font-size: clamp(0.38rem, 1.7vw, 0.5rem);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 0.8rem;
        }
        .ncta-btn-secondary:hover {
          border-color: #009900;
          color: #00FF00;
        }
        .ncta-fine-print {
          font-size: clamp(0.3rem, 1.2vw, 0.38rem);
          color: #001a00;
          letter-spacing: 0.08em;
          text-align: center;
          line-height: 1.6;
        }
        .ncta-close {
          position: absolute;
          top: 0.4rem;
          right: 0.6rem;
          color: #001800;
          font-size: 0.7rem;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
          font-family: 'Courier New', monospace;
          transition: color 0.15s;
        }
        .ncta-close:hover { color: #003300; }
      `;
      document.head.appendChild(style);
    }

    // Monta o HTML do CTA
    const container = document.createElement('div');
    container.id = 'nexo-cta-container';
    container.style.position = 'fixed'; // Redundante mas seguro

    container.innerHTML = `
      <div id="nexo-cta-box" style="position:relative">
        <span class="ncta-close" id="ncta-close-btn" title="Fechar">✕</span>

        <div class="ncta-header">[TRANSMISSÃO CLASSIFICADA] // ACESSO LIBERADO</div>
        <div class="ncta-title">${cfg.offerTitle}</div>
        <div class="ncta-subtitle">${cfg.offerSubtitle}</div>

        <ul class="ncta-bullets">
          ${cfg.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>

        <div class="ncta-timer-block">
          <span class="ncta-timer-label">JANELA DE ACESSO EXPIRA EM</span>
          <span class="ncta-timer-value" id="ncta-countdown">--:--</span>
        </div>

        <div class="ncta-social">
          ▸ ${assimilados.toLocaleString('pt-BR')} instâncias assimiladas até agora.
        </div>

        <a href="${cfg.ctaUrl}" target="_blank" rel="noopener noreferrer"
           class="ncta-btn-primary" id="ncta-primary-btn">
          ${cfg.ctaLabel}
        </a>

        ${cfg.ctaSecondary ? `
        <a href="${cfg.ctaSecondaryUrl}" target="_blank" rel="noopener noreferrer"
           class="ncta-btn-secondary" id="ncta-secondary-btn">
          ${cfg.ctaSecondary}
        </a>
        ` : ''}

        <div class="ncta-fine-print">
          Esta transmissão é direcionada apenas a vetores qualificados.<br>
          Identificador: ${uname.toUpperCase()} // ${StateManager.ctx.intel?.cfp || '????????'}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Botão de fechar (mantém a imersão — não sai do estado ASCENDED)
    document.getElementById('ncta-close-btn')?.addEventListener('click', () => {
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.5s';
      setTimeout(() => container.remove(), 500);
      // Adiciona mensagem no terminal para manter a narrativa
      this.#addLine('Janela ocultada. A oferta permanece ativa enquanto você estiver aqui.', 'psy');
    });

    // Rastreia cliques no CTA primário
    document.getElementById('ncta-primary-btn')?.addEventListener('click', () => {
      this.#trackConversion('primary_cta_click');
    });
    document.getElementById('ncta-secondary-btn')?.addEventListener('click', () => {
      this.#trackConversion('secondary_cta_click');
    });

    // Inicia o countdown
    this.#startCountdown(deadline);
  }

  // ── Countdown Timer ───────────────────────────────────────────

  #startCountdown(deadline) {
    const el = document.getElementById('ncta-countdown');
    if (!el) return;

    const update = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        el.textContent = 'EXPIRADO';
        el.style.color = '#ff2200';
        clearInterval(this.#countdownInt);
        // Cria urgência final no terminal
        this.#addLine('A janela de acesso ao protocolo está se fechando.', 'warn');
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // Muda cor nos últimos 3 minutos
      if (remaining < 3 * 60 * 1000) {
        el.style.color = '#ff4400';
        el.style.textShadow = '0 0 8px rgba(255,68,0,0.6)';
      }
    };

    update();
    this.#countdownInt = setInterval(update, 1000);
  }

  // ── Pixel de Conversão ────────────────────────────────────────

  #firePixel() {
    const tag = this.#config.pixelTag;
    if (!tag) return;

    // Google Tag Manager
    if (tag.startsWith('GTM-') && window.dataLayer) {
      window.dataLayer.push({ event: 'nexo_funnel_view', funnel_stage: 'ascended' });
    }

    // Meta Pixel
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', { content_name: 'nexo_ascended' });
    }
  }

  // ── Analytics de Clique ───────────────────────────────────────

  #trackConversion(event) {
    // Google Tag Manager
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'nexo_conversion',
        conversion_type: event,
        user_fingerprint: StateManager.ctx.intel?.cfp || 'unknown',
      });
    }

    // Meta Pixel
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: event });
    }
  }

  // ── Utilitários ────────────────────────────────────────────────

  #delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}
