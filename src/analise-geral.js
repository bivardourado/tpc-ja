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
            ${getHeader('analise', 'Visão Geral')}
            <style>
                .analise-container {
                    max-width: 1400px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
                .stat-number {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: var(--primary-color);
                    margin-bottom: 0.5rem;
                }
                .stat-label {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .section-box {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                }
                .person-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                .person-item {
                    padding: 0.75rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .person-item:last-child {
                    border-bottom: none;
                }
                .badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }
                .badge-danger {
                    background: rgba(244, 67, 54, 0.2);
                    color: #f44336;
                }
                .badge-warning {
                    background: rgba(255, 152, 0, 0.2);
                    color: #ff9800;
                }
                .badge-info {
                    background: rgba(33, 150, 243, 0.2);
                    color: #2196f3;
                }
            </style>


            <div class="analise-container">
                <div style="margin-bottom: 10px;"><a href="/analise" style="color: var(--primary-color); text-decoration: none;">&larr; Voltar para Análises</a></div>
                <h1>📊 Análise Geral - <span id="titulo-periodo">Seleção</span></h1>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">Investigação detalhada de por que poucas pessoas foram designadas</p>

                <div class="search-box" style="margin-bottom: 2rem; background: var(--surface-color); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color);">
                    <label for="periodo-select" style="font-weight: 600; margin-right: 1rem;">Período:</label>
                    <select id="periodo-select" style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 1rem;">
                        <option value="">Selecione um período...</option>
                        <option value="fevereiro/2025" selected>Fevereiro/2025</option>
                        <option value="março/2025">Março/2025</option>
                        <option value="abril/2025">Abril/2025</option>
                        <option value="janeiro/2026">Janeiro/2026</option>
                         <option value="fevereiro/2026">Fevereiro/2026</option>
                        <option value="março/2026">Março/2026</option>
                    </select>
                    <button id="btn-atualizar" class="btn-primary" style="margin-left: 1rem;">Atualizar Análise</button>
                </div>

                <div id="loading" style="text-align: center; padding: 3rem;">
                    <p style="font-size: 1.2rem;">⏳ Analisando dados... isso pode levar alguns segundos.</p>
                </div>

                <div id="resultado" style="display: none;">
                    <!-- Resultado será inserido aqui -->
                </div>
            </div>
            ${getFooter()}
        `;

        initHeader();

        // Setup listeners
        const btn = document.getElementById('btn-atualizar');
        const select = /** @type {HTMLSelectElement} */ (document.getElementById('periodo-select'));
        const titulo = document.getElementById('titulo-periodo');

        if (btn && select) {
            btn.addEventListener('click', () => {
                if (select.value) {
                    if (titulo) titulo.textContent = select.value.charAt(0).toUpperCase() + select.value.slice(1);
                    analisarPeriodo(select.value);
                }
            });

            // Auto run for initial selection
            if (select.value) {
                if (titulo) titulo.textContent = select.value.charAt(0).toUpperCase() + select.value.slice(1);
                analisarPeriodo(select.value);
            }
        }
    }
});

async function analisarPeriodo(/** @type {string} */ periodoSelecionado) {
    console.log(`Analisando período: ${periodoSelecionado}`);
    const loadingDiv = document.getElementById('loading');
    const resultadoDiv = document.getElementById('resultado');

    if (loadingDiv) loadingDiv.style.display = 'block';
    if (resultadoDiv) resultadoDiv.style.display = 'none';

    try {
        // 1. Carregar todas as pessoas
        const pessoasSnap = await getDocs(collection(db, 'Pessoas'));
        /** @type {any[]} */
        const todasPessoas = [];
        pessoasSnap.forEach(doc => {
            todasPessoas.push({ id: doc.id, ...doc.data() });
        });

        // 2. Carregar escalas do período
        const escalasSnap = await getDocs(collection(db, 'Escalas'));
        const designacoesPeriodo = new Set();
        let totalVagosPeriodo = 0;
        let vagosPreenchidosPeriodo = 0;

        escalasSnap.forEach(docEscala => {
            const escala = docEscala.data();
            // Comparação insensível a maiúsculas/minúsculas
            if (escala.periodo.toLowerCase() === periodoSelecionado.toLowerCase()) {
                (escala.vagos || []).forEach((/** @type {any} */ vago) => {
                    totalVagosPeriodo++;
                    if (vago.designacao) {
                        vagosPreenchidosPeriodo++;
                        if (vago.designacao.pessoa1?.id) designacoesPeriodo.add(vago.designacao.pessoa1.id);
                        if (vago.designacao.pessoa2?.id) designacoesPeriodo.add(vago.designacao.pessoa2.id);
                    }
                });
            }
        });


        // 3. Categorizar pessoas
        /** @type {any[]} */
        const indisponiveis = [];
        /** @type {any[]} */
        const semFrequencia = [];
        /** @type {any[]} */
        const semDisponibilidade = [];
        /** @type {any[]} */
        const semDupla = [];
        /** @type {any[]} */
        const trabalharam = [];

        todasPessoas.forEach(p => {
            if (designacoesPeriodo.has(p.id)) {
                trabalharam.push(p);
            } else {
                // Investigar motivo
                if (p.indisponivelProximoMes) {
                    indisponiveis.push(p);
                } else if (!p.frequenciaMaxima || p.frequenciaMaxima === 0) {
                    semFrequencia.push(p);
                } else if (!p.disponibilidade || p.disponibilidade.length === 0) {
                    semDisponibilidade.push(p);
                } else {
                    semDupla.push(p);
                }
            }
        });

        // 4. Renderizar resultado
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (!resultadoDiv) return;

        resultadoDiv.style.display = 'block';

        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${todasPessoas.length}</div>
                    <div class="stat-label">Total de Cadastrados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${trabalharam.length}</div>
                    <div class="stat-label">Trabalharam em Janeiro</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${todasPessoas.length - trabalharam.length}</div>
                    <div class="stat-label">NÃO Trabalharam</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalVagosPeriodo}</div>
                    <div class="stat-label">Vagos no Período</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${vagosPreenchidosPeriodo}</div>
                    <div class="stat-label">Vagos Preenchidos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalVagosPeriodo - vagosPreenchidosPeriodo}</div>
                    <div class="stat-label">Vagos Vazios</div>
                </div>
            </div>

            <h2>🔍 Motivos para NÃO Designação</h2>
        `;

        // Motivo 1: Marcaram "Não vou participar"
        if (indisponiveis.length > 0) {
            html += `
                <div class="section-box">
                    <h3>⚠️ Marcaram "Não vou participar no próximo mês" (${indisponiveis.length})</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Essas pessoas foram automaticamente excluídas da geração da escala.</p>
                    <div class="person-list">
                        ${indisponiveis.map(p => `
                            <div class="person-item">
                                <span>${p.nome}</span>
                                <span class="badge badge-danger">Indisponível</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Motivo 2: Frequência Máxima = 0
        if (semFrequencia.length > 0) {
            html += `
                <div class="section-box">
                    <h3>🚫 Frequência Máxima = 0 ou não definida (${semFrequencia.length})</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Essas pessoas configuraram que não querem participar ou não definiram frequência.</p>
                    <div class="person-list">
                        ${semFrequencia.map(p => `
                            <div class="person-item">
                                <span>${p.nome}</span>
                                <span class="badge badge-warning">Freq: ${p.frequenciaMaxima || 0}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Motivo 3: Sem disponibilidade cadastrada
        if (semDisponibilidade.length > 0) {
            html += `
                <div class="section-box">
                    <h3>📅 Sem disponibilidade cadastrada (${semDisponibilidade.length})</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Essas pessoas não marcaram nenhum dia/horário disponível.</p>
                    <div class="person-list">
                        ${semDisponibilidade.map(p => `
                            <div class="person-item">
                                <span>${p.nome}</span>
                                <span class="badge badge-warning">0 horários</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Motivo 4: Falta de dupla compatível
        if (semDupla.length > 0) {
            // Agrupar por gênero
            /** @type {Record<string, any[]>} */
            const porGenero = {};
            semDupla.forEach((/** @type {any} */ p) => {
                const gen = p.genero || 'Não informado';
                if (!porGenero[gen]) porGenero[gen] = [];
                porGenero[gen].push(p);
            });

            html += `
                <div class="section-box">
                    <h3>👥 Possível falta de dupla compatível (${semDupla.length})</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Essas pessoas têm disponibilidade e frequência OK, mas não foram designadas. Pode ser falta de dupla do mesmo gênero nos mesmos horários.</p>
                    ${Object.keys(porGenero).map(gen => `
                        <details style="margin-bottom: 1rem;">
                            <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px;">
                                ${gen}: ${porGenero[gen].length} pessoa(s)
                            </summary>
                            <div class="person-list" style="margin-top: 0.5rem;">
                                ${porGenero[gen].map((/** @type {any} */ p) => `
                                    <div class="person-item">
                                        <span>${p.nome}</span>
                                        <span class="badge badge-info">${(p.disponibilidade || []).length} horários</span>
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    `).join('')}
                </div>
            `;
        }

        // Conclusão
        html += `
            <div class="section-box" style="background: linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(53, 122, 189, 0.05));">
                <h3>💡 Conclusão</h3>
                <ul style="line-height: 1.8;">
                    <li><strong>${indisponiveis.length}</strong> pessoas marcaram "Não vou participar" e foram excluídas automaticamente</li>
                    <li><strong>${semFrequencia.length}</strong> pessoas têm frequência = 0 (não querem participar)</li>
                    <li><strong>${semDisponibilidade.length}</strong> pessoas não cadastraram disponibilidade</li>
                    <li><strong>${semDupla.length}</strong> pessoas podem ter ficado sem dupla compatível</li>
                    <li><strong>${totalVagosPeriodo - vagosPreenchidosPeriodo}</strong> vagos ficaram vazios (falta de pessoas disponíveis)</li>
                </ul>
                <p style="margin-top: 1rem; padding: 1rem; background: rgba(255, 152, 0, 0.1); border-left: 4px solid #ff9800; border-radius: 4px;">
                    <strong>Principal causa:</strong> ${indisponiveis.length > 0 ?
                `A maioria (${indisponiveis.length}) marcou "Não vou participar". Isso é comum em janeiro (férias, viagens de fim de ano).` :
                semFrequencia.length > 0 ?
                    `Muitas pessoas (${semFrequencia.length}) não definiram frequência ou deixaram em 0.` :
                    `Falta de duplas compatíveis nos horários disponíveis.`
            }
                </p>
            </div>
        `;

        resultadoDiv.innerHTML = html;

    } catch (error) {
        console.error('Erro na análise:', error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (resultadoDiv) {
            resultadoDiv.style.display = 'block';
            resultadoDiv.innerHTML = `<p style="color: red;">Erro ao carregar análise: ${error}</p>`;
        }
    }
}
