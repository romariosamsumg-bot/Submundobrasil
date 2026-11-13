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

def cortar(caminho, cols, rows):
    im = Image.open(caminho).convert('RGB'); escuro = np.asarray(im).astype(int).sum(axis=2) < 90
    xs, ys = bordas(escuro, 0), bordas(escuro, 1)
    if len(xs) != 2 * cols or len(ys) != 2 * rows: sys.exit(f'Bordas não batem: {len(xs) // 2} colunas e {len(ys) // 2} linhas encontradas.')
    return [im.crop((xs[2 * c][1] + 6, ys[2 * r][1] + 6, xs[2 * c + 1][0] - 6, ys[2 * r + 1][0] - 6)) for r in range(rows) for c in range(cols)]

if __name__ == '__main__':
    caminho, cols, rows, prefixo, ids = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
    os.makedirs('art', exist_ok=True)
    for nome, q in zip(ids, cortar(caminho, cols, rows)):
        w, h = q.size; s = min(w, h)
        q = q.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((192, 192), Image.LANCZOS)
        destino = f'art/{prefixo}-{nome}.webp'; q.save(destino, 'WEBP', quality=80, method=6)
        print(destino, os.path.getsize(destino) // 1024, 'KB')
