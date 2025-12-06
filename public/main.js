import { jogo, $, formatMoney, sleep, mostraStatus, escondeStatus, atualizaDisplayData, getPesoAtual } from './utils.js';
import { floydWarshall, reconstruirCaminho, findBestRoute } from './algorithms.js';
import { preRenderTerrain, desenharMapa } from './map.js';
import { virarMes, abrirPanorama, fecharPanorama, transacaoManual, upgradeMochila } from './economy.js';
import { salvarNoBanco, carregarDoBanco } from './api.js';

function addRota(u, v, custo){ 
    if(!jogo.rotas.some(r => r.from === u && r.to === v)){ 
        jogo.rotas.push({ from: u, to: v, custo }); 
    } 
}

// --- FUNÇÃO DE UI (Com Tabela Interativa de Compra/Venda) ---
function atualizaUI(){
    // Stats do Jogador
    $('dinheiro').innerText = formatMoney(jogo.jogador.dinheiro); 
    $('localAtual').innerText = jogo.jogador.cidadeAtual; 
    $('baseJogador').innerText = jogo.jogador.cidadeBase; 
    $('lucroTotal').innerText = formatMoney(jogo.jogador.lucroTotal);
    $('Mochila').innerText = `${Math.pow(2,(jogo.jogador.capacidadeMax/25 - 1))*500}`;
    
    // Atualiza indicadores de Peso
    $('pesoAtual').innerText = getPesoAtual();
    $('pesoMax').innerText = jogo.jogador.capacidadeMax;
    
    // Constrói Tabela de Mercado
    const tbody = $('tbodyMercado'); 
    tbody.innerHTML = ''; 
    const m = jogo.cidades[jogo.jogador.cidadeAtual].mercado; 
    $('tituloMercado').innerText = jogo.jogador.cidadeAtual;
    
    Object.keys(m).forEach(mat => { 
        const dados = m[mat];
        const tr = document.createElement('tr');
        
        const tdNome = document.createElement('td'); tdNome.innerText = mat;
        const tdPreco = document.createElement('td'); tdPreco.innerText = `${formatMoney(dados.preco)}`;
        const tdEstoque = document.createElement('td'); tdEstoque.innerText = dados.estoque;

        // Coluna de Ações (+ / -)
        const tdAcoes = document.createElement('td');
        tdAcoes.style.display = 'flex';
        tdAcoes.style.gap = '5px';

        // Botão Comprar (+)
        const btnBuy = document.createElement('button');
        btnBuy.innerText = '+';
        btnBuy.className = 'btn'; 
        btnBuy.style.padding = '2px 6px';
        btnBuy.style.fontSize = '0.8rem';
        btnBuy.onclick = () => { 
            transacaoManual(mat, 'compra'); 
            atualizaUI(); // Atualiza a tela imediatamente
        };

        // Botão Vender (-)
        const btnSell = document.createElement('button');
        btnSell.innerText = '-';
        btnSell.className = 'btn';
        btnSell.style.padding = '2px 6px';
        btnSell.style.fontSize = '0.8rem';
        btnSell.onclick = () => { 
            transacaoManual(mat, 'venda'); 
            atualizaUI(); // Atualiza a tela imediatamente
        };

        tdAcoes.appendChild(btnBuy);
        tdAcoes.appendChild(btnSell);

        tr.appendChild(tdNome); tr.appendChild(tdPreco); tr.appendChild(tdEstoque); tr.appendChild(tdAcoes);
        tbody.appendChild(tr); 
    });
    
    // Atualiza Lista de Inventário
    const inv = jogo.jogador.inventario; 
    const items = Object.keys(inv).filter(k => inv[k]>0); 
    $('inventarioDiv').innerHTML = items.length ? items.map(k=>`${k}: ${inv[k]}`).join('<br>') : 'Vazio';
    
    // --- LÓGICA DO SELECT DE CIDADES ---
    const sel = $('selectDestino'); 
    const cidadesNomes = Object.keys(jogo.cidades).sort();
    
    // Se estiver vazio, popula a lista
    if(sel.options.length === 0 && cidadesNomes.length > 0){ 
        cidadesNomes.forEach(c => { 
            const op = document.createElement('option'); 
            op.value = c; op.text = c; 
            sel.appendChild(op); 
        }); 
    }
}

