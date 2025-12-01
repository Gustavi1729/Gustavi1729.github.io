import pdfplumber
import pandas as pd
import re
import json
import urllib.request
import requests

from bs4 import BeautifulSoup
from unidecode import unidecode
from constantes import *


class Disciplina:
    def __init__(self, codigo, nome, prerequisitoH,prerequisitoD, cargaHSemestral,cargaHExtensionista, cargaHA, teoricas, praticas, obg, periodo = 0):
        self.codigo = codigo
        self.nome = nome
        self.prerequisitoH = prerequisitoH
        self.prerequisitoD = prerequisitoD
        self.cargaHSemestral = cargaHSemestral
        self.cargaHExtensionista = cargaHExtensionista
        self.cargaHA = cargaHA
        self.teoricas = teoricas
        self.praticas = praticas
        self.periodo = periodo
        self.feito = 0
        self.obg = obg



# Alguns pre Requisitos estão dispersos em multiplas linhas. Essa função coloca todos em uma linha   
def juntaPreReq(df):
    mask = (df.iloc[:, 0].isna()) | (df.iloc[:, 0].astype(str).str.strip() == '')

    for col in df.columns:
        df[col] = df[col].astype(str)
        df.loc[mask, col] = df[col].shift(1)[mask] + ' ' + df[col][mask]
    
    return df[~mask].reset_index(drop=True)

#Faz a leitura do pdf e recupera os dados
def trataPdf(arquivo):

    #Extrai todas as tabelas
    with pdfplumber.open(arquivo) as pdf:
        tabs = []
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                tabs.append(table)

    tabsObrigatorias = []
    tabsEletivas = []
    #Separa as tabelas e remove o header
    for tab in tabs:
        if (tab[0][1] == 'DISCIPLINAS OBRIGATÓRIAS'):
            tabdf = juntaPreReq(pd.DataFrame(tab)).iloc[1:]
            tabsObrigatorias.append(tabdf)

        if (tab[0][1] == 'DISCIPLINAS ELETIVAS'):
            tabdf = juntaPreReq(pd.DataFrame(tab)).iloc[1:]
            tabsEletivas.append(tabdf)
    #Extrair a quantidade de horas de eletivas necessárias do curso
    if 'Componentes Curriculares' in tabs[-1][0][0]:
        horasEletiva = (int(tabs[-1][1][2].split('\n')[1]))
    

    #Classifica e combina as tabelas
    dfObg = pd.concat(tabsObrigatorias, ignore_index=True)
    dfEle = pd.concat(tabsEletivas, ignore_index=True)

    dfObg['Obrigatoria'] = 1
    dfEle['Obrigatoria'] = 0

    df = pd.concat([dfObg,dfEle], ignore_index=True)

    return df, horasEletiva

#Faz um json com as informações do curso a partir do dataframe feito por trataPDF
def geraJSON(df, codCurso):
    vetorgrade = []
    #Cada linha é uma disciplina, os dados da disciplinas são extraídos, colocados em um objeto e então num vetor
    for row in df.iterrows():

        codigo = row[1][0]
        if (re.search(padraoDISC, codigo) ): #Em algumas grades têm linhas sem código separando as obrigatórias em categorias

            
            nome = row[1][1].replace('\n',' ')
            prereqH = (re.search(padraohoras, row[1][2]))
            if (prereqH != None):
                prereqH = int(prereqH.group(1))
            prereqD = (list(re.findall(padraoDISC, row[1][2])))
            carga = row[1][3].split('/')
            cargaHS, cargaHE = int(carga[0]), int(carga[1])
            cargaHA = int(row[1][4])
            teoricas, praticas = int(row[1][5]), int(row[1][6])
            if (row[1][7]):
                periodo = int(row[1][7])
            else:
                periodo = 0
            
            obg = int(row[1]['Obrigatoria'])
            

            vetorgrade.append(Disciplina(codigo, nome, prereqH, prereqD, cargaHS, cargaHE, cargaHA, teoricas, praticas,obg, periodo))



    #Transforma o vetor de disciplinas em um json
    dados_json = [disciplina.__dict__ for disciplina in vetorgrade]
    with open(f'jsons/{codCurso}.json', 'w', encoding='utf-8') as f:
        json.dump(dados_json, f, indent=4, ensure_ascii=False)
    print(f'Json {codCurso}.json gerado com sucesso\n\n')

