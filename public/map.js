import { jogo, $ } from './utils.js';

// --- CARREGAMENTO DA IMAGEM ---
const backgroundImage = new Image();
// Certifique-se que a imagem salva na pasta public é 'mapa_fundo.png'
backgroundImage.src = 'mapa_fundo.png'; 

let imagemCarregada = false;
backgroundImage.onload = () => {
    imagemCarregada = true;
    requestAnimationFrame(desenharMapa);
};

// Mantido vazio para compatibilidade com imports
export function preRenderTerrain(w, h) {} 

export function desenharMapa(){
    const cvs = $('mapCanvas'); 
    if(cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }
    const ctx = cvs.getContext('2d'); 
    
    // 1. DESENHA O FUNDO
    if (imagemCarregada) {
        ctx.drawImage(backgroundImage, 0, 0, cvs.width, cvs.height);
        
        // Camada escura bem leve para diminuir o brilho excessivo e destacar a UI
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
        ctx.fillRect(0, 0, cvs.width, cvs.height);
    } else {
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = '#fff';
        ctx.fillText('Carregando mapa...', 50, 50);
    }

    const desenhadas = new Set();
    
    function isArestaNoCaminho(u, v, caminho){ 
        if(!caminho || caminho.length < 2) return false; 
        for(let i=0; i<caminho.length-1; i++){ 
            if((caminho[i]===u && caminho[i+1]===v) || (caminho[i]===v && caminho[i+1]===u)) return true; 
        } 
        return false; 
    }

    // 2. DESENHA AS ROTAS (ESTRADAS)
    jogo.rotas.forEach(r => {
        const id = [r.from, r.to].sort().join('-'); if(desenhadas.has(id)) return; desenhadas.add(id);
        const c1 = jogo.cidades[r.from]; const c2 = jogo.cidades[r.to];
        const midX = (c1.x + c2.x) / 2; const midY = (c1.y + c2.y) / 2;
        const hash = (r.from.charCodeAt(0) + r.to.charCodeAt(0)) % 50 - 25; 
        const cpX = midX + hash * (c1.y > c2.y ? 1 : -1); const cpY = midY + hash * (c1.x < c2.x ? 1 : -1);

        // --- Lógica de Cores (ALTERADA AQUI) ---
        // Mudamos de branco fraco para um DOURADO forte
        let strokeColor = 'rgba(255, 215, 0, 0.8)'; // Amarelo Dourado
        let lineWidth = 4;
        let isDashed = true;
        let isActive = false;

        if(jogo.rotaNegocio && isArestaNoCaminho(r.from, r.to, jogo.rotaNegocio.caminhoNos)) { 
            strokeColor = '#ff3d00'; // Laranja Neon (Comércio)
            lineWidth = 6;
            isDashed = false;
            isActive = true;
        } else if(jogo.rotaGPS && isArestaNoCaminho(r.from, r.to, jogo.rotaGPS.caminho)) { 
            strokeColor = '#00e5ff'; // Azul Ciano (GPS)
            lineWidth = 6;
            isDashed = false;
            isActive = true;
        } 

        ctx.beginPath(); 
        ctx.moveTo(c1.x, c1.y); 
        ctx.quadraticCurveTo(cpX, cpY, c2.x, c2.y);

        // --- TRUQUE DE CONTRASTE (BORDA PRETA) ---
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'; // Contorno preto bem forte
        ctx.lineWidth = lineWidth + 4;       // Mais grosso que a linha colorida
        if(isDashed) ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.restore();

        // --- LINHA COLORIDA ---
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        if(isDashed) ctx.setLineDash([8, 8]);
        
        // Brilho Neon se for rota ativa
        if(isActive) {
            ctx.shadowColor = strokeColor;
            ctx.shadowBlur = 15;
        }
        ctx.stroke();
        ctx.restore();
        
        // Bolinha de Custo (Placa na estrada)
        // Mostra só se for ativa ou se o custo for alto pra não poluir
        if(isActive || r.custo > 15) {
            ctx.beginPath(); ctx.arc(midX, midY+hash/2, 11, 0, Math.PI*2); 
            ctx.fillStyle='#212121'; ctx.fill(); 
            ctx.strokeStyle=strokeColor; ctx.lineWidth=2; ctx.stroke(); // Borda da cor da linha
            
            ctx.fillStyle='#fff'; 
            ctx.font='bold 11px Arial'; 
            ctx.textAlign='center'; ctx.textBaseline='middle'; 
            ctx.fillText(r.custo, midX, midY+hash/2);
        }
    });

    // 3. DESENHA AS CIDADES
    Object.keys(jogo.cidades).forEach(nome => {
        const c = jogo.cidades[nome]; const isPlayer = nome === jogo.jogador.cidadeAtual;
        
        // Glow atrás da cidade para separar do terreno
        ctx.save();
        ctx.shadowColor = "black";
        ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI*2); 
        ctx.fillStyle = "black"; ctx.fill();
        ctx.restore();

        // Círculo da Cidade
        ctx.beginPath(); 
        ctx.arc(c.x, c.y, isPlayer ? 10 : 7, 0, Math.PI*2); 
        // Jogador = Laranja Ouro, Cidade = Branco Perola
        ctx.fillStyle = isPlayer ? '#ffab00' : '#f5f5f5'; 
        ctx.fill(); 
        
        // Borda da Cidade
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();

        // --- TEXTO (ESTILO LEGENDA DE FILME) ---
        ctx.font = isPlayer ? 'bold 16px Verdana' : 'bold 13px Verdana'; 
        ctx.textAlign = 'center'; 
        
        const textY = c.y - 16;

        // 1. Contorno Preto Grosso (Outline)
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'black';
        ctx.strokeText(nome.toUpperCase(), c.x, textY);
        
        // 2. Texto Branco Brilhante
        ctx.fillStyle = '#fff'; 
        ctx.fillText(nome.toUpperCase(), c.x, textY);
        
        // Marcador do Jogador (Anel Pulsante Extra)
        if(isPlayer) { 
            ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, Math.PI*2); 
            ctx.strokeStyle='#ffab00'; 
            ctx.lineWidth=2; 
            ctx.setLineDash([3, 3]); // Pontilhado girando (efeito estático aqui)
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
}