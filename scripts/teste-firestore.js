import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

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

// Teste MUITO simples
async function testarFirestore() {
    try {
        console.log('🧪 Teste MÍNIMO...\n');

        const teste = {
            nome: 'Teste',
            telefone: '87999999999'
        };

        console.log('Salvando em coleção "teste_import"...');
        const docRef = await addDoc(collection(db, 'teste_import'), teste);
        console.log('✅ SUCESSO! ID:', docRef.id);

    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error('Código:', error.code);
    }
}

testarFirestore();
