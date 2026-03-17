with open("test_theatre_continuous.spec.js", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "await page.evaluate(async () => {" in line:
        # We need to wait for firebase to load before evaluate
        new_lines.append("        await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);\n")
        new_lines.append(line)
    elif "await page.click('#btn-theatre-avanzar');" in line:
        new_lines.append("        // Make sure continuous mode is active visually and internally\n")
        new_lines.append("        await page.locator('#dm-theatre-continuous').check();\n")
        new_lines.append(line)
    else:
        new_lines.append(line)

with open("test_theatre_continuous.spec.js", "w") as f:
    f.writelines(new_lines)