// --- FUNÇÃO GERAR MAPA (MAPEAMENTO RDR2) ---
function gerarMapa(){
    jogo.jogador.dinheiro = 2500; jogo.jogador.lucroTotal = 0; jogo.jogador.inventario = {};
    jogo.cidades = {}; jogo.rotas = []; jogo.rotaGPS = null; jogo.rotaNegocio = null;
    jogo.busy = false; jogo.cacheDist = null;
    jogo.tempo = { mes: 0, ano: 1899 }; 
    
    // Limpa o select para forçar recriação na atualizaUI
    $('selectDestino').innerHTML = '';

    atualizaDisplayData();

    const canvas = $('mapCanvas');
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
    const w = canvas.width; 
    const h = canvas.height;

    // --- COORDENADAS FIXAS (Baseadas na imagem do RDR2) ---
    const posicoesFixas = {
        'Colter':        { x: w * 0.52, y: h * 0.11 }, // Norte (Neve)
        'Valentine':     { x: w * 0.59, y: h * 0.38 }, // Centro
        'Emerald Ranch': { x: w * 0.76, y: h * 0.41 }, // Leste Centro
        'Annesburg':     { x: w * 0.86, y: h * 0.27 }, // Nordeste
        'Van Horn':      { x: w * 0.875, y: h * 0.395 }, // Leste
        
        'Strawberry':    { x: w * 0.47, y: h * 0.54 }, // Oeste
        'Blackwater':    { x: w * 0.54, y: h * 0.66 }, // Sul do lago
        'Rhodes':        { x: w * 0.72, y: h * 0.67 }, // Sudeste
        
        'Lagras':        { x: w * 0.81, y: h * 0.56 }, // Pantano
        'Saint Denis':   { x: w * 0.845, y: h * 0.65 }, // Extremo Sudeste
        'Armadillo':     { x: w * 0.35, y: h * 0.83 }, // Deserto
        'Tumbleweed':    { x: w * 0.195, y: h * 0.905 }  // Extremo Sudoeste
    };
    
    const nomes = Object.keys(posicoesFixas);

    // Criação das cidades
    nomes.forEach(nome => {
        const pos = posicoesFixas[nome];
        jogo.cidades[nome] = { x: pos.x, y: pos.y, mercado: {} };
        
        // Popula mercado com preços base
        jogo.materiais.forEach(mat => {
            let basePrice = 0; let baseStock = 0;
            switch(mat){
                case 'Mantimentos': basePrice = 12;  baseStock = 150; break;
                case 'Madeira':     basePrice = 25;  baseStock = 100; break;
                case 'Sal':         basePrice = 45;  baseStock = 80;  break;
                case 'Peles':       basePrice = 80;  baseStock = 60;  break;
                case 'Ferro':       basePrice = 120; baseStock = 40;  break;
                case 'Tabaco':      basePrice = 180; baseStock = 25;  break;
                case 'Prata':       basePrice = 260; baseStock = 15;  break;
                case 'Ouro':        basePrice = 400; baseStock = 8;   break;
            }
            const variacaoPreco = (Math.random() * 0.5) + 0.75; 
            const preco = Math.floor(basePrice * variacaoPreco);
            const variacaoEstoque = (Math.random() * 1.0) + 0.5;
            const estoque = Math.floor(baseStock * variacaoEstoque);
            jogo.cidades[nome].mercado[mat] = { preco, estoque, basePrice, baseStock };
        });
    });

    // --- CONEXÃO INTELIGENTE DE ROTAS ---
    // Conecta cada cidade às 3 mais próximas para formar um grafo bonito
    nomes.forEach(c1Nome => {
        const c1 = jogo.cidades[c1Nome];
        let distancias = nomes
            .filter(c2Nome => c2Nome !== c1Nome)
            .map(c2Nome => {
                const c2 = jogo.cidades[c2Nome];
                const distPix = Math.hypot(c1.x - c2.x, c1.y - c2.y);
                return { nome: c2Nome, dist: distPix };
            });
        
        // Ordena do mais perto para o mais longe
        distancias.sort((a, b) => a.dist - b.dist);
        
        // Conecta aos 3 vizinhos mais próximos (garante grafo conexo e limpo)
        const vizinhos = distancias.slice(0, 3);
        
        vizinhos.forEach(vizinho => {
            // Custo da viagem = Distância * Fator
            const custo = Math.max(10, Math.floor(vizinho.dist * 0.15));
            addRota(c1Nome, vizinho.nome, custo);
            addRota(vizinho.nome, c1Nome, custo);
        });
    });

    // Define posição inicial
    jogo.jogador.cidadeBase = 'Valentine';
    jogo.jogador.cidadeAtual = 'Valentine';
    
    // Recalcula grafo matemático (Floyd-Warshall)
    const fw = floydWarshall(); 
    jogo.cacheDist = fw.dist; 
    jogo.cacheProx = fw.prox;
    
    atualizaUI(); 
    requestAnimationFrame(desenharMapa);
}

