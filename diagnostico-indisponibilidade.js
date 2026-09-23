// Script de diagnóstico para verificar participantes indisponíveis
// Cole este código no console do navegador (F12) quando estiver na página do sistema

import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase.js';

async function diagnosticarIndisponibilidade() {
    console.log('🔍 DIAGNÓSTICO DE INDISPONIBILIDADE\n');
    console.log('='.repeat(60));

    const pessoasSnap = await getDocs(collection(db, 'Pessoas'));
    const todasPessoas = pessoasSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log(`\n📊 Total de pessoas cadastradas: ${todasPessoas.length}`);

    const indisponiveis = todasPessoas.filter(p => p.indisponivelProximoMes === true);
    const disponiveis = todasPessoas.filter(p => !p.indisponivelProximoMes);

    console.log(`✅ Disponíveis: ${disponiveis.length}`);
    console.log(`❌ Indisponíveis: ${indisponiveis.length}`);

    if (indisponiveis.length > 0) {
        console.log('\n⚠️ PESSOAS MARCADAS COMO INDISPONÍVEIS:');
        indisponiveis.forEach((p, i) => {
            console.log(`${i + 1}. ${p.nome || p.id}`);
        });
    } else {
        console.log('\n✅ Nenhuma pessoa está marcada como indisponível!');
    }

    console.log('\n' + '='.repeat(60));

    return {
        total: todasPessoas.length,
        disponiveis: disponiveis.length,
        indisponiveis: indisponiveis.length,
        nomesIndisponiveis: indisponiveis.map(p => p.nome || p.id)
    };
}

// Executar diagnóstico
diagnosticarIndisponibilidade().then(resultado => {
    console.log('\n📋 RESUMO:', resultado);
});
