-- Submundo Brasil online, fase 1: jogadores, saves e ranking de respeito.
-- O jogador só LÊ as próprias linhas; quem escreve é o servidor do jogo (função "jogar", com a chave de serviço).
create table if not exists public.jogadores (
  id uuid primary key references auth.users (id) on delete cascade,
  codinome text not null unique check (char_length(codinome) between 2 and 22),
  cidade text not null,
  criado_em timestamptz not null default now()
);
create table if not exists public.saves (
  jogador uuid primary key references public.jogadores (id) on delete cascade,
  estado jsonb not null,
  temporada int not null default 1,
  dia int not null default 1,
  respeito int not null default 0,
  patrimonio bigint not null default 0,
  atualizado_em timestamptz not null default now()
);
create index if not exists saves_respeito on public.saves (respeito desc);
alter table public.jogadores enable row level security;
alter table public.saves enable row level security;
drop policy if exists "jogador le o proprio cadastro" on public.jogadores;
create policy "jogador le o proprio cadastro" on public.jogadores for select using (auth.uid() = id);
drop policy if exists "jogador le o proprio save" on public.saves;
create policy "jogador le o proprio save" on public.saves for select using (auth.uid() = jogador);
-- Ranking público: só codinome, cidade, respeito e dia (nada de e-mail ou save).
create or replace function public.ranking(limite int default 50)
returns table (posicao bigint, codinome text, cidade text, respeito int, dia int)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.respeito desc, s.atualizado_em asc), j.codinome, j.cidade, s.respeito, s.dia
  from public.saves s join public.jogadores j on j.id = s.jogador
  order by s.respeito desc, s.atualizado_em asc
  limit least(greatest(coalesce(limite, 50), 1), 100);
$$;
revoke all on function public.ranking(int) from public;
grant execute on function public.ranking(int) to anon, authenticated;
