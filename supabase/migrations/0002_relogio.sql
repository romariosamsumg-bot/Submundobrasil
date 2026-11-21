-- Fase 1b: o ranking conta só o mês corrente (horário de Brasília). Quem não entrou neste mês não aparece.
alter table public.saves add column if not exists mes text;
create index if not exists saves_mes_respeito on public.saves (mes, respeito desc);
create or replace function public.ranking(limite int default 50)
returns table (posicao bigint, codinome text, cidade text, respeito int, dia int)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.respeito desc, s.atualizado_em asc), j.codinome, j.cidade, s.respeito, s.dia
  from public.saves s join public.jogadores j on j.id = s.jogador
  where s.mes = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')
  order by s.respeito desc, s.atualizado_em asc
  limit least(greatest(coalesce(limite, 50), 1), 100);
$$;
