import re

with open('hoja_personaje.js', 'r') as f:
    content = f.read()

content = content.replace(
    '''if (data.class) {
        document.querySelectorAll(`span[name="attr_class"], input[name="attr_class"]`).forEach(el => {
            if (el.tagName === "INPUT") el.value = data.class;
            else el.innerText = data.class;
        });
    }''',
    '''if (data.class) {
        document.querySelectorAll(`span[name="attr_class"], input[name="attr_class"]`).forEach(el => {
            if (el.tagName === "INPUT") {
                if (document.activeElement !== el) el.value = data.class;
            } else el.innerText = data.class;
        });
    }'''
)

content = content.replace(
    '''if (data.race) {
        document.querySelectorAll(`span[name="attr_race"], input[name="attr_race"]`).forEach(el => {
            if (el.tagName === "INPUT") el.value = data.race;
            else el.innerText = data.race;
        });
    }''',
    '''if (data.race) {
        document.querySelectorAll(`span[name="attr_race"], input[name="attr_race"]`).forEach(el => {
            if (el.tagName === "INPUT") {
                if (document.activeElement !== el) el.value = data.race;
            } else el.innerText = data.race;
        });
    }'''
)

content = content.replace(
    '''if (data.background) {
        document.querySelectorAll(`span[name="attr_background"], input[name="attr_background"]`).forEach(el => {
            if (el.tagName === "INPUT") el.value = data.background;
            else el.innerText = data.background;
        });
    }''',
    '''if (data.background) {
        document.querySelectorAll(`span[name="attr_background"], input[name="attr_background"]`).forEach(el => {
            if (el.tagName === "INPUT") {
                if (document.activeElement !== el) el.value = data.background;
            } else el.innerText = data.background;
        });
    }'''
)

content = content.replace(
    '''if (data.identity) {
        document.querySelectorAll(`span[name="attr_identity"], input[name="attr_identity"]`).forEach(el => {
            if (el.tagName === "INPUT") el.value = data.identity;
            else el.innerText = data.identity;
        });
    }''',
    '''if (data.identity) {
        document.querySelectorAll(`span[name="attr_identity"], input[name="attr_identity"]`).forEach(el => {
            if (el.tagName === "INPUT") {
                if (document.activeElement !== el) el.value = data.identity;
            } else el.innerText = data.identity;
        });
    }'''
)

with open('hoja_personaje.js', 'w') as f:
    f.write(content)
