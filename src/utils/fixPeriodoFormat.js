/**
 * Script de migração para corrigir o formato do campo "periodo" nas escalas.
 * Converte "JANEIRO/2026" para "Janeiro/2026"
 * 
 * Para executar: Adicione um botão temporário no admin ou rode via console do navegador
 */

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';

/**
 * Capitaliza apenas a primeira letra de uma string
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Corrige o formato do período de "JANEIRO/2026" para "Janeiro/2026"
 */
export async function fixPeriodoFormat() {
    console.log('[FixPeriodo] Iniciando correção de formatos...');

    try {
        const escalasRef = collection(db, 'Escalas');
        const snapshot = await getDocs(escalasRef);

        let totalDocumentos = 0;
        let documentosCorrigidos = 0;
        let erros = 0;

        /** @type {Promise<void>[]} */
        const promises = [];

        snapshot.forEach((docSnap) => {
            totalDocumentos++;
            const data = docSnap.data();
            const periodoAtual = data.periodo;

            if (!periodoAtual) {
                console.warn(`[FixPeriodo] Documento ${docSnap.id} não tem campo "periodo"`);
                return;
            }

            // Verifica se está em maiúsculas ou formato incorreto
            const [mesAtual, anoAtual] = periodoAtual.split('/');

            // Se o mês estiver todo em maiúsculas, precisa corrigir
            if (mesAtual === mesAtual.toUpperCase()) {
                const mesCorrigido = capitalize(mesAtual);
                const periodoCorrigido = `${mesCorrigido}/${anoAtual}`;

                console.log(`[FixPeriodo] Corrigindo: "${periodoAtual}" → "${periodoCorrigido}"`);

                promises.push(
                    updateDoc(doc(db, 'Escalas', docSnap.id), {
                        periodo: periodoCorrigido
                    }).then(() => {
                        documentosCorrigidos++;
                        console.log(`[FixPeriodo] ✅ Documento ${docSnap.id} atualizado`);
                    }).catch((error) => {
                        erros++;
                        console.error(`[FixPeriodo] ❌ Erro ao atualizar ${docSnap.id}:`, error);
                    })
                );
            } else {
                console.log(`[FixPeriodo] ✓ Documento ${docSnap.id} já está no formato correto: "${periodoAtual}"`);
            }
        });

        // Aguarda todas as atualizações
        await Promise.all(promises);

        console.log('\n[FixPeriodo] ========== RESUMO ==========');
        console.log(`Total de documentos: ${totalDocumentos}`);
        console.log(`Documentos corrigidos: ${documentosCorrigidos}`);
        console.log(`Erros: ${erros}`);
        console.log(`Já estavam corretos: ${totalDocumentos - documentosCorrigidos - erros}`);
        console.log('[FixPeriodo] ============================\n');

        return {
            total: totalDocumentos,
            corrigidos: documentosCorrigidos,
            erros: erros,
            sucesso: erros === 0
        };

    } catch (error) {
        console.error('[FixPeriodo] Erro fatal:', error);
        throw error;
    }
}
