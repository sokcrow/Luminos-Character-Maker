with open('pantalla_dm.html', 'r') as f:
    html = f.read()

idx = html.find('const lvl =')
print(html[idx-100:idx+400])
