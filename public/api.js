import { mostraStatus, escondeStatus } from './utils.js';

const API_URL = 'http://127.0.0.1:5000/api';

export async function salvarNoBanco(jogoEstado) {
    mostraStatus("Conectando ao Back-end...");
    try {
        const response = await fetch(`${API_URL}/salvar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jogoEstado)
        });
        
        if (response.ok) {
            mostraStatus("✅ Salvo no Banco SQL!");
            setTimeout(escondeStatus, 2000);
            return true;
        } else {
            throw new Error("Erro no servidor");
        }
    } catch (error) {
        alert("Erro ao conectar com o Back-end Python. O 'app.py' está rodando?");
        escondeStatus();
        return false;
    }
}

export async function carregarDoBanco() {
    mostraStatus("Buscando dados no SQL...");
    try {
        const response = await fetch(`${API_URL}/carregar`);
        if (response.ok) {
            const dados = await response.json();
            mostraStatus("✅ Dados carregados!");
            setTimeout(escondeStatus, 1500);
            return dados;
        } else {
            alert("Nenhum save encontrado no banco.");
            escondeStatus();
            return null;
        }
    } catch (error) {
        alert("Erro ao conectar com o Back-end Python.");
        escondeStatus();
        return null;
    }
}