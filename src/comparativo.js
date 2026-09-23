import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

// --- Helper Functions ---

/**
 * Normaliza o nome do dia
 * @param {string} dia
 */
function normalizarDia(dia) {
    if (!dia) return '';
    const d = dia.toLowerCase();
    /** @type {Record<string, string>} */
    const map = {
        'segunda': 'Segunda', 'terça': 'Terça', 'terca': 'Terça',
        'quarta': 'Quarta', 'quinta': 'Quinta', 'sexta': 'Sexta',
        'sábado': 'Sábado', 'sabado': 'Sábado', 'domingo': 'Domingo'
    };
    for (const key in map) {
        if (d.includes(key)) return map[key];
    }
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

/**
 * @param {string} dataStr
 * @param {string} hora
 */
function getSlotKey(dataStr, hora) {
    // dataStr: YYYY-MM-DD
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const date = new Date(ano, mes - 1, dia);
    const dayIndex = date.getDay(); // 0=Domingo, 1=Segunda...
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const diaNome = dias[dayIndex];
    return { dia: diaNome, turno: normalizarTurno(hora) };
}

// --- Main Logic ---

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
        ${getHeader('analise', 'Comparativo')}
        
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
                margin-top: 2rem;
            }

            .calendar-grid th,
            .calendar-grid td {
                padding: 1rem;
                text-align: center;
                border-bottom: 1px solid var(--border-color);
                border-right: 1px solid var(--border-color);
                vertical-align: middle;
            }

            .calendar-grid th {
                background: #2a2828;
                color: var(--text-primary);
                font-weight: 600;
            }

            .calendar-grid .shift-header {
                background: #2a2828;
                font-weight: 600;
                color: var(--text-secondary);
                text-align: left;
                width: 100px;
            }

            .data-cell {
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: center;
                justify-content: center;
            }

            .count-row {
                display: flex;
                justify-content: space-between;
                width: 100%;
                font-size: 0.9em;
            }
            
            .count-label {
                color: var(--text-secondary);
                font-size: 0.8em;
            }

            .val-avail { color: var(--primary-color); font-weight: bold; }
            .val-assign { color: #4ade80; font-weight: bold; }

            .controls {
                background: var(--surface-color);
                padding: 1.5rem;
                border-radius: 12px;
                border: 1px solid var(--border-color);
                display: flex;
                gap: 1rem;
                align-items: center;
            }
            
            select {
                padding: 0.5rem;
                border-radius: 6px;
                border: 1px solid var(--border-color);
                background: var(--background-color);
                color: var(--text-primary);
                min-width: 250px;
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
                    <span>Comparativo</span>
                </div>
                <h1>Disponibilidade vs Designações</h1>
                <p>Compare quantas pessoas escolheram cada turno e quantas foram efetivamente escaladas.</p>
            </div>

            <div class="controls">
                <label for="scale-select">Selecione a Escala:</label>
                <select id="scale-select">
                    <option value="">Carregando escalas...</option>
                </select>
            </div>

            <div id="calendar-content">
                <div class="loading-text">Selecione uma escala para ver os dados.</div>
            </div>
        </div>

        ${getFooter()}
    `;

    initHeader();
    initLogic();
}

async function initLogic() {
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('scale-select'));
    if (!select) return;

    // 1. Load Scales
    /** @type {any[]} */
    let escalas = [];
    try {
        const q = query(collection(db, "Escalas"), orderBy("dataGeracao", "desc"));
        const snapshot = await getDocs(q);

        select.innerHTML = '<option value="">Selecione uma escala...</option>';

        snapshot.forEach(doc => {
            const data = doc.data();
            escalas.push({ id: doc.id, ...data });
            const option = document.createElement('option');
            option.value = doc.id;
            const dataGeracao = data.dataGeracao?.toDate ? data.dataGeracao.toDate().toLocaleDateString() : 'Data desc.';
            option.textContent = `${data.periodo} (Gerada: ${dataGeracao})`;
            select.appendChild(option);
        });

        if (escalas.length > 0) {
            select.value = escalas[0].id; // Select most recent by default
            carregarDadosComparativos(escalas[0]);
        }

    } catch (error) {
        console.error("Erro ao carregar escalas", error);
        select.innerHTML = '<option>Erro ao carregar</option>';
    }

    select.addEventListener('change', (e) => {
        const target = /** @type {HTMLSelectElement} */ (e.target);
        const id = target.value;
        // @ts-ignore
        const escala = escalas.find(e => e.id === id);
        if (escala) {
            carregarDadosComparativos(escala);
        }
    });
}

/**
 * @param {any} escala 
 */
async function carregarDadosComparativos(escala) {
    const content = document.getElementById('calendar-content');
    if (content) content.innerHTML = '<div class="loading-text">Calculando dados...</div>';

    try {
        // 1. Fetch Availability (Pessoas)
        const pessoasSnap = await getDocs(collection(db, 'Pessoas'));

        // Structure to count available unique people
        const availMap = initCountMap();

        pessoasSnap.forEach(doc => {
            const p = doc.data();
            if (p.disponibilidade && Array.isArray(p.disponibilidade)) {
                const countedSlots = new Set(); // Avoid double counting same person in same slot
                p.disponibilidade.forEach((/** @type {string|any} */ disp) => {
                    let d = '', t = '';
                    if (typeof disp === 'string') {
                        const parts = disp.split('-');
                        d = parts[0];
                        t = parts.slice(1).join('-'); // handles manha-08:30-10:30
                    } else if (typeof disp === 'object') {
                        d = disp.dia; t = disp.turno;
                    }
                    d = normalizarDia(d);
                    t = normalizarTurno(t);

                    if (d && t && availMap[t] && availMap[t][d] !== undefined) {
                        const key = `${d}-${t}`;
                        if (!countedSlots.has(key)) {
                            availMap[t][d]++;
                            countedSlots.add(key);
                        }
                    }
                });
            }
        });

        // 2. Process Scale Assignments
        // Count TOTAL assignments (not unique people)
        const assignMap = initCountMap();

        if (escala.vagos && Array.isArray(escala.vagos)) {
            escala.vagos.forEach((/** @type {any} */ vago) => {
                const info = getSlotKey(vago.data, vago.hora);
                if (info.dia && info.turno && assignMap[info.turno]) {
                    if (assignMap[info.turno][info.dia] !== undefined) {
                        // Increment for each person assigned
                        if (vago.designacao?.pessoa1?.id || vago.designacao?.pessoa1?.nome) {
                            assignMap[info.turno][info.dia]++;
                        }
                        if (vago.designacao?.pessoa2?.id || vago.designacao?.pessoa2?.nome) {
                            assignMap[info.turno][info.dia]++;
                        }
                    }
                }
            });
        }

        renderTable(availMap, assignMap);

    } catch (error) {
        console.error(error);
        if (content) content.innerHTML = '<div class="loading-text" style="color:red">Erro ao processar dados.</div>';
    }
}

function initCountMap() {
    /** @type {Record<string, Record<string, number>>} */
    const map = {
        'Manhã 08:30-10:30': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
        'Manhã 10-12': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
        'Tarde 14-16': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
        'Tarde 16-18': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 },
        'Noite 18-20': { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 }
    };
    return map;
}

// function initSetMap removed as it is no longer used

/**
 * @param {any} availMap 
 * @param {any} uniqueAssigns 
 */
function renderTable(availMap, uniqueAssigns) {
    const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const turnos = ['Manhã 08:30-10:30', 'Manhã 10-12', 'Tarde 14-16', 'Tarde 16-18', 'Noite 18-20'];

    let html = `
        <div style="margin-bottom: 1rem; text-align: right; color: var(--text-secondary); font-size: 0.9em;">
             <span class="val-avail">Cor: Escolheram (Disponíveis)</span> | <span class="val-assign">Cor: Designados (Total de Vagas Preenchidas)</span>
        </div>
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
        html += `<tr><td class="shift-header">${turno}</td>`;
        dias.forEach(dia => {
            const avail = availMap[turno][dia];
            const assigned = uniqueAssigns[turno][dia]; // Now it is a number directly

            html += `
                <td>
                    <div class="data-cell">
                        <div class="count-row">
                            <span class="count-label">Esc:</span>
                            <span class="val-avail">${avail}</span>
                        </div>
                        <div class="count-row">
                            <span class="count-label">Des:</span>
                            <span class="val-assign">${assigned}</span>
                        </div>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;

    const content = document.getElementById('calendar-content');
    if (content) content.innerHTML = html;
}
