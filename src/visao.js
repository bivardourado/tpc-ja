import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');



/**
 * Normaliza o nome do dia para corresponder às chaves do nosso objeto de contagem
 * @param {string} dia 
 */
function normalizarDia(dia) {
    if (!dia) return '';
    const d = dia.toLowerCase();
    if (d.includes('segunda')) return 'Segunda';
    if (d.includes('terça') || d.includes('terca')) return 'Terça';
    if (d.includes('quarta')) return 'Quarta';
    if (d.includes('quinta')) return 'Quinta';
    if (d.includes('sexta')) return 'Sexta';
    if (d.includes('sábado') || d.includes('sabado')) return 'Sábado';
    if (d.includes('domingo')) return 'Domingo';
    return '';
}

/**
 * Normaliza o nome do turno
 * @param {string} turno 
 */
function normalizarTurno(turno) {
    if (!turno) return '';
    const t = turno.toLowerCase();

    // Check for specific slots first
    if (t.includes('08:30-10:30')) return 'Manhã 08:30-10:30';
    if (t.includes('10-12')) return 'Manhã 10-12';
    if (t.includes('14-16')) return 'Tarde 14-16';
    if (t.includes('16-18')) return 'Tarde 16-18';

    // Legacy or generic matches
    if (t.includes('manha') || t.includes('manhã')) return 'Manhã 08:30-10:30';
    if (t.includes('tarde')) return 'Tarde 16-18';
    if (t.includes('noite')) return 'Noite 18-20';

    return '';
}

// Protege a rota
protectRoute().then(() => {
    if (app) {
        renderPage();
    } else {
        console.error('Elemento #app não encontrado!');
    }
});

function renderPage() {
    // @ts-ignore
    app.innerHTML = `
        ${getHeader('analise', 'Visão Geral')}
        
        <style>
            .visao-container {
                max-width: 1200px;
                margin: 5rem auto 2rem;
                padding: 2rem;
            }

            .visao-header {
                margin-bottom: 2rem;
            }

            .visao-header h1 {
                font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
                font-size: 23px;
                font-weight: 400;
                margin-bottom: 0.5rem;
                color: #FFFFFF;
                letter-spacing: -0.01em;
                -webkit-font-smoothing: antialiased;
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

            .calendar-grid {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                background: var(--surface-color);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid var(--border-color);
            }

            .calendar-grid th,
            .calendar-grid td {
                padding: 1.5rem;
                text-align: center;
                border-bottom: 1px solid var(--border-color);
                border-right: 1px solid var(--border-color);
            }

            .calendar-grid th:last-child,
            .calendar-grid td:last-child {
                border-right: none;
            }

            .calendar-grid tr:last-child td {
                border-bottom: none;
            }

            .calendar-grid th {
                background: #2a2828;
                color: var(--text-primary);
                font-weight: 600;
                font-size: 1rem;
            }

            .calendar-grid .shift-header {
                background: #2a2828;
                font-weight: 600;
                color: var(--text-secondary);
                text-align: left;
                width: 120px;
            }

            .count-cell {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--primary-color);
            }

            .loading-text {
                font-size: 1.2rem;
                color: var(--text-secondary);
                text-align: center;
                padding: 3rem;
            }
        </style>

        <div class="visao-container">
            <div class="visao-header">
                <div class="breadcrumb">
                    <a href="/analise">📊 Análises</a>
                    <span>/</span>
                    <span>Visão Geral</span>
                </div>
                <h1> Quadro de Disponibilidade</h1>
                <p>Total de participantes disponíveis por dia e turno</p>
            </div>

            <div id="calendar-content">
                <div class="loading-text">Carregando dados...</div>
            </div>
        </div>

        ${getFooter()}
    `;

    initHeader();
    carregarDados();
}

async function carregarDados() {
    try {
        const pessoasSnap = await getDocs(collection(db, 'Pessoas'));

        // Estrutura para armazenar contagens
        /** @type {Object.<string, Object.<string, number>>} */
        const contagens = {
            'Manhã 08:30-10:30': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
            'Manhã 10-12': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
            'Tarde 14-16': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
            'Tarde 16-18': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
            'Noite 18-20': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 }
        };

        pessoasSnap.forEach(doc => {
            const pessoa = doc.data();

            if (pessoa.disponibilidade && Array.isArray(pessoa.disponibilidade)) {
                // Set para evitar contar a mesma pessoa 2x no mesmo slot (embora improvável)
                const slotsContados = new Set();

                pessoa.disponibilidade.forEach(disp => {
                    let dia = '';
                    let turno = '';

                    if (typeof disp === 'string') {
                        const partes = disp.split('-');
                        dia = normalizarDia(partes[0]);
                        turno = normalizarTurno(partes.slice(1).join('-'));
                    } else if (typeof disp === 'object' && disp.dia && disp.turno) {
                        dia = normalizarDia(disp.dia);
                        turno = normalizarTurno(disp.turno);
                    }

                    if (dia && turno && contagens[turno] && contagens[turno][dia] !== undefined) {
                        const slotKey = `${dia}-${turno}`;
                        if (!slotsContados.has(slotKey)) {
                            contagens[turno][dia]++;
                            slotsContados.add(slotKey);
                        }
                    }
                });
            }
        });

        renderizarTabela(contagens);

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        const content = document.getElementById('calendar-content');
        if (content) {
            content.innerHTML = `<div class="loading-text" style="color: var(--danger-color)">Erro ao carregar dados. Tente novamente.</div>`;
        }
    }
}

/**
 * @param {Object.<string, Object.<string, number>>} contagens 
 */
function renderizarTabela(contagens) {
    const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const turnos = ['Manhã 08:30-10:30', 'Manhã 10-12', 'Tarde 14-16', 'Tarde 16-18', 'Noite 18-20'];

    let html = `
        <table class="calendar-grid">
            <thead>
                <tr>
                    <th class="shift-header">Turno</th>
                    ${dias.map(dia => `<th>${dia}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    turnos.forEach(turno => {
        html += `<tr>`;
        html += `<td class="shift-header">${turno}</td>`;

        dias.forEach(dia => {
            const count = contagens[turno][dia];
            html += `<td class="count-cell">${count}</td>`;
        });

        html += `</tr>`;
    });

    html += `
            </tbody>
        </table>
    `;

    const content = document.getElementById('calendar-content');
    if (content) {
        content.innerHTML = html;
    }
}
