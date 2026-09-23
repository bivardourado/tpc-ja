import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, updateDoc } from "firebase/firestore";
import { db } from '../services/firebase.js';

export default class LocationManager {
    /**
     * @param {string} containerId - ID do container onde o componente será renderizado
     */
    constructor(containerId) {
        this.containerId = containerId;
        /** @type {Array<{id: string, nome: string, turnos?: string[], dias?: string[], configuracao?: Object.<string, string[]>}>} */
        this.locais = [];
        /** @type {string[]} */
        this.feriados = [];
        /** @type {Record<string, number>} */
        this.stats = {};
        /** @type {string} */
        this.selectedPeriod = '';
        /** @type {string | null} */
        this.editingId = null;
        this.render();
        this.init();
    }

    async init() {
        await Promise.all([this.fetchLocais(), this.fetchCalendar(), this.fetchStats()]);
        this.renderList();
        this.renderHolidays();
    }

    render() {
        const container = document.querySelector(this.containerId);
        if (!container) {
            console.error(`Container ${this.containerId} não encontrado`);
            return;
        }

        container.innerHTML = `
      <div class="dashboard-grid grid-three-columns">
        <!-- Card 1: Adicionar/Editar Local -->
        <div class="dashboard-card">
            <h2 id="form-title">Adicionar Novo Local</h2>
            <form id="add-location-form" class="styled-form">
                <input type="hidden" id="editing-location-id">
                <div class="form-group">
                    <label for="new-location-name">Nome do Local</label>
                    <input type="text" id="new-location-name" placeholder="Ex: Portaria 3" required>
                </div>
                
                <div class="form-group">
                    <label>Configuração Semanal</label>
                    <div class="weekly-config">
                        ${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(dia => `
                            <div class="day-row">
                                <span class="day-label">${dia}</span>
                                <div class="shifts-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                                    <label><input type="checkbox" name="config_${dia}" value="Manhã 08:30-10:30" checked> 08:30-10:30</label>
                                    <label><input type="checkbox" name="config_${dia}" value="Manhã 10-12" checked> 10-12</label>
                                    <label><input type="checkbox" name="config_${dia}" value="Tarde 14-16" checked> 14-16</label>
                                    <label><input type="checkbox" name="config_${dia}" value="Tarde 16-18" checked> 16-18</label>
                                    <label><input type="checkbox" name="config_${dia}" value="Noite 18-20" checked> Noite 18-20</label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button type="submit" class="btn-primary" style="flex: 1;" id="submit-btn">Adicionar Local</button>
                    <button type="button" class="btn-secondary" id="cancel-edit-btn" style="display: none;">Cancelar</button>
                </div>
            </form>
        </div>

        <!-- Card 2: Locais Cadastrados -->
        <div class="dashboard-card">
            <h2>Locais Cadastrados</h2>
            <ul id="location-list" class="styled-list">
                <li>Carregando...</li>
            </ul>
        </div>

        <!-- Card 3: Estatísticas de Uso -->
        <div class="dashboard-card" id="stats-card-container">
            <h2>Estatísticas de Uso</h2>
            <p>Carregando...</p>
        </div>

        <!-- Card 4: Datas Bloqueadas -->
        <div class="dashboard-card">
            <h2>Datas Bloqueadas</h2>
            <p class="hint">Datas onde não haverá escala em NENHUM local.</p>
            
            <form id="add-holiday-form" class="inline-form">
                <input type="date" id="new-holiday-date" required>
                <button type="submit" class="btn-primary">Adicionar Data</button>
            </form>

            <ul id="holiday-list" class="styled-list">
                <li>Carregando...</li>
            </ul>
        </div>

      </div>
    `;

        this.bindEvents();
    }

    bindEvents() {
        // Form de Locais
        const locForm = document.querySelector('#add-location-form');
        if (locForm) {
            locForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = /** @type {HTMLInputElement} */ (document.querySelector('#new-location-name'));
                const editingIdInput = /** @type {HTMLInputElement} */ (document.getElementById('editing-location-id'));

                // Coleta a configuração por dia
                const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
                /** @type {Object.<string, string[]>} */
                const configuracao = {};
                let hasAnyShift = false;

                diasSemana.forEach(dia => {
                    const turnosSelecionados = Array.from(document.querySelectorAll(`input[name="config_${dia}"]:checked`))
                        .map(cb => /** @type {HTMLInputElement} */(cb).value);

                    if (turnosSelecionados.length > 0) {
                        configuracao[dia] = turnosSelecionados;
                        hasAnyShift = true;
                    }
                });

                if (nameInput.value.trim() && hasAnyShift) {
                    if (editingIdInput && editingIdInput.value) {
                        // Modo de edição
                        await this.updateLocal(editingIdInput.value, nameInput.value.trim(), configuracao);
                        this.cancelEdit();
                    } else {
                        // Modo de adição
                        await this.addLocal(nameInput.value.trim(), configuracao);
                        nameInput.value = '';
                        // Resetar checkboxes para o padrão (todos marcados)
                        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                             /** @type {HTMLInputElement} */(cb).checked = true;
                        });
                    }
                } else {
                    alert('Preencha o nome e selecione pelo menos um turno em algum dia.');
                }
            });
        }

        // Botão cancelar edição
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelEdit();
            });
        }

        // Lista de Locais (Edit e Delete)
        const locList = document.querySelector('#location-list');
        if (locList) {
            locList.addEventListener('click', async (e) => {
                const target = /** @type {HTMLElement} */ (e.target);

                // Botão de editar
                if (target.closest('.btn-edit')) {
                    const btn = target.closest('.btn-edit');
                    // @ts-ignore
                    const id = btn.dataset.id;
                    await this.loadLocationForEdit(id);
                }

                // Botão de excluir
                if (target.closest('.btn-delete')) {
                    const btn = target.closest('.btn-delete');
                    // @ts-ignore
                    const id = btn.dataset.id;
                    // @ts-ignore
                    const nome = btn.dataset.nome;
                    if (confirm(`Excluir o local "${nome}"?`)) {
                        await this.deleteLocal(id);
                        this.cancelEdit(); // Limpar formulário se estava editando este local
                    }
                }
            });
        }

        // Form de Feriados
        const holForm = document.querySelector('#add-holiday-form');
        if (holForm) {
            holForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const dateInput = /** @type {HTMLInputElement} */ (document.querySelector('#new-holiday-date'));
                if (dateInput.value) {
                    await this.addHoliday(dateInput.value);
                    dateInput.value = '';
                }
            });
        }

        // Lista de Feriados (Delete)
        const holList = document.querySelector('#holiday-list');
        if (holList) {
            holList.addEventListener('click', async (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                if (target.closest('.btn-delete-holiday')) {
                    const btn = target.closest('.btn-delete-holiday');
                    // @ts-ignore
                    const date = btn.dataset.date;
                    if (confirm(`Remover o feriado de ${date}?`)) {
                        await this.removeHoliday(date);
                    }
                }
            });
        }
    }

    // --- LOCAIS ---

    async fetchLocais() {
        try {
            const q = query(collection(db, "Locais"), orderBy("nome"));
            const querySnapshot = await getDocs(q);
            this.locais = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                this.locais.push({
                    id: doc.id,
                    nome: data.nome,
                    configuracao: data.configuracao || null, // Configuração detalhada por dia/turno
                    turnos: data.turnos || ['Manhã', 'Tarde', 'Noite'], // Backwards compatibility
                    dias: data.dias || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
                });
            });
            this.renderList();
        } catch (error) {
            console.error("Erro ao buscar locais:", error);
        }
    }

    renderList() {
        const list = document.querySelector('#location-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.locais.length === 0) {
            list.innerHTML = '<li class="empty-message">Nenhum local cadastrado.</li>';
            return;
        }

        this.locais.forEach(local => {
            const li = document.createElement('li');
            li.className = 'location-item';

            // Se tem configuração detalhada, extrair turnos e dias únicos
            let turnosDisplay = '';
            let diasDisplay = '';

            if (local.configuracao) {
                const todosOsTurnos = new Set();
                const diasComTurnos = Object.keys(local.configuracao);

                // Coletar todos os turnos únicos
                Object.values(local.configuracao).forEach(turnos => {
                    turnos.forEach((/** @type {string} */ turno) => todosOsTurnos.add(turno));
                });

                // Ordenar turnos na ordem correta
                const ordemTurnos = ['Manhã 08:30-10:30', 'Manhã 10-12', 'Tarde 14-16', 'Tarde 16-18', 'Noite 18-20', 'Noite', 'Manhã', 'Tarde']; // Inclui legados
                const turnosOrdenados = ordemTurnos.filter(t => todosOsTurnos.has(t));

                // Ordenar dias na ordem correta da semana
                const ordemDias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
                const diasOrdenados = ordemDias.filter(d => diasComTurnos.includes(d));

                turnosDisplay = turnosOrdenados.join(', ');
                diasDisplay = diasOrdenados.map(d => d.substring(0, 3)).join(', ');
            } else {
                // Fallback para formato antigo
                turnosDisplay = local.turnos ? local.turnos.join(', ') : 'N/A';

                // Ordenar dias no fallback também
                if (local.dias && Array.isArray(local.dias)) {
                    const ordemDias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
                    const diasOrdenados = ordemDias.filter(d => local.dias && local.dias.includes(d));
                    diasDisplay = diasOrdenados.map(d => d.substring(0, 3)).join(', ');
                } else {
                    diasDisplay = 'N/A';
                }
            }

            li.innerHTML = `
                <div class="loc-info">
                    <div class="loc-name">${local.nome}</div>
                    <div class="loc-detail">Turnos: ${turnosDisplay}</div>
                    <div class="loc-detail">Dias: ${diasDisplay}</div>
                </div>
                    <div class="action-buttons">
                        <button class="btn-edit" data-id="${local.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Editar
                        </button>
                        <button class="btn-delete" data-id="${local.id}" data-nome="${local.nome}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            Excluir
                        </button>
                    </div>
            `;
            list.appendChild(li);
        });
    }

    /**
     * @param {string} id
     */
    async loadLocationForEdit(id) {
        const local = this.locais.find(l => l.id === id);
        if (!local) return;

        this.editingId = id;

        // Atualizar título e botão
        const formTitle = document.getElementById('form-title');
        const submitBtn = document.getElementById('submit-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const editingIdInput = /** @type {HTMLInputElement} */ (document.getElementById('editing-location-id'));

        if (formTitle) formTitle.textContent = 'Editar Local';
        if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
        if (cancelBtn) cancelBtn.style.display = 'block';
        if (editingIdInput) editingIdInput.value = id;

        // Preencher nome
        const nameInput = /** @type {HTMLInputElement} */ (document.getElementById('new-location-name'));
        if (nameInput) nameInput.value = local.nome;

        // Desmarcar todos os checkboxes primeiro
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            /** @type {HTMLInputElement} */(cb).checked = false;
        });

        // Marcar apenas os configurados
        if (local.configuracao) {
            Object.entries(local.configuracao).forEach(([dia, turnos]) => {
                turnos.forEach(turno => {
                    const checkbox = /** @type {HTMLInputElement} */ (document.querySelector(`input[name="config_${dia}"][value="${turno}"]`));
                    if (checkbox) checkbox.checked = true;
                });
            });
        }

        // Scroll para o formulário
        document.getElementById('add-location-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    cancelEdit() {
        this.editingId = null;

        const formTitle = document.getElementById('form-title');
        const submitBtn = document.getElementById('submit-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const editingIdInput = /** @type {HTMLInputElement} */ (document.getElementById('editing-location-id'));
        const nameInput = /** @type {HTMLInputElement} */ (document.getElementById('new-location-name'));

        if (formTitle) formTitle.textContent = 'Adicionar Novo Local';
        if (submitBtn) submitBtn.textContent = 'Adicionar Local';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (editingIdInput) editingIdInput.value = '';
        if (nameInput) nameInput.value = '';

        // Marcar todos os checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            /** @type {HTMLInputElement} */(cb).checked = true;
        });
    }

    /**
     * @param {string} nome
     * @param {Object.<string, string[]>} configuracao
     */
    async addLocal(nome, configuracao) {
        try {
            // Extrair turnos únicos da configuração
            const todosOsTurnos = new Set();
            Object.values(configuracao).forEach(turnos => {
                turnos.forEach(turno => todosOsTurnos.add(turno));
            });

            // Ordenar turnos na ordem correta
            const ordemTurnos = ['Manhã 08:30-10:30', 'Manhã 10-12', 'Tarde 14-16', 'Tarde 16-18', 'Noite 18-20', 'Noite', 'Manhã', 'Tarde'];
            const turnosReais = ordemTurnos.filter(t => todosOsTurnos.has(t));

            await addDoc(collection(db, "Locais"), {
                nome,
                configuracao,
                // Campos legados com os turnos REAIS configurados
                turnos: turnosReais,
                dias: Object.keys(configuracao)
            });
            await this.fetchLocais();
        } catch (error) {
            console.error("Erro ao adicionar local:", error);
            alert("Erro ao adicionar local.");
        }
    }

    /**
     * @param {string} id
     * @param {string} nome
     * @param {Object.<string, string[]>} configuracao
     */
    async updateLocal(id, nome, configuracao) {
        try {
            // Extrair turnos únicos da configuração
            const todosOsTurnos = new Set();
            Object.values(configuracao).forEach(turnos => {
                turnos.forEach(turno => todosOsTurnos.add(turno));
            });

            // Ordenar turnos na ordem correta
            const ordemTurnos = ['Manhã 08:30-10:30', 'Manhã 10-12', 'Tarde 14-16', 'Tarde 16-18', 'Noite 18-20', 'Noite', 'Manhã', 'Tarde'];
            const turnosReais = ordemTurnos.filter(t => todosOsTurnos.has(t));

            await updateDoc(doc(db, "Locais", id), {
                nome,
                configuracao,
                turnos: turnosReais,
                dias: Object.keys(configuracao)
            });

            alert('✅ Local atualizado com sucesso!');
            await this.fetchLocais();
        } catch (error) {
            console.error("Erro ao atualizar local:", error);
            alert("Erro ao atualizar local.");
        }
    }

    /**
     * @param {string} id
     */
    async deleteLocal(id) {
        try {
            await deleteDoc(doc(db, "Locais", id));
            await this.fetchLocais();
        } catch (error) {
            console.error("Erro ao excluir local:", error);
        }
    }

    // --- FERIADOS ---

    async fetchCalendar() {
        try {
            const docRef = doc(db, "Config", "calendar");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                this.feriados = docSnap.data().feriados || [];
            } else {
                this.feriados = [];
            }
            this.renderHolidays();
        } catch (error) {
            console.error("Erro ao buscar calendário:", error);
        }
    }

    renderHolidays() {
        const list = document.querySelector('#holiday-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.feriados.length === 0) {
            list.innerHTML = '<li class="empty-message">Nenhuma data bloqueada.</li>';
            return;
        }

        // Ordenar datas
        const sortedDates = [...this.feriados].sort();

        sortedDates.forEach(date => {
            const li = document.createElement('li');
            li.className = 'holiday-item';
            // Formatar data para PT-BR
            const [ano, mes, dia] = date.split('-');
            const formattedDate = `${dia}/${mes}/${ano}`;

            li.innerHTML = `
                <span>${formattedDate}</span>
                <button class="btn-delete-holiday" data-date="${date}" title="Remover">✕</button>
            `;
            list.appendChild(li);
        });
    }

    /**
     * @param {string} date
     */
    async addHoliday(date) {
        if (this.feriados.includes(date)) {
            alert('Esta data já está na lista.');
            return;
        }
        try {
            const newHolidays = [...this.feriados, date];
            await setDoc(doc(db, "Config", "calendar"), { feriados: newHolidays }, { merge: true });
            this.feriados = newHolidays;
            this.renderHolidays();
        } catch (error) {
            console.error("Erro ao salvar feriado:", error);
            alert("Erro ao salvar feriado.");
        }
    }

    /**
     * @param {string} date
     */
    async removeHoliday(date) {
        try {
            const newHolidays = this.feriados.filter(d => d !== date);
            await setDoc(doc(db, "Config", "calendar"), { feriados: newHolidays }, { merge: true });
            this.feriados = newHolidays;
            this.renderHolidays();
        } catch (error) {
            console.error("Erro ao remover feriado:", error);
        }
    }
    // --- ESTATÍSTICAS ---

    async fetchStats() {
        try {
            // Se não tiver período selecionado, usa o atual
            if (!this.selectedPeriod) {
                const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const date = new Date();
                this.selectedPeriod = `${meses[date.getMonth()]}/${date.getFullYear()}`;
            }

            const q = query(collection(db, "Escalas"), where("periodo", "==", this.selectedPeriod));
            const querySnapshot = await getDocs(q);

            this.stats = {};

            if (!querySnapshot.empty) {
                const escalaData = querySnapshot.docs[0].data();
                const vagos = escalaData.vagos || [];

                vagos.forEach((/** @type {any} */ vago) => {
                    // Conta apenas se houver designação (slot preenchido)
                    if (vago.designacao) {
                        this.stats[vago.local] = (this.stats[vago.local] || 0) + 1;
                    }
                });
            }

            this.renderStatsCard();
        } catch (error) {
            console.error("Erro ao buscar estatísticas:", error);
        }
    }

    renderStatsCard() {
        const container = document.querySelector('#stats-card-container');
        if (!container) return;

        // Gerar opções de meses (Atual - 1 até Atual + 4)
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const date = new Date();
        let optionsHtml = '';

        for (let i = -1; i < 5; i++) {
            const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
            const periodo = `${meses[d.getMonth()]}/${d.getFullYear()}`;
            const selected = periodo === this.selectedPeriod ? 'selected' : '';
            optionsHtml += `<option value="${periodo}" ${selected}>${periodo}</option>`;
        }

        let statsListHtml = '';
        if (Object.keys(this.stats).length > 0) {
            // Ordenar por quantidade (decrescente)
            const sortedStats = Object.entries(this.stats).sort((a, b) => b[1] - a[1]);

            statsListHtml = `<ul class="styled-list">`;
            sortedStats.forEach(([local, count]) => {
                statsListHtml += `
                    <li class="location-item">
                        <div class="loc-info">
                            <div class="loc-name">${local}</div>
                        </div>
                        <div class="loc-detail" style="font-size: 1.1rem; font-weight: bold; color: var(--primary-color);">
                            ${count} designações
                        </div>
                    </li>
                `;
            });
            statsListHtml += `</ul>`;
        } else {
            statsListHtml = '<p class="empty-message">Nenhuma escala encontrada ou designação feita para este período.</p>';
        }

        container.innerHTML = `
            <h2>Estatísticas de Uso</h2>
            <div class="form-group" style="margin-bottom: 1rem;">
                <label for="stats-period-select">Período</label>
                <select id="stats-period-select">
                    ${optionsHtml}
                </select>
            </div>
            ${statsListHtml}
        `;

        // Bind do select
        const select = container.querySelector('#stats-period-select');
        if (select) {
            select.addEventListener('change', (e) => {
                // @ts-ignore
                this.selectedPeriod = e.target.value;
                this.fetchStats();
            });
        }
    }
}
