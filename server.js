const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors'); // Importa o pacote cors
const path = require('path'); // Módulo para lidar com caminhos de arquivos

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10; // Fator de custo para o hash da senha

// --- Middlewares ---
// Habilita o CORS, permitindo que o frontend acesse o backend
app.use(cors());
// Permite que o Express entenda requisições com corpo em JSON
app.use(express.json());
// Serve arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static('.'));

// Conecta ao banco de dados SQLite (cria o arquivo se não existir)
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        // Garante que os comandos de criação de tabela executem em ordem
        db.serialize(() => {
            // Cria a tabela de usuários (se não existir)
            db.run(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    senha TEXT NOT NULL
                )
            `, (err) => {
                if (err) console.error('Erro ao criar tabela usuarios.', err.message);
            });

            // Cria a tabela de gastos (se não existir)
            db.run(`
                CREATE TABLE IF NOT EXISTS gastos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    descricao TEXT NOT NULL,
                    valor REAL NOT NULL,
                    categoria TEXT NOT NULL,
                    data TEXT NOT NULL,
                    usuario_id INTEGER,
                    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
                )
            `, (err) => {
                if (err) console.error("Erro ao criar tabela de gastos.", err.message);
            });
        });
    }
});

// Rota para CADASTRAR um novo usuário
app.post('/register', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(senha, saltRounds);
        const sql = 'INSERT INTO usuarios (email, senha) VALUES (?, ?)';
        
        db.run(sql, [email, hashedPassword], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Erro ao cadastrar usuário. O email talvez já exista.' });
            }
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno no servidor ao gerar hash.' });
    }
});

// Rota para autenticar (login) um usuário
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    const sql = 'SELECT * FROM usuarios WHERE email = ?';

    db.get(sql, [email], async (err, usuario) => {
        if (err) {
            return res.status(500).json({ message: 'Erro interno no servidor.' });
        }
        if (!usuario) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }

        // Compara a senha enviada com o hash salvo no banco
        const match = await bcrypt.compare(senha, usuario.senha);

        if (match) {
            // Retorna o ID do usuário no login para ser salvo no frontend
            res.status(200).json({ message: 'Login realizado com sucesso!', usuarioId: usuario.id });
        } else {
            res.status(401).json({ message: 'Email ou senha inválidos.' });
        }
    });
});

// Rota para ADICIONAR um novo gasto
app.post('/gastos', (req, res) => {
    const { descricao, valor, categoria, data, usuarioId } = req.body;

    if (!descricao || !valor || !categoria || !data || !usuarioId) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const sql = 'INSERT INTO gastos (descricao, valor, categoria, data, usuario_id) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [descricao, valor, categoria, data, usuarioId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao salvar gasto.', error: err.message });
        }
        res.status(201).json({ message: 'Gasto adicionado com sucesso!', gastoId: this.lastID });
    });
});

// Rota para BUSCAR todos os gastos de um usuário
app.get('/gastos/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;

    const sql = 'SELECT * FROM gastos WHERE usuario_id = ? ORDER BY data DESC';
    db.all(sql, [usuarioId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar gastos.', error: err.message });
        }
        res.status(200).json(rows);
    });
});

// Rota para DELETAR um gasto
app.delete('/gastos/:id', (req, res) => {
    const { id } = req.params; // Pega o ID do gasto da URL

    const sql = 'DELETE FROM gastos WHERE id = ?';

    db.run(sql, id, function(err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao deletar gasto.', error: err.message });
        }
        // this.changes retorna o número de linhas afetadas. Se for 0, o gasto não foi encontrado.
        res.status(200).json({ message: 'Gasto deletado com sucesso!', changes: this.changes });
    });
});

// Rota para buscar gastos AGRUPADOS por categoria
app.get('/gastos/agrupados/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;

    const sql = `
        SELECT categoria, SUM(valor) as total
        FROM gastos
        WHERE usuario_id = ?
        GROUP BY categoria
        ORDER BY total DESC
    `;

    db.all(sql, [usuarioId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar gastos agrupados.', error: err.message });
        }
        res.status(200).json(rows);
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});