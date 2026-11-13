// Servidor do jogo (Supabase Edge Function). As regras rodam aqui, não no aparelho:
// o jogador manda a ação, o servidor aplica com o mesmo motor do jogo e grava o resultado.
import './engine.js';
import { aplicar } from './logica.js';
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
const SB = (globalThis as any).SB;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const quem = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await quem.auth.getUser();
    if (!user) return json(401, { erro: 'Entre na sua conta.' });
    const pedido = await req.json().catch(() => null);
    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data: linha } = await db.from('saves').select('estado').eq('jogador', user.id).maybeSingle();
    const saida = aplicar(SB, linha ? linha.estado : null, pedido, Date.now());
    if (saida.novo) {
      const { error } = await db.from('jogadores').upsert({ id: user.id, codinome: saida.novo.codinome, cidade: saida.novo.cidade }, { onConflict: 'id' });
      if (error) return json(409, { erro: error.code === '23505' ? 'Esse codinome já está em uso. Escolha outro.' : 'Não foi possível criar o personagem.' });
    }
    if (saida.salvar) {
      const e = saida.salvar;
      const { error } = await db.from('saves').upsert({ jogador: user.id, estado: e, temporada: e.season, dia: e.day, mes: e.clock ? e.clock.month : null, respeito: e.respect, patrimonio: SB.patrimony(e), atualizado_em: new Date().toISOString() }, { onConflict: 'jogador' });
      if (error) return json(500, { erro: 'Não foi possível salvar no servidor.' });
    }
    return json(saida.status, saida.corpo);
  } catch (_e) {
    return json(500, { erro: 'Erro no servidor do jogo.' });
  }
});
