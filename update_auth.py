import re

with open('js/auth.js', 'r') as f:
    content = f.read()

# Remove authPlayerIdInput
content = re.sub(r'\s*const authPlayerIdInput = document\.getElementById\(\'auth-player-id\'\); // for registration\n', '\n', content)

# Update handleRegister
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
                redirectUser(userCredential.user);
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

content = re.sub(r'\s*// --- REGISTRATION LOGIC ---.*?};', new_handle_register, content, flags=re.DOTALL)

with open('js/auth.js', 'w') as f:
    f.write(content)