#Faz o download da grade
def downloadGrade(url, save_path):
    try:
        urllib.request.urlretrieve(url, save_path)
        print(f"PDF salvo em {save_path}")
    except Exception as e:
        print(f"Erro baixando pdf PDF: {e}")

# A partir do url do curso, faz o scraping da página pra pegar o link da Grade
def recuperaLinkGrade(url):
    try:

        #Extrai a página e faz um parse
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Encontra as duas divs com links de grades. field-item even sempre vai ser a segunda ocorrencia e field-item odd a segunda. Mas field-item odd nem sempre tem porque ela é usada unicamente para licenciatura
        divs = soup.find_all('div', class_='field-item even')
        target_div = divs[1]

        divs2 = soup.find_all('div', class_='field-item odd')
        target_div2 = divs2[0] if divs2 else None
        
        #Pega o link a partir das divs
        linksPdfs = [extraiDiv(target_div), extraiDiv(target_div2)]

        return linksPdfs
        
        
        


    except requests.exceptions.RequestException as e:
        return f"Erro no scraping: {e}"

#Extrai informações da div da grade
def extraiDiv(div):
    return div.find('a').get('href') if div and div.find('a') else None

# Trata o nome do curso a partir da lista de constantes e converte em um URL para scraping
def curso_para_URL(curso):
    curso = curso.lower()
    curso = curso.replace('(','').replace(')','')
    curso = curso.replace(' ', '-')
    curso = unidecode(curso)
    return 'https://seja.ufop.br/cursos/' + curso 


# Dado o link de uma grade, processa as informações importantes e escreve os jsons
def processaLink(link, dicCod_Nome, dicCurso_Horas, curso, nGenerico, complemento=''):
    if not link:
        return

    #Recuperamos o código do curso a partir do link obtido        
    resultado = re.search(padraocodCurso, link)
    if (resultado):
        codCurso = (resultado.group(1))
    else:
        print(f'{link} Fora do padrão')
        codCurso =  f'CodigoGen{nGenerico}'
        nGenerico = nGenerico + 1
    #Seria muito mais fácil obter as grades se tivesse uma lista dos códigos dos cursos para começo de conversa, mas como não consegui achar, fiz o scraping, vamos ao menos usar para separar os arquivos
    #Garanto que foi mais rápido implementar a automatização do que ir em cada página separadamente e procurar os códigos no html

    arq = f'pdfs/{codCurso}.pdf'
    #Baixa a grade, faz o tratamento, cria o json, e adiciona uma entrada ao dicionario curso -> codigo e curso -> eletivas para lookup mais tarde
    try:
        downloadGrade(link, arq)
        tabela, horasEletivas = trataPdf(arq)
        geraJSON(tabela, codCurso)
        dicCod_Nome[f'{curso}{complemento}'] = codCurso


        dicCurso_Horas[codCurso] = horasEletivas
    except Exception as e:
        print(f'O curso de {curso}{complemento} não possui um link fácil de scraping :(. Erro: {e}')  

# Processa as informações de cada curso na lista de cursos e cria dicionarios
def extraiCursos():

    nGenerico = 0
    dicCod_Nome = {}
    dicCurso_Horas = {}

    for curso in Cursos:
        print(curso)

        #Pega o link da grade a partir do nome do curso na tabela em constantes.py
        linkcurso = (curso_para_URL(curso))
        links = recuperaLinkGrade(linkcurso)
        print(links)

        #Se temos uma licenciatura, ao gravar o nome do curso no dicionário, devemos identificar se o curso é bacharel ou licenciatura. Caso contrário, não precisa
        LicenciaturaFlag = (links[0] and links[1])

        if LicenciaturaFlag:
            processaLink(links[0], dicCod_Nome, dicCurso_Horas,curso, nGenerico,' (Bacharelado)')
            processaLink(links[1], dicCod_Nome, dicCurso_Horas,curso, nGenerico,' (Licenciatura)')
        else:
            processaLink(links[0], dicCod_Nome, dicCurso_Horas,curso, nGenerico)



            
    # Cria os dicionários
    with open('dicionario.js', 'w', encoding='utf-8') as f:
        f.write(f"const dicCods = {json.dumps(dicCod_Nome, indent=2, ensure_ascii=False)};")
    with open(f'jsons/horasEletivas.json', 'w', encoding='utf-8') as f:
        json.dump(dicCurso_Horas, f, indent=4, ensure_ascii=False)


extraiCursos()

