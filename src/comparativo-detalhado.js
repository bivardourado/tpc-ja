import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

protectRoute().then(() => {
    if (app) {
        renderPage();
    }
});

function renderPage() {
    if (!app) return;
    app.innerHTML = `
        ${getHeader('analise', 'Comparativo Detalhado')}
        
        <style>
            .comp-container {
                max-width: 1200px;
                margin: 5rem auto 2rem;
                padding: 2rem;
            }

            .comp-header {
                margin-bottom: 2rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .comp-header h1 {
                font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
                font-size: 23px;
                font-weight: 400;
                margin: 0;
                color: #FFFFFF;
                letter-spacing: -0.01em;
                -webkit-font-smoothing: antialiased;
            }

            .back-link {
                color: var(--primary-color);
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 500;
            }

            .controls-card {
                background: var(--surface-color);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
                margin-bottom: 2rem;
                display: flex;
                gap: 1.5rem;
                align-items: center;
            }

            .select-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                flex: 1;
            }

            .select-group label {
                font-size: 0.9rem;
                color: var(--text-secondary);
                font-weight: 500;
            }

            select {
                padding: 0.75rem;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--bg-color);
                color: var(--text-primary);
                font-size: 1rem;
            }

            .stats-overview {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .stat-card {
                background: var(--surface-color);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
            }

            .stat-card.highlight {
                border-color: var(--primary-color);
            }

            .stat-value {
                font-size: 2rem;
                font-weight: 700;
                color: var(--primary-color);
                margin-bottom: 0.25rem;
            }

            .stat-label {
                font-size: 0.85rem;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .comp-table-container {
                background: var(--surface-color);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                position: relative;
            }

            table {
                width: 100%;
                border-collapse: collapse;
            }

            th {
                position: -webkit-sticky;
                position: sticky;
                top: 64px; /* Altura do header principal */
                z-index: 10;
                background-color: #222020; /* Mesma cor que var(--surface-color) */
                text-align: left;
                padding: 1rem 1.5rem;
                border-bottom: 2px solid var(--border-color);
                font-weight: 600;
                color: var(--text-secondary);
                font-size: 0.9rem;
                /* Previne que o conteúdo da célula apareça por trás da borda ao rolar */
                background-clip: padding-box;
            }

            td {
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-primary);
            }

            tr:last-child td {
                border-bottom: none;
            }

            .fill-rate-bar {
                height: 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
                width: 100px;
                overflow: hidden;
                margin-top: 0.5rem;
            }

            .fill-rate-progress {
                height: 100%;
                background: var(--primary-color);
                border-radius: 4px;
            }

            .status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 600;
            }

            .status-full { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
            .status-partial { background: rgba(255, 152, 0, 0.15); color: #ff9800; }
            .status-empty { background: rgba(244, 67, 54, 0.15); color: #f44336; }

            .text-center { text-align: center; }

            .summary-row {
               background: rgba(74, 144, 226, 0.05);
               font-weight: 600;
            }

            .loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem;
                color: var(--text-secondary);
            }

            @media (max-width: 768px) {
                .controls-card { flex-direction: column; align-items: stretch; }
                .comp-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
            }
        </style>

        <div class="comp-container">
            <div class="comp-header">
                <div>
                   <a href="/analise" class="back-link">← Voltar para Análises</a>
                   <h1>📊 Comparativo por Local</h1>
                </div>
            </div>

            <div class="controls-card">
                 <div class="select-group">
                    <label for="periodoSelect">Selecione o Mês</label>
                    <select id="periodoSelect">
                         <option value="">Carregando meses...</option>
                    </select>
                 </div>
                 <div class="select-group">
                    <label for="localFilter">Filtrar Local</label>
                    <select id="localFilter">
                         <option value="all">Todos os Locais</option>
                    </select>
                 </div>
            </div>

            <div id="statsContent">
                <div class="loading-container">
                    <p>Selecione um mês para carregar os dados comparativos.</p>
                </div>
            </div>
        </div>

        ${getFooter()}
    `;

    initHeader();
    carregarFiltros();
}

async function carregarFiltros() {
    const periodoSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('periodoSelect'));
    const localFilter = /** @type {HTMLSelectElement | null} */ (document.getElementById('localFilter'));

    if (!periodoSelect || !localFilter) return;

    try {
        // Carregar Periodos
        const escalasSnap = await getDocs(query(collection(db, "Escalas"), orderBy("dataGeracao", "desc")));
        periodoSelect.innerHTML = '<option value="">Escolha um período...</option>';

        escalasSnap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.periodo || 'Sem Período';
            periodoSelect.appendChild(option);
        });

        // Carregar Locais para filtro
        const locaisSnap = await getDocs(query(collection(db, "Locais"), orderBy("nome")));
        locaisSnap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = data.nome;
            option.textContent = data.nome;
            localFilter.appendChild(option);
        });

        periodoSelect.onchange = () => realizarAnalise();
        localFilter.onchange = () => realizarAnalise();

        // Auto-selecionar primeiro se disponível
        if (periodoSelect.options.length > 1) {
            periodoSelect.selectedIndex = 1;
            realizarAnalise();
        }

    } catch (error) {
        console.error("Erro ao carregar filtros:", error);
    }
}

