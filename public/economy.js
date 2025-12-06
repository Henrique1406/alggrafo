import { jogo, $, mostraStatus, atualizaDisplayData, getPesoAtual, formatMoney } from './utils.js';
import { preRenderTerrain } from './map.js';

export function flutuarEconomia(){
    const nomes = Object.keys(jogo.cidades);
    nomes.forEach(cidade => {
        jogo.materiais.forEach(mat => {
            const item = jogo.cidades[cidade].mercado[mat];
            const variacao = (Math.random() * 0.16) - 0.08; 
            let novoPreco = Math.floor(item.preco * (1 + variacao));
            const min = Math.floor(item.basePrice * 0.65); const max = Math.floor(item.basePrice * 1.35);
            if(novoPreco < min) novoPreco = min; if(novoPreco > max) novoPreco = max;
            let diff = item.baseStock - item.estoque; let recuperacao = Math.ceil(diff * 0.1); 
            let novoEstoque = item.estoque + recuperacao; novoEstoque += Math.floor(Math.random()*5) - 2;
            if(novoEstoque < 0) novoEstoque = 0;
            item.preco = novoPreco; item.estoque = novoEstoque;
        });
    });
    if(!jogo.busy) mostraStatus("Novo Mês: Preços Atualizados!");
}

export function virarMes() {
    jogo.tempo.mes++;
    if(jogo.tempo.mes > 11){ jogo.tempo.mes = 0; jogo.tempo.ano++; }
    flutuarEconomia();
    const cvs = $('mapCanvas');
    preRenderTerrain(cvs.width, cvs.height);
    atualizaDisplayData();
}

// Lógica de Compra e Venda Manual (SÓ MEXE NO DINHEIRO AGORA)
export function transacaoManual(item, tipo) {
    const cidade = jogo.cidades[jogo.jogador.cidadeAtual];
    const dadosMercado = cidade.mercado[item];
    
    if (tipo === 'compra') {
        if (dadosMercado.estoque <= 0) return alert("Sem estoque na cidade!");
        if (jogo.jogador.dinheiro < dadosMercado.preco) return alert("Dinheiro insuficiente!");
        if (getPesoAtual() >= jogo.jogador.capacidadeMax) return alert("Mochila cheia!");

        // Executa Compra (Apenas reduz dinheiro e estoque)
        jogo.jogador.dinheiro -= dadosMercado.preco;
        dadosMercado.estoque--;
        jogo.jogador.inventario[item] = (jogo.jogador.inventario[item] || 0) + 1;
    
    } else if (tipo === 'venda') {
        const qtdInv = jogo.jogador.inventario[item] || 0;
        if (qtdInv <= 0) return alert("Você não tem este item!");

        // Executa Venda (Apenas aumenta dinheiro e estoque)
        jogo.jogador.dinheiro += dadosMercado.preco;
        dadosMercado.estoque++;
        jogo.jogador.inventario[item]--;
    }
}

export function upgradeMochila() {
    const CUSTO = Math.pow(2,(jogo.jogador.capacidadeMax/25 - 1))*500;
    const AUMENTO = 25;
    
    if (jogo.jogador.dinheiro < CUSTO) {
        alert(`Você precisa de ${formatMoney(CUSTO)} para melhorar a mochila.`);
        return false;
    }
    
    jogo.jogador.dinheiro -= CUSTO;
    jogo.jogador.capacidadeMax += AUMENTO;
    mostraStatus(`Mochila melhorada! Agora cabe ${jogo.jogador.capacidadeMax} itens.`);
    return true;
}

export function abrirPanorama(){
    const modal = $('modalPanorama'); const container = $('tabelaPanoramaContainer'); const analiseDiv = $('analiseRapidaContent');
    const cidades = Object.keys(jogo.cidades).sort(); const materiais = jogo.materiais;
    let html = `<table class="pano-table"><thead><tr><th>Cidade</th>`;
    materiais.forEach(mat => { html += `<th colspan="2">${mat}</th>`; });
    html += `</tr><tr><th></th>`; materiais.forEach(m => html += `<th>$</th><th>#</th>`); html += `</tr></thead><tbody>`;
    const extremos = {}; 
    materiais.forEach(m => extremos[m] = { min: Infinity, minCity: '', max: -Infinity, maxCity: '' });
    cidades.forEach(cid => { materiais.forEach(mat => { const dados = jogo.cidades[cid].mercado[mat]; if(dados.estoque > 0 && dados.preco < extremos[mat].min){ extremos[mat].min = dados.preco; extremos[mat].minCity = cid; } if(dados.preco > extremos[mat].max){ extremos[mat].max = dados.preco; extremos[mat].maxCity = cid; } }); });
    cidades.forEach(cid => { const isCurrent = (cid === jogo.jogador.cidadeAtual); html += `<tr style="${isCurrent ? 'background:rgba(183, 28, 28, 0.1)' : ''}">`; html += `<td style="font-weight:bold;text-align:left; color:#3e2723">${isCurrent?'🤠':''} ${cid}</td>`; materiais.forEach(mat => { const dados = jogo.cidades[cid].mercado[mat]; let classeTd = ''; if(dados.estoque > 0 && dados.preco === extremos[mat].min) classeTd = 'bg-best-buy'; else if(dados.preco === extremos[mat].max) classeTd = 'bg-best-sell'; html += `<td class="${classeTd}">${dados.preco}</td>`; html += `<td class="${classeTd}" style="font-weight:normal; font-size:0.85em; color:#5d4037">${dados.estoque}</td>`; }); html += `</tr>`; });
    html += `</tbody></table>`; container.innerHTML = html;
    let analiseHtml = '';
    materiais.forEach(mat => { const ex = extremos[mat]; if(ex.min !== Infinity && ex.max !== -Infinity){ const lucroPorUnidade = ex.max - ex.min; const porcentagem = ((lucroPorUnidade / ex.min) * 100).toFixed(0); analiseHtml += `<div style="margin-bottom:6px; border-bottom:1px dotted #ccc; padding-bottom:2px;"> <strong>${mat}:</strong> <span class="tag-buy">Comprar em ${ex.minCity} (${ex.min})</span> → <span class="tag-sell">Vender em ${ex.maxCity} (${ex.max})</span> [Lucro: +${porcentagem}%] </div>`; } });
    analiseDiv.innerHTML = analiseHtml; modal.classList.add('open');
}

export function fecharPanorama(){ $('modalPanorama').classList.remove('open'); }