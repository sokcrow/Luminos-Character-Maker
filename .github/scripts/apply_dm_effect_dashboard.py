from pathlib import Path
p=Path('hoja_de_DM.html')
text=p.read_text(encoding='utf-8')
old='  <script src="js/instance-control.js"></script>\n'
new='  <script src="js/instance-control.js"></script>\n  <script src="js/dm-managed-effect-engine.js"></script>\n'
if old not in text: raise SystemExit('instance-control script marker missing')
p.write_text(text.replace(old,new,1),encoding='utf-8')
print('DM effect dashboard staged')
