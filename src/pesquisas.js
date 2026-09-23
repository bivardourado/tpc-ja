import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

// Protege a rota
protectRoute().then(() => {
    if (app) {
        app.innerHTML = `
            ${getHeader('pesquisas', 'Pesquisas')}
            
            <style>
                .pesquisas-container {
                    max-width: 1200px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                }

                .pesquisas-header h1 {
                    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
                    font-size: 23px;
                    font-weight: 400;
                    margin-bottom: 0.5rem;
                    color: #FFFFFF;
                    letter-spacing: -0.01em;
                    -webkit-font-smoothing: antialiased;
                }

                .pesquisas-header p {
                    color: var(--text-secondary);
                    margin-bottom: 2rem;
                }

                /* Tabs */
                .tabs-container {
                    border-bottom: 1px solid var(--border-color);
                    margin-bottom: 2rem;
                }

                .tabs {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .tab {
                    background: transparent;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--text-secondary);
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    font-size: 0.95rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .tab:hover {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.05);
                }

                .tab.active {
                    color: var(--primary-color);
                    border-bottom-color: var(--primary-color);
                }

                /* Tab Content */
                .tab-content {
                    display: none;
                }

                .tab-content.active {
                    display: block;
                }

                /* Filtros */
                .filtros-container {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .filtros-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .filtros-grid label {
                    display: block;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .filtros-grid select {
                    width: 100%;
                }

                /* Resultado */
                .resultado-container {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .resultado-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--border-color);
                }

                .resultado-count {
                    font-size: 1.1rem;
                    color: var(--text-primary);
                }

                .pessoa-item {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .pessoa-item:last-child {
                    border-bottom: none;
                }

                .pessoa-info h3 {
                    margin: 0 0 0.25rem 0;
                    color: var(--text-primary);
                    font-size: 1rem;
                }

                .pessoa-info p {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }

                .empty-message {
                    text-align: center;
                    padding: 2rem;
                    color: var(--text-secondary);
                }
            </style>

            <div class="pesquisas-container">
                <div class="pesquisas-header">
                    <h1>📊 Pesquisas</h1>
                    <p>Consultas e relatórios do sistema</p>
                </div>

                <!-- Tabs -->
                <div class="tabs-container">
                    <div class="tabs">
                        <button class="tab active" data-tab="turnos">Turnos</button>
                        <!-- Futuramente: outras abas -->
                    </div>
                </div>

                <!-- Tab: Turnos -->
                <div class="tab-content active" id="tab-turnos">
                    <div class="filtros-container">
                        <h3 style="margin-top: 0; color: var(--text-primary);">Filtros</h3>
                        <div class="filtros-grid">
                            <div>
                                <label for="filtro-dia">Dia da Semana</label>
                                <select id="filtro-dia">
                                    <option value="">Selecione...</option>
                                    <option value="Segunda-feira">Segunda-feira</option>
                                    <option value="Terça-feira">Terça-feira</option>
                                    <option value="Quarta-feira">Quarta-feira</option>
                                    <option value="Quinta-feira">Quinta-feira</option>
                                    <option value="Sexta-feira">Sexta-feira</option>
                                    <option value="Sábado">Sábado</option>
                                    <option value="Domingo">Domingo</option>
                                </select>
                            </div>
                            <div>
                                <label for="filtro-local">Local</label>
                                <select id="filtro-local">
                                    <option value="">Carregando...</option>
                                </select>
                            </div>
                            <div>
                                <label for="filtro-turno">Turno</label>
                                <select id="filtro-turno">
                                    <option value="">Selecione...</option>
                                    <option value="Manhã">Manhã</option>
                                    <option value="Tarde">Tarde</option>
                                    <option value="Noite">Noite</option>
                                </select>
                            </div>
                        </div>
                        <button id="btn-pesquisar" class="btn-primary">🔍 Pesquisar</button>
                    </div>

                    <div class="resultado-container" id="resultado-turnos">
                        <div class="empty-message">
                            Selecione os filtros e clique em "Pesquisar" para ver os resultados
                        </div>
                    </div>
                </div>
            </div>

            ${getFooter()}
        `;

        // Inicializa header
        initHeader();

        // Carregar locais
        carregarLocais();

        // Event listeners das tabs
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                if (tabName) trocarTab(tabName);
            });
        });

        // Botão pesquisar
        const btnPesquisar = document.getElementById('btn-pesquisar');
        btnPesquisar?.addEventListener('click', pesquisarTurnos);

    } else {
        console.error('Elemento #app não encontrado!');
    }
});

