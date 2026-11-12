# Ícone do dinmeta Gestor; bxb.ico é o nome técnico mantido pela compilação existente.
# Executar com Python e Pillow: python gestor/gerar-icone.py
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

PASTA = Path(__file__).parent
RAIZ = ET.parse(PASTA / 'dinmeta-simbolo.svg').getroot()

def contornos(d):
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)', d)
    contornos, pontos = [], []
    i, comando = 0, None
    atual = inicio = (0, 0)
    while i < len(tokens):
        if tokens[i].isalpha():
            comando, i = tokens[i], i + 1
        if comando == 'Z':
            pontos.append(inicio)
            contornos.append(pontos)
            pontos, atual = [], inicio
            continue
        numero = {'M': 2, 'L': 2, 'V': 1, 'H': 1, 'C': 6, 'Q': 4}[comando]
        v = list(map(float, tokens[i:i + numero]))
        i += numero
        x, y = atual
        if comando in ('M', 'L'):
            atual = tuple(v)
            if comando == 'M':
                if pontos:
                    contornos.append(pontos)
                pontos, inicio = [], atual
                comando = 'L'
            pontos.append(atual)
        elif comando in ('V', 'H'):
            atual = (x, v[0]) if comando == 'V' else (v[0], y)
            pontos.append(atual)
        else:
            for passo in range(1, 65):
                t, u = passo / 64, 1 - passo / 64
                if comando == 'C':
                    pontos.append((u**3*x + 3*u*u*t*v[0] + 3*u*t*t*v[2] + t**3*v[4], u**3*y + 3*u*u*t*v[1] + 3*u*t*t*v[3] + t**3*v[5]))
                else:
                    pontos.append((u*u*x + 2*u*t*v[0] + t*t*v[2], u*u*y + 2*u*t*v[1] + t*t*v[3]))
            atual = tuple(v[-2:])
    if pontos:
        contornos.append(pontos)
    return contornos

CAMINHOS = [(p.get('fill'), contornos(p.get('d'))) for p in RAIZ.findall('{http://www.w3.org/2000/svg}path')]

def renderizar(tamanho, tinta):
    fator = 8
    lado = tamanho * fator
    escala = lado / 224
    margem_y = (lado - 180*escala) / 2
    imagem = Image.new('RGBA', (lado, lado))
    for cor, formas in CAMINHOS:
        mascara = Image.new('L', imagem.size)
        desenho = ImageDraw.Draw(mascara)
        for j, forma in enumerate(formas):
            desenho.polygon([(x*escala, y*escala+margem_y) for x, y in forma], fill=255 if j == 0 else 0)
        imagem.paste(tinta if cor == 'currentColor' else cor, (0, 0, lado, lado), mascara)
    return imagem.resize((tamanho, tamanho), Image.Resampling.LANCZOS)

if __name__ == '__main__':
    simbolo = renderizar(256, '#e9edf5')
    icone = Image.new('RGBA', (256, 256))
    ImageDraw.Draw(icone).rounded_rectangle((0, 0, 255, 255), radius=48, fill='#11151d')
    icone.alpha_composite(simbolo)
    icone.save(PASTA / 'bxb.ico', format='ICO', bitmap_format='bmp', sizes=[(n, n) for n in (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)])
    print('Ícone dinmeta gerado em bxb.ico (16 a 256 px).')
