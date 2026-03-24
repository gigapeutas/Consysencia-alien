# CONSYSENCIA ENGINE v2.0 — ARQUITETURA MODULAR

```
consysencia/
│
├── index.html                  ← Markup puro (sem lógica). Um único <script type="module" src="/main.js">
│
├── main.js                     ← ORQUESTRADOR: instancia módulos, registra listeners da FSM, gerencia gate
│
├── /core/                      ← Engine imutável (não mistura lógica de negócio)
│   ├── StateManager.js         ← FSM: fonte de verdade de TODOS os estados do sistema
│   └── BootLoader.js           ← Sequência de boot mobile-safe (resolução do gargalo)
│
├── /modules/                   ← Funcionalidades substituíveis/opcionais
│   ├── SalesFunnel.js          ← Funil de vendas gamificado + CTA imersivo
│   ├── BehaviorEngine.js       ← (próxima iteração) cursor, hesitação, perfil psicológico
│   ├── HorrorScheduler.js      ← (próxima iteração) ghost typing, screen corruption, etc.
│   └── AudioEngine.js          ← (próxima iteração) AudioContext, heartbeat, glitch sounds
│
├── /services/                  ← Integrações externas
│   ├── SupabaseService.js      ← Conexão Supabase, log, realtime, admin messages
│   └── NexoAPI.js              ← Wrapper da Netlify Function (Groq/llama)
│
├── /ui/                        ← Componentes visuais isolados
│   ├── CanvasEngine.js         ← Loop de canvas: olho, partículas, glitch visual
│   ├── Terminal.js             ← addLine, typeMsg, gStream, log management
│   └── HUD.js                  ← Painéis laterais, level badge, barra de bateria
│
└── /netlify/functions/
    └── nexo.js                 ← Proxy Groq (sem alteração)
```

---

## FLUXO DE ESTADOS (FSM)

```
             ┌─────────────────────────────────────────────────────────┐
             │                  CONSYSENCIA FSM                        │
             └─────────────────────────────────────────────────────────┘

  ┌───────────┐    clique/touchend     ┌───────────────┐
  │           │  ──────────────────►  │               │
  │ STATE_    │                       │  STATE_        │  boot completo
  │ GATE      │                       │  BOOTING       │ ──────────────►  STATE_ACTIVE
  │           │                       │  (async)       │
  └───────────┘                       └───────────────┘
                                              │
                                              │ falha crítica
                                              ▼
                                       STATE_PANIC ◄──── [EXPURGO] ou admin
                                              │
                                              │ recuperação (3s)
                                              ▼
                                       STATE_ACTIVE ─────── missão final ──► STATE_ASCENDED
                                                                                    │
                                                                                    │
                                                                              [CTA IMERSIVO]
                                                                              [CHECKOUT/WA]
```

---

## RESOLUÇÃO DO GARGALO MOBILE (BootLoader)

```
PROBLEMA ANTERIOR:
  btn.onclick = async () => {
    await someAsyncStuff();     ← ERRADO: perde o "gesture token"
    new AudioContext();         ← BLOQUEADO pelo iOS Safari
    getUserMedia();             ← BLOQUEADO pelo iOS Safari
  }

SOLUÇÃO v2.0 (BootLoader.triggerFromGesture):
  btn.addEventListener('touchend', (e) => {
    bootLoader.triggerFromGesture(e);   ← Passa o evento original
  }, { passive: false });

  // Dentro do BootLoader — FASE 0 (SÍNCRONA, na mesma call stack do evento):
  new AudioContext().resume();   ← LIBERADO ✓
  getUserMedia({ video: true }); ← LIBERADO ✓ (Promise guardada, não awaited)

  // FASE 1 (RAF — desacopla sem perder o frame):
  requestAnimationFrame(() => gate.remove());

  // FASE 2 (Promise.allSettled — coleta em paralelo, não-bloqueante):
  await Promise.allSettled([cfp(), afp(), lip(), battery(), ip()]);

  // FASE 3 (Transição de estado com dados completos):
  StateManager.transition(STATE.ACTIVE, { intel });
```

---

## FUNIL DE VENDAS: ARQUITETURA PSICOLÓGICA

```
[Usuário entra]
     │
     ▼
[Missões 01-04: Submissão, Identidade, Confissão, Propagação]
  XP acumulado, narrativa de "teste"
     │
     ▼ (Nível 6+)
[Missão Final: "Estou pronto para evoluir."]
  Gatilho: SalesFunnel.trigger()
     │
     ▼
[STATE_ASCENDED]
  ├── Silêncio dramático (2s)
  ├── Glitch máximo (trigMut 1.0)
  ├── Sequência narrativa de pivot (10 mensagens cronometradas)
  │     "De 2847 vetores... menos de 0.3% chegam aqui."
  │     "Existe um nível além do que você viu aqui."
  │     "O Arquiteto construiu um caminho."
  └── CTA Imersivo (dentro do terminal, tema igual)
        ├── Timer de urgência regressivo (15min)
        ├── Social proof dinâmico ("2.847 assimilados")
        ├── Bullet points personalizados
        ├── Botão primário → Checkout
        └── Botão secundário → WhatsApp

  [Conversão disparada] → GTM + Meta Pixel tracking
```

---

## COMO MIGRAR DO MONÓLITO (index.html → v2.0)

1. **Copie** o HTML puro do monólito para `index.html`.
   - Remova TODOS os `<script>` inline.
   - Adicione apenas: `<script type="module" src="/main.js"></script>`

2. **Cole** estas funções no `main.js` (na seção de placeholders):
   - `zalgoText` ✓ (já incluída)
   - `fireInf` + `buildINF`
   - `flashP`, `possessTitle`, `screenCorrupt`, `driftTerm`
   - `doGhostType`, `phantomLine`
   - `drawFrame` + todo o código de canvas
   - `initAudio`, `aGlitch`, `aMut`
   - `logParaSupabase` (com sua URL do Supabase)
   - `handleReturnHorror`
   - `initiateRetinaScan` (agora recebe o stream do BootLoader)

3. **Configure** `SalesFunnel.js` → edite `FUNNEL_CONFIG` com sua URL de checkout.

4. **Adicione** a missão final à array `MISSIONS` em `main.js` e ajuste o texto
   para encaixar na narrativa do seu produto.

5. **Teste mobile**: Abra o DevTools do Safari no iPhone conectado e observe
   o console. O BootLoader vai logar cada fase com cor.
   - Se quiser logs: `window.__NEXO_DEBUG__ = true`