async function realizarAnalise() {
    const pSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('periodoSelect'));
    const lFil = /** @type {HTMLSelectElement | null} */ (document.getElementById('localFilter'));
    const statsContent = document.getElementById('statsContent');

    if (!pSel || !lFil || !statsContent) return;

    const escalaId = pSel.value;
    const localFiltroItem = lFil.value;

    statsContent.innerHTML = `
        <div class="loading-container">
            <p>🔄 Processando dados...</p>
        </div>
    `;

    try {
        const escalasSnap = await getDocs(collection(db, "Escalas"));
        const escalaDoc = escalasSnap.docs.find(d => d.id === escalaId);
        if (!escalaDoc) return;

        const escala = escalaDoc.data();
        const vagos = escala.vagos || [];

        /** @type {Record<string, { total: number, preenchidos: number, parciais: number, vazios: number, pessoas: number }>} */
        const stats = {};

        vagos.forEach((/** @type {any} */ v) => {
            if (localFiltroItem !== 'all' && v.local !== localFiltroItem) return;

            // Determinar dia da semana
            let diaSemana = "";
            if (v.data) {
                const [y, m, d] = v.data.split('-').map(Number);
                const dObj = new Date(y, m - 1, d);
                diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dObj.getDay()];
            }

            const chave = `${v.local} | ${diaSemana} - ${v.hora}`;

            if (!stats[chave]) {
                stats[chave] = { total: 0, preenchidos: 0, parciais: 0, vazios: 0, pessoas: 0 };
            }

            stats[chave].total++;

            const p1 = v.designacao?.pessoa1;
            const p2 = v.designacao?.pessoa2;

            if (p1 && p2) {
                stats[chave].preenchidos++;
                stats[chave].pessoas += 2;
            } else if (p1 || p2) {
                stats[chave].parciais++;
                stats[chave].pessoas += 1;
            } else {
                stats[chave].vazios++;
            }
        });

        // Totais Gerais
        let totalGeral = 0;
        let totalPreenchidos = 0;
        let totalParciais = 0;
        let totalVazios = 0;
        let totalPessoas = 0;

        Object.values(stats).forEach(s => {
            totalGeral += s.total;
            totalPreenchidos += s.preenchidos;
            totalParciais += s.parciais;
            totalVazios += s.vazios;
            totalPessoas += s.pessoas;
        });

        const taxaGeral = totalGeral > 0 ? Math.round((totalPreenchidos / totalGeral) * 100) : 0;

        let html = `
            <div class="stats-overview">
                <div class="stat-card highlight">
                    <div class="stat-value">${taxaGeral}%</div>
                    <div class="stat-label">Eficiência Geral</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalGeral}</div>
                    <div class="stat-label">Total de Vagas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalPreenchidos}</div>
                    <div class="stat-label">Preenchidas (Dupla)</div>
                </div>
                 <div class="stat-card">
                    <div class="stat-value">${totalVazios}</div>
                    <div class="stat-label">Vazias</div>
                </div>
            </div>

            <div class="comp-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Local e Horário</th>
                            <th class="text-center">Total Vagas</th>
                            <th class="text-center">Completo (2)</th>
                            <th class="text-center">Parcial (1)</th>
                            <th class="text-center">Vazio (0)</th>
                            <th class="text-center">Participantes</th>
                            <th class="text-center">Fill Rate</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Ordenar stats por Local e depois por Dia/Hora
        const sortedEntries = Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]));

        sortedEntries.forEach(([chave, s]) => {
            const perc = Math.round((s.preenchidos / s.total) * 100);

            // Variável perc usada para estilizar as barras e Badges
            html += `
                <tr>
                    <td><strong>${chave}</strong></td>
                    <td class="text-center">${s.total}</td>
                    <td class="text-center"><span class="status-badge status-full">${s.preenchidos}</span></td>
                    <td class="text-center"><span class="status-badge status-partial">${s.parciais}</span></td>
                    <td class="text-center"><span class="status-badge status-empty">${s.vazios}</span></td>
                    <td class="text-center">${s.pessoas}</td>
                    <td class="text-center">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-weight: bold; color: ${perc === 100 ? '#4caf50' : 'inherit'}">${perc}%</span>
                            <div class="fill-rate-bar">
                                <div class="fill-rate-progress" style="width: ${perc}%; background: ${perc === 100 ? '#4caf50' : (perc < 50 ? '#f44336' : '#ff9800')}"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                        <tr class="summary-row">
                            <td>TOTAL GERAL</td>
                            <td class="text-center">${totalGeral}</td>
                            <td class="text-center">${totalPreenchidos}</td>
                            <td class="text-center">${totalParciais}</td>
                            <td class="text-center">${totalVazios}</td>
                            <td class="text-center">${totalPessoas}</td>
                            <td class="text-center">${taxaGeral}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        statsContent.innerHTML = html;

    } catch (error) {
        console.error("Erro ao realizar análise:", error);
        if (statsContent) {
            const errMsg = error instanceof Error ? error.message : String(error);
            statsContent.innerHTML = `<p class="text-danger">Erro ao carregar dados: ${errMsg}</p>`;
        }
    }
}
