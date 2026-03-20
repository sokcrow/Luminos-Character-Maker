import re

css = open("hoja_personaje.css").read()

# 1. Hide .sheet-attr-inputs
# find exactly .sheet-attr-inputs { display: flex; justify-content: center; gap: 10px; margin-top: 10px; }
css = css.replace('.sheet-attr-inputs { display: flex; justify-content: center; gap: 10px; margin-top: 10px; }',
                  '.sheet-attr-inputs { display: none !important; justify-content: center; gap: 10px; margin-top: 10px; }')

# 2. Hide #stats-container .sheet-skill-inputs
to_find = """#stats-container .sheet-skill-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    justify-content: center;
}"""
to_replace = """#stats-container .sheet-skill-inputs {
    display: none !important;
    align-items: center;
    gap: 4px;
    flex: 1;
    justify-content: center;
}"""
css = css.replace(to_find, to_replace)

# 3. Hide #stats-container .sheet-skill-separator
to_find_sep = """#stats-container .sheet-skill-separator {
    color: #666;
    font-size: 0.9em;
}"""
to_replace_sep = """#stats-container .sheet-skill-separator {
    display: none !important;
    color: #666;
    font-size: 0.9em;
}"""
css = css.replace(to_find_sep, to_replace_sep)

with open("hoja_personaje.css", "w") as f:
    f.write(css)
