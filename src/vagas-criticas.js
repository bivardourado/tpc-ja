import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

// Protege a rota
protectRoute().then(async () => {
    if (app) {
        app.innerHTML = `
            ${getHeader('analise', 'Análise de Vagas')}
            
            <style>
                .analysis-container {
                    max-width: 1200px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                }

                .analysis-header {
                    margin-bottom: 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .analysis-header h1 {
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
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 500;
                }

                .report-card {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                    margin-top: 2rem;
                }

                .stat-box {
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    transition: all 0.2s;
                }

                .stat-box:hover {
                    background: #1a365d;
                    border-color: #3182ce;
                }

                .stat-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--primary-color);
                }

                .stat-label {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .critical-list {
                    list-style: none;
                    padding: 0;
                    margin: 2rem 0 0 0;
                }

                .critical-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                    transition: background-color 0.2s;
                }

                .critical-item:hover {
                    background: #1a365d;
                    border-color: #3182ce;
                }

                .critical-info h3 {
                    margin: 0 0 0.5rem 0;
                    color: var(--text-primary);
                    font-size: 1.1rem;
                }

                .critical-info p {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }

                .heatmap-badge {
                    background: rgba(207, 102, 121, 0.15);
                    color: var(--danger-color);
                    padding: 0.5rem 1rem;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    border: 1px solid rgba(207, 102, 121, 0.3);
                    min-width: 120px;
                    text-align: center;
                }

                .select-control {
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    font-family: inherit;
                    min-width: 200px;
                }

                /* Níveis de Criticidade */
                .level-high { 
                    background: rgba(207, 102, 121, 0.15); 
                    color: #ff6b6b; 
                    border-color: rgba(207, 102, 121, 0.3);
                }
                .level-medium { 
                    background: rgba(255, 152, 0, 0.15); 
                    color: #ff9800; 
                    border-color: rgba(255, 152, 0, 0.3);
                }
            </style>

            <div class="analysis-container">
                <div class="analysis-header">
                    <div>
                        <a href="/analise" class="back-link">← Voltar para Análises</a>
                        <h1 style="margin-top: 0.5rem;">🚨 Vagas Críticas</h1>
                        <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                            Identifique onde faltam irmãos para apoiar na pregação.
                        </p>
                    </div>
                    <div>
                         <select id="periodoSelect" class="select-control">
                            <option value="">Carregando meses...</option>
                        </select>
                        <button id="btnAtualizar" class="btn-primary" style="margin-left: 1rem;">
                            Analisar
                        </button>
                    </div>
                </div>

                <div id="loading" style="display: none; text-align: center; padding: 4rem;">
                    <div class="loading-spinner">🔄 Analisando escalas e disponibilidade...</div>
                </div>

                <div id="resultado">
                    <!-- Conteúdo injetado via JS -->
                    <div class="report-card" style="text-align: center; padding: 4rem;">
                        <p style="color: var(--text-secondary);">Selecione um mês acima e clique em "Analisar".</p>
                    </div>
                </div>
            </div>

            ${getFooter()}
        `;

        initHeader();

        // Carrega a lista de escalas disponíveis
        await carregarOpcoesPeriodos();

        document.getElementById('btnAtualizar')?.addEventListener('click', () => {
            const select = /** @type {HTMLSelectElement} */ (document.getElementById('periodoSelect'));
            if (select && select.value) {
                analisarVagasCriticas(select.value);
            }
        });
    }
});

