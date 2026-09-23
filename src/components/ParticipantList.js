import { collection, getDocs, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase.js";
import { cache } from "../services/CacheService.js";


/**
 * @typedef {Object} Participant
 * @property {string} id
 * @property {string} [nome]
 * @property {string} [email]
 * @property {string} [telefone]
 * @property {string} [genero]
 * @property {string|number} [frequenciaMaxima]
 */

export default class ParticipantList {
  /**
   * @param {string} containerId - ID do container onde a lista será renderizada
   */
  constructor(containerId) {
    this.containerId = containerId;
    /** @type {Participant[]} */
    this.participants = [];
    /** @type {Participant[]} */
    this.filteredParticipants = [];
    this.searchTerm = '';
    this.render(); // Desenha a estrutura inicial
    this.fetchParticipants(); // Carrega os dados
  }

  render() {
    const container = document.querySelector(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="search-container" style="margin-bottom: 20px;">
        <input 
          type="text" 
          id="search-participants" 
          placeholder="🔍 Buscar por nome ou telefone..." 
          style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; background: var(--card-bg); color: var(--text-primary);"
        />
      </div>
      <div id="participant-count" style="margin-bottom: 15px; padding: 10px; background: var(--card-bg); border-radius: 8px; border-left: 4px solid var(--primary-color); font-weight: 500; color: var(--text-primary);">
        Carregando...
      </div>
      <div class="table-responsive">
        <table id="participants-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Gênero</th>
              <th>Frequência Máxima</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="7">Carregando participantes...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    // Bind search event
    const searchInput = document.getElementById('search-participants');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        this.searchTerm = target.value.toLowerCase();
        this.filterParticipants();
      });
    }

    // Bind global events for the table
    const table = document.getElementById('participants-table');
    if (table) {
      table.addEventListener('click', (e) => this.handleTableClick(/** @type {MouseEvent} */(e)));
    }
  }

  async fetchParticipants() {
    try {
      // Usa cache para evitar carregar todos os participantes toda vez
      // TTL: 1 hora (60 min) - Permite ver novos cadastros mais rapidamente
      const participants = await cache.cachedGetDocs(
        async () => await getDocs(collection(db, "Pessoas")),
        'participant_list',
        60 // 1 hora
      );

      this.participants = participants;

      // Ordenar por nome alfabeticamente
      this.participants.sort((a, b) => {
        const nomeA = (a.nome || '').toLowerCase();
        const nomeB = (b.nome || '').toLowerCase();
        return nomeA.localeCompare(nomeB);
      });

      this.filteredParticipants = [...this.participants];
      this.renderRows();
    } catch (error) {
      console.error("Erro ao buscar participantes:", error);
      const tableBody = document.querySelector('#participants-table tbody');
      if (tableBody) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const userEmail = auth.currentUser ? auth.currentUser.email : 'Não autenticado';
        tableBody.innerHTML = `<tr><td colspan="7" style="color: red; padding: 20px;">
            <strong>Erro ao carregar dados:</strong> ${errorMessage}<br>
            <small>Tentando acessar como: <strong>${userEmail}</strong></small><br>
            <small>Verifique se este email tem permissão no Firebase.</small>
        </td></tr>`;
      }
    }
  }

  filterParticipants() {
    if (!this.searchTerm) {
      this.filteredParticipants = [...this.participants];
    } else {
      this.filteredParticipants = this.participants.filter(p => {
        const nome = (p.nome || '').toLowerCase();
        const telefone = (p.telefone || '').toLowerCase();
        return nome.includes(this.searchTerm) || telefone.includes(this.searchTerm);
      });

      // Manter ordenação alfabética após filtrar
      this.filteredParticipants.sort((a, b) => {
        const nomeA = (a.nome || '').toLowerCase();
        const nomeB = (b.nome || '').toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
    }
    this.renderRows();
  }

  renderRows() {
    const tableBody = document.querySelector('#participants-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (this.filteredParticipants.length === 0) {
      const message = this.searchTerm
        ? 'Nenhum participante encontrado com esse critério de busca.'
        : 'Nenhum participante encontrado.';
      tableBody.innerHTML = `<tr><td colspan="7">${message}</td></tr>`;
      this.updateParticipantCount();
      return;
    }

    this.filteredParticipants.forEach((p, index) => {
      const row = document.createElement('tr');
      row.dataset.id = p.id;
      row.innerHTML = this.getRowHTML(p, index + 1);
      tableBody.appendChild(row);
    });

    this.updateParticipantCount();
  }

  updateParticipantCount() {
    const countElement = document.getElementById('participant-count');
    if (!countElement) return;

    const totalFiltered = this.filteredParticipants.length;
    const totalAll = this.participants.length;

    if (this.searchTerm) {
      countElement.innerHTML = `📊 Mostrando <strong>${totalFiltered}</strong> de <strong>${totalAll}</strong> participantes`;
    } else {
      countElement.innerHTML = `📊 Total de participantes: <strong>${totalAll}</strong>`;
    }
  }

  /**
   * @param {Participant} p
   * @param {number} index
   */
  getRowHTML(p, index) {
    return `
      <td>${index}</td>
      <td>${p.nome || ''}</td>
      <td>${p.email || ''}</td>
      <td>${p.telefone || ''}</td>
      <td>${p.genero || ''}</td>
      <td>${p.frequenciaMaxima || ''}</td>
      <td>
        <div class="action-buttons">
            <button class="btn-edit" data-id="${p.id}" title="Editar Dados Básicos">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Editar
            </button>
            <a href="/form?id=${p.id}" class="btn-availability" title="Editar Disponibilidade" style="text-decoration: none; margin: 0 5px; font-size: 1.2rem;">📅</a>
            <button class="btn-delete" data-id="${p.id}" title="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                Excluir
            </button>
        </div>
      </td>
    `;
  }

  /**
   * @param {Participant} p
   * @param {number} index
   */
  getEditRowHTML(p, index) {
    return `
      <td>${index}</td>
      <td><input type="text" name="nome" value="${p.nome || ''}" class="edit-input"></td>
      <td><input type="email" name="email" value="${p.email || ''}" class="edit-input"></td>
      <td><input type="tel" name="telefone" value="${p.telefone || ''}" class="edit-input"></td>
      <td><input type="text" name="genero" value="${p.genero || ''}" class="edit-input" style="width: 80px;"></td>
      <td><input type="number" name="frequenciaMaxima" value="${p.frequenciaMaxima || ''}" class="edit-input" style="width: 60px;"></td>
      <td>
        <button class="btn-save" data-id="${p.id}" title="Salvar">✅</button>
        <button class="btn-cancel" data-id="${p.id}" title="Cancelar">❌</button>
      </td>
    `;
  }

  /**
   * @param {MouseEvent} e
   */
  async handleTableClick(e) {
    const target = /** @type {HTMLElement} */ (e.target);
    // Se clicou no link, deixa navegar
    if (target.closest('a')) return;

    // Se clicou no botão (ou ícone dentro dele), pega o ID do botão
    const btn = target.closest('button');
    if (!btn) return;

    const btnId = btn.dataset.id;
    if (!btnId) return;

    if (btn.classList.contains('btn-delete')) {
      if (confirm('Deseja excluir este participante?')) {
        await this.deleteParticipant(btnId);
      }
    } else if (btn.classList.contains('btn-edit')) {
      this.enableEditMode(btnId);
    } else if (btn.classList.contains('btn-save')) {
      await this.saveEdit(btnId);
    } else if (btn.classList.contains('btn-cancel')) {
      this.cancelEdit(btnId);
    }
  }

  /**
   * @param {string} id
   */
  enableEditMode(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const participant = this.participants.find(p => p.id === id);
    if (!participant) return;

    const index = this.participants.indexOf(participant) + 1;

    row.innerHTML = this.getEditRowHTML(participant, index);
  }

  /**
   * @param {string} id
   */
  cancelEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const participant = this.participants.find(p => p.id === id);
    if (!participant) return;

    const index = this.participants.indexOf(participant) + 1;

    row.innerHTML = this.getRowHTML(participant, index);
  }

  /**
   * @param {string} id
   */
  async saveEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const inputs = row.querySelectorAll('input');
    /** @type {Record<string, string>} */
    const updatedData = {};

    inputs.forEach(input => {
      updatedData[input.name] = input.value;
    });

    try {
      await setDoc(doc(db, "Pessoas", id), updatedData, { merge: true });

      // Limpa o cache globalmente após edição
      cache.clearAll();

      // Update local state
      const pIndex = this.participants.findIndex(p => p.id === id);
      if (pIndex !== -1) {
        this.participants[pIndex] = { ...this.participants[pIndex], ...updatedData };
      }

      // Re-render row
      this.cancelEdit(id); // cancelEdit effectively re-renders the read-only view with current data
    } catch (error) {
      console.error('Erro ao editar participante:', error);
      alert('Não foi possível atualizar o participante.');
    }
  }

  /**
   * @param {string} id
   */
  async deleteParticipant(id) {
    try {
      await deleteDoc(doc(db, "Pessoas", id));
      // Limpa o cache para que a lista atualize corretamente ao recarregar
      cache.clearAll();
      this.participants = this.participants.filter(p => p.id !== id);
      this.filteredParticipants = this.filteredParticipants.filter(p => p.id !== id);
      this.renderRows();
    } catch (error) {
      console.error('Erro ao excluir participante:', error);
      alert('Não foi possível excluir o participante.');
    }
  }
}