async function executarPlano(){
    if(!jogo.rotaNegocio || jogo.busy) return;
    if(jogo.jogador.cidadeAtual !== jogo.rotaNegocio.origemCalculada){ alert("A posição mudou! Recalcule."); return; }
    jogo.busy = true; $('btnExecutar').disabled = true; $('btnAnalisar').disabled = true;
    const plano = jogo.rotaNegocio; mostraStatus("A caravana iniciou a jornada..."); await sleep(1000);
    try { 
        for(const passo of plano.pasos){ 
            if(passo.acao === 'ir'){ 
                const destino = passo.dest; 
                if(jogo.jogador.cidadeAtual === destino) continue; 
                const caminhoNos = reconstruirCaminho(jogo.jogador.cidadeAtual, destino, jogo.cacheProx); 
                for(let i=0; i < caminhoNos.length - 1; i++){ 
                    const a = caminhoNos[i]; const b = caminhoNos[i+1]; 
                    const custo = jogo.cacheDist[a][b]; 
                    if(jogo.jogador.dinheiro < custo) throw new Error("Sem dinheiro para suprimentos!"); 
                    mostraStatus(`Viajando: ${a} ➔ ${b} (-${formatMoney(custo)})`); 
                    await sleep(1000); 
                    jogo.jogador.dinheiro -= custo; jogo.jogador.cidadeAtual = b; 
                    atualizaUI(); desenharMapa(); 
                } 
            } else if(passo.acao === 'comprar'){ 
                let qtd = passo.qtd; 
                const espacoLivre = jogo.jogador.capacidadeMax - getPesoAtual();
                if (qtd > espacoLivre) qtd = espacoLivre;

                const mercado = jogo.cidades[jogo.jogador.cidadeAtual].mercado[passo.mat]; 
                const precoReal = mercado.preco; 
                let custo = qtd * precoReal; 
                if(jogo.jogador.dinheiro < custo) { qtd = Math.floor(jogo.jogador.dinheiro / precoReal); custo = qtd * precoReal; } 
                
                if(qtd > 0) {
                    mostraStatus(`Comprando ${qtd}x ${passo.mat} por ${formatMoney(precoReal)}...`); await sleep(1800); 
                    jogo.jogador.dinheiro -= custo; 
                    jogo.jogador.inventario[passo.mat] = (jogo.jogador.inventario[passo.mat]||0) + qtd; 
                    mercado.estoque -= qtd; 
                    atualizaUI(); 
                }
            } else if(passo.acao === 'vender'){ 
                const qtdNoInv = jogo.jogador.inventario[passo.mat] || 0; let qtd = passo.qtd; if(qtdNoInv < qtd) qtd = qtdNoInv; 
                if(qtd > 0) {
                    const mercado = jogo.cidades[jogo.jogador.cidadeAtual].mercado[passo.mat]; const precoReal = mercado.preco; const ganho = qtd * precoReal; 
                    mostraStatus(`Vendendo ${qtd}x ${passo.mat} por ${formatMoney(precoReal)}...`); await sleep(1800); 
                    jogo.jogador.dinheiro += ganho; jogo.jogador.inventario[passo.mat] -= qtd; mercado.estoque += qtd; atualizaUI(); 
                }
            } 
        } 
        jogo.jogador.lucroTotal += plano.lucroLiquido; 
        
        virarMes();
        mostraStatus("Rota concluída. Novo mês iniciado!"); 
        await sleep(1500);
    } catch (e) { alert(e.message); } 
    finally { jogo.busy = false; $('btnExecutar').disabled = true; $('btnAnalisar').disabled = false; jogo.rotaNegocio = null; escondeStatus(); atualizaUI(); desenharMapa(); }
}

async function irGPS(){
    if(!jogo.rotaGPS || jogo.busy) return; 
    jogo.busy = true; $('btnIr').disabled = true; const caminho = jogo.rotaGPS.caminho;
    try { 
        for(let i=0; i<caminho.length-1; i++){ 
            const a = caminho[i], b = caminho[i+1]; const custo = jogo.cacheDist[a][b]; 
            if(jogo.jogador.dinheiro < custo) throw new Error("Sem dinheiro."); 
            mostraStatus(`Viajando: ${a} ➔ ${b}`); await sleep(800); 
            jogo.jogador.dinheiro -= custo; jogo.jogador.cidadeAtual = b; 
            atualizaUI(); desenharMapa(); 
        } 
        virarMes();
        mostraStatus("Chegada a destino. Novo mês iniciado!"); 
        await sleep(1000); jogo.rotaGPS = null; desenharMapa(); $('selectDestino').value = ""; 
    } catch(e){ alert(e.message); } 
    finally { jogo.busy = false; $('btnIr').disabled = false; escondeStatus(); atualizaUI(); }
}

