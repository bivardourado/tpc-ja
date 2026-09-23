import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

/**
 * Capitaliza a primeira letra de uma string
 * @param {string} str
 * @returns {string}
 */
function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Protege a rota
protectRoute().then(() => {
    if (app) {
        app.innerHTML = `
            ${getHeader('analise', 'Pesquisa por Turnos')}
            
            <style>
                .turnos-container {
                    max-width: 1200px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                }

                .turnos-header {
                    margin-bottom: 2rem;
                }

                .turnos-header h1 {
                    font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
                    font-size: 23px;
                    font-weight: 400;
                    margin-bottom: 0.5rem;
                    color: #FFFFFF;
                    letter-spacing: -0.01em;
                    -webkit-font-smoothing: antialiased;
                }

                .turnos-header p {
                    color: var(--text-secondary);
                }

                .breadcrumb {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }

                .breadcrumb a {
                    color: var(--primary-color);
                    text-decoration: none;
                }

                .breadcrumb a:hover {
                    text-decoration: underline;
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
                    grid-template-columns: repeat(2, 1fr);
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

                @media (max-width: 768px) {
                    .turnos-container {
                        margin-top: 4rem;
                        padding: 1rem;
                    }
                    
                    .turnos-header h1 {
                        font-size: 1.5rem;
                    }
                    
                    .filtros-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .filtros-container {
                        padding: 1rem;
                    }

                    .filtros-grid select {
                        font-size: 16px; /* Evita zoom no iOS */
                        padding: 8px;
                        height: 45px;
                    }

                    #btn-pesquisar {
                        width: 100%;
                        justify-content: center;
                        padding: 12px;
                    }
                }
            </style>

            <div class="turnos-container">
                <div class="turnos-header">
                    <div class="breadcrumb">
                        <a href="/analise">📊 Análises</a>
                        <span>/</span>
                        <span>Turnos</span>
                    </div>
                    <h1>⏰ Pesquisa por Turnos</h1>
                    <p>Consulte quem está disponível por dia e turno</p>
                </div>

                <div class="filtros-container">
                    <h3 style="margin-top: 0; color: var(--text-primary);">Filtros</h3>
                    <div class="filtros-grid">
                        <div>
                            <label for="filtro-dia">Dia da Semana</label>
                            <select id="filtro-dia">
                                <option value="">Selecione...</option>
                                <option value="Segunda">Segunda</option>
                                <option value="Terça">Terça</option>
                                <option value="Quarta">Quarta</option>
                                <option value="Quinta">Quinta</option>
                                <option value="Sexta">Sexta</option>
                                <option value="Sábado">Sábado</option>
                                <option value="Domingo">Domingo</option>
                            </select>
                        </div>
                        <div>
                            <label for="filtro-turno">Horário</label>
                            <select id="filtro-turno">
                                <option value="">Selecione...</option>
                                <option value="08:30-10:30">08:30 - 10:30</option>
                                <option value="10-12">10:00 - 12:00</option>
                                <option value="14-16">14:00 - 16:00</option>
                                <option value="16-18">16:00 - 18:00</option>
                                <option value="18-20">18:00 - 20:00</option>
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

            ${getFooter()}
        `;

        // Inicializa header
        initHeader();

        // Botão pesquisar
        const btnPesquisar = document.getElementById('btn-pesquisar');
        if (btnPesquisar) {
            btnPesquisar.addEventListener('click', pesquisarTurnos);
        }

    } else {
        console.error('Elemento #app não encontrado!');
    }
});

async function pesquisarTurnos() {
    const dia = /** @type {HTMLSelectElement} */ (document.getElementById('filtro-dia'))?.value;
    const turno = /** @type {HTMLSelectElement} */ (document.getElementById('filtro-turno'))?.value;

    if (!dia || !turno) {
        alert('Por favor, selecione o Dia e o Turno');
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

        console.log('🔍 Procurando por:', { dia, turno });
        console.log('📊 Total de pessoas no banco:', pessoasSnap.size);

        pessoasSnap.forEach(doc => {
            const pessoa = doc.data();

            console.log('👤 Pessoa:', pessoa.nome);
            console.log('📅 Disponibilidades:', JSON.stringify(pessoa.disponibilidade, null, 2));

            // Verificar disponibilidade
            if (pessoa.disponibilidade && Array.isArray(pessoa.disponibilidade)) {
                const disponivel = pessoa.disponibilidade.some(disp => {
                    // Se for string no formato "dia-turno"
                    if (typeof disp === 'string') {
                        const partes = disp.split('-');
                        if (partes.length >= 2) {
                            // Mapeamento de dias
                            /** @type {Object.<string, string>} */
                            const mapaDias = {
                                'segunda': 'Segunda',
                                'terca': 'Terça', 'terça': 'Terça',
                                'quarta': 'Quarta',
                                'quinta': 'Quinta',
                                'sexta': 'Sexta',
                                'sabado': 'Sábado', 'sábado': 'Sábado',
                                'domingo': 'Domingo'
                            };

                            const diaDisp = mapaDias[partes[0].toLowerCase()] || capitalizar(partes[0]);

                            // Verifica formato novo: dia-turno-inicio-fim (ex: segunda-manha-08:30-10:30)
                            if (partes.length >= 4) {
                                const horario = `${partes[2]}-${partes[3]}`;
                                // DEBUG LOG
                                const match = diaDisp === dia && horario === turno;
                                if (match) return true;
                            }
                            // Verifica formato antigo (dia-turno) ou incompleto
                            else if (partes.length >= 2) {
                                const turnoBroad = partes[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // manha, tarde, noite
                                let matchesTime = false;

                                // Lógica de Fallback: Se o usuário tem "Manhã", aparece em 08:30-10:30 e 10-12, etc.
                                if (turnoBroad.includes('manha') && (turno === '08:30-10:30' || turno === '10-12')) matchesTime = true;
                                if (turnoBroad.includes('tarde') && (turno === '14-16' || turno === '16-18')) matchesTime = true;
                                if (turnoBroad.includes('noite') && (turno === '18-20')) matchesTime = true;

                                if (diaDisp === dia && matchesTime) return true;
                            }
                        }
                    }
                    // Se for objeto (formato antigo)
                    else if (typeof disp === 'object' && disp.dia && disp.turno) {
                        const match = disp.dia === dia && disp.turno === turno;
                        console.log(`  ➡️ Objeto: dia="${disp.dia}" turno="${disp.turno}" | Match: ${match}`);
                        return match;
                    }
                    return false;
                });

                if (disponivel) {
                    console.log('✅ ADICIONADO:', pessoa.nome);
                    resultados.push({
                        id: doc.id,
                        nome: pessoa.nome,
                        telefone: pessoa.telefone
                    });
                } else {
                    console.log(' ❌ NÃO combinou');
                }
            } else {
                console.log('❌ Sem disponibilidade');
            }
        });

        console.log('📋 Total de resultados:', resultados.length);

        // Renderizar resultados
        if (resultados.length === 0) {
            resultadoDiv.innerHTML = '<div class="empty-message">Nenhuma pessoa disponível para os filtros selecionados</div>';
        } else {
            const filtroTexto = `${dia} - ${turno}`;
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
        console.error('❌ Erro ao pesquisar:', error);
        resultadoDiv.innerHTML = '<div class="empty-message" style="color: var(--danger-color);">Erro ao realizar pesquisa</div>';
    }
}
