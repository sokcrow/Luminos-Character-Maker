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

document.addEventListener('DOMContentLoaded', () => {
    // These IDs are mapped directly from index.html
    const loginEmailInput = document.getElementById('auth-email');
    const loginPasswordInput = document.getElementById('auth-password');
    const authPlayerIdInput = document.getElementById('auth-player-id'); // for registration

    const btnLogin = document.getElementById('btn-login'); // Iniciar Sesión button
    const btnRegisterSubmit = document.getElementById('btn-register-submit'); // Confirm Registration button

    const errorBox = document.getElementById('auth-error');

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
        } else {
            window.location.replace('hoja_personaje.html');
        }
    }

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

        auth.signInWithEmailAndPassword(email, password)
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
        const rawPlayerId = authPlayerIdInput.value.trim();

        if (!email || !password) {
            showError("INGRESE CORREO Y CONTRASEÑA.");
            return;
        }

        const playerId = rawPlayerId.replace(/\s+/g, '');

        btnRegisterSubmit.disabled = true;
        btnRegisterSubmit.textContent = "REGISTRANDO...";

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                if (user.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') {
                    redirectUser(user);
                    return;
                }

                if (playerId) {
                    // Check if legacy player profile exists
                    db.ref('campaña/jugadores/' + playerId).once('value').then(snapshot => {
                        if (snapshot.exists()) {
                            // Data exists, migrate it to the new UID node
                            const legacyData = snapshot.val();
                            db.ref('campaña/jugadores/' + user.uid).set(legacyData)
                                .then(() => {
                                    redirectUser(user);
                                })
                                .catch(err => {
                                    console.error("Error migrating player data:", err);
                                    showError("ERROR AL MIGRAR DATOS.");
                                    btnRegisterSubmit.disabled = false;
                                    btnRegisterSubmit.textContent = "CONFIRMAR REGISTRO";
                                });
                        } else {
                            // No legacy data found, initialize blank profile or redirect to creation
                            window.location.replace('creacion_personaje.html');
                        }
                    }).catch(err => {
                        console.error("Firebase error checking player:", err);
                        redirectUser(user);
                    });
                } else {
                    // New user without legacy data
                    window.location.replace('creacion_personaje.html');
                }
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
