import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

protectRoute().then(async () => {
    if (app) {
        app.innerHTML = `
            ${getHeader('analise', 'Ranking')}
            <style>
                .ranking-container {
                    max-width: 1200px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                    font-family: 'Inter', sans-serif;
                }
                .ranking-header {
                    margin-bottom: 2rem;
                }
                .ranking-header h1 {
                    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
                    font-size: 23px;
                    font-weight: 400;
                    margin-bottom: 0.5rem;
                    color: #FFFFFF;
                    letter-spacing: -0.01em;
                    -webkit-font-smoothing: antialiased;
                }
                .table-responsive {
                    overflow-x: auto;
                    overflow-y: auto; /* Permite rolagem vertical */
                    max-height: 75vh; /* Altura máxima da tabela (75% da tela) */
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    white-space: nowrap;
                }
                th, td {
                    padding: 1rem;
                    text-align: left;
                    border-bottom: 1px solid var(--border-color);
                }
                th {
                    background-color: var(--surface-color); /* Cor sólida para cobrir conteúdo ao rolar */
                    font-weight: 600;
                    color: var(--text-secondary);
                    position: sticky;
                    top: 0;
                    z-index: 100; /* Garante que fique acima das linhas */
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2); /* Pequena sombra para separar do conteúdo */
                }
                tr:hover {
                    background-color: var(--bg-hover);
                }
                .rank-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    font-weight: bold;
                    font-size: 0.9rem;
                }
                .rank-1 { background: #FFD700; color: #000; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
                .rank-2 { background: #C0C0C0; color: #000; }
                .rank-3 { background: #CD7F32; color: #fff; }
                .total-highlight {
                    font-weight: bold;
                    color: var(--primary-color);
                }
                .loading-spinner {
                    text-align: center;
                    padding: 3rem;
                    font-size: 1.2rem;
                    color: var(--text-secondary);
                }
                .month-cell {
                    text-align: center;
                    color: var(--text-secondary);
                }
                .month-cell.active {
                    color: var(--text-primary);
                    font-weight: 500;
                }
            </style>

            <div class="ranking-container">
                <div class="ranking-header">
                    <div style="margin-bottom: 10px;"><a href="/analise" style="color: var(--primary-color); text-decoration: none;">&larr; Voltar para Análises</a></div>
                    <h1>Ranking de Participação</h1>
                    <p style="color: var(--text-secondary);">Relatório detalhado de designações por mês</p>
                </div>

                <div id="ranking-content">
                    <div class="loading-spinner">
                        ⏳ Carregando dados do servidor... isso pode levar alguns segundos.
                    </div>
                </div>
            </div>
            ${getFooter()}
        `;

        initHeader();
        await carregarRanking();
    }
});

