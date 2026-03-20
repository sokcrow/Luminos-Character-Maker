with open('pantalla_dm.html', 'r') as f:
    content = f.read()

# Fix duplicate css links
content = content.replace('<link rel="stylesheet" href="styles/menus/dm-screen.css">\n\n<link rel="stylesheet" href="styles/menus/dm-screen.css">', '<link rel="stylesheet" href="styles/menus/dm-screen.css">')
content = content.replace('<link rel="stylesheet" href="styles/menus/dm-screen.css">\n</head>\n<body>\n\n  <link rel="stylesheet" href="styles/menus/dm-screen.css">', '<link rel="stylesheet" href="styles/menus/dm-screen.css">\n</head>\n<body>\n')

with open('pantalla_dm.html', 'w') as f:
    f.write(content)
