export const jogo = {
    jogador: { dinheiro: 2500, cidadeAtual: '', cidadeBase: '', inventario: {}, lucroTotal: 0, capacidadeMax: 50 },
    cidades: {}, rotas: [],
    materiais: ['Mantimentos', 'Madeira', 'Sal', 'Peles', 'Ferro', 'Tabaco', 'Prata', 'Ouro'],
    rotaGPS: null, rotaNegocio: null, busy: false, cacheDist: null, cacheProx: null,
    terrainCache: null,
    tempo: { mes: 0, ano: 1899 } 
};

export const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const $ = id => document.getElementById(id);
export const formatMoney = v => `$${v.toFixed(0)}`; 
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const mostraStatus = txt => { 
    const s=$('status'); s.innerText=txt; s.classList.add('show'); 
};
export const escondeStatus = () => $('status').classList.remove('show');

export const getPesoAtual = () => {
    return Object.values(jogo.jogador.inventario).reduce((a, b) => a + b, 0);
};

export function atualizaDisplayData(){
    $('dateDisplay').innerText = `${nomesMeses[jogo.tempo.mes]}, ${jogo.tempo.ano}`;
    $('CustoAtual').innerText = `${400 + (jogo.tempo.ano-1898)*100}`;
    const mes = jogo.tempo.mes;
    if(mes > 2 && mes < 9) { $('dateDisplay').style.color = '#f4e4bc'; } 
    else { $('dateDisplay').style.color = '#e0e0e0'; }
}