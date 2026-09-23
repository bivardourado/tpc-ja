import './style.css';
import './header-fullwidth.css';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';
import { db } from './services/firebase.js';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const app = document.querySelector('#app');

// Protege a rota antes de renderizar
protectRoute().then(() => {
    if (app) {
        app.innerHTML = `
            ${getHeader('importar', 'Importar Dados')}
            
            <style>
                .import-container {
                    max-width: 800px;
                    margin: 2rem auto;
                    padding: 2rem;
                }

                .import-card {
                    background: var(--surface-color);
                    border-radius: 12px;
                    padding: 2rem;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .file-input-wrapper {
                    margin: 2rem 0;
                    padding: 2rem;
                    border: 2px dashed var(--border-color);
                    border-radius: 8px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .file-input-wrapper:hover {
                    border-color: var(--primary-color);
                    background: rgba(74, 144, 226, 0.05);
                }

                .file-input-wrapper input {
                    display: none;
                }

                .progress-container {
                    margin: 2rem 0;
                    display: none;
                }

                .progress-bar {
                    width: 100%;
                    height: 30px;
                    background: var(--border-color);
                    border-radius: 15px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: var(--primary-color);
                    transition: width 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                }

                .log-container {
                    margin-top: 2rem;
                    max-height: 400px;
                    overflow-y: auto;
                    background: #f5f5f5;
                    padding: 1rem;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 0.9rem;
                    display: none;
                }

                .log-entry {
                    padding: 0.25rem 0;
                }

                .log-success {
                    color: #28a745;
                }

                .log-error {
                    color: #dc3545;
                }

                .log-warning {
                    color: #ffc107;
                }

                .log-info {
                    color: #17a2b8;
                }
            </style>

            <div class="import-container">
                <div class="import-card">
                    <h1>📊 Importar Participantes</h1>
                    <p>Importe participantes de um arquivo Excel (.xls ou .xlsx)</p>

                    <div class="file-input-wrapper" id="fileInputWrapper">
                        <input type="file" id="fileInput" accept=".xls,.xlsx">
                        <div>
                            <p style="font-size: 3rem; margin: 0;">📁</p>
                            <p><strong>Clique para selecionar arquivo</strong></p>
                            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                                Arquivo Excel com colunas: NOME, TELEFONE, CONGREGAÇÃO
                            </p>
                        </div>
                    </div>

                    <div class="progress-container" id="progressContainer">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill">0%</div>
                        </div>
                        <p id="progressText" style="text-align: center; margin-top: 1rem;"></p>
                    </div>

                    <div class="log-container" id="logContainer"></div>

                    <div style="margin-top: 2rem; text-align: center;">
                        <button class="btn-secondary" onclick="window.location.href='/admin'">
                            ← Voltar para Admin
                        </button>
                    </div>
                </div>
            </div>

            ${getFooter()}
        `;

        // Inicializa o header (dropdown e logout)
        initHeader();

        // Carregar biblioteca XLSX do CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        document.head.appendChild(script);

        script.onload = () => {
            console.log('📚 Biblioteca XLSX carregada');

            const fileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('fileInput'));
            const fileInputWrapper = document.getElementById('fileInputWrapper');
            const progressContainer = document.getElementById('progressContainer');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const logContainer = document.getElementById('logContainer');

            if (!fileInput || !fileInputWrapper || !progressContainer || !progressFill || !progressText || !logContainer) {
                console.error('Elementos da interface não encontrados.');
                return;
            }

            /**
             * Função para adicionar log
             * @param {string} message 
             * @param {string} type 
             */
            function addLog(message, type = 'info') {
                if (!logContainer) return;
                logContainer.style.display = 'block';
                const entry = document.createElement('div');
                entry.className = `log-entry log-${type}`;
                entry.textContent = message;
                logContainer.appendChild(entry);
                logContainer.scrollTop = logContainer.scrollHeight;
            }

            // Click no wrapper abre o input
            fileInputWrapper.addEventListener('click', () => {
                fileInput.click();
            });

            // Quando selecionar arquivo
            fileInput.addEventListener('change', async (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                if (!target.files || target.files.length === 0) return;

                const file = target.files[0];
                addLog(`📁 Arquivo selecionado: ${file.name}`, 'info');

                try {
                    // Ler arquivo
                    const data = await file.arrayBuffer();
                    // @ts-ignore
                    const XLSX = window.XLSX;
                    const workbook = XLSX.read(data);
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const dados = XLSX.utils.sheet_to_json(worksheet);

                    addLog(`📋 Encontrados ${dados.length} registros`, 'info');

                    // Mostrar progresso
                    progressContainer.style.display = 'block';

                    let sucessos = 0;
                    let erros = 0;
                    let ignorados = 0;

                    for (let i = 0; i < dados.length; i++) {
                        const linha = /** @type {any} */ (dados[i]);

                        try {
                            // Pegar nome
                            const nomeRaw = linha.NOME || linha.Nome || linha.nome || '';
                            const nome = String(nomeRaw).trim();

                            // Pegar telefone
                            const telefoneRaw = String(linha.TELEFONE || linha.Telefone || linha.telefone || '');
                            const telefone = telefoneRaw.replace(/\D/g, '');

                            // Pegar congregação
                            const congregacaoRaw = linha.CONGREGACAO || linha['CONGREGAÇÃO'] || linha.Congregacao || linha.Congregação || linha.congregacao || '';
                            const congregacao = String(congregacaoRaw).trim();

                            // Validar Nome (Obrigatório)
                            if (!nome || nome.length < 2) {
                                ignorados++;
                                continue;
                            }

                            // VERIFICAR DUPLICIDADE (Pelo Nome)
                            const q = query(collection(db, 'Pessoas'), where('nome', '==', nome));
                            const querySnapshot = await getDocs(q);

                            if (!querySnapshot.empty) {
                                addLog(`⚠️  ${nome} - Já cadastrado (Ignorado)`, 'warning');
                                ignorados++;
                                continue;
                            }

                            // Validar Telefone (Opcional na importação, obrigatório no site)
                            let telefoneFinal = telefone;
                            if (!telefone || telefone.length < 10) {
                                addLog(`⚠️  ${nome} - Importado sem telefone (será exigido ao atualizar)`, 'warning');
                                telefoneFinal = ''; // Salva vazio
                            }

                            // Criar participante
                            const participante = {
                                nome: nome,
                                telefone: telefoneFinal,
                                congregacao: congregacao || 'Não informada',
                                frequenciaMaxima: 1,
                                disponibilidade: [],
                                termoAceito: true,
                                dataCriacao: new Date(),
                                dataAtualizacao: new Date()
                            };

                            // Salvar no Firestore
                            await addDoc(collection(db, 'Pessoas'), participante);

                            sucessos++;
                            const percent = Math.round(((i + 1) / dados.length) * 100);
                            progressFill.style.width = `${percent}%`;
                            progressFill.textContent = `${percent}%`;
                            progressText.textContent = `${i + 1}/${dados.length} - ${nome}`;

                            if (sucessos % 10 === 0) {
                                addLog(`✅ ${sucessos} importados...`, 'success');
                            }

                        } catch (error) {
                            const err = /** @type {Error} */ (error);
                            const nomeErro = linha.NOME || linha.Nome || linha.nome || `Linha ${i + 1}`;
                            addLog(`❌ ${nomeErro}: ${err.message}`, 'error');
                            erros++;
                        }
                    }

                    // Resumo final
                    addLog(`\n📊 RESUMO DA IMPORTAÇÃO:`, 'info');
                    addLog(`✅ Sucessos: ${sucessos}`, 'success');
                    addLog(`⚠️  Ignorados: ${ignorados}`, 'warning');
                    addLog(`❌ Erros: ${erros}`, 'error');
                    addLog(`📝 Total: ${dados.length}`, 'info');

                    if (sucessos > 0) {
                        addLog(`\n🎉 Importação concluída!`, 'success');
                        addLog(`Você pode atualizar gênero, email, cônjuge, frequência e disponibilidade editando cada participante.`, 'info');
                    }

                } catch (error) {
                    const err = /** @type {Error} */ (error);
                    addLog(`❌ Erro ao processar arquivo: ${err.message}`, 'error');
                    console.error(error);
                }
            });
        };
    } else {
        console.error('Elemento #app não encontrado!');
    }
});
