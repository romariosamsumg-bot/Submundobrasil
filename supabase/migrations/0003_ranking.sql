-- Fase 2: tela de Ranking. Ranking do mês com filtro por cidade, a sua posição (e quem está logo acima)
-- e a Galeria da fama (os 3 primeiros de cada mês que passou).
-- O jogador continua sem ler o save de ninguém: as funções devolvem só vulgo, cidade, respeito, classe,
-- retrato e quantos bairros comanda.

-- Respeito final de cada mês, gravado pelo servidor do jogo quando o save do jogador vira para o mês seguinte.
create table if not exists public.historico (
  jogador uuid not null references public.jogadores (id) on delete cascade,
  mes text not null,
  respeito int not null,
  codinome text not null,
  cidade text not null,
  classe text,
  avatar text,
  primary key (jogador, mes)
);
alter table public.historico enable row level security; -- sem política: só o servidor grava e lê direto

create or replace function public.ranking_mes(limite int default 50, cidade_f text default null)
returns table (posicao bigint, codinome text, cidade text, respeito int, classe text, avatar text, bairros int, eu boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.respeito desc, s.atualizado_em asc) as posicao, j.codinome, j.cidade, s.respeito,
    s.estado->>'career', s.estado->>'avatar',
    coalesce(jsonb_array_length(case when jsonb_typeof(s.estado->'turfOwned') = 'array' then s.estado->'turfOwned' end), 0),
    coalesce(s.jogador = auth.uid(), false)
  from public.saves s join public.jogadores j on j.id = s.jogador
  where s.mes = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') and (cidade_f is null or j.cidade = cidade_f)
  order by posicao
  limit least(greatest(coalesce(limite, 50), 1), 100);
$$;
revoke all on function public.ranking_mes(int, text) from public;
grant execute on function public.ranking_mes(int, text) to anon, authenticated;

create or replace function public.minha_posicao(cidade_f text default null)
returns table (posicao bigint, total bigint, respeito int, acima_codinome text, acima_respeito int)
language sql stable security definer set search_path = public as $$
  with r as (
    select s.jogador, j.codinome, s.respeito, row_number() over (order by s.respeito desc, s.atualizado_em asc) as pos
    from public.saves s join public.jogadores j on j.id = s.jogador
    where s.mes = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') and (cidade_f is null or j.cidade = cidade_f)
  ), eu as (select * from r where jogador = auth.uid())
  select eu.pos, (select count(*) from r), eu.respeito, a.codinome, a.respeito
  from eu left join r a on a.pos = eu.pos - 1;
$$;
revoke all on function public.minha_posicao(text) from public;
grant execute on function public.minha_posicao(text) to authenticated;

create or replace function public.galeria(meses int default 6)
returns table (mes text, posicao bigint, codinome text, cidade text, respeito int, classe text, avatar text)
language sql stable security definer set search_path = public as $$
  with atual as (select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') as m),
  cand as (
    select h.jogador, h.mes, h.respeito, h.codinome, h.cidade, h.classe, h.avatar from public.historico h
    union all
    -- quem não voltou depois que o mês acabou: o save ainda guarda o mês e o respeito final
    select s.jogador, s.mes, s.respeito, j.codinome, j.cidade, s.estado->>'career', s.estado->>'avatar'
    from public.saves s join public.jogadores j on j.id = s.jogador
    where s.mes is not null and not exists (select 1 from public.historico h2 where h2.jogador = s.jogador and h2.mes = s.mes)
  ),
  r as (
    select c.*, row_number() over (partition by c.mes order by c.respeito desc, c.codinome) as pos
    from cand c, atual where c.mes < atual.m
      and c.mes >= to_char((now() at time zone 'America/Sao_Paulo') - make_interval(months => least(greatest(coalesce(meses, 6), 1), 24)), 'YYYY-MM')
  )
  select r.mes, r.pos, r.codinome, r.cidade, r.respeito, r.classe, r.avatar from r where r.pos <= 3 order by r.mes desc, r.pos;
$$;
revoke all on function public.galeria(int) from public;
grant execute on function public.galeria(int) to anon, authenticated;
