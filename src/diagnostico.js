import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

protectRoute().then(() => {
    if (app) {
        app.innerHTML = `
            ${getHeader('analise', 'Diagnóstico')}
            <style>
                .diagnostico-container {
                    max-width: 1000px;
                    margin: 5rem auto 2rem;
                    padding: 2rem;
                }
                .search-box {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                }
                .search-box input {
                    width: 100%;
                    padding: 12px;
                    font-size: 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }
                .result-box {
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 2rem;
                }
                .status-item {
                    padding: 1rem;
                    margin-bottom: 1rem;
                    border-radius: 8px;
                    border-left: 4px solid;
                }
                .status-ok {
                    border-color: #4caf50;
                    background: rgba(76, 175, 80, 0.1);
                }
                .status-warning {
                    border-color: #ff9800;
                    background: rgba(255, 152, 0, 0.1);
                }
                .status-error {
                    border-color: #f44336;
                    background: rgba(244, 67, 54, 0.1);
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .info-item {
                    padding: 0.5rem;
                }
                .info-label {
                    font-weight: bold;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .info-value {
                    color: var(--text-primary);
                    margin-top: 0.25rem;
                }
            </style>

            <div class="diagnostico-container">
                <div style="margin-bottom: 10px;"><a href="/analise" style="color: var(--primary-color); text-decoration: none;">&larr; Voltar para Análises</a></div>
                <h1>🔍 Diagnóstico de Participação</h1>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">Descubra por que alguém não foi designado em determinado mês</p>

                <div class="search-box">
                    <label for="nome-busca" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nome do Participante:</label>
                    <input type="text" id="nome-busca" placeholder="Digite o nome completo ou parte dele..." autocomplete="off">
                    <div id="suggestions" style="margin-top: 0.5rem;"></div>
                    <button id="btn-diagnosticar" class="btn-primary" style="margin-top: 1rem;">Diagnosticar</button>
                </div>

                <div id="resultado" style="display: none;" class="result-box">
                    <!-- Resultado será inserido aqui -->
                </div>
            </div>
            ${getFooter()}
        `;

        initHeader();
        setupDiagnostico();
    }
});

