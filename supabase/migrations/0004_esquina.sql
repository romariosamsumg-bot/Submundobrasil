-- Esquina (online): chat da cidade e geral, desafios de combate com aposta e mercado negro da produção.
-- Ninguém lê nem escreve nestas tabelas direto: quem grava é o servidor do jogo (função "jogar", com a chave
-- de serviço) e a leitura é por funções que devolvem só vulgo, cidade e números (nunca e-mail, id ou save).

create table if not exists public.mensagens (
  id bigserial primary key,
  sala text not null check (char_length(sala) between 1 and 40),
  jogador uuid not null references public.jogadores (id) on delete cascade,
  codinome text not null,
  texto text not null check (char_length(texto) between 1 and 200),
  oculta boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_sala on public.mensagens (sala, id desc);
create index if not exists mensagens_jogador on public.mensagens (jogador, criado_em desc);

create table if not exists public.denuncias (
  mensagem bigint not null references public.mensagens (id) on delete cascade,
  jogador uuid not null references public.jogadores (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (mensagem, jogador)
);

create table if not exists public.mercado (
  id bigserial primary key,
  vendedor uuid not null references public.jogadores (id) on delete cascade,
  vendedor_nome text not null,
  cidade text not null,
  mercadoria text not null,
  qtd int not null check (qtd between 1 and 500),
  preco int not null check (preco > 0),
  status text not null default 'aberto' check (status in ('aberto', 'vendido', 'cancelado')),
  comprador uuid references public.jogadores (id) on delete set null,
  comprador_nome text,
  pago boolean not null default false,
  criado_em timestamptz not null default now(),
  vendido_em timestamptz
);
create index if not exists mercado_aberto on public.mercado (status, id desc);
create index if not exists mercado_vendedor on public.mercado (vendedor, status, pago);

create table if not exists public.desafios (
  id bigserial primary key,
  desafiante uuid not null references public.jogadores (id) on delete cascade,
  desafiante_nome text not null,
  alvo uuid not null references public.jogadores (id) on delete cascade,
  alvo_nome text not null,
  aposta int not null check (aposta > 0),
  poder_a int not null,
  respeito_a int not null,
  status text not null default 'aberto' check (status in ('aberto', 'aceito', 'recusado', 'cancelado', 'expirado')),
  chance int,
  venceu text check (venceu in ('desafiante', 'alvo')),
  efeito_a jsonb,
  entregue_a boolean not null default true, -- false = há algo para entregar ao desafiante na próxima vez que ele entrar
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists desafios_alvo on public.desafios (alvo, status);
create index if not exists desafios_desafiante on public.desafios (desafiante, entregue_a);

alter table public.mensagens enable row level security;
alter table public.denuncias enable row level security;
alter table public.mercado enable row level security;
alter table public.desafios enable row level security;
-- sem políticas: só o servidor (chave de serviço) e as funções abaixo tocam nos dados

-- Chat: últimas mensagens visíveis de uma sala (a sala geral ou a de uma cidade).
create or replace function public.chat_ler(sala_f text, depois bigint default 0)
returns table (id bigint, codinome text, texto text, criado_em timestamptz, eu boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.codinome, m.texto, m.criado_em, m.jogador = auth.uid()
  from public.mensagens m
  where auth.uid() is not null and m.sala = sala_f and not m.oculta and m.id > coalesce(depois, 0) and m.criado_em > now() - interval '3 days'
  order by m.id desc limit 60;
$$;
revoke all on function public.chat_ler(text, bigint) from public;
grant execute on function public.chat_ler(text, bigint) to authenticated;

-- Quem passou pela rua nos últimos 20 minutos (para desafiar), da cidade escolhida ou de todas.
create or replace function public.esquina_presentes(cidade_f text default null)
returns table (codinome text, cidade text, respeito int, classe text, avatar text)
language sql stable security definer set search_path = public as $$
  select j.codinome, j.cidade, s.respeito, s.estado->>'career', s.estado->>'avatar'
  from public.saves s join public.jogadores j on j.id = s.jogador
  where auth.uid() is not null and s.jogador <> auth.uid() and s.atualizado_em > now() - interval '20 minutes' and (cidade_f is null or j.cidade = cidade_f)
  order by s.atualizado_em desc limit 30;
$$;
revoke all on function public.esquina_presentes(text) from public;
grant execute on function public.esquina_presentes(text) to authenticated;

-- Banca do mercado: ofertas abertas (as suas aparecem marcadas).
create or replace function public.mercado_listar()
returns table (id bigint, vendedor_nome text, cidade text, mercadoria text, qtd int, preco int, criado_em timestamptz, meu boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.vendedor_nome, m.cidade, m.mercadoria, m.qtd, m.preco, m.criado_em, m.vendedor = auth.uid()
  from public.mercado m where auth.uid() is not null and m.status = 'aberto' order by m.id desc limit 80;
$$;
revoke all on function public.mercado_listar() from public;
grant execute on function public.mercado_listar() to authenticated;

-- Seus desafios dos últimos 3 dias (lançados e recebidos).
drop function if exists public.meus_desafios();
create or replace function public.meus_desafios()
returns table (id bigint, desafiante_nome text, alvo_nome text, aposta int, status text, chance int, venceu text, poder_a int, criado_em timestamptz, resolvido_em timestamptz, eu_desafiei boolean)
language sql stable security definer set search_path = public as $$
  select d.id, d.desafiante_nome, d.alvo_nome, d.aposta, d.status, d.chance, d.venceu, d.poder_a, d.criado_em, d.resolvido_em, d.desafiante = auth.uid()
  from public.desafios d where auth.uid() is not null and (d.desafiante = auth.uid() or d.alvo = auth.uid()) and d.criado_em > now() - interval '3 days'
  order by d.id desc limit 30;
$$;
revoke all on function public.meus_desafios() from public;
grant execute on function public.meus_desafios() to authenticated;
