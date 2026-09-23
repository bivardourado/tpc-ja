/**
 * CacheService - Sistema de Cache Inteligente para Firebase
 * Reduz drasticamente o número de leituras do Firestore
 */

export class CacheService {
    /**
     * @param {number} ttlMinutes - Tempo de vida do cache em minutos (padrão: 5)
     */
    constructor(ttlMinutes = 5) {
        this.ttl = ttlMinutes * 60 * 1000; // Converte para milissegundos
        this.prefix = 'tpe_cache_';
    }

    /**
     * Gera chave única para o cache
     * @param {string} collection - Nome da coleção
     * @param {string} key - Chave adicional (opcional)
     * @returns {string}
     */
    getCacheKey(collection, key = '') {
        return `${this.prefix}${collection}${key ? '_' + key : ''}`;
    }

    /**
     * Salva dados no cache
     * @param {string} collection - Nome da coleção
     * @param {any} data - Dados para cachear
     * @param {string} key - Chave adicional (opcional)
     */
    set(collection, data, key = '') {
        try {
            const cacheKey = this.getCacheKey(collection, key);
            const cacheData = {
                data: data,
                timestamp: Date.now(),
                ttl: this.ttl
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`✅ Cache salvo: ${cacheKey}`);
        } catch (error) {
            console.warn('⚠️ Erro ao salvar cache:', error);
            // Se localStorage estiver cheio, limpa caches antigos
            this.clearExpired();
        }
    }

    /**
     * Recupera dados do cache
     * @param {string} collection - Nome da coleção
     * @param {string} key - Chave adicional (opcional)
     * @returns {any|null} - Dados do cache ou null se expirado/não existe
     */
    get(collection, key = '') {
        try {
            const cacheKey = this.getCacheKey(collection, key);
            const cached = localStorage.getItem(cacheKey);

            if (!cached) {
                console.log(`❌ Cache não encontrado: ${cacheKey}`);
                return null;
            }

            const cacheData = JSON.parse(cached);
            const now = Date.now();
            const age = now - cacheData.timestamp;

            // Verifica se o cache expirou
            if (age > cacheData.ttl) {
                console.log(`⏰ Cache expirado: ${cacheKey} (${Math.round(age / 1000)}s)`);
                localStorage.removeItem(cacheKey);
                return null;
            }

            console.log(`✅ Cache válido: ${cacheKey} (${Math.round(age / 1000)}s de ${Math.round(cacheData.ttl / 1000)}s)`);
            return cacheData.data;
        } catch (error) {
            console.warn('⚠️ Erro ao ler cache:', error);
            return null;
        }
    }

    /**
     * Invalida cache específico
     * @param {string} collection - Nome da coleção
     * @param {string} key - Chave adicional (opcional)
     */
    invalidate(collection, key = '') {
        try {
            const cacheKey = this.getCacheKey(collection, key);
            localStorage.removeItem(cacheKey);
            console.log(`🗑️ Cache invalidado: ${cacheKey}`);
        } catch (error) {
            console.warn('⚠️ Erro ao invalidar cache:', error);
        }
    }

    /**
     * Limpa todos os caches expirados
     */
    clearExpired() {
        try {
            const now = Date.now();
            const keys = Object.keys(localStorage);
            let cleared = 0;

            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(key) || '{}');
                        if (cached.timestamp && (now - cached.timestamp) > cached.ttl) {
                            localStorage.removeItem(key);
                            cleared++;
                        }
                    } catch (e) {
                        // Cache corrompido, remove
                        localStorage.removeItem(key);
                        cleared++;
                    }
                }
            });

            if (cleared > 0) {
                console.log(`🧹 ${cleared} cache(s) expirado(s) removido(s)`);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao limpar caches expirados:', error);
        }
    }

    /**
     * Limpa TODOS os caches do TPUBLI
     */
    clearAll() {
        try {
            const keys = Object.keys(localStorage);
            let cleared = 0;

            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                    cleared++;
                }
            });

            console.log(`🗑️ ${cleared} cache(s) removido(s)`);
        } catch (error) {
            console.warn('⚠️ Erro ao limpar todos os caches:', error);
        }
    }

    /**
     * Wrapper para getDocs com cache automático
     * @param {Function} getDocsFunction - Função getDocs do Firebase
     * @param {string} cacheKey - Chave única para este cache
     * @param {number} [ttlMinutes] - TTL customizado em minutos (opcional, usa padrão se não informado)
     * @returns {Promise<any>}
     */
    async cachedGetDocs(getDocsFunction, cacheKey, ttlMinutes) {
        // Usa TTL customizado ou o padrão da instância
        const customTtl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.ttl;

        // Tenta buscar do cache primeiro
        const cached = this.get('firestore', cacheKey);
        if (cached !== null) {
            console.log(`📦 Usando cache para: ${cacheKey}`);
            return cached;
        }

        // Se não tem cache, busca do Firebase
        console.log(`🔥 Buscando do Firebase: ${cacheKey}`);
        const result = await getDocsFunction();

        // Converte snapshot para array simples (serializável)
        const data = result.docs.map(/** @param {any} doc */(doc) => ({
            id: doc.id,
            ...doc.data()
        }));

        // Salva no cache com TTL customizado
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            ttl: customTtl
        };

        try {
            const fullCacheKey = this.getCacheKey('firestore', cacheKey);
            localStorage.setItem(fullCacheKey, JSON.stringify(cacheData));
            console.log(`✅ Cache salvo: ${fullCacheKey} (TTL: ${Math.round(customTtl / 60000)} min)`);
        } catch (error) {
            console.warn('⚠️ Erro ao salvar cache:', error);
            this.clearExpired();
        }

        return data;
    }
}

// Exporta instância global com TTL de 24 horas (1440 minutos)
// Ideal para sistemas onde os dados mudam raramente (escalas 1x/mês, cadastros estáveis)
export const cache = new CacheService(1440);