async function setupDiagnostico() {
    const inputNome = /** @type {HTMLInputElement | null} */ (document.getElementById('nome-busca'));
    const btnDiagnosticar = document.getElementById('btn-diagnosticar');
    const suggestionsDiv = document.getElementById('suggestions');
    const resultadoDiv = document.getElementById('resultado');

    // Carregar todos os participantes para autocomplete
    const pessoasSnap = await getDocs(collection(db, 'Pessoas'));
    /** @type {any[]} */
    const pessoas = [];
    pessoasSnap.forEach(doc => {
        pessoas.push({ id: doc.id, ...doc.data() });
    });

    // Autocomplete
    if (inputNome) {
        inputNome.addEventListener('input', () => {
            const valor = inputNome.value.toLowerCase().trim();
            if (!suggestionsDiv) return;

            if (valor.length < 2) {
                suggestionsDiv.innerHTML = '';
                return;
            }

            const matches = pessoas.filter(p =>
                p.nome.toLowerCase().includes(valor)
            ).slice(0, 5);

            if (matches.length > 0) {
                suggestionsDiv.innerHTML = matches.map(p =>
                    `<div style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color);" 
                          onclick="document.getElementById('nome-busca').value='${p.nome}'; document.getElementById('suggestions').innerHTML='';">
                        ${p.nome}
                    </div>`
                ).join('');
            } else {
                suggestionsDiv.innerHTML = '<div style="padding: 8px; color: var(--text-secondary);">Nenhum resultado encontrado</div>';
            }
        });
    }

    // Diagnóstico
    if (btnDiagnosticar) {
        btnDiagnosticar.addEventListener('click', async () => {
            const nome = inputNome?.value.trim();
            if (!nome || !resultadoDiv) return;

            resultadoDiv.style.display = 'block';
            resultadoDiv.innerHTML = '<p>Analisando...</p>';

            // Normalizar nome para busca (remover acentos e converter para minúsculas)
            const normalizarNome = (/** @type {string} */ str) => {
                return str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim();
            };

            const nomeBusca = normalizarNome(nome);
            const pessoa = pessoas.find(p => normalizarNome(p.nome) === nomeBusca);

            if (!pessoa) {
                resultadoDiv.innerHTML = '<p style="color: var(--danger-color);">❌ Pessoa não encontrada no cadastro.</p>';
                return;
            }

            // Buscar escalas
            const escalasSnap = await getDocs(collection(db, 'Escalas'));
            const designacoesJaneiro = [];

            escalasSnap.forEach(docEscala => {
                const escala = docEscala.data();
                if (escala.periodo.toLowerCase().includes('janeiro')) {
                    (escala.vagos || []).forEach((/** @type {any} */ vago) => {
                        if (vago.designacao) {
                            if (vago.designacao.pessoa1?.id === pessoa.id || vago.designacao.pessoa2?.id === pessoa.id) {
                                designacoesJaneiro.push(vago);
                            }
                        }
                    });
                }
            });

            // Análise
            let html = `<h2>Diagnóstico: ${pessoa.nome}</h2>`;

            // 1. Verificar se foi designado
            if (designacoesJaneiro.length > 0) {
                html += `<div class="status-item status-ok">
                    <strong>✅ Foi designado(a) em Janeiro</strong>
                    <p>Total de designações: ${designacoesJaneiro.length}</p>
                </div>`;
            } else {
                html += `<div class="status-item status-error">
                    <strong>❌ NÃO foi designado(a) em Janeiro</strong>
                    <p>Analisando possíveis causas...</p>
                </div>`;
            }

            // 2. Status de disponibilidade
            if (pessoa.indisponivelProximoMes) {
                html += `<div class="status-item status-error">
                    <strong>⚠️ Marcou "Não vou participar no próximo mês"</strong>
                    <p>Esta pessoa foi automaticamente excluída da geração da escala de janeiro.</p>
                    <p><strong>Solução:</strong> A pessoa precisa atualizar o cadastro desmarcando essa opção.</p>
                </div>`;
            } else {
                html += `<div class="status-item status-ok">
                    <strong>✅ Disponível para participar</strong>
                </div>`;
            }

            // 3. Frequência máxima
            const freq = pessoa.frequenciaMaxima || 0;
            if (freq === 0) {
                html += `<div class="status-item status-error">
                    <strong>⚠️ Frequência Máxima = 0</strong>
                    <p>Esta pessoa configurou que não quer participar (ou deixou em branco).</p>
                    <p><strong>Solução:</strong> Atualizar o cadastro com um número maior que 0.</p>
                </div>`;
            } else {
                html += `<div class="status-item status-ok">
                    <strong>✅ Frequência Máxima: ${freq} vezes/mês</strong>
                </div>`;
            }

            // 4. Disponibilidade de horários
            const disp = pessoa.disponibilidade || [];
            if (disp.length === 0) {
                html += `<div class="status-item status-error">
                    <strong>⚠️ Nenhuma disponibilidade cadastrada</strong>
                    <p>Esta pessoa não marcou nenhum dia/horário disponível.</p>
                    <p><strong>Solução:</strong> Atualizar o cadastro marcando os horários disponíveis.</p>
                </div>`;
            } else {
                html += `<div class="status-item status-ok">
                    <strong>✅ Disponibilidade cadastrada: ${disp.length} horários</strong>
                    <details style="margin-top: 0.5rem;">
                        <summary style="cursor: pointer;">Ver horários</summary>
                        <ul style="margin-top: 0.5rem;">
                            ${disp.slice(0, 10).map((/** @type {any} */ d) => `<li>${d}</li>`).join('')}
                            ${disp.length > 10 ? `<li>... e mais ${disp.length - 10}</li>` : ''}
                        </ul>
                    </details>
                </div>`;
            }

            // 5. Informações gerais
            html += `<div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Gênero:</div>
                    <div class="info-value">${pessoa.genero || 'Não informado'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Congregação:</div>
                    <div class="info-value">${pessoa.congregacao || 'Não informado'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Telefone:</div>
                    <div class="info-value">${pessoa.telefone || 'Não informado'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Cônjuge:</div>
                    <div class="info-value">${pessoa.conjuge || 'Não informado'}</div>
                </div>
            </div>`;

            // 6. Conclusão
            if (!pessoa.indisponivelProximoMes && freq > 0 && disp.length > 0 && designacoesJaneiro.length === 0) {
                html += `<div class="status-item status-warning" style="margin-top: 1rem;">
                    <strong>🤔 Possíveis causas adicionais:</strong>
                    <ul style="margin-top: 0.5rem;">
                        <li>Falta de dupla compatível (mesmo gênero ou cônjuge) nos horários disponíveis</li>
                        <li>Todos os horários disponíveis já estavam preenchidos quando o algoritmo chegou nesta pessoa</li>
                        <li>Os horários marcados não correspondem aos locais/turnos configurados no sistema</li>
                    </ul>
                    <p style="margin-top: 0.5rem;"><strong>Sugestão:</strong> Verifique se há outras pessoas do mesmo gênero (${pessoa.genero}) com disponibilidade nos mesmos horários.</p>
                </div>`;
            }

            resultadoDiv.innerHTML = html;
        });
    }
}
