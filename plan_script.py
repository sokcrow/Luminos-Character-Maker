with open('hoja_personaje.js', 'r') as f:
    text = f.read()

# Print snippet from the end of Shim to find the start of the next section
idx = text.find('    })();') + 9
print(text[idx:idx+1500])
