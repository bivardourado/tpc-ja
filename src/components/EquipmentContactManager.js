import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from '../services/firebase.js';

export default class EquipmentContactManager {
    /**
     * @param {string} containerId - ID do container onde o componente será renderizado
     */
    constructor(containerId) {
        this.containerId = containerId;
        /** @type {Array<{id: string, nome: string, telefone: string}>} */
        this.contatos = [];
        this.render();
        this.init();
    }

    async init() {
        await this.fetchContatos();
        this.renderList();
    }

    render() {
        const container = document.querySelector(this.containerId);
        if (!container) {
            console.error(`Container ${this.containerId} não encontrado`);
            return;
        }

        container.innerHTML = `
      <div class="dashboard-card">
        <h2>Responsáveis pelo Material</h2>
        <p class="hint">Irmãos que entregam equipamentos.</p>
        
        <form id="add-contact-form" class="inline-form" style="margin-bottom: 1rem;">
          <input type="text" id="contact-name" placeholder="Nome do Irmão" required style="flex: 2;">
          <input type="tel" id="contact-phone" placeholder="(00) 00000-0000" required style="flex: 1;">
          <button type="submit" class="btn-primary">Adicionar</button>
        </form>

        <ul id="contact-list" class="styled-list">
          <li>Carregando...</li>
        </ul>
      </div>
    `;

        this.bindEvents();
    }

    bindEvents() {
        // Form de adicionar contato
        const form = document.querySelector('#add-contact-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = /** @type {HTMLInputElement} */ (document.querySelector('#contact-name'));
                const phoneInput = /** @type {HTMLInputElement} */ (document.querySelector('#contact-phone'));

                if (nameInput.value.trim() && phoneInput.value.trim()) {
                    await this.addContato(nameInput.value.trim(), phoneInput.value.trim());
                    nameInput.value = '';
                    phoneInput.value = '';
                } else {
                    alert('Preencha todos os campos.');
                }
            });
        }

        // Máscara de telefone
        const phoneInput = document.querySelector('#contact-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                const input = /** @type {HTMLInputElement} */ (e.target);
                let value = input.value.replace(/\D/g, '');

                if (value.length <= 11) {
                    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
                }

                input.value = value;
            });
        }

        // Lista de contatos (Delete)
        const list = document.querySelector('#contact-list');
        if (list) {
            list.addEventListener('click', async (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                if (target.closest('.btn-delete')) {
                    const btn = target.closest('.btn-delete');
                    // @ts-ignore
                    const id = btn.dataset.id;
                    // @ts-ignore
                    const nome = btn.dataset.nome;
                    if (confirm(`Excluir o contato "${nome}"?`)) {
                        await this.deleteContato(id);
                    }
                }
            });
        }
    }

    async fetchContatos() {
        try {
            const q = query(collection(db, "ResponsaveisMaterial"), orderBy("nome"));
            const querySnapshot = await getDocs(q);
            this.contatos = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                this.contatos.push({
                    id: doc.id,
                    nome: data.nome,
                    telefone: data.telefone
                });
            });
            this.renderList();
        } catch (error) {
            console.error("Erro ao buscar contatos:", error);
        }
    }

    renderList() {
        const list = document.querySelector('#contact-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.contatos.length === 0) {
            list.innerHTML = '<li class="empty-message">Nenhum contato cadastrado.</li>';
            return;
        }

        this.contatos.forEach(contato => {
            const li = document.createElement('li');
            li.className = 'location-item';

            li.innerHTML = `
                <div class="loc-info">
                    <div class="loc-name">${contato.nome}</div>
                    <div class="loc-detail">Tel: ${contato.telefone}</div>
                </div>
                <div class="action-buttons">
                    <button class="btn-delete" data-id="${contato.id}" data-nome="${contato.nome}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Excluir
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    /**
     * @param {string} nome
     * @param {string} telefone
     */
    async addContato(nome, telefone) {
        try {
            await addDoc(collection(db, "ResponsaveisMaterial"), {
                nome,
                telefone
            });
            await this.fetchContatos();
        } catch (error) {
            console.error("Erro ao adicionar contato:", error);
            alert("Erro ao adicionar contato.");
        }
    }

    /**
     * @param {string} id
     */
    async deleteContato(id) {
        try {
            await deleteDoc(doc(db, "ResponsaveisMaterial", id));
            await this.fetchContatos();
        } catch (error) {
            console.error("Erro ao excluir contato:", error);
        }
    }

    /**
     * Retorna a lista de contatos para uso em outros componentes
     * @returns {Array<{id: string, nome: string, telefone: string}>}
     */
    getContatos() {
        return this.contatos;
    }
}
