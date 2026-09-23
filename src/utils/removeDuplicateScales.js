/**
 * Script para deletar escalas duplicadas.
 * Mantém apenas a mais recente de cada período.
 */

import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';

/**
 * Remove escalas duplicadas, mantendo apenas a mais recente de cada período
 */
export async function removeDuplicateScales() {
    console.log('[RemoveDuplicates] Iniciando limpeza de duplicatas...');

    try {
        const escalasRef = collection(db, 'Escalas');
        const snapshot = await getDocs(escalasRef);

        /** @type {Record<string, Array<{id: string, dataGeracao: Date}>>} */
        const escalasAgrupadas = {};

        // Agrupa escalas por período
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const periodo = data.periodo;

            if (!periodo) {
                console.warn(`[RemoveDuplicates] Documento ${docSnap.id} sem período`);
                return;
            }

            if (!escalasAgrupadas[periodo]) {
                escalasAgrupadas[periodo] = [];
            }

            escalasAgrupadas[periodo].push({
                id: docSnap.id,
                dataGeracao: data.dataGeracao?.toDate() || new Date(0)
            });
        });

        let totalDuplicatas = 0;
        let totalDeletados = 0;
        let erros = 0;

        /** @type {Promise<void>[]} */
        const promises = [];

        // Para cada período, mantém apenas o mais recente
        Object.entries(escalasAgrupadas).forEach(([periodo, escalas]) => {
            if (escalas.length > 1) {
                console.log(`[RemoveDuplicates] Período "${periodo}" tem ${escalas.length} duplicatas`);
                totalDuplicatas += escalas.length - 1;

                // Ordena por data de geração (mais recente primeiro)
                escalas.sort((a, b) => b.dataGeracao.getTime() - a.dataGeracao.getTime());

                // Mantém o primeiro (mais recente), deleta o resto
                const [maisRecente, ...paraRemover] = escalas;

                console.log(`[RemoveDuplicates] Mantendo: ${maisRecente.id} (${maisRecente.dataGeracao.toISOString()})`);

                paraRemover.forEach(escala => {
                    console.log(`[RemoveDuplicates] Deletando: ${escala.id} (${escala.dataGeracao.toISOString()})`);

                    promises.push(
                        deleteDoc(doc(db, 'Escalas', escala.id))
                            .then(() => {
                                totalDeletados++;
                                console.log(`[RemoveDuplicates] ✅ Deletado: ${escala.id}`);
                            })
                            .catch((error) => {
                                erros++;
                                console.error(`[RemoveDuplicates] ❌ Erro ao deletar ${escala.id}:`, error);
                            })
                    );
                });
            }
        });

        // Aguarda todas as deleções
        await Promise.all(promises);

        console.log('\n[RemoveDuplicates] ========== RESUMO ==========');
        console.log(`Total de períodos: ${Object.keys(escalasAgrupadas).length}`);
        console.log(`Duplicatas encontradas: ${totalDuplicatas}`);
        console.log(`Documentos deletados: ${totalDeletados}`);
        console.log(`Erros: ${erros}`);
        console.log('[RemoveDuplicates] ============================\n');

        return {
            periodos: Object.keys(escalasAgrupadas).length,
            duplicatas: totalDuplicatas,
            deletados: totalDeletados,
            erros: erros,
            sucesso: erros === 0
        };

    } catch (error) {
        console.error('[RemoveDuplicates] Erro fatal:', error);
        throw error;
    }
}
