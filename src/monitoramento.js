import './style.css';
import './header-fullwidth.css';
import './monitoramento.css';
import { collection, getDocs, doc, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from './services/firebase.js';
import { cache } from './services/CacheService.js';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';

class MonitoramentoRecadastramento {
    constructor() {
        this.app = document.querySelector('#app');
        this.renderLayout();

        // Elementos do DOM (após renderLayout)
        this.listContainer = /** @type {HTMLElement} */ (document.getElementById('participant-list'));
        this.loadingEl = /** @type {HTMLElement} */ (document.getElementById('loading'));
        this.searchInput = /** @type {HTMLInputElement} */ (document.getElementById('search-input'));
        this.totalCountEl = /** @type {HTMLElement} */ (document.getElementById('total-count'));
        this.updatedCountEl = /** @type {HTMLElement} */ (document.getElementById('updated-count'));
        this.pendingCountEl = /** @type {HTMLElement} */ (document.getElementById('pending-count'));
        this.adminActions = /** @type {HTMLElement} */ (document.getElementById('admin-actions'));
        this.btnIniciar = /** @type {HTMLButtonElement} */ (document.getElementById('btn-iniciar-recadastramento'));

        /** @type {Array<{id: string, nome: string, telefone: string, status: string}>} */
        this.allParticipants = [];
        this.isRecadastramentoAtivo = false;

        this.init();
    }

    renderLayout() {
        if (!this.app) return;

        this.app.innerHTML = `
            ${getHeader('monitoramento', 'Monitoramento')}

            <div class="monitor-container">
                <div class="monitor-header">
                    <h2>Monitoramento de Recadastramento</h2>
                    <div class="stats-card">
                        <div class="stat-item" id="stat-total">
                            <div class="stat-value" id="total-count">0</div>
                            <div class="stat-label">Total</div>
                        </div>
                        <div class="stat-item clickable" id="stat-updated">
                            <div class="stat-value updated" id="updated-count">0</div>
                            <div class="stat-label">Atualizados</div>
                        </div>
                        <div class="stat-item clickable" id="stat-pending">
                            <div class="stat-value pending" id="pending-count">0</div>
                            <div class="stat-label">Pendentes</div>
                        </div>
                    </div>
                </div>

                <!-- Área de Ação Admin -->
                <div id="admin-actions">
                    <h3>⚠️ Área de Controle</h3>
                    <p>
                        Esta ação irá copiar todos os nomes e telefones atuais para uma lista de controle e <strong>APAGAR</strong> todos os cadastros do sistema principal. 
                        Isso forçará todos a se recadastrarem.
                    </p>
                    <button id="btn-iniciar-recadastramento" class="action-btn danger">
                        Iniciar Processo de Recadastramento
                    </button>
                </div>

                <input type="text" id="search-input" class="search-bar" placeholder="Buscar por nome ou telefone...">

                <div id="loading" style="text-align: center; padding: 2rem;">
                    Carregando dados...
                </div>

                <div class="participant-list" id="participant-list">
                    <!-- Lista será preenchida via JS -->
                </div>

                <button id="btn-topo" class="btn-scroll-top">⬆️ Voltar ao Topo</button>
            </div>

            ${getFooter()}
        `;

        // Listener para o botão voltar ao topo
        // Adicionando um pequeno delay para garantir que o elemento foi inserido no DOM
        setTimeout(() => {
            const btnTopo = document.getElementById('btn-topo');
            if (btnTopo) {
                btnTopo.addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }
        }, 0);
    }

    async init() {
        await this.checkEstadoRecadastramento();
        this.bindEvents();
    }

    bindEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                this.filterList(target.value);
            });
        }

        if (this.btnIniciar) {
            this.btnIniciar.addEventListener('click', () => this.iniciarRecadastramento());
        }

        // Cards de estatísticas clicáveis
        const statUpdated = document.getElementById('stat-updated');
        const statPending = document.getElementById('stat-pending');

        if (statUpdated) {
            statUpdated.addEventListener('click', () => {
                const firstUpdated = document.querySelector('.participant-item.item-updated');
                if (firstUpdated) {
                    firstUpdated.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }

        if (statPending) {
            statPending.addEventListener('click', () => {
                const firstPending = document.querySelector('.participant-item.item-pending');
                if (firstPending) {
                    firstPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }

        // Inicializar eventos do header (dropdown e logout)
        initHeader();
    }

    async checkEstadoRecadastramento() {
        if (this.loadingEl) this.loadingEl.style.display = 'block';
        if (this.listContainer) this.listContainer.innerHTML = '';

        try {
            const controleSnapshot = await getDocs(collection(db, "ControleRecadastramento"));

            if (!controleSnapshot.empty) {
                this.isRecadastramentoAtivo = true;
                console.log('Modo: Recadastramento em andamento');

                const pessoasSnapshot = await getDocs(collection(db, "Pessoas"));
                const recadastradosMap = new Set(pessoasSnapshot.docs.map(d => d.data().telefone));

                this.allParticipants = controleSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const isUpdated = recadastradosMap.has(data.telefone);
                    return {
                        id: doc.id,
                        nome: data.nome,
                        telefone: data.telefone,
                        status: isUpdated ? 'updated' : 'pending'
                    };
                });

                if (this.adminActions) this.adminActions.style.display = 'none';

            } else {
                this.isRecadastramentoAtivo = false;
                console.log('Modo: Visualização Normal');

                const pessoasSnapshot = await getDocs(collection(db, "Pessoas"));
                this.allParticipants = pessoasSnapshot.docs.map(doc => ({
                    id: doc.id,
                    nome: doc.data().nome,
                    telefone: doc.data().telefone,
                    status: 'updated'
                }));

                if (this.adminActions) this.adminActions.style.display = 'block';
            }

            this.renderList();
            this.updateStats();

        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            if (this.listContainer) this.listContainer.innerHTML = '<p style="text-align:center; color:red">Erro ao carregar dados.</p>';
        } finally {
            if (this.loadingEl) this.loadingEl.style.display = 'none';
        }
    }

    /**
     * @param {Array<{id: string, nome: string, telefone: string, status: string}>} items
     */
    renderList(items = this.allParticipants) {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';

        if (items.length === 0) {
            this.listContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Nenhum registro encontrado.</div>';
            return;
        }

        items.sort((a, b) => {
            // 1. Critério: Status (Pendente vem antes de Atualizado)
            if (a.status !== b.status) {
                // Se a é pending, ele vem antes (-1). Se a é updated, ele vem depois (1).
                return a.status === 'pending' ? -1 : 1;
            }

            // 2. Critério: Nome (Ordem Alfabética)
            return a.nome.localeCompare(b.nome);
        });

        items.forEach(p => {
            const el = document.createElement('div');
            const isPendente = p.status === 'pending';
            el.className = `participant-item ${isPendente ? 'item-pending' : 'item-updated'}`;

            // Preparar link do WhatsApp
            const phoneClean = p.telefone.replace(/\D/g, '');
            const fullPhone = phoneClean.length <= 11 ? '55' + phoneClean : phoneClean;

            // Mensagem diferente dependendo do status (opcional, mas bom para lembrete)
            let textoMensagem = '';
            if (isPendente) {
                textoMensagem = `Olá *${p.nome}*, \n\nEstamos realizando o recadastramento do TPUBLI e notamos que o seu ainda está pendente.\n\nPor favor, atualize seus dados o quanto antes no link:\nhttps://tpubli.vercel.app/form\n\nObrigado!`;
            } else {
                textoMensagem = `Olá *${p.nome}*, \n\nAgradecemos por realizar seu recadastramento no TPUBLI!`;
            }

            const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(textoMensagem)}`;

            el.innerHTML = `
                <div class="participant-info">
                    <h3>${p.nome}</h3>
                    <p>📱 ${p.telefone}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <a href="${waLink}" target="_blank" class="action-btn whatsapp">
                        <span>💬</span> ${isPendente ? 'Perguntar' : 'Msg'}
                    </a>
                    <span class="status-badge ${isPendente ? 'status-pending' : 'status-updated'}">
                        ${isPendente ? '⏳ Pendente' : '✅ Atualizado'}
                    </span>
                    <button class="btn-delete-participant" data-id="${p.id}" data-nome="${p.nome}">
                        🗑️ Excluir
                    </button>
                </div>
            `;
            this.listContainer.appendChild(el);
        });

        // Vincular eventos de exclusão
        const deleteButtons = this.listContainer.querySelectorAll('.btn-delete-participant');
        deleteButtons.forEach((/** @type {Element} */ btn) => {
            btn.addEventListener('click', (/** @type {Event} */ e) => {
                e.preventDefault();
                const target = /** @type {HTMLElement} */ (e.currentTarget);
                const id = target.getAttribute('data-id');
                const nome = target.getAttribute('data-nome');
                if (id && nome) {
                    this.excluirParticipante(id, nome);
                }
            });
        });
    }

    updateStats() {
        const total = this.allParticipants.length;
        const updated = this.allParticipants.filter(p => p.status === 'updated').length;
        const pending = total - updated;

        if (this.totalCountEl) this.totalCountEl.textContent = total.toString();
        if (this.updatedCountEl) this.updatedCountEl.textContent = updated.toString();
        if (this.pendingCountEl) this.pendingCountEl.textContent = pending.toString();
    }

    /**
     * @param {string} term
     */
    filterList(term) {
        const lowerTerm = term.toLowerCase();
        const filtered = this.allParticipants.filter(p =>
            p.nome.toLowerCase().includes(lowerTerm) ||
            p.telefone.includes(term)
        );
        this.renderList(filtered);
    }

    /**
     * Exclui um participante do sistema
     * @param {string} id - ID do participante
     * @param {string} nome - Nome do participante
     */
    async excluirParticipante(id, nome) {
        if (!confirm(`⚠️ Tem certeza que deseja EXCLUIR permanentemente o cadastro de "${nome}"?\n\nEsta ação NÃO pode ser desfeita!`)) {
            return;
        }

        try {
            // Se estiver em modo de recadastramento, deleta de ControleRecadastramento
            if (this.isRecadastramentoAtivo) {
                await deleteDoc(doc(db, "ControleRecadastramento", id));
                console.log(`✅ ${nome} excluído de ControleRecadastramento`);
            } else {
                // Se não, deleta de Pessoas
                await deleteDoc(doc(db, "Pessoas", id));
                console.log(`✅ ${nome} excluído de Pessoas`);
            }

            // Limpa o cache globalmente após exclusão
            cache.clearAll();

            // Remove da lista local
            this.allParticipants = this.allParticipants.filter(p => p.id !== id);

            // Atualiza a interface
            this.renderList();
            this.updateStats();

            alert(`✅ ${nome} foi excluído com sucesso!`);

        } catch (error) {
            console.error('❌ Erro ao excluir:', error);
            alert(`❌ Erro ao excluir ${nome}. Verifique o console.`);
        }
    }

    async iniciarRecadastramento() {
        if (!confirm('⚠️ ATENÇÃO CRÍTICA ⚠️\n\nVocê está prestes a APAGAR todos os cadastros do sistema principal para iniciar um recadastramento.\n\n1. Todos os nomes e telefones atuais serão salvos numa lista de controle.\n2. O banco de dados principal será LIMPO.\n3. O sistema de escalas ficará vazio até as pessoas se recadastrarem.\n\nTem certeza absoluta que deseja continuar?')) {
            return;
        }

        const senha = prompt('Para confirmar, digite a senha de administrador (TPUBLI2025):');
        if (senha !== 'tpubli2026') {
            alert('Senha incorreta. Ação cancelada.');
            return;
        }

        if (this.loadingEl) {
            this.loadingEl.style.display = 'block';
            this.loadingEl.textContent = 'Processando migração... Por favor, aguarde.';
        }
        if (this.adminActions) this.adminActions.style.display = 'none';
        if (this.listContainer) this.listContainer.innerHTML = '';

        try {
            const pessoasSnapshot = await getDocs(collection(db, "Pessoas"));
            const totalPessoas = pessoasSnapshot.size;

            console.log(`Iniciando migração de ${totalPessoas} pessoas...`);

            const batchSize = 450;
            const chunks = [];
            const docs = pessoasSnapshot.docs;

            for (let i = 0; i < docs.length; i += batchSize) {
                chunks.push(docs.slice(i, i + batchSize));
            }

            for (const chunk of chunks) {
                const batch = writeBatch(db);

                chunk.forEach(docSnap => {
                    const data = docSnap.data();

                    const controleRef = doc(db, "ControleRecadastramento", docSnap.id);
                    batch.set(controleRef, {
                        nome: data.nome,
                        telefone: data.telefone,
                        dataMigracao: new Date()
                    });

                    const pessoaRef = doc(db, "Pessoas", docSnap.id);
                    batch.delete(pessoaRef);
                });

                await batch.commit();
                console.log('Lote processado...');
            }

            // Limpa todo o cache após a migração
            cache.clearAll();

            alert('✅ Recadastramento iniciado com sucesso!\n\nO banco principal foi limpo. Acompanhe o progresso nesta página.');
            window.location.reload();

        } catch (error) {
            console.error("Erro fatal na migração:", error);
            alert('❌ Erro ao realizar a migração. Verifique o console.');
            if (this.loadingEl) this.loadingEl.style.display = 'none';
            this.checkEstadoRecadastramento();
        }
    }
}

// Inicialização com autenticação
(async () => {
    console.log('🔐 Aguardando autenticação...');
    try {
        await protectRoute();
        console.log('✅ Autenticado! Inicializando monitoramento...');
        new MonitoramentoRecadastramento();
    } catch (error) {
        console.error('❌ Erro na autenticação:', error);
    }
})();

