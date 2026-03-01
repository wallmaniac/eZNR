import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyAXZE09uVhj7K2__ZH9Xpb2UkxoW2jllMQ",
    authDomain: "eznr-ee559.firebaseapp.com",
    projectId: "eznr-ee559",
    storageBucket: "eznr-ee559.firebasestorage.app",
    messagingSenderId: "757041188739",
    appId: "1:757041188739:web:765245b76119d695b4b0b6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function run() {
    try {
        const cred = await createUserWithEmailAndPassword(auth, "admin@eznr.ba", "admin123");
        console.log("✅ Created Admin in Firebase Auth:", cred.user.email, cred.user.uid);
    } catch (e) {
        console.log("Admin exists or error:", e.message);
    }

    try {
        const cred = await createUserWithEmailAndPassword(auth, "emir@merkant.ba", "officer123");
        console.log("✅ Created Officer in Firebase Auth:", cred.user.email, cred.user.uid);
    } catch (e) {
        console.log("Officer exists or error:", e.message);
    }
    process.exit(0);
}

run();
