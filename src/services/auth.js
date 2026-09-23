import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

const SUPER_USER = "bivardourado@gmail.com";
const ACCESS_CONTROL_COLLECTION = "accessControl";
const ALLOWED_EMAILS_DOC = "allowedEmails";

export const AuthService = {
    /**
     * Inicia o fluxo de login com Google
     */
    async login() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            if (!user.email) {
                await this.logout();
                throw new Error("E-mail não disponível.");
            }

            const isAuthorized = await this.checkAuthorization(user.email);

            if (!isAuthorized) {
                await this.logout();
                throw new Error("E-mail não autorizado.");
            }

            return user;
        } catch (error) {
            console.error("Erro no login:", error);
            throw error;
        }
    },

    /**
     * Faz logout do usuário
     */
    async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro no logout:", error);
        }
    },

    /**
     * Verifica se o e-mail está na lista de autorizados
     * @param {string} email 
     * @returns {Promise<boolean>}
     */
    async checkAuthorization(email) {
        if (!email) {
            console.log("❌ Autorização negada: e-mail vazio");
            return false;
        }

        // Super usuário sempre tem acesso
        if (email === SUPER_USER) {
            console.log("✅ Super usuário autorizado:", email);
            return true;
        }

        try {
            const docRef = doc(db, ACCESS_CONTROL_COLLECTION, ALLOWED_EMAILS_DOC);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const allowedEmails = data.emails || [];
                console.log("📋 Lista de e-mails autorizados:", allowedEmails);

                const isAuthorized = allowedEmails.includes(email);

                if (isAuthorized) {
                    console.log("✅ E-mail autorizado:", email);
                } else {
                    console.log("❌ E-mail NÃO autorizado:", email);
                }

                return isAuthorized;
            } else {
                // Se o documento não existir, cria com o super usuário apenas
                console.log("⚠️ Documento de controle não existe. Criando com super usuário...");
                await setDoc(docRef, { emails: [SUPER_USER] });

                const isSuper = email === SUPER_USER;
                console.log(isSuper ? "✅ Super usuário autorizado" : "❌ E-mail não autorizado (documento criado)");
                return isSuper;
            }
        } catch (error) {
            console.error("❌ Erro ao verificar autorização:", error);
            return false;
        }
    },

    /**
     * Monitora o estado da autenticação
     * @param {function} callback 
     */
    onAuthStateChanged(callback) {
        return onAuthStateChanged(auth, async (user) => {
            if (user && user.email) {
                const isAuthorized = await this.checkAuthorization(user.email);
                if (isAuthorized) {
                    callback(user);
                } else {
                    await this.logout();
                    callback(null);
                }
            } else {
                callback(null);
            }
        });
    },

    // --- Gestão da Lista de E-mails (Apenas para usuários autorizados) ---

    async getAllowedEmails() {
        try {
            const docRef = doc(db, ACCESS_CONTROL_COLLECTION, ALLOWED_EMAILS_DOC);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().emails || [];
            }
            return [SUPER_USER];
        } catch (error) {
            console.error("Erro ao buscar e-mails:", error);
            return [];
        }
    },

    /**
     * @param {string} email
     */
    async addAllowedEmail(email) {
        try {
            const docRef = doc(db, ACCESS_CONTROL_COLLECTION, ALLOWED_EMAILS_DOC);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                // Documento existe, atualiza
                await updateDoc(docRef, {
                    emails: arrayUnion(email)
                });
            } else {
                // Documento não existe, cria com super usuário + novo email
                await setDoc(docRef, {
                    emails: [SUPER_USER, email]
                });
            }
        } catch (error) {
            console.error("Erro ao adicionar e-mail:", error);
            throw error;
        }
    },

    /**
     * @param {string} email
     */
    async removeAllowedEmail(email) {
        if (email === SUPER_USER) {
            throw new Error("Não é possível remover o super usuário.");
        }
        try {
            const docRef = doc(db, ACCESS_CONTROL_COLLECTION, ALLOWED_EMAILS_DOC);
            await updateDoc(docRef, {
                emails: arrayRemove(email)
            });
        } catch (error) {
            console.error("Erro ao remover e-mail:", error);
            throw error;
        }
    },

    getSuperUser() {
        return SUPER_USER;
    }
};
