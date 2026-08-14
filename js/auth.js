const firebaseConfig = {
    apiKey: "AIzaSyAIVIuKgXUsdrb9Mmss9PH7R3FpWAMG2hU",
    authDomain: "luminous-system.firebaseapp.com",
    databaseURL: "https://luminous-system-default-rtdb.firebaseio.com",
    projectId: "luminous-system",
    storageBucket: "luminous-system.firebasestorage.app",
    messagingSenderId: "330473029689",
    appId: "1:330473029689:web:44a05e870d493a3b294de8",
    measurementId: "G-X775P4YS7W"
};

// Initialize Firebase App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// --- Firebase Auth State Listener (Route Guard for Index) ---
auth.onAuthStateChanged(user => {
    if (user) {
        // Already logged in, redirect immediately
        redirectUser(user);
    }
});

function redirectUser(user) {
    if (user.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') {
        window.location.replace('pantalla_dm.html');
        return;
    }

    // Traffic Controller: Identity Search
    db.ref('campaña/jugadores/').orderByChild('uid').equalTo(user.uid).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                let matchFound = false;
                snapshot.forEach(child => {
                    const data = child.val();
                    if (data.status === 'approved') {
                        localStorage.setItem('playerId', child.key);
                        window.location.replace('hoja_personaje.html');
                        matchFound = true;
                        return true; // Stop iterating
                    } else if (data.status === 'pending') {
                        window.location.replace('vinculacion.html');
                        matchFound = true;
                        return true;
                    }
                });

                // If it exists but has no status (legacy) or didn't match pending/approved logic
                if (!matchFound) {
                    // Fallback for legacy approved characters
                    const child = Object.values(snapshot.val())[0];
                    const childKey = Object.keys(snapshot.val())[0];
                    if (child.uid === user.uid) {
                        localStorage.setItem('playerId', childKey);
                        window.location.replace('hoja_personaje.html');
                    } else {
                         window.location.replace('vinculacion.html');
                    }
                }
            } else {
                window.location.replace('vinculacion.html');
            }
        })
        .catch(error => {
            console.error("Error during identity search:", error);
            window.location.replace('vinculacion.html');
        });
}

document.addEventListener('DOMContentLoaded', () => {
    // These IDs are mapped directly from index.html
    const loginEmailInput = document.getElementById('auth-email');
    const loginPasswordInput = document.getElementById('auth-password');

    const btnLogin = document.getElementById('btn-login'); // Iniciar Sesión button
    const btnRegisterSubmit = document.getElementById('btn-register-submit'); // Confirm Registration button

    const errorBox = document.getElementById('auth-error');

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    }

    function clearError() {
        if (!errorBox) return;
        errorBox.textContent = '';
        errorBox.style.display = 'none';
    }

    // --- LOGIN LOGIC ---
    const handleLogin = () => {
        clearError();
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        if (!email || !password) {
            showError("INGRESE CORREO Y CONTRASEÑA.");
            return;
        }

        btnLogin.disabled = true;
        btnLogin.textContent = "AUTENTICANDO...";

        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                return auth.signInWithEmailAndPassword(email, password);
            })
            .then((userCredential) => {
                redirectUser(userCredential.user);
            })
            .catch((error) => {
                console.error("Login error:", error);
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    showError("CREDENCIALES INCORRECTAS.");
                } else if (error.code === 'auth/invalid-email') {
                    showError("FORMATO DE CORREO INVÁLIDO.");
                } else {
                    showError("ERROR: " + error.message);
                }
                btnLogin.disabled = false;
                btnLogin.textContent = "INICIAR SESIÓN";
            });
    };

    if (btnLogin) {
        btnLogin.addEventListener('click', handleLogin);
    }

    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (btnRegisterSubmit && btnRegisterSubmit.style.display === 'block') {
                    handleRegister();
                } else {
                    handleLogin();
                }
            }
        });
    }
    // --- REGISTRATION LOGIC ---
    const handleRegister = () => {
        clearError();
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        if (!email || !password) {
            showError("INGRESE CORREO Y CONTRASEÑA.");
            return;
        }

        btnRegisterSubmit.disabled = true;
        btnRegisterSubmit.textContent = "REGISTRANDO...";

        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                return auth.createUserWithEmailAndPassword(email, password);
            })
            .then((userCredential) => {
                const user = userCredential.user;

                if (user.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') {
                    redirectUser(user);
                    return;
                }

                // For everyone else, route through redirectUser to ensure they hit the Traffic Controller
                redirectUser(user);
            })
            .catch((error) => {
                console.error("Registration error:", error);
                if (error.code === 'auth/email-already-in-use') {
                    showError("EL CORREO YA ESTÁ EN USO.");
                } else if (error.code === 'auth/weak-password') {
                    showError("LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES.");
                } else if (error.code === 'auth/invalid-email') {
                    showError("FORMATO DE CORREO INVÁLIDO.");
                } else {
                    showError("ERROR: " + error.message);
                }
                btnRegisterSubmit.disabled = false;
                btnRegisterSubmit.textContent = "CONFIRMAR REGISTRO";
            });
    };



    if (btnRegisterSubmit) {
        btnRegisterSubmit.addEventListener('click', handleRegister);
    }

});