// --- FUNÇÃO MODO CHEAT (NOVA) ---
function criarBotaoCheat() {
    const btn = document.createElement('button');
    btn.innerText = "💸 MODO CHEAT";
    
    // Estilo flutuante
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '10000',
        padding: '12px 24px',
        backgroundColor: '#f1c40f', // Amarelo
        color: '#2c3e50',
        border: 'none',
        borderRadius: '50px',
        fontWeight: 'bold',
        fontSize: '14px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif'
    });

    // Efeito Hover
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';

    btn.onclick = () => {
        // Define dinheiro infinito (1 milhão)
        jogo.jogador.dinheiro = 1000000;
        
        // Atualiza UI instantaneamente
        atualizaUI();
        
        // Feedback Visual
        btn.innerText = "💰 RICO!";
        setTimeout(() => btn.innerText = "💸 MODO CHEAT", 2000);
        
        console.log("--- CHEAT ATIVADO: R$ 1.000.000 ---");
    };

    document.body.appendChild(btn);
}

// BIND DOS EVENTOS
$('btnNovoMapa').onclick = gerarMapa; 
$('btnPanorama').onclick = abrirPanorama;
$('btnTraçar').onclick = () => { 
    const dest = $('selectDestino').value; const origem = jogo.jogador.cidadeAtual; 
    if(dest === origem) return alert("Já está no local."); 
    const dist = jogo.cacheDist[origem][dest]; if(!isFinite(dist)) return alert("Inacessível."); 
    jogo.rotaGPS = { caminho: reconstruirCaminho(origem, dest, jogo.cacheProx), custo: dist }; 
    $('btnIr').disabled = false; mostraStatus(`Custo: ${formatMoney(dist)}`); desenharMapa(); 
};
$('btnIr').onclick = irGPS;

$('btnAnalisar').onclick = () => { 
    const CUSTO_ANALISE = 400+(jogo.tempo.ano-1898)*100;
    if(jogo.jogador.dinheiro < CUSTO_ANALISE) return alert(`Você precisa de ${formatMoney(CUSTO_ANALISE)} para comprar informações! 💰`);
    
    jogo.jogador.dinheiro -= CUSTO_ANALISE;
    atualizaUI();

    mostraStatus(`Analisando mercado (-${formatMoney(CUSTO_ANALISE)})...`); 
    setTimeout(() => { 
        findBestRoute(); const r = jogo.rotaNegocio; const div = $('detalhesRota'); 
        if(r) { div.innerHTML = `<strong>${r.tipo.toUpperCase()}</strong><br>${r.desc}<br>Lucro Est: <strong style='color:#2e7d32'>${formatMoney(r.lucroLiquido)}</strong>`; $('btnExecutar').disabled = false; } 
        else { div.innerText = "Nenhuma oportunidade."; $('btnExecutar').disabled = true; } 
        escondeStatus(); desenharMapa(); 
    }, 150); 
};

$('btnExecutar').onclick = executarPlano;
$('btnIrBase').onclick = () => { if(jogo.jogador.cidadeAtual !== jogo.jogador.cidadeBase && confirm("Voltar ao acampamento por $100?")) { jogo.jogador.dinheiro -= 100; jogo.jogador.cidadeAtual = jogo.jogador.cidadeBase; virarMes(); atualizaUI(); desenharMapa(); } };

$('btnUpgradeBag').onclick = () => { if(upgradeMochila()) atualizaUI(); };


$('btnSalvarDB').onclick = () => { salvarNoBanco(jogo); };

$('btnCarregarDB').onclick = async () => {
    const dadosCarregados = await carregarDoBanco();
    if (dadosCarregados) {
        jogo.jogador = dadosCarregados.jogador;
        jogo.cidades = dadosCarregados.cidades;
        jogo.rotas = dadosCarregados.rotas;
        jogo.tempo = dadosCarregados.tempo;
        
        const cvs = $('mapCanvas');
        preRenderTerrain(cvs.width, cvs.height);
        
        const res = floydWarshall();
        jogo.cacheDist = res.dist;
        jogo.cacheProx = res.prox;
        
        // CORREÇÃO: Limpar antes de repopular
        $('selectDestino').innerHTML = ''; 
        atualizaUI();
        
        atualizaDisplayData();
        desenharMapa();
        alert("Jogo carregado do banco com sucesso! 🤠");
    }
};

window.fecharPanorama = fecharPanorama;
window.onresize = desenharMapa; 

// INICIALIZAÇÃO
criarBotaoCheat(); // Cria o botão antes de iniciar
gerarMapa();