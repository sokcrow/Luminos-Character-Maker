# LuminousLab

Entrada simple para ejecutar el Lab local en Android.

La carpeta se llama deliberadamente `LuminousLab` para que el launcher sea fácil de localizar dentro de cualquier ZIP extraído del branch PR777.

## Android / Termux

Desde cualquier carpeta:

```bash
SCRIPT="$(find /sdcard/Download -type f -path '*/LuminousLab/START_ANDROID.sh' -print -quit)"
bash "$SCRIPT"
```

El script no borra ZIPs, no elimina carpetas y no modifica otras extracciones. Sólo arranca el servidor que pertenece a la misma copia del repositorio y abre el navegador.
