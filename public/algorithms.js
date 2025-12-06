import { jogo, getPesoAtual } from './utils.js';

export function floydWarshall(){
    const cidades = Object.keys(jogo.cidades); 
    const dist = {}; 
    const prox = {};
    
    cidades.forEach(u => { 
        dist[u] = {}; 
        prox[u] = {}; 
        cidades.forEach(v => { 
            if(u === v) { dist[u][v] = 0; prox[u][v] = u; } 
            else { dist[u][v] = Infinity; prox[u][v] = null; } 
        }); 
    });
    
    jogo.rotas.forEach(r => { 
        dist[r.from][r.to] = r.custo; 
        prox[r.from][r.to] = r.to; 
    });
    
    for(const k of cidades){ 
        for(const i of cidades){ 
            for(const j of cidades){ 
                if(dist[i][k] + dist[k][j] < dist[i][j]){ 
                    dist[i][j] = dist[i][k] + dist[k][j]; 
                    prox[i][j] = prox[i][k]; 
                } 
            } 
        } 
    }
    return { dist, prox };
}

export function distancia(u, v){ 
    if(!jogo.cacheDist) return Infinity; 
    return jogo.cacheDist[u][v]; 
}

export function reconstruirCaminho(u, v, prox){ 
    if(distancia(u,v) === Infinity) return []; 
    const path = [u]; 
    let curr = u; 
    while(curr !== v){ 
        curr = prox[curr][v]; 
        if(!curr) return []; 
        path.push(curr); 
    } 
    return path; 
}

// --- ALGORITMO MULTI-ITEM (KNAPSACK GREEDY) ---
export function findBestRoute(){
    const dist = jogo.cacheDist; 
    const prox = jogo.cacheProx; 
    const cidades = Object.keys(jogo.cidades); 
    const pontoPartida = jogo.jogador.cidadeAtual; 
    const dinheiroInicial = jogo.jogador.dinheiro;
    const espacoLivreInicial = jogo.jogador.capacidadeMax - getPesoAtual(); // Quanto cabe na mochila agora

    let melhorPlano = { tipo: 'nenhum', lucroLiquido: -Infinity };

    // Itera sobre todas as combinações de rotas possíveis (Origem -> Destino)
    for(const origem of cidades){
        for(const destino of cidades){
            if(origem === destino) continue; // Não faz sentido comprar e vender no mesmo lugar

            // 1. Custo Logístico (Ciclo: Start -> Origem -> Destino -> Start)
            const custoViagem = dist[pontoPartida][origem] + dist[origem][destino] + dist[destino][pontoPartida];
            
            if(!isFinite(custoViagem)) continue; // Rota impossível
            if(custoViagem >= dinheiroInicial) continue; // Sem dinheiro nem pra viajar

            // 2. Análise de Mercado (Coleta todos os itens lucrativos nesta rota)
            let oportunidades = [];
            for(const mat of jogo.materiais){
                const dadosOrigem = jogo.cidades[origem].mercado[mat];
                const dadosDestino = jogo.cidades[destino].mercado[mat];

                const margem = dadosDestino.preco - dadosOrigem.preco;
                
                // Se dá lucro e tem estoque, é um candidato
                if (margem > 0 && dadosOrigem.estoque > 0) {
                    oportunidades.push({
                        mat: mat,
                        precoCompra: dadosOrigem.preco,
                        precoVenda: dadosDestino.preco,
                        margem: margem,
                        estoque: dadosOrigem.estoque
                    });
                }
            }

            // Se não tem nada pra comprar nessa rota, pula
            if (oportunidades.length === 0) continue;

            // 3. Otimização da Mochila (Greedy Strategy)
            // Ordenamos pelo MAIOR LUCRO UNITÁRIO (Margem)
            // Isso garante que vamos encher a mochila com o "filé mignon" primeiro
            oportunidades.sort((a, b) => b.margem - a.margem);

            let orcamentoAtual = dinheiroInicial - custoViagem;
            let espacoAtual = espacoLivreInicial;
            let lucroBrutoCarga = 0;
            let listaCompras = []; // Vai guardar o que decidimos comprar

            for (const item of oportunidades) {
                // Se acabou o dinheiro ou o espaço, para de comprar este item
                if (orcamentoAtual <= 0 || espacoAtual <= 0) break;

                // Calcula quantos podemos comprar deste item específico
                // Limitado por: Orçamento, Espaço e Estoque da cidade
                const maxPeloDinheiro = Math.floor(orcamentoAtual / item.precoCompra);
                const qtd = Math.min(espacoAtual, item.estoque, maxPeloDinheiro);

                if (qtd > 0) {
                    listaCompras.push({
                        mat: item.mat,
                        qtd: qtd,
                        preco: item.precoCompra,
                        precoVenda: item.precoVenda
                    });

                    // Atualiza os recursos restantes para o próximo item da lista
                    orcamentoAtual -= (qtd * item.precoCompra);
                    espacoAtual -= qtd;
                    lucroBrutoCarga += (qtd * item.margem);
                }
            }

            // 4. Fechamento do Plano
            const lucroLiquidoFinal = lucroBrutoCarga - custoViagem;

            if (lucroLiquidoFinal > melhorPlano.lucroLiquido && listaCompras.length > 0) {
                // Monta os passos para o boneco executar
                let passos = [];
                
                // Passo 1: Ir até a origem
                passos.push({ acao: 'ir', dest: origem });

                // Passos 2...N: Comprar todos os itens da lista
                let descritivo = "Comprar: ";
                listaCompras.forEach(compra => {
                    passos.push({ acao: 'comprar', mat: compra.mat, qtd: compra.qtd, preco: compra.preco });
                    descritivo += `${compra.qtd}x ${compra.mat}, `;
                });

                // Passo N+1: Ir até o destino
                passos.push({ acao: 'ir', dest: destino });

                // Passos N+2...M: Vender tudo que comprou
                listaCompras.forEach(venda => {
                    passos.push({ acao: 'vender', mat: venda.mat, qtd: venda.qtd, preco: venda.precoVenda });
                });

                // Passo Final: Voltar pra casa (opcional, mas o custo já considerou isso)
                passos.push({ acao: 'ir', dest: pontoPartida });

                // Salva o melhor plano encontrado
                melhorPlano = {
                    tipo: 'multi_item',
                    lucroLiquido: lucroLiquidoFinal,
                    origemCalculada: pontoPartida,
                    desc: `${descritivo} em ${origem} e vender em ${destino}.`,
                    pasos: passos
                };
            }
        }
    }

    // Geração do traçado visual
    if(melhorPlano.tipo !== 'nenhum'){ 
        let caminhoFull = [pontoPartida]; 
        let atual = pontoPartida; 
        melhorPlano.pasos.forEach(p => { 
            if(p.acao === 'ir'){ 
                const subPath = reconstruirCaminho(atual, p.dest, prox); 
                if(subPath.length > 0) { 
                    caminhoFull = caminhoFull.concat(subPath.slice(1)); 
                    atual = p.dest; 
                } 
            } 
        }); 
        melhorPlano.caminhoNos = caminhoFull; 
    } 
    
    jogo.rotaNegocio = melhorPlano.lucroLiquido > 0 ? melhorPlano : null;
}