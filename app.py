import sqlite3
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='public')
CORS(app) # Permite conexão do Front com o Back

DB_NAME = "jogo.db"

# --- BANCO DE DADOS (SQLite) ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Tabela simples para salvar o estado completo do jogo (JSON)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT,
            game_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print("--- Banco de Dados SQL Inicializado ---")

# --- ROTAS DA API ---

# Rota para entregar o Front-end (Serve o index.html)
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

# Rota para servir os arquivos JS e CSS
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

# Rota: SALVAR JOGO (Recebe JSON do JS e grava no SQL)
@app.route('/api/salvar', methods=['POST'])
def salvar():
    data = request.json
    game_json = json.dumps(data)
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO saves (player_name, game_data) VALUES (?, ?)", ("Forasteiro", game_json))
    conn.commit()
    save_id = cursor.lastrowid
    conn.close()
    
    print(f"Jogo salvo no ID: {save_id}")
    return jsonify({"message": "Jogo salvo com sucesso no Banco SQL!", "id": save_id})

# Rota: CARREGAR JOGO (Lê do SQL e devolve JSON pro JS)
@app.route('/api/carregar', methods=['GET'])
def carregar():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Pega o último save
    cursor.execute("SELECT game_data FROM saves ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    
    if row:
        print("Jogo carregado do banco.")
        return jsonify(json.loads(row[0]))
    else:
        return jsonify({"error": "Nenhum save encontrado"}), 404

if __name__ == '__main__':
    init_db() # Cria o banco ao iniciar
    print("--- Servidor Back-end Rodando na porta 5000 ---")
    app.run(port=5000, debug=True)