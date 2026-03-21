with open('js/auth.js', 'r') as f:
    content = f.read()

# We need to remove authPlayerIdInput but KEEP the DM routing.
# Replace the authPlayerIdInput definition
content = content.replace("const authPlayerIdInput = document.getElementById('auth-player-id'); // for registration", "")

# Replace handleRegister logic entirely to be simple, but KEEP DM check
import re
new_handle_register = """
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

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                if (user.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') {
                    redirectUser(user);
                    return;
                }

                // For everyone else, just go to hoja_personaje which now handles character linking
                window.location.replace('hoja_personaje.html');
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
"""

# Find the old registration logic and replace it
content = re.sub(r'\s*// --- REGISTRATION LOGIC ---.*?};', new_handle_register, content, flags=re.DOTALL)

with open('js/auth.js', 'w') as f:
    f.write(content)
