import { AuthService } from "../services/auth.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../services/firebase.js";

export default class AccessControl {
    /**
     * @param {string} containerId
     */
    constructor(containerId) {
        this.containerId = containerId;
        /** @type {string[]} */
        this.emails = [];
        this.superUser = AuthService.getSuperUser();
        this.render();
        this.init();
    }

    async init() {
        await Promise.all([
            this.fetchEmails(),
            this.fetchPasswords()
        ]);
    }

    async fetchEmails() {
        this.emails = await AuthService.getAllowedEmails();
        this.renderList();
    }

    async fetchPasswords() {
        try {
            // Senha Novo Cadastro
            const cadastroRef = doc(db, 'configuracoes', 'senhaCadastro');
            const cadastroSnap = await getDoc(cadastroRef);
            const cadastroInput = /** @type {HTMLInputElement} */ (document.getElementById('cadastro-password-input'));

            // Senha Atualização
            const atualizacaoRef = doc(db, 'configuracoes', 'senhaAtualizacao');
            const atualizacaoSnap = await getDoc(atualizacaoRef);
            const atualizacaoInput = /** @type {HTMLInputElement} */ (document.getElementById('update-password-input'));

            // Fallback para senha antiga se não existir nova
            const oldConfigRef = doc(db, 'configuracoes', 'senhaAcesso');
            const oldConfigSnap = await getDoc(oldConfigRef);
            const oldPassword = oldConfigSnap.exists() ? oldConfigSnap.data().senha : 'tpubli2026';

            if (cadastroInput) {
                cadastroInput.value = (cadastroSnap.exists() && cadastroSnap.data().senha) ? cadastroSnap.data().senha : oldPassword;
            }

            if (atualizacaoInput) {
                atualizacaoInput.value = (atualizacaoSnap.exists() && atualizacaoSnap.data().senha) ? atualizacaoSnap.data().senha : (oldConfigSnap.exists() ? oldConfigSnap.data().senha : 'tpubli2026');
            }

        } catch (error) {
            console.error('Erro ao buscar senhas:', error);
        }
    }

    render() {
        const container = document.querySelector(this.containerId);
        if (!container) return;

        container.innerHTML = `
      <div class="dashboard-grid">
        <!-- Card: Senha Novo Cadastro -->
        <div class="dashboard-card">
          <h2>🔐 Senha: Novo Cadastro</h2>
          <p class="hint">Senha para quem vai se cadastrar pela primeira vez.</p>
          <form id="cadastro-password-form" class="styled-form">
            <div class="form-group">
              <label for="cadastro-password-input">Senha Atual</label>
              <div style="display: flex; gap: 10px;">
                <input type="text" id="cadastro-password-input" placeholder="Carregando..." required style="flex: 1;">
                <button type="submit" class="btn-primary">Salvar</button>
              </div>
            </div>
          </form>
        </div>

        <!-- Card: Senha Atualização -->
        <div class="dashboard-card">
          <h2>🔄 Senha: Atualização</h2>
          <p class="hint">Senha para quem já tem cadastro e vai atualizar.</p>
          <form id="update-password-form" class="styled-form">
            <div class="form-group">
              <label for="update-password-input">Senha Atual</label>
              <div style="display: flex; gap: 10px;">
                <input type="text" id="update-password-input" placeholder="Carregando..." required style="flex: 1;">
                <button type="submit" class="btn-primary">Salvar</button>
              </div>
            </div>
          </form>
        </div>

        <!-- Card: Adicionar E-mail -->
        <div class="dashboard-card">
          <h2>Adicionar E-mail Admin</h2>
          <form id="add-email-form" class="styled-form">
            <div class="form-group" style="margin-bottom: 15px;">
              <label for="new-email">E-mail Google</label>
              <input type="email" id="new-email" placeholder="exemplo@gmail.com" required>
            </div>
            <button type="submit" class="btn-primary full-width">Autorizar Acesso</button>
          </form>
        </div>

        <!-- Card: Lista de E-mails -->
        <div class="dashboard-card full-width">
          <h2>E-mails Administradores</h2>
          <p class="hint">Usuários listados abaixo têm acesso total ao sistema administrativo.</p>
          <ul id="email-list" class="styled-list">
            <li>Carregando...</li>
          </ul>
        </div>
      </div>
    `;

        this.bindEvents();
    }

