import re

with open('hoja_personaje.css', 'r') as f:
    css = f.read()

# Make sure we add styles for the missing classes:
# .shop-item-header
# .shop-item-tag
# .shop-item-description
# .shop-item-meta
# .shop-item-possession
# .shop-item-possession-label
# .shop-item-possession-value

new_css = """
.shop-item-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.shop-item-name {
    color: #fffacd;
    font-size: 20px;
    font-family: 'Mikodacs', sans-serif;
    font-weight: normal;
    text-transform: uppercase;
    text-align: left;
    margin: 0;
    line-height: 1.1;
    text-shadow: 1px 1px 2px #000;
}

.shop-item-tag {
    color: #a0a0a0;
    font-family: 'ExcelsiorSans', sans-serif;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.shop-item-description {
    color: #cccccc;
    font-family: 'ExcelsiorSans', sans-serif;
    font-size: 13px;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}

.shop-item-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
    width: 25%;
    min-width: 120px;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.3);
    border-left: 1px solid #222;
}

.shop-item-possession {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #111;
    border: 1px solid #333;
    padding: 4px 8px;
    border-radius: 2px;
}

.shop-item-possession-label {
    color: #888;
    font-family: 'ExcelsiorSans', sans-serif;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.shop-item-possession-value {
    color: #fff;
    font-family: 'Mikodacs', sans-serif;
    font-size: 16px;
}

.shop-item-tier {
    position: static;
    color: #ffd700;
    font-weight: bold;
    font-size: 18px;
    text-shadow: 0 0 5px #ff8c00, 0 0 2px #000;
    align-self: flex-end;
}
"""

css = re.sub(r'\.shop-item-name \{[^}]+\}', '', css)
css = re.sub(r'\.shop-item-tier \{[^}]+\}', '', css)

with open('hoja_personaje.css', 'w') as f:
    f.write(css + "\n" + new_css)
