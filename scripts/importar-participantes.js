import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do Firebase
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Função para importar APENAS NOMES
async function importarNomes() {
    try {
        // Tentar .xlsx primeiro, depois .xls
        let excelPath = path.join(__dirname, 'participantes.xlsx');

        if (!fs.existsSync(excelPath)) {
            excelPath = path.join(__dirname, 'participantes.xls');
        }

        if (!fs.existsSync(excelPath)) {
            console.error('❌ Arquivo não encontrado!');
            console.log('💡 Coloque o arquivo "participantes.xls" ou "participantes.xlsx" na pasta scripts/');
            return;
        }

        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converter para JSON
        const dados = XLSX.utils.sheet_to_json(worksheet);

        console.log(`📋 Encontrados ${dados.length} participantes no Excel\n`);

        let sucessos = 0;
        let erros = 0;
        let ignorados = 0;

        for (let i = 0; i < dados.length; i++) {
            const linha = dados[i];

            try {
                // Pegar APENAS o nome
                const nomeRaw = linha.NOME || linha.Nome || linha.nome || '';
                const nome = String(nomeRaw).trim();

                // Validar
                if (!nome || nome.length < 2) {
                    ignorados++;
                    continue;
                }

                // Objeto MÍNIMO - só nome
                const participante = {
                    nome: nome
                };

                await addDoc(collection(db, 'Pessoas'), participante);
                console.log(`✅ ${i + 1}/${dados.length} - ${participante.nome}`);
                sucessos++;

            } catch (error) {
                const nomeErro = linha.NOME || linha.Nome || linha.nome || `Linha ${i + 1}`;
                console.error(`❌ ${nomeErro}:`, error.message);
                erros++;
            }
        }

        console.log(`\n📊 Resumo da importação:`);
        console.log(`   ✅ Sucessos: ${sucessos}`);
        console.log(`   ⚠️  Ignorados: ${ignorados}`);
        console.log(`   ❌ Erros: ${erros}`);
        console.log(`   📝 Total: ${dados.length}`);
        console.log(`\n💡 Importados apenas os NOMES!`);
        console.log(`   Você pode completar telefone, congregação, etc. depois editando cada um.`);

    } catch (error) {
        console.error('❌ Erro ao importar:', error.message);
    }
}

// Executar importação
importarNomes();