    renderList() {
        const list = document.querySelector('#email-list');
        if (!list) return;
        list.innerHTML = '';

        // Ordena: Super usuário primeiro, depois alfabético
        const sortedEmails = [...this.emails].sort((a, b) => {
            if (a === this.superUser) return -1;
            if (b === this.superUser) return 1;
            return a.localeCompare(b);
        });

        sortedEmails.forEach(email => {
            const li = document.createElement('li');
            li.className = 'email-item location-item'; // Reutilizando estilo de item de lista

            const isSuperUser = email === this.superUser;

            li.innerHTML = `
        <div class="loc-info">
          <div class="loc-name" style="${isSuperUser ? 'color: var(--primary-color);' : ''}">
            ${email} ${isSuperUser ? '(Super Usuário)' : ''}
          </div>
        </div>
        ${!isSuperUser ? `
          <button class="btn-delete btn-delete-email" data-email="${email}" title="Remover Acesso">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            Excluir
          </button>
        ` : ''}
      `;
            list.appendChild(li);
        });
    }

    bindEvents() {
        this.bindPasswordEvents();
        this.bindEmailEvents();
    }

    bindPasswordEvents() {
        // Form Cadastro
        const cadastroForm = document.getElementById('cadastro-password-form');
        if (cadastroForm) {
            cadastroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.savePassword('cadastro-password-input', 'senhaCadastro', cadastroForm);
            });
        }

        // Form Atualização
        const updateForm = document.getElementById('update-password-form');
        if (updateForm) {
            updateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.savePassword('update-password-input', 'senhaAtualizacao', updateForm);
            });
        }
    }

    /**
     * @param {string} inputId
     * @param {string} configKey
     * @param {HTMLElement} formElement
     */
    async savePassword(inputId, configKey, formElement) {
        const input = /** @type {HTMLInputElement} */ (document.getElementById(inputId));
        const btn = formElement.querySelector('button');

        if (!input || !input.value.trim()) {
            alert('Por favor, digite uma senha.');
            return;
        }

        const newPassword = input.value.trim();

        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Salvando...';
            }

            const configRef = doc(db, 'configuracoes', configKey);
            await setDoc(configRef, { senha: newPassword });

            alert('✅ Senha atualizada com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar senha:', error);
            alert('❌ Erro ao salvar a senha.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Salvar';
            }
        }
    }

    bindEmailEvents() {
        // Adicionar E-mail
        const form = document.querySelector('#add-email-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = /** @type {HTMLInputElement} */ (document.querySelector('#new-email'));

                if (input && input.value) {
                    const email = input.value.trim();
                    if (this.emails.includes(email)) {
                        alert('Este e-mail já está autorizado.');
                        return;
                    }

                    try {
                        await AuthService.addAllowedEmail(email);
                        await this.fetchEmails();
                        input.value = '';
                        alert('E-mail autorizado com sucesso!');
                    } catch (error) {
                        console.error('Erro ao autorizar e-mail:', error);
                        alert(`Erro ao autorizar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                }
            });
        }

        // Remover E-mail
        const list = document.querySelector('#email-list');
        if (list) {
            list.addEventListener('click', async (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                const btn = target.closest('.btn-delete-email');
                if (btn) {
                    // @ts-ignore
                    const email = btn.dataset.email;
                    if (confirm(`Remover o acesso de ${email}?`)) {
                        try {
                            await AuthService.removeAllowedEmail(email);
                            await this.fetchEmails();
                            alert('Acesso removido com sucesso!');
                        } catch (error) {
                            console.error('Erro ao remover acesso:', error);
                            alert(`Erro ao remover acesso: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                        }
                    }
                }
            });
        }
    }
}