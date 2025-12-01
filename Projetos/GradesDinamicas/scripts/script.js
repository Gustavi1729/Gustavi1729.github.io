
const container = document.getElementById('containerGRID');
const containersidebar = document.getElementById('containerSIDE');
var listaDisc = [];
var dicionarioEletivas = {}
var dicionario = {};

var horasObrigatoriasContabilizadas = 0;
var horasEletivasContabilizadas = 0;

var numeroDeObrigatorias = 0;
var numeroDeHorasObrigatorias = 0;
var numeroDeHorasEletivas = 0;
var codCurso;

async function carregaJSONS(codCurso)
{
    // Carrega dois jsons: Um com todas as informações das disciplinas e um com as horas necessárias de eletiva no curso
    try {
         const response = await fetch(`jsons/${codCurso}.json` );
        if (!response.ok) 
            throw new Error('Não foi possível acessar json');

        const response2 = await fetch(`jsons/horasEletivas.json` );
        if (!response2.ok) 
            throw new Error('Não foi possível acessar json');
        
        
        listaDisc = await response.json();
        dicionarioEletivas = await response2.json();

        numeroDeHorasEletivas = dicionarioEletivas[codCurso]

    }
    catch (error) {
        console.error('Erro ao carregar json:', error);
    }

}

async function carregaGrade(){

        //Carrega a grade do curso selecionado
        salvaEstado();
        codCurso = document.getElementById('selCurso').value;
        await carregaJSONS(codCurso)
        

        // Inicialização/Resetar valores
        horasObrigatoriasContabilizadas = 0;
        numeroDeObrigatorias = 0;
        horasEletivasContabilizadas = 0;
        numeroDeHorasObrigatorias = 0;
        
        container.innerHTML = '';
        containersidebar.innerHTML = ''
       

        //Calcula quantas linhas e colunas vai ter na tabela baseado na quantidade de periodos e o periodo que tem a maior quantidade de disciplinas
        let cont = 0
        while (listaDisc[cont].periodo > 0){
            qntPeriodos = listaDisc[cont].periodo
            cont++
        }
        linhas = calculaLinhas(qntPeriodos)


        container.style.gridTemplateColumns = `repeat(${qntPeriodos},1fr)`;
        container.style.gridTemplateRows = `repeat(${linhas + 1},1fr)`;

       


        geraTabela(qntPeriodos);
        atualizaTabela()
        recuperaEstado()
        
}

function geraTabela(qntPeriodos)
{
    // Cria 
     for (let i=0; i < qntPeriodos; i++)
        {

            const header = document.createElement('div');
            header.className = 'headerPeriodo'
            header.textContent = `${i+1}º periodo`
            header.style.gridColumn = i+1
            container.appendChild(header)
        }

     for (let i =0; i < listaDisc.length; i++)
        {
            //console.log('Loaded data:', listaDisc[i]);

            dicionario[listaDisc[i].codigo] = i;
            const square = document.createElement('div');

            square.className = 'square';
            square.id = listaDisc[i].codigo;
            square.textContent = `${listaDisc[i].codigo} - ${listaDisc[i].nome}`;
            square.addEventListener('click', flip );


        
            const squareInfo = document.createElement('div');
            squareInfo.textContent = `${listaDisc[i].cargaHSemestral + listaDisc[i].cargaHExtensionista} Horas`;
            squareInfo.className = 'squareInfo'
            square.appendChild(squareInfo)

        

            if (listaDisc[i].obg == "1"){
                square.style.gridColumn = (listaDisc[i].periodo).toString()
                container.appendChild(square);
                numeroDeObrigatorias++;
                numeroDeHorasObrigatorias += (listaDisc[i].cargaHSemestral + listaDisc[i].cargaHExtensionista)
            }
            else
            {
                containersidebar.appendChild(square)
            }

        }

}

function flip()
{
    this.classList.toggle('feito');
    disc = listaDisc[dicionario[this.id]]
    disc.feito ^= 1

    var horasAdicionadas = (disc.feito*2 - 1)*(disc.cargaHSemestral + disc.cargaHExtensionista);

    if (disc.obg == 0) 
        horasEletivasContabilizadas += horasAdicionadas;
    else
        horasObrigatoriasContabilizadas += horasAdicionadas;


    //document.getElementById('ContaHoras').textContent = `Total de horas: ${horasObrigatoriasContabilizadas + horasEletivasContabilizadas}`; 
    atualizaTabela() 

}