/**
 * @param {string} tabName
 */
function trocarTab(tabName) {
    // Atualiza tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Atualiza conteúdo
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
}

async function carregarLocais() {
    try {
        const locaisSnap = await getDocs(collection(db, 'Locais'));
        const selectLocal = /** @type {HTMLSelectElement} */ (document.getElementById('filtro-local'));

        if (!selectLocal) return;

        selectLocal.innerHTML = '<option value="">Todos os locais</option>';

        locaisSnap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = data.nome;
            option.textContent = data.nome;
            selectLocal.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar locais:', error);
    }
}

async function pesquisarTurnos() {
    const dia = /** @type {HTMLSelectElement} */ (document.getElementById('filtro-dia'))?.value;
    const local = /** @type {HTMLSelectElement} */ (document.getElementById('filtro-local'))?.value;
    const turno = /** @type {HTMLSelectElement} */ (document.getElementById('filtro-turno'))?.value;

    if (!dia || !turno) {
        alert('Por favor, selecione pelo menos o Dia e o Turno');
        return;
    }

    const resultadoDiv = document.getElementById('resultado-turnos');
    if (!resultadoDiv) return;

    resultadoDiv.innerHTML = '<div class="empty-message">Carregando...</div>';

    try {
        // Buscar todas as pessoas
        const pessoasSnap = await getDocs(collection(db, 'Pessoas'));
        /** @type {Array<{id: string, nome: string, telefone?: string}>} */
        const resultados = [];

        pessoasSnap.forEach(doc => {
            const data = doc.data();
            /** @type {{nome: string, telefone?: string, disponibilidade?: Array<{dia: string, turno: string, local: string}>}} */
            const pessoa = {
                nome: data.nome || 'Sem Nome',
                telefone: data.telefone,
                disponibilidade: data.disponibilidade
            };

            // Verificar disponibilidade
            if (pessoa.disponibilidade && Array.isArray(pessoa.disponibilidade)) {
                const disponivel = pessoa.disponibilidade.some(disp => {
                    const diaMatch = disp.dia === dia;
                    const turnoMatch = disp.turno === turno;
                    const localMatch = !local || disp.local === local;

                    return diaMatch && turnoMatch && localMatch;
                });

                if (disponivel) {
                    resultados.push({
                        id: doc.id,
                        nome: pessoa.nome,
                        telefone: pessoa.telefone
                    });
                }
            }
        });

        // Renderizar resultados
        if (resultados.length === 0) {
            resultadoDiv.innerHTML = '<div class="empty-message">Nenhuma pessoa disponível para os filtros selecionados</div>';
        } else {
            const filtroTexto = `${dia} - ${turno}${local ? ` - ${local}` : ''}`;
            resultadoDiv.innerHTML = `
                <div class="resultado-header">
                    <div class="resultado-count">
                        <strong>${resultados.length}</strong> ${resultados.length === 1 ? 'pessoa disponível' : 'pessoas disponíveis'}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${filtroTexto}
                    </div>
                </div>
                ${resultados.map(p => `
                    <div class="pessoa-item">
                        <div class="pessoa-info">
                            <h3>${p.nome}</h3>
                            <p>📱 ${p.telefone || 'Não informado'}</p>
                        </div>
                    </div>
                `).join('')}
            `;
        }
    } catch (error) {
        console.error('Erro ao pesquisar:', error);
        resultadoDiv.innerHTML = '<div class="empty-message" style="color: var(--danger-color);">Erro ao realizar pesquisa</div>';
    }
}
