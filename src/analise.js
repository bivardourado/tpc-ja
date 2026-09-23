import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';

const app = document.querySelector('#app');

// Protege a rota
protectRoute().then(() => {
    if (app) {
        app.innerHTML = `
            ${getHeader('analise', 'Análises')}
            
            <style>
                .pesquisas-hub-container {
                    max-width: 1200px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                }

                .pesquisas-hub-header h1 {
                    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
                    font-size: 23px;
                    font-weight: 400;
                    margin-bottom: 0.5rem;
                    color: #FFFFFF;
                    letter-spacing: -0.01em;
                    -webkit-font-smoothing: antialiased;
                }

                .pesquisas-hub-header p {
                    color: var(--text-secondary);
                    margin-bottom: 2rem;
                }

                .pesquisas-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .pesquisa-card {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 2rem;
                    text-decoration: none;
                    color: var(--text-primary);
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .pesquisa-card:hover {
                    background: #1a365d; /* Azulado conforme a referência */
                    border-color: #3182ce;
                }

                .pesquisa-card-icon {
                    font-size: 2.5rem;
                }

                .pesquisa-card-title {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .pesquisa-card-description {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }
            </style>

            <div class="pesquisas-hub-container">
                <div class="pesquisas-hub-header">
                    <h1>📊 Análises</h1>
                    <p>Escolha o tipo de consulta que deseja realizar</p>
                </div>

                <div class="pesquisas-grid">
                    <a href="/turnos" class="pesquisa-card">
                        <div class="pesquisa-card-title">Turnos</div>
                        <div class="pesquisa-card-description">
                            Consulte quem está disponível por dia e turno
                        </div>
                    </a>

                    <a href="/visao" class="pesquisa-card">
                        <div class="pesquisa-card-title">Visão Geral</div>
                        <div class="pesquisa-card-description">
                            Quadro consolidado de disponibilidades por dia e turno
                        </div>
                    </a>

                    <a href="/comparativo-detalhado.html" class="pesquisa-card">
                        <div class="pesquisa-card-title">Comparativo por Local</div>
                        <div class="pesquisa-card-description">
                            Vagas totais vs Preenchidas em cada local e horário
                        </div>
                    </a>

                    <a href="/analise-geral.html" class="pesquisa-card">
                        <div class="pesquisa-card-title">🔍 Diagnóstico Geral</div>
                        <div class="pesquisa-card-description">
                            Descubra por que alguns participantes não foram escalados
                        </div>
                    </a>

                    <a href="/vagas-criticas.html" class="pesquisa-card">
                        <div class="pesquisa-card-title">🚨 Vagas Críticas</div>
                        <div class="pesquisa-card-description">
                            Veja quais dias e horários mais precisam de voluntários
                        </div>
                    </a>
                </div>
            </div>

            ${getFooter()}
        `;

        // Inicializa header
        initHeader();

    } else {
        console.error('Elemento #app não encontrado!');
    }
});
