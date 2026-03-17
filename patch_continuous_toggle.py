import sys

def patch_file(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    out_lines = []
    in_controls_div = False

    for line in lines:
        out_lines.append(line)

        if 'id="dm-theatre-max-sprites"' in line:
            # We add our continuous toggle right after the max-sprites label
            out_lines.append('          </label>\n')
            out_lines.append('          <label style="color: #0df; font-weight: bold; display: flex; align-items: center; gap: 5px; background: #222; padding: 8px; border-radius: 4px; border: 1px solid #0df; cursor: pointer;">\n')
            out_lines.append('            <input type="checkbox" id="dm-theatre-continuous" /> MODO CONTINUO\n')
            # Note: the closing label for max-sprites is on the NEXT line in the original file, so we need to skip it or handle it.
            # Actually, looking at the previous grep:
            #           <label style="color: #0df; font-weight: bold; display: flex; align-items: center; gap: 5px; background: #222; padding: 8px; border-radius: 4px; border: 1px solid #0df;">
            #             Max Sprites:
            #             <input type="number" id="dm-theatre-max-sprites" value="4" min="1" max="10" style="width: 50px; padding: 4px; background: #111; color: #fff; border: 1px solid #444; border-radius: 4px; text-align: center;" />
            #           </label>
            pass

    # Let's do a proper search and replace