async function carregarOpcoesPeriodos() {
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('periodoSelect'));
    if (!select) return;

    try {
        const querySnapshot = await getDocs(collection(db, "Escalas"));
        /** @type {string[]} */
        const periodos = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.periodo) {
                periodos.push(data.periodo);
            }
        });

        // Remove duplicatas e ordena
        const periodosUnicos = [...new Set(periodos)];

        /** @type {Record<string, number>} */
        const meses = { 'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12 };

        periodosUnicos.sort((a, b) => {
            const [mesA, anoA] = a.split('/');
            const [mesB, anoB] = b.split('/');

            if (anoA !== anoB) return parseInt(anoB) - parseInt(anoA); // Ano mais recente primeiro
            return meses[mesB] - meses[mesA]; // Mês mais recente primeiro
        });

        if (periodosUnicos.length === 0) {
            select.innerHTML = '<option value="">Nenhuma escala encontrada</option>';
            return;
        }

        select.innerHTML = '<option value="">Selecione o Mês...</option>';
        periodosUnicos.forEach(p => {
            // Formatar value para o padrão que a função analisarVagasCriticas espera (01-2026)
            const [nomeMes, ano] = p.split('/');
            const numMes = String(meses[nomeMes]).padStart(2, '0');
            const value = `${numMes}-${ano}`;

            const option = document.createElement('option');
            option.value = value;
            option.textContent = p;
            select.appendChild(option);
        });

        // Seleciona o primeiro automaticamente
        if (select.options.length > 1) {
            select.selectedIndex = 1;
            // Disparar análise inicial
            const primeiroValor = /** @type {HTMLOptionElement} */ (select.options[1]).value;
            analisarVagasCriticas(primeiroValor);
        }

    } catch (error) {
        console.error("Erro ao carregar períodos:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function analisarVagasCriticas(/** @type {string} */ periodoStr) {
    if (!periodoStr) return;

    const [mesStr, anoStr] = periodoStr.split('-');
    const mes = parseInt(mesStr);
    const ano = parseInt(anoStr);

    // Formatação amigável
    const nomeMes = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

    // Formatar para busca no Firestore: "Fevereiro/2025"
    const nomeMesQuery = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long' });
    const nomeMesCapQuery = nomeMesQuery.charAt(0).toUpperCase() + nomeMesQuery.slice(1);
    const periodoFormatado = `${nomeMesCapQuery}/${anoStr}`;

    const loadingDiv = document.getElementById('loading');
    const resultadoDiv = document.getElementById('resultado');

    if (loadingDiv) loadingDiv.style.display = 'block';
    if (resultadoDiv) resultadoDiv.style.display = 'none';

    try {
        // 1. Carregar Escala do Mês (Busca por query, pois o ID pode variar)
        const q = query(collection(db, "Escalas"), where("periodo", "==", periodoFormatado));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error(`Nenhuma escala encontrada para ${periodoFormatado}.`);
        }

        // Pega a primeira escala encontrada (considerando que pode haver duplicadas, pega a primeira retornada)
        const escalaDoc = querySnapshot.docs[0];

        let totalVagos = 0;
        let totalVazios = 0;

        /** @type {Record<string, {vazios: number, total: number}>} */
        const statsPorDiaHorario = {};

        if (escalaDoc.exists()) {
            const dadosEscala = escalaDoc.data();
            // Escalas antigas usam array 'vagos' direto na raiz (padrão atual do ScaleService)
            // Escalas MUITO antigas usavam objeto 'dias'
            const listaVagos = dadosEscala.vagos || [];

            listaVagos.forEach((/** @type {any} */ vago) => {
                // vago: { data: '2025-02-01', hora: 'Manhã', local: '...', designacao: {...} }
                // Precisamos descobrir o dia da semana a partir da data se não vier explícito
                let diaSemana = vago.dia; // Alguns objetos salvos podem ter 'dia'
                if (!diaSemana && vago.data) {
                    const [y, m, d] = vago.data.split('-').map(Number);
                    const dObj = new Date(y, m - 1, d);
                    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                    diaSemana = diasSemana[dObj.getDay()];
                }

                const hora = vago.hora;     // ex: "Manhã" ou "Manhã 08:30-10:30"
                const chave = `${diaSemana} - ${hora}`;

                if (!statsPorDiaHorario[chave]) {
                    statsPorDiaHorario[chave] = { vazios: 0, total: 0 };
                }

                statsPorDiaHorario[chave].total++;
                totalVagos++;

                // Verifica se ficou vazio (sem designação)
                const designacao = vago.designacao;
                // Um vago está vazio se designacao for null ou array vazio ou objeto vazio
                const estaVazio = !designacao ||
                    (Array.isArray(designacao) && designacao.length === 0) ||
                    (typeof designacao === 'object' && Object.keys(designacao).length === 0) ||
                    (!designacao.pessoa1 && !designacao.pessoa2);

                if (estaVazio) {
                    statsPorDiaHorario[chave].vazios++;
                    totalVazios++;
                }
            });
        }

        // Processar Ranking
        const ranking = Object.entries(statsPorDiaHorario)
            .map(([chave, stats]) => {
                return {
                    chave,
                    vazios: stats.vazios,
                    total: stats.total,
                    taxaOciosidade: (stats.vazios / stats.total) * 100
                };
            })
            .filter(item => item.vazios > 0) // Só mostra onde tem problema
            .sort((a, b) => b.vazios - a.vazios); // Ordena pelo número absoluto de buracos

        // Renderizar
        const html = `
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value text-danger">${totalVazios}</div>
                    <div class="stat-label">Vagas Não Preenchidas</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${totalVagos}</div>
                    <div class="stat-label">Total de Vagas no Mês</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${ranking.length}</div>
                    <div class="stat-label">Horários com Déficit</div>
                </div>
            </div>

            <div class="report-card" style="margin-top: 2rem;">
                <h2 style="margin-top: 0; color: var(--text-primary);">📍 Onde precisamos de ajuda? Analise ${nomeMesCap}!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    Abaixo estão os dias e horários com maior número de vagas vazias. Convide irmãos que tenham disponibilidade nestes horários!
                </p>

                ${ranking.length === 0 ?
                '<div class="empty-message">🎉 Parabéns! Nenhuma vaga ficou vazia neste mês.</div>' :
                `<ul class="critical-list">
                        ${ranking.map((r, index) => {
                    const percent = Math.round(r.taxaOciosidade);
                    const nivelClass = percent > 50 ? 'level-high' : 'level-medium';
                    const [dia, hora] = r.chave.split(' - ');

                    return `
                            <li class="critical-item">
                                <div class="critical-info">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span style="font-weight: bold; color: var(--text-primary); font-size: 1.2rem;">${index + 1}º</span>
                                        <h3>${dia}</h3>
                                    </div>
                                    <p>${hora}</p>
                                    <p style="font-size: 1.1rem; margin-top: 0.5rem; color: var(--text-primary);">De <strong>${r.total}</strong> vagas, <strong>${r.vazios}</strong> ficaram vazias.</p>
                                </div>
                                <div class="heatmap-badge ${nivelClass}">
                                    ${r.vazios} Vagas
                                </div>
                            </li>
                            `;
                }).join('')}
                    </ul>`
            }
            </div>
        `;

        if (resultadoDiv) {
            resultadoDiv.innerHTML = html;
            resultadoDiv.style.display = 'block';
        }
        if (loadingDiv) loadingDiv.style.display = 'none';

    } catch (error) {
        console.error("Erro ao analisar vagas críticas:", error);

        if (resultadoDiv) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            resultadoDiv.innerHTML = `<p class="text-danger" style="text-align:center; padding: 2rem;">Erro ao carregar dados: ${errorMsg}</p>`;
            resultadoDiv.style.display = 'block';
        }
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}
