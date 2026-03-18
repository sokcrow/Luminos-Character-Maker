with open('pantalla_dm.html', 'r') as f:
    html = f.read()

idx = html.find('const perfil = data.perfil || {};')
if idx != -1:
    print("Found! Printing context:")
    print(html[idx:idx+300])