function atualizaTabela()
{
    progressCountObg = 0
    progressCountEle = 0
    for (let i = 0; i < listaDisc.length; i++) 
    {
        if (listaDisc[i].feito != 1) {
            const elemento = document.getElementById(listaDisc[i].codigo);
            verificaPreReq(listaDisc[i]) ? elemento.classList.add('possivel') : elemento.classList.remove('possivel');
        }
        else listaDisc[i].obg == 1 ? progressCountObg++ : progressCountEle++

    }
    progressCountTot = progressCountObg + progressCountEle
    horasTotaisContabilizadas = horasObrigatoriasContabilizadas + Math.min(horasEletivasContabilizadas, numeroDeHorasEletivas)
    numeroDeHorasTotais = numeroDeHorasEletivas + numeroDeHorasObrigatorias
    horasEletivasContabilizadasClip = Math.min(horasEletivasContabilizadas, numeroDeHorasEletivas)


    document.getElementById('barraProgressoObg').value = progressCountObg/numeroDeObrigatorias*100;
    document.getElementById('textoProgressoObgPorc').textContent = `${(progressCountObg/numeroDeObrigatorias*100).toFixed(1)}%`;
    document.getElementById('textoProgressoObgAbs').textContent = `${progressCountObg}/${numeroDeObrigatorias} Disciplinas`;

    document.getElementById('barraProgressoEle').value = horasEletivasContabilizadas/numeroDeHorasEletivas*100;
    document.getElementById('textoProgressoElePorc').textContent = `${(horasEletivasContabilizadasClip/numeroDeHorasEletivas*100).toFixed(1)}%`;
    document.getElementById('textoProgressoEleAbs').textContent = `${horasEletivasContabilizadasClip}/${numeroDeHorasEletivas} Horas`;

    document.getElementById('barraProgressoTot').value = (horasTotaisContabilizadas)/(numeroDeHorasTotais)*100;
    document.getElementById('textoProgressoPorc').textContent = `${((horasTotaisContabilizadas)/(numeroDeHorasTotais)*100).toFixed(1)}%`;
    document.getElementById('textoProgressoAbs').textContent = `${horasTotaisContabilizadas}/${numeroDeHorasTotais} Horas`;

}
function verificaPreReq(disciplina)

{
     if (disciplina.prerequisitoH != null & ((horasObrigatoriasContabilizadas + horasEletivasContabilizadas) < disciplina.prerequisitoH)) return 0;
     if (disciplina.prerequisitoD.length == 0) return 1;
    
     for (var prereq of disciplina.prerequisitoD)
        if (listaDisc[dicionario[prereq]].feito != 1) return 0;

     return 1;
}

function calculaLinhas(qntPeriodos)
{
    var linhas = Array(qntPeriodos).fill(0);
    
    for (var disciplina of listaDisc)
    {
        linhas[disciplina.periodo -1]++;
    }
    return  Math.max.apply(null, linhas);
} 

function filtraEletivas()
{
    stringPesquisa = document.getElementById('courseSearch').value.toUpperCase()
    stringFiltrada = (stringPesquisa.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    console.log(stringFiltrada)


    for (const child of containersidebar.children){
        if (!child.textContent.includes(stringFiltrada))
            child.classList.add('hidden')
        else
            child.classList.remove('hidden')
        }


    // containersidebar.innerHTML = ''

     /*
    for (let i =0; i < listaDisc.length; i++)
        {
            //console.log('Loaded data:', listaDisc[i]);
            if (listaDisc[i].obg == "0" & `${listaDisc[i].codigo} - ${listaDisc[i].nome}`.includes(stringFiltrada))
            {
                const square = document.createElement('div');

                square.className = 'square';
                square.id = listaDisc[i].codigo;
                square.textContent = `${listaDisc[i].codigo} - ${listaDisc[i].nome}`;
                square.addEventListener('click', flip );


                const squareInfo = document.createElement('div');
                squareInfo.textContent = `${listaDisc[i].cargaHSemestral + listaDisc[i].cargaHExtensionista} Horas`;
                squareInfo.className = 'squareInfo'
                square.appendChild(squareInfo)

        
            

                console.log("ok!")
                containersidebar.appendChild(square);
            }

    }
            */



}

function salvaEstado()
{
    
    vetor = []

    for (disc of listaDisc)
        vetor.push(disc.feito)

    document.cookie = `${codCurso}=${vetor}; max-age=3600; path=/`;


}

function limpaGrade()
{
    if (listaDisc.length == 0)
        return;

    for (var i =0;i < listaDisc.length;i++)
        if (listaDisc[i].feito == 1)
            flip.call(document.getElementById(listaDisc[i].codigo))

}

function recuperaEstado()
{

    cookieVector = document.cookie.split(';')
    
    for (cookieSeparado of cookieVector)
    {
        //console.log(codCurso,cookieSeparado.match(/[A-Za-z]+/)[0])
        if (cookieSeparado.match(/[A-Za-z]+/)[0] == codCurso)
        {

            vetorFeito = (cookieSeparado.match(/(\d,)+\d/)[0].split(','))
            for (var i = 0;i < vetorFeito.length; i++)
            {
                if (vetorFeito[i] == 1)
                    flip.call(document.getElementById(listaDisc[i].codigo))
            }
        }
    }

    

}


window.addEventListener('beforeunload',salvaEstado);

Object.entries(dicCods).forEach(([nome, codCurso]) => {
    const option = document.createElement('option');
    option.value = codCurso;
    option.textContent = nome;
    document.getElementById('selCurso').appendChild(option);
});

const toggleBtn = document.getElementById('toggleBtn');
const toggleBtnSide = document.getElementById('toggleBtnSide');
const sidebar = document.getElementById('sidebar');

toggleBtn.addEventListener('click', function() {
sidebar.classList.toggle('open');
toggleBtn.textContent = sidebar.classList.contains('open') ? '✕ Fechar' : '☰ Menu Eletivas';
toggleBtnSide.classList.toggle('hidden');
});

toggleBtnSide.addEventListener('click', function() {
sidebar.classList.toggle('open');
toggleBtn.textContent = sidebar.classList.contains('open') ? '✕ Fechar' : '☰ Menu Eletivas';
toggleBtnSide.classList.toggle('hidden');
});

barraDePesquisa = document.getElementById('courseSearch')
barraDePesquisa.addEventListener('keydown', function(event)
{
if (event.key == 'Enter')
    filtraEletivas()

})