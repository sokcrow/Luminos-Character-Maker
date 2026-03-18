import re

def main():
    with open('pantalla_dm.html', 'r') as f:
        html = f.read()

    print(html.find('const perfil = data.perfil || {};'))

main()
