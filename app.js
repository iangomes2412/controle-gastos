const API = 'http://localhost:3000';

// Adiciona um "escutador" que roda o código quando a página termina de carregar
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.endsWith('index.html') || path.endsWith('/')) {
        document.querySelector('button').addEventListener('click', login);
    } else if (path.endsWith('cadastro.html')) {
        document.querySelector('button').addEventListener('click', cadastrar);
    } else if (path.endsWith('sistema.html')) {
        verificarLogin();
        carregarGastos();
        renderizarGraficoDeGastos();
        document.querySelector('header button').addEventListener('click', logout);
        document.querySelector('.container button').addEventListener('click', adicionarGasto);
    }
});

function verificarLogin() {
    if (!localStorage.getItem('usuarioId')) {
        window.location.href = 'index.html';
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        const response = await fetch(API + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('usuarioId', data.usuarioId);
            window.location.href = 'sistema.html';
        } else {
            alert(data.erro || 'Erro ao fazer login.');
        }
    } catch (error) {
        alert('Falha na comunicação com o servidor.');
    }
}

async function cadastrar() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmar').value;

    if (senha !== confirmar) {
        return alert('As senhas não conferem.');
    }

    try {
        const response = await fetch(API + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();
        alert(data.mensagem || data.erro);

        if (response.ok) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        alert('Falha na comunicação com o servidor.');
    }
}

function logout() {
    localStorage.removeItem('usuarioId');
    window.location.href = 'index.html';
}

async function adicionarGasto() {
    const descricao = document.getElementById('descricao').value;
    const valor = document.getElementById('valor').value;
    const categoria = document.getElementById('categoria').value;
    const data = document.getElementById('data').value;

    if (!descricao || !valor || !categoria || !data) {
        return alert('Preencha todos os campos para adicionar um gasto.');
    }

    await fetch(API + '/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            descricao,
            valor: Number(valor),
            categoria,
            data,
            usuarioId: localStorage.getItem('usuarioId')
        })
    });

    // Limpa os campos e recarrega a lista
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    document.getElementById('categoria').value = '';
    document.getElementById('data').value = '';
    carregarGastos();
    renderizarGraficoDeGastos();
}

async function deletarGasto(id) {
    // Pede confirmação ao usuário antes de deletar
    if (!confirm('Tem certeza que deseja deletar este gasto?')) {
        return;
    }

    try {
        const response = await fetch(`${API}/gastos/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            carregarGastos(); // Recarrega a lista para refletir a deleção
            renderizarGraficoDeGastos(); // Atualiza o gráfico também
        } else {
            const data = await response.json();
            alert(data.erro || 'Não foi possível deletar o gasto.');
        }
    } catch (error) {
        alert('Falha na comunicação com o servidor.');
    }
}

let meuGrafico; // Variável para armazenar a instância do gráfico

async function renderizarGraficoDeGastos() {
    const usuarioId = localStorage.getItem('usuarioId');
    if (!usuarioId) return;

    try {
        const response = await fetch(`${API}/gastos/agrupados/${usuarioId}`);
        const dadosAgrupados = await response.json();

        const labels = dadosAgrupados.map(item => item.categoria || 'Sem Categoria');
        const data = dadosAgrupados.map(item => item.total);

        const ctx = document.getElementById('graficoCategorias').getContext('2d');

        // Se já existir um gráfico, destrua-o antes de criar um novo
        if (meuGrafico) {
            meuGrafico.destroy();
        }

        meuGrafico = new Chart(ctx, {
            type: 'doughnut', // Tipo do gráfico: pode ser 'pie', 'bar', etc.
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gastos por Categoria',
                    data: data,
                    backgroundColor: [ // Cores para as fatias do gráfico
                        '#ef4444', '#f97316', '#eab308',
                        '#84cc16', '#22c55e', '#10b981',
                        '#06b6d4', '#3b82f6', '#8b5cf6',
                    ],
                    borderColor: '#1f2937', // Cor da borda igual ao fundo do container
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#d1d5db' } } // Cor do texto da legenda
                }
            }
        });
    } catch (error) {
        console.error('Erro ao renderizar gráfico:', error);
    }
}

async function carregarGastos() {
    const usuarioId = localStorage.getItem('usuarioId');
    if (!usuarioId) return;

    const response = await fetch(`${API}/gastos/${usuarioId}`);
    const gastos = await response.json();

    const lista = document.getElementById('lista');
    lista.innerHTML = '';
    let soma = 0;

    if (gastos.length === 0) {
        lista.innerHTML = '<p>Nenhum gasto registrado ainda.</p>';
    }

    gastos.forEach(g => {
        soma += g.valor;

        const card = document.createElement('div');
        card.className = 'card';

        const descricaoSpan = document.createElement('span');
        descricaoSpan.textContent = g.descricao;

        const valorSpan = document.createElement('span');
        valorSpan.textContent = `R$ ${g.valor.toFixed(2)}`;

        const dataSpan = document.createElement('span');
        dataSpan.textContent = new Date(g.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Deletar';
        deleteButton.onclick = () => deletarGasto(g.id);

        card.appendChild(descricaoSpan);
        card.appendChild(valorSpan);
        card.appendChild(dataSpan);
        card.appendChild(deleteButton);
        lista.appendChild(card);
    });

    document.getElementById('total').innerText = soma.toFixed(2);
}