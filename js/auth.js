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
    const titleScreen = document.getElementById('title-screen');
    const loginScreen = document.getElementById('login-screen');
    const titlePrompt = document.getElementById('title-prompt');
    const btnToLogin = document.getElementById('btn-to-login');
    const btnToRegister = document.getElementById('btn-to-register');

    // Form wrappers
    const loginFormWrapper = document.getElementById('login-form-wrapper');
    const registerFormWrapper = document.getElementById('register-form-wrapper');

    // Login Form Elements
    const loginEmailInput = document.getElementById('login-email-input');
    const loginPasswordInput = document.getElementById('login-password-input');
    const btnLogin = document.getElementById('btn-login');
    const loginStatus = document.getElementById('login-status');

    // Register Form Elements
    const registerEmailInput = document.getElementById('register-email-input');
    const registerPasswordInput = document.getElementById('register-password-input');
    const registerPlayerIdInput = document.getElementById('register-player-id-input'); // Character name
    const btnRegister = document.getElementById('btn-register');
    const registerStatus = document.getElementById('register-status');

    titlePrompt.textContent = "Click para Ingresar";

    titleScreen.addEventListener('click', () => {
        titleScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginEmailInput.focus();
    });

    // Toggle between Login and Register
    btnToRegister.addEventListener('click', () => {
        loginFormWrapper.style.display = 'none';
        registerFormWrapper.style.display = 'block';
        registerEmailInput.focus();
    });

    btnToLogin.addEventListener('click', () => {
        registerFormWrapper.style.display = 'none';
        loginFormWrapper.style.display = 'block';
        loginEmailInput.focus();
    });

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

    // --- LOGIN LOGIC ---
    const handleLogin = () => {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        if (!email || !password) {
            loginStatus.textContent = "Ingrese correo y contraseña.";
            loginStatus.style.color = "red";
            return;
        }

        loginStatus.textContent = "Autenticando...";
        loginStatus.style.color = "var(--cyan-tech)";
        btnLogin.disabled = true;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                loginStatus.textContent = "Acceso concedido. Redirigiendo...";
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
                loginStatus.style.color = "red";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    loginStatus.textContent = "Credenciales incorrectas.";
                } else if (error.code === 'auth/invalid-email') {
                    loginStatus.textContent = "Formato de correo inválido.";
                } else {
                    loginStatus.textContent = "Error: " + error.message;
                }
                btnLogin.disabled = false;
            });
    };

    btnLogin.addEventListener('click', handleLogin);
    loginPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // Hover effect on login button
    btnLogin.addEventListener('mouseenter', () => {
        btnLogin.style.background = 'var(--gold-bright)';
        btnLogin.style.color = 'black';
    });
    btnLogin.addEventListener('mouseleave', () => {
        btnLogin.style.background = 'transparent';
        btnLogin.style.color = 'var(--gold-bright)';
    });

    // --- REGISTRATION LOGIC ---
    const handleRegister = () => {
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value;
        const rawPlayerId = registerPlayerIdInput.value.trim();

        if (!email || !password || !rawPlayerId) {
            registerStatus.textContent = "Complete todos los campos.";
            registerStatus.style.color = "red";
            return;
        }

        const playerId = rawPlayerId.replace(/\s+/g, '');

        registerStatus.textContent = "Registrando usuario...";
        registerStatus.style.color = "var(--cyan-tech)";
        btnRegister.disabled = true;

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                // Save mapping from UID to PlayerId
                db.ref('campaña/auth_mapping/' + user.uid).set(playerId)
                    .then(() => {
                        localStorage.setItem('playerId', playerId);

                        // Check if player profile exists, if not, prepare to init or redirect to creation
                        db.ref('campaña/jugadores/' + playerId).once('value').then(snapshot => {
                            registerStatus.textContent = "Registro exitoso. Redirigiendo...";
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
                        registerStatus.textContent = "Error interno al registrar.";
                        registerStatus.style.color = "red";
                        btnRegister.disabled = false;
                    });
            })
            .catch((error) => {
                console.error("Registration error:", error);
                registerStatus.style.color = "red";
                if (error.code === 'auth/email-already-in-use') {
                    registerStatus.textContent = "El correo ya está en uso.";
                } else if (error.code === 'auth/weak-password') {
                    registerStatus.textContent = "La contraseña debe tener al menos 6 caracteres.";
                } else if (error.code === 'auth/invalid-email') {
                    registerStatus.textContent = "Formato de correo inválido.";
                } else {
                    registerStatus.textContent = "Error: " + error.message;
                }
                btnRegister.disabled = false;
            });
    };

    btnRegister.addEventListener('click', handleRegister);
    registerPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });

    // Hover effect on register button
    btnRegister.addEventListener('mouseenter', () => {
        btnRegister.style.background = 'var(--gold-bright)';
        btnRegister.style.color = 'black';
    });
    btnRegister.addEventListener('mouseleave', () => {
        btnRegister.style.background = 'transparent';
        btnRegister.style.color = 'var(--gold-bright)';
    });

});
