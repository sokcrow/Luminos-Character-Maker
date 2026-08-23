from pathlib import Path

path = Path('tests/racial_trait_catalog.spec.js')
text = path.read_text(encoding='utf-8')
replacements = [
    ('test("Feline Reflexes resolves Max Speed and Evade Final Power from Proficiency", () => {', 'test("Feline Reflexes resolves Max Speed and Evade Power from Proficiency", () => {'),
    ('  expect(snapshot.modifiers.final_power).toBe(4);\n});\n\ntest("Fairy Form contributes the confirmed speed, evasion and fragility modifiers while active", () => {', '  expect(snapshot.modifiers.evade_power).toBe(4);\n  expect(snapshot.modifiers.final_power).toBe(0);\n});\n\ntest("Fairy Form contributes the confirmed speed, evasion and fragility modifiers while active", () => {'),
    ('  expect(snapshot.modifiers.final_power).toBe(2);\n  expect(snapshot.modifiers.damage_taken_multiplier).toBe(-5);', '  expect(snapshot.modifiers.evade_power).toBe(2);\n  expect(snapshot.modifiers.final_power).toBe(0);\n  expect(snapshot.modifiers.damage_taken_multiplier).toBe(-5);'),
]
for old, new in replacements:
    if new in text:
        continue
    if text.count(old) != 1:
        raise AssertionError(f'Expected one match, found {text.count(old)}: {old[:100]!r}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Defense channel expectations updated.')
