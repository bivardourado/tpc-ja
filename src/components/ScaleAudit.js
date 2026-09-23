import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from '../services/firebase.js';

export default class ScaleAudit {
    /**
     * @param {string} containerId - ID do container onde o componente será renderizado
     */
    constructor(containerId) {
        this.containerId = containerId;
        /** @type {any[]} */
        this.escalas = [];
        this.selectedEscala = null;
        /** @type {Record<string, any>} */
        this.participantsMap = {}; // Cache de participantes { id: dados }
        this.render();
        this.init();
    }

    async init() {
        await this.fetchParticipants();
        await this.fetchEscalas();
    }

    render() {
        const container = document.querySelector(this.containerId);
        if (!container) return;

        container.innerHTML = `
      <div class="audit-container">
        <h2>🛡️ Auditoria de Escala</h2>
        <p class="subtitle">Verifique se todos os participantes foram alocados conforme a disponibilidade cadastrada.</p>
        
        <div class="audit-controls">
          <label for="audit-scale-select">Selecione a Escala para Auditar:</label>
          <select id="audit-scale-select" class="form-select">
            <option value="">Carregando escalas...</option>
          </select>
          <button id="btn-run-audit" class="btn-primary" disabled>
            🔍 Executar Auditoria
          </button>
        </div>

        <div id="audit-results" class="audit-results" style="display:none;">
          <div class="summary-cards">
            <div class="card info">
              <h3>👥 Cadastrados</h3>
              <span id="count-total">0</span>
            </div>
            <div class="card warning">
              <h3>📅 Na Escala</h3>
              <span id="count-allocated">0</span>
            </div>
            <div class="card success">
              <h3>✅ Válidos</h3>
              <span id="count-valid">0</span>
            </div>
            <div class="card error">
              <h3>❌ Conflitos</h3>
              <span id="count-error">0</span>
            </div>
          </div>

          <div class="table-responsive">
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Participante</th>
                  <th>Designação (Dia/Hora)</th>
                  <th>Slot Calculado</th>
                  <th>Disponibilidade Informada</th>
                  <th>Disponibilidade Informada</th>
                  <th>Designações na Escala</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="audit-table-body">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

        // Bind inputs
        const select = /** @type {HTMLSelectElement} */ (document.getElementById('audit-scale-select'));
        const btn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-run-audit'));

        if (select && btn) {
            select.addEventListener('change', (e) => {
                const target = /** @type {HTMLSelectElement} */ (e.target);
                const id = target.value;
                if (id) {
                    this.selectedEscala = this.escalas.find(e => e.id === id);
                    btn.disabled = false;
                } else {
                    this.selectedEscala = null;
                    btn.disabled = true;
                }
            });

            btn.addEventListener('click', () => {
                if (this.selectedEscala) {
                    this.runAudit();
                }
            });
        }
    }

    async fetchParticipants() {
        try {
            const q = query(collection(db, "Pessoas"));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                this.participantsMap[doc.id] = { id: doc.id, ...doc.data() };
            });
            console.log(`[Audit] ${Object.keys(this.participantsMap).length} participantes carregados.`);

            const countTotalEl = document.getElementById('count-total');
            if (countTotalEl) {
                countTotalEl.innerText = String(Object.keys(this.participantsMap).length);
            }
        } catch (error) {
            console.error("Erro ao carregar participantes:", error);
            alert("Erro ao carregar dados dos participantes.");
        }
    }

    async fetchEscalas() {
        const select = document.getElementById('audit-scale-select');
        if (!select) return;

        try {
            const q = query(collection(db, "Escalas"), orderBy("dataGeracao", "desc"));
            const snapshot = await getDocs(q);

            this.escalas = [];
            select.innerHTML = '<option value="">Selecione uma escala...</option>';

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                this.escalas.push({ id: docSnap.id, ...data });

                const option = document.createElement('option');
                option.value = docSnap.id;
                const dataGeracao = data.dataGeracao?.toDate ? data.dataGeracao.toDate().toLocaleDateString() : 'Data desc.';
                option.textContent = `${data.periodo} (Gerada em: ${dataGeracao})`;
                select.appendChild(option);
            });

        } catch (error) {
            console.error("Erro ao carregar escalas:", error);
            select.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    runAudit() {
        const resultsContainer = document.getElementById('audit-results');
        const tbody = document.getElementById('audit-table-body');
        const countValidEl = document.getElementById('count-valid');
        const countErrorEl = document.getElementById('count-error');
        const countAllocatedEl = document.getElementById('count-allocated');

        if (!tbody || !resultsContainer) return;

        tbody.innerHTML = '';
        resultsContainer.style.display = 'block';

        const escala = this.selectedEscala;
        if (!escala || !escala.vagos) return;

        let validCount = 0;
        let errorCount = 0;
        /** @type {Set<string>} */
        const participantsInScale = new Set();

        // Helper para mapear dias
        const diasSafe = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

        // Pré-processamento: Mapear todas as designações de cada pessoa nesta escala
        /** @type {Record<string, string[]>} */
        const personAssignments = {};
        escala.vagos.forEach((/** @type {any} */ v) => {
            if (!v.designacao) return;
            const [, m, d] = v.data.split('-').map(Number);
            const dateStr = `${d}/${m}`;
            const entry = `${dateStr} ${v.hora}`;

            const addAssingment = (/** @type {any} */ p) => {
                if (!personAssignments[p.id]) personAssignments[p.id] = [];
                personAssignments[p.id].push(entry);
            };

            if (v.designacao.pessoa1) addAssingment(v.designacao.pessoa1);
            if (v.designacao.pessoa2) addAssingment(v.designacao.pessoa2);
        });

        escala.vagos.forEach((/** @type {any} */ vago, /** @type {number} */ index) => {
            if (!vago.designacao) return; // Slot vazio não precisa auditar

            const listaPessoas = [];
            if (vago.designacao.pessoa1) {
                listaPessoas.push(vago.designacao.pessoa1);
                participantsInScale.add(vago.designacao.pessoa1.id);
            }
            if (vago.designacao.pessoa2) {
                listaPessoas.push(vago.designacao.pessoa2);
                participantsInScale.add(vago.designacao.pessoa2.id);
            }

            // Calcular Slot Key do Vago
            // Parse manual da data
            const [ano, mes, dia] = vago.data.split('-').map(Number);
            const dataObj = new Date(ano, mes - 1, dia);
            const diaIndex = dataObj.getDay();
            const diaCurto = diasSafe[diaIndex];
            const turnoNormalizado = vago.hora.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const slotKey = `${diaCurto}-${turnoNormalizado}`;

            listaPessoas.forEach(/** @type {any} */ pessoaDesignada => {
                const pessoaDb = this.participantsMap[pessoaDesignada.id];

                // Se não encontrar no banco (foi excluído?), consideramos erro ou aviso.
                if (!pessoaDb) {
                    this.addResultRow(tbody, '?', pessoaDesignada.nome, vago, slotKey, 'Participante excluído do banco?', '', true, index); // Pass index and isError=true
                    errorCount++;
                    return;
                }

                const disponibilidade = pessoaDb.disponibilidade || [];
                const isValid = disponibilidade.includes(slotKey);

                // Buscar histórico de designações desta pessoa na escala
                const designacoesTotais = personAssignments[pessoaDesignada.id] ? personAssignments[pessoaDesignada.id].join(', ') : '';

                if (isValid) {
                    validCount++;
                    this.addResultRow(tbody, '✅', pessoaDb.nome, vago, slotKey, disponibilidade.join(', '), designacoesTotais);
                } else {
                    errorCount++;
                    this.addResultRow(tbody, '❌', pessoaDb.nome, vago, slotKey, disponibilidade.join(', '), designacoesTotais, true, index);
                }
            });
        });

        if (countAllocatedEl) {
            countAllocatedEl.innerText = String(participantsInScale.size);
        }

        if (countValidEl) {
            countValidEl.innerText = String(validCount);
            countValidEl.className = 'text-success';
        }
        if (countErrorEl) {
            countErrorEl.innerText = String(errorCount);
            countErrorEl.className = errorCount > 0 ? 'text-danger blinking' : 'text-muted';
        }

        // Ordenar tabela para erros primeiro
        this.sortAuditTable();
    }

    /**
    * @param {HTMLElement} tbody
    * @param {string} icon
    * @param {string} nome
    * @param {any} vago
    * @param {string} slotKey
    * @param {string} disponibilidadeStr
    * @param {string} designacoesStr
    * @param {number} [vagoIndex]
    */
    addResultRow(tbody, icon, nome, vago, slotKey, disponibilidadeStr, designacoesStr, isError = false, vagoIndex = undefined) {
        if (!tbody) return;
        const row = document.createElement('tr');
        if (isError) row.classList.add('error-row');

        // Formatar data
        const [ano, mes, dia] = vago.data.split('-').map(Number);
        const dataFmt = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR');

        row.innerHTML = `
        <td class="status-cell">${icon}</td>
        <td><strong>${nome}</strong></td>
        <td>${dataFmt} - ${vago.hora} <br><small>${vago.local}</small></td>
        <td><code>${slotKey}</code></td>
        <td class="disp-cell"><div class="disp-scroll">${disponibilidadeStr}</div></td>
        <td class="disp-cell"><div class="disp-scroll">${designacoesStr}</div></td>
        <td>
            ${isError && typeof vagoIndex === 'number' ? `
                <button class="btn-clean-slot" title="Remover esta designação da escala">
                    🗑️ Limpar
                </button>
            ` : ''}
        </td>
    `;

        // Bind click event
        const btn = row.querySelector('.btn-clean-slot');
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof vagoIndex === 'number') {
                    this.limparVaga(vagoIndex);
                }
            });
        }

        tbody.appendChild(row);
    }

    /**
     * Remove a designação de um vago específico
     * @param {number} index 
     */
    async limparVaga(index) {
        if (!this.selectedEscala || typeof index !== 'number') return;

        if (!confirm('⚠️ Tem certeza? Isso removerá a dupla inteira deste horário na escala.\n\nUse isso para corrigir conflitos ou remover participantes excluídos.')) {
            return;
        }

        try {
            // Atualiza localmente
            const novaListaVagos = [...this.selectedEscala.vagos];
            novaListaVagos[index].designacao = null;

            // Atualiza no Firebase
            const escalaRef = doc(db, "Escalas", this.selectedEscala.id);
            await updateDoc(escalaRef, { vagos: novaListaVagos });

            alert('✅ Vaga limpa com sucesso!');

            // Recarrega a auditoria
            this.selectedEscala.vagos = novaListaVagos; // Update local state immediately
            this.runAudit();

        } catch (error) {
            console.error("Erro ao limpar vaga:", error);
            alert("Erro ao atualizar a escala.");
        }
    }

    sortAuditTable() {
        const tbody = document.getElementById('audit-table-body');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
            const isErrorA = a.classList.contains('error-row');
            const isErrorB = b.classList.contains('error-row');
            return (isErrorB ? 1 : 0) - (isErrorA ? 1 : 0); // Erros primeiro
        });

        rows.forEach(row => tbody.appendChild(row));
    }
}
