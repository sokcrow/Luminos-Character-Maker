import re

with open('hoja_personaje_clean.js', 'r') as f:
    text = f.read()

# We also need to remove 'on(`' which we might have missed
def remove_on_blocks_any(text):
    idx = 0
    while True:
        idx_s = text.find("on('", idx)
        idx_d = text.find('on("', idx)
        idx_b = text.find('on(`', idx)

        possibles = [p for p in [idx_s, idx_d, idx_b] if p != -1]
        if not possibles:
            break

        idx = min(possibles)

        # Find the opening brace of the callback
        open_brace = text.find('{', idx)
        if open_brace == -1:
            idx += 1
            continue

        # Find the matching closing brace
        brace_count = 1
        i = open_brace + 1
        while i < len(text) and brace_count > 0:
            if text[i] == '{':
                brace_count += 1
            elif text[i] == '}':
                brace_count -= 1
            i += 1

        # Look for the closing parenthesis and semicolon
        close_paren = text.find(')', i)
        semi_colon = text.find(';', close_paren)
        end_block = semi_colon + 1 if semi_colon != -1 and semi_colon - close_paren < 5 else close_paren + 1

        text = text[:idx] + text[end_block:]
    return text

text = remove_on_blocks_any(text)

# Also remove everything else related to Roll20 setAttrs or helper methods that aren't used
# I will just write a whole new JS structure since we're replacing the whole logic