async function carregarRanking() {
    try {
        const contentDiv = document.getElementById('ranking-content');
        if (!contentDiv) return;

        // 1. Buscar Pessoas
        const pessoasSnap = await getDocs(collection(db, 'Pessoas'));

        /** @type {Record<string, {id: string, nome: string, frequenciaMaxima: number, indisponivelProximoMes: boolean, total: number, meses: Record<string, number>}>} */
        const mapaPessoas = {};

        pessoasSnap.forEach(doc => {
            const p = doc.data();
            mapaPessoas[doc.id] = {
                id: doc.id,
                nome: p.nome,
                frequenciaMaxima: p.frequenciaMaxima || 0,
                indisponivelProximoMes: p.indisponivelProximoMes || false,
                total: 0,
                meses: {}
            };
        });

        // 2. Buscar Escalas
        const escalasSnap = await getDocs(collection(db, 'Escalas'));
        let todosMeses = new Set();

        escalasSnap.forEach(docEscala => {
            const escala = docEscala.data();
            const vagos = escala.vagos || [];

            vagos.forEach((/** @type {any} */ vago) => {
                if (vago.designacao) {
                    // Extrair Mês/Ano da data do vago (YYYY-MM-DD)
                    const [ano, mes] = vago.data.split('-');
                    const chaveMes = `${mes}/${ano}`;
                    todosMeses.add(chaveMes);

                    // Contabilizar Pessoa 1
                    if (vago.designacao.pessoa1 && vago.designacao.pessoa1.id) {
                        const pid = vago.designacao.pessoa1.id;
                        if (mapaPessoas[pid]) {
                            mapaPessoas[pid].total++;
                            mapaPessoas[pid].meses[chaveMes] = (mapaPessoas[pid].meses[chaveMes] || 0) + 1;
                        }
                    }

                    // Contabilizar Pessoa 2
                    if (vago.designacao.pessoa2 && vago.designacao.pessoa2.id) {
                        const pid = vago.designacao.pessoa2.id;
                        if (mapaPessoas[pid]) {
                            mapaPessoas[pid].total++;
                            mapaPessoas[pid].meses[chaveMes] = (mapaPessoas[pid].meses[chaveMes] || 0) + 1;
                        }
                    }
                }
            });
        });

        // 3. Processar Meses para Colunas (Ordenar cronologicamente)
        const mesesOrdenados = Array.from(todosMeses).sort((a, b) => {
            const [ma, aa] = a.split('/');
            const [mb, ab] = b.split('/');
            // @ts-ignore
            return new Date(`${aa}-${ma}-01`) - new Date(`${ab}-${mb}-01`);
        });

        // 4. Processar Lista Final
        const todosParticipantes = Object.values(mapaPessoas);

        // Ativos (Já trabalharam)
        const listaAtivos = todosParticipantes
            .filter(p => p.total > 0)
            .sort((a, b) => b.total - a.total);

        // Inativos (Nunca trabalharam)
        const listaInativos = todosParticipantes
            .filter(p => p.total === 0)
            .sort((a, b) => a.nome.localeCompare(b.nome));

        // 5. Renderizar Tabela
        if (todosParticipantes.length === 0) {
            contentDiv.innerHTML = '<p style="text-align:center; padding: 2rem;">Nenhum voluntário cadastrado.</p>';
            return;
        }

        let html = `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">#</th>
                            <th>Nome</th>
                            <th style="width: 80px; text-align: center;" title="Disponibilidade por mês">Disp/Mês</th>
                            <th style="width: 80px; text-align: center;" title="Status de participação">Status</th>
                            ${mesesOrdenados.map(m => `<th style="text-align: center;">${m}</th>`).join('')}
                            <th style="text-align: center; color: var(--primary-color);">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        listaAtivos.forEach((p, index) => {
            const rank = index + 1;
            const statusIcon = p.indisponivelProximoMes
                ? '<span style="color: #ff9800; font-size: 1.2rem;" title="Não vai participar no próximo mês">⚠️</span>'
                : '<span style="color: #4caf50;" title="Disponível">✓</span>';

            html += `
                <tr>
                    <td style="text-align: center;">
                        <span class="rank-badge">${rank}</span>
                    </td>
                    <td style="font-weight: 500;">${p.nome}</td>
                    <td style="text-align: center; color: var(--text-secondary); font-size: 0.9rem;">${p.frequenciaMaxima || '-'}</td>
                    <td style="text-align: center;">${statusIcon}</td>
                    ${mesesOrdenados.map(m => {
                const qtd = p.meses[m] || 0;
                return `<td class="month-cell ${qtd > 0 ? 'active' : ''}">${qtd > 0 ? qtd : '-'}</td>`;
            }).join('')}
                    <td style="text-align: center;" class="total-highlight">${p.total}</td>
                </tr>
            `;
        });

        // Calcular totais por mês (quantas pessoas trabalharam)
        /** @type {Record<string, number>} */
        const totaisPorMes = {};
        mesesOrdenados.forEach(mes => {
            totaisPorMes[mes] = listaAtivos.filter(p => (p.meses[mes] || 0) > 0).length;
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr style="background-color: var(--bg-secondary); font-weight: bold;">
                            <td colspan="4" style="text-align: right; padding-right: 1rem;">Total que trabalharam:</td>
                            ${mesesOrdenados.map(m => `<td style="text-align: center;">${totaisPorMes[m]}</td>`).join('')}
                            <td style="text-align: center; color: var(--primary-color);">${listaAtivos.length}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Seção de Voluntários que nunca participaram -->
            <div style="margin-top: 3rem; background: var(--surface-color); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <h3 style="margin-bottom: 1rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.2rem;">👤</span> 
                    Voluntários Sem Participação (${listaInativos.length})
                </h3>
                ${listaInativos.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
                    ${listaInativos.map(p => `
                        <div style="padding: 0.8rem; background: var(--bg-primary); border-radius: 6px; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                            <span>${p.nome}</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Disp: ${p.frequenciaMaxima || 0}</span>
                        </div>
                    `).join('')}
                </div>
                ` : '<p style="color: var(--text-secondary); font-size: 0.9rem;">Todos os voluntários já participaram de pelo menos uma escala!</p>'}
            </div>

            <div style="margin-top: 2rem; color: var(--text-secondary); font-size: 0.9rem; text-align: right; padding-bottom: 2rem;">
                Participantes Ativos: <b>${listaAtivos.length}</b> | 
                Aguardando Primeira Escala: <b>${listaInativos.length}</b> | 
                Total Cadastrado: <b>${todosParticipantes.length}</b>
            </div>
        `;

        contentDiv.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
        const contentDiv = document.getElementById('ranking-content');
        if (contentDiv) {
            // @ts-ignore
            contentDiv.innerHTML = `<p style="color: red; text-align: center;">Erro ao carregar dados: ${error.message}</p>`;
        }
    }
}
