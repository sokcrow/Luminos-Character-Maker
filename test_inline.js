const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('pantalla_dm.html', 'utf8');
const dom = new JSDOM(html);
const scripts = dom.window.document.querySelectorAll('script');

scripts.forEach((script, index) => {
    if (script.textContent.trim()) {
        try {
            new vm.Script(script.textContent);
            console.log(`Script ${index} compiled successfully`);
        } catch (e) {
            console.error(`Script ${index} failed to compile:`, e);
            process.exit(1);
        }
    } else {
         console.log(`Script ${index} skipped (empty or external)`);
    }
});
