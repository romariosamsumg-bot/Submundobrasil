"""Corta uma grade de figuras (quadros com borda escura) em arquivos art/<prefixo>-<id>.webp.
Uso: python3 tools/cortar-grade.py <imagem> <colunas> <linhas> <prefixo> <id1,id2,...>
As bordas são achadas sozinhas: linhas finas e escuras que atravessam a imagem. Quadros a mais são ignorados."""
import sys, os
from PIL import Image
import numpy as np

def bordas(escuro, eixo):
    perfil = escuro.mean(axis=eixo); grupos = []
    for i in np.where(perfil > 0.6)[0]:
        if grupos and i - grupos[-1][-1] <= 3: grupos[-1].append(i)
        else: grupos.append([i])
    return [(g[0], g[-1]) for g in grupos if g[-1] - g[0] <= 14]

def faixas(fundo, eixo, n):
    """Plano B: as faixas lisas da cor do fundo entre os quadros. Devolve os n trechos de conteúdo."""
    perfil = fundo.mean(axis=eixo); conteudo = perfil <= 0.5; trechos = []; ini = None
    for i, c in enumerate(conteudo):
        if c and ini is None: ini = i
        if not c and ini is not None: trechos.append((ini, i - 1)); ini = None
    if ini is not None: trechos.append((ini, len(conteudo) - 1))
    trechos = sorted(trechos, key=lambda t: t[1] - t[0], reverse=True)[:n]  # descarta riscos finos
    return sorted(trechos)

def cortar(caminho, cols, rows):
    im = Image.open(caminho).convert('RGB'); a = np.asarray(im).astype(int); escuro = a.sum(axis=2) < 90
    xs, ys = bordas(escuro, 0), bordas(escuro, 1)
    if len(xs) == 2 * cols and len(ys) == 2 * rows:
        return [im.crop((xs[2 * c][1] + 6, ys[2 * r][1] + 6, xs[2 * c + 1][0] - 6, ys[2 * r + 1][0] - 6)) for r in range(rows) for c in range(cols)]
    cor = np.median(np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)]), axis=0)
    fundo = np.abs(a - cor).sum(axis=2) < 45
    cx, cy = faixas(fundo, 0, cols), faixas(fundo, 1, rows)
    if len(cx) != cols or len(cy) != rows: sys.exit(f'Não achei a grade: {len(cx)} colunas e {len(cy)} linhas.')
    m = 10  # pula a moldura escura de cada quadro
    return [im.crop((cx[c][0] + m, cy[r][0] + m, cx[c][1] - m, cy[r][1] - m)) for r in range(rows) for c in range(cols)]

if __name__ == '__main__':
    caminho, cols, rows, prefixo, ids = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
    os.makedirs('art', exist_ok=True)
    for nome, q in zip(ids, cortar(caminho, cols, rows)):
        w, h = q.size; s = min(w, h)
        q = q.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((192, 192), Image.LANCZOS)
        destino = f'art/{prefixo}-{nome}.webp'; q.save(destino, 'WEBP', quality=80, method=6)
        print(destino, os.path.getsize(destino) // 1024, 'KB')
