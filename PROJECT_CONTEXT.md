# Submundo Brasil — Contexto do Projeto

RPG de crime e estratégia para navegador, com ambientação brasileira fictícia,
inspirado nos jogos clássicos de menus e cliques. Single-player, offline, em um
único arquivo HTML.

## Estado atual: v1.2

| Arquivo | Papel |
|---|---|
| `Submundo-Brasil-v1.2.html` | **Entregável**: jogo completo e autônomo (gerado, não editar à mão) |
| `Submundo-Brasil-v0.4.html` | Versão anterior, mantida como referência e para o teste de compatibilidade |
| `src/engine.js` | Motor de regras: dados, estado, migração, fórmulas, ações, IA, eventos, temporada (sem DOM) |
| `src/art.js` | Ilustrações SVG e troca por imagens pintadas (`window.SB_ART`) |
| `PROMPTS_ARTE.md` | Guia de estilo e prompts das imagens pintadas |
| `src/ui.js` | Interface: persistência, renderização das 6 telas e eventos de clique |
| `src/style.css` | CSS herdado da 0.4 (identidade visual) |
| `src/extra.css` | Componentes novos da 0.5 no mesmo estilo |
| `src/body.html` | Estrutura fixa (topo, menus, tela inicial) |
| `build.js` | Concatena `src/` em `Submundo-Brasil-v1.2.html` |
| `tests/` | Motor, fuzz, interface (Playwright), simulação e comparação de carreiras |
| `GAME_DESIGN.md` | Auditoria da 0.4 e todas as regras e números |
| `VALIDATION.md` | O que foi testado, resultados e limitações |
| `NEXT_STEPS.md` | Pendências e roadmap |
| `LANCAMENTO.md` | Análise do que falta para lançar, por prioridade |
| `AGENTS.md` | Regras para quem continuar o desenvolvimento |

## Arquitetura

```
┌───────────── Submundo-Brasil-v1.2.html ─────────────┐
│ <style>  style.css + extra.css                       │
│ <body>   body.html                                   │
│ <script id="sb-engine">  window.SB  (regras puras)   │
│ <script id="sb-ui">      persistência + telas        │
└──────────────────────────────────────────────────────┘
```

- **Estado**: um objeto JSON simples (`SB.defaultState`), schema 2. É gravado inteiro em `localStorage['submundo_brasil_v01']` após cada ação (a chave é a mesma desde a 0.1, para ler saves antigos).
- **Regras**: `SB.perform(state, 'acao', ...args)` valida, altera e devolve `{ok, good, msg, lines}`. Uma ação recusada não altera o estado.
- **Interface**: tira uma "foto" do estado antes e depois de cada ação para mostrar as variações; `render()` redesenha a tela atual a partir do estado.
- **Aleatoriedade**: `crypto.getRandomValues` no jogo; `SB.setRandom(SB.seeded(n))` nos testes, de forma determinística.

## Persistência e segurança dos dados

- `parseSave(texto)` aceita o save cru do `localStorage`, arquivos exportados da 0.4 e da 0.5 (envelope `{game, version, checksum, save}`) e schemas 1 e 2.
- Verificação estrutural mínima (nome, dia, temporada, listas); depois `normalizeSave` **reconstrói** cada campo com tipo e faixa corretos. Campos desconhecidos são descartados, e textos são limpos e truncados.
- Save ilegível → cópia em `submundo_brasil_corrupt_backup` + aviso na tela inicial.
- Primeira migração da 0.4 → cópia em `submundo_brasil_v04_backup`.
- Exportação com checksum FNV-1a; a importação avisa se o arquivo foi alterado.
- Todo texto vindo do save é escapado ao renderizar.

## Como trabalhar

```bash
node build.js            # gera o HTML
npm test                 # build + motor + fuzz + interface
npm run simulate         # balanceamento por estratégia
npm run careers          # carreiras × estratégias
```

Requisitos: Node 18+ e, para o teste de interface, Playwright com Chromium.
O jogo em si não tem dependências: basta abrir o HTML.

## Backend e multiplayer (futuro, não implementado)

A 0.5 é deliberadamente local. Não há nada simulando "online". Para competição
real seriam necessários:

1. **Servidor autoritativo**: hoje o cliente calcula tudo e o save é editável (o checksum só detecta, não impede). Num ranking real, as ações precisam ser validadas no servidor; o `engine.js` foi escrito sem DOM justamente para poder rodar em Node.
2. **Banco de dados** (por exemplo, PostgreSQL): contas, personagens, temporadas globais, ranking, histórico de ações para auditoria.
3. **Tempo real em vez de "Avançar dia"**: energia regenerando por relógio e virada diária global. Exige redesenhar o ritmo (hoje 1 dia = 1 clique).
4. **Facções de jogadores**: as facções da IA viram NPCs, e gangues de jogadores disputam a mesma tabela `presence`.
5. **Antitrapaça e moderação**: limite de ações por tempo, nomes de gangue moderados, sem chat inicialmente.
6. **Privacidade (LGPD)**: dados mínimos, termos de uso, exclusão de conta.
