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
            // Retrieve associated playerId if possible, or just redirect
            // In a complete system, we'd map UID to PlayerID. For now, redirect.
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
                // Look up playerId associated with this UID to set localStorage
                db.ref('campaña/auth_mapping/' + userCredential.user.uid).once('value')
                    .then(snapshot => {
                        const playerId = snapshot.val();
                        if (playerId) {
                            localStorage.setItem('playerId', playerId);
                        }
                        redirectUser(userCredential.user);
                    })
                    .catch(err => {
                        console.error("Error fetching auth mapping", err);
                        redirectUser(userCredential.user);
                    });
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

        if (!email || !password || !rawPlayerId) {
            showError("COMPLETE TODOS LOS CAMPOS.");
            return;
        }

        const playerId = rawPlayerId.replace(/\s+/g, '');

        btnRegisterSubmit.disabled = true;
        btnRegisterSubmit.textContent = "REGISTRANDO...";

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                // Save mapping from UID to PlayerId
                db.ref('campaña/auth_mapping/' + user.uid).set(playerId)
                    .then(() => {
                        localStorage.setItem('playerId', playerId);

                        // Check if player profile exists, if not, prepare to init or redirect to creation
                        db.ref('campaña/jugadores/' + playerId).once('value').then(snapshot => {
                            if (!snapshot.exists()) {
                                // For now, we redirect to creacion_personaje or just hoja_personaje
                                // The original system redirected to creacion_personaje if localState didn't exist
                                window.location.replace('creacion_personaje.html');
                            } else {
                                redirectUser(user);
                            }
                        }).catch(err => {
                            console.error("Firebase error checking player:", err);
                            redirectUser(user);
                        });
                    })
                    .catch(err => {
                        console.error("Error saving mapping:", err);
                        showError("ERROR INTERNO AL REGISTRAR.");
                        btnRegisterSubmit.disabled = false;
                        btnRegisterSubmit.textContent = "CONFIRMAR REGISTRO";
                    });
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
