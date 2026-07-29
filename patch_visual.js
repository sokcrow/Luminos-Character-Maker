const fs = require('fs');
let content = fs.readFileSync('dm-combat-creator.html', 'utf8');

const search = `        let allGlobalSkills = {};`;

const replace = `        let allGlobalSkills = {};

        const VISUAL_DICT = {
            sins: {
                wrath: { url: "https://imgur.com/Nn33MJR.png", color: "#FF0000" },
                lust: { url: "https://imgur.com/bF7bHHT.png", color: "#FFA500" },
                sloth: { url: "https://imgur.com/igYFF1I.png", color: "#FFFF00" },
                gluttony: { url: "https://imgur.com/0KArwDU.png", color: "#008000" },
                gloom: { url: "https://imgur.com/DCTX5Jy.png", color: "#00FFFF" },
                pride: { url: "https://imgur.com/w6z9THA.png", color: "#4169E1" },
                envy: { url: "https://imgur.com/SuNHY9D.png", color: "#800080" },
                sinless: { url: "", color: "#555555" }
            },
            damage: {
                cortante: { url: "https://imgur.com/Akf25L5.png" },
                perforante: { url: "https://imgur.com/slcQlpc.png" },
                contundente: { url: "https://imgur.com/cg8Wh4w.png" }
            }
        };

        function renderSkillCard(skill) {
            const previewContainer = document.getElementById("editor-preview");

            const sinData = VISUAL_DICT.sins[skill.pecado || 'sinless'] || VISUAL_DICT.sins['sinless'];
            const dmgData = VISUAL_DICT.damage[skill.tipo_dano || 'contundente'] || VISUAL_DICT.damage['contundente'];

            const sinIconHtml = sinData.url ? \`<img src="\${sinData.url}" style="width: 45px; height: 45px; object-fit: contain;">\` : '<div style="width: 45px; height: 45px; border-radius: 50%; border: 2px dashed #888;"></div>';

            let effectsHtml = '';

            // Global Effects
            if (skill.effects && Array.isArray(skill.effects)) {
                skill.effects.forEach((eff) => {
                    const statusObj = window.STATUS_REGISTRY ? window.STATUS_REGISTRY[eff.status] : null;
                    const statusIcon = statusObj && statusObj.icon ? \`<img src="\${statusObj.icon}" style="width: 18px; height: 18px;">\` : '';
                    const statusName = statusObj ? statusObj.name : eff.status;

                    effectsHtml += \`
                        <div class="effect-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                            <div class="coin-index" style="border: 1px solid #777; border-radius: 2px; width: 22px; height: 22px; display: flex; justify-content: center; align-items: center; font-size: 0.8rem; background: #222;">G</div>
                            <span style="color: #00FF00; font-weight: bold;">\${eff.trigger}</span>
                            <span>\${eff.target === 'self' ? 'Gain' : 'Inflict'} \${eff.potency || ''}\${eff.count ? '/' + eff.count : ''}</span>
                            \${statusIcon}
                            <span style="color: #FF3333; text-decoration: underline; text-decoration-color: #770000;">\${statusName}</span>
                        </div>
                    \`;
                });
            }

            // Coin Effects
            const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
            if (skill.coins && Array.isArray(skill.coins)) {
                skill.coins.forEach((coin, index) => {
                    if (coin.effects && Array.isArray(coin.effects)) {
                        coin.effects.forEach((eff) => {
                            const statusObj = window.STATUS_REGISTRY ? window.STATUS_REGISTRY[eff.status] : null;
                            const statusIcon = statusObj && statusObj.icon ? \`<img src="\${statusObj.icon}" style="width: 18px; height: 18px;">\` : '';
                            const statusName = statusObj ? statusObj.name : eff.status;

                            effectsHtml += \`
                                <div class="effect-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                                    <div class="coin-index" style="border: 1px solid #777; border-radius: 2px; width: 22px; height: 22px; display: flex; justify-content: center; align-items: center; font-size: 0.8rem; background: #222;">\${roman[index] || (index+1)}</div>
                                    <span style="color: #00FF00; font-weight: bold;">\${eff.trigger}</span>
                                    <span>\${eff.target === 'self' ? 'Gain' : 'Inflict'} \${eff.potency || ''}\${eff.count ? '/' + eff.count : ''}</span>
                                    \${statusIcon}
                                    <span style="color: #FF3333; text-decoration: underline; text-decoration-color: #770000;">\${statusName}</span>
                                </div>
                            \`;
                        });
                    }
                });
            }

            const html = \`
                <!-- Contenedor Principal (Fondo Negro Absoluto) -->
                <div class="skill-card-preview" style="background-color: #000; color: #fff; display: flex; gap: 20px; padding: 15px; font-family: 'Courier New', Courier, monospace; border: 1px solid #333;">

                    <!-- Columna Izquierda: Geometría y Poder Base -->
                    <div class="skill-left" style="display: flex; flex-direction: column; align-items: center; min-width: 100px;">
                        <!-- Heptágono de Pecado -->
                        <div class="sin-container" style="width: 80px; height: 80px; background-color: #000; border: 4px solid \${sinData.color}; clip-path: polygon(50% 100%, 0 75%, 0 25%, 50% 0, 100% 25%, 100% 75%); display: flex; justify-content: center; align-items: center;">
                            \${sinIconHtml}
                        </div>
                        <!-- Valores de Moneda -->
                        <div class="skill-power" style="margin-top: 10px; font-size: 1.3rem; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                            \${skill.basePower || 0} <span class="coin-icon" style="color: #b87333;">🌙</span> +\${skill.coinPower || 0}
                        </div>
                    </div>

                    <!-- Columna Derecha: Datos Mecánicos y Activadores -->
                    <div class="skill-right" style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1;">

                        <!-- Cabecera: Daño Cinético y Nombre (Banner Inclinado) -->
                        <div class="skill-header" style="display: flex; align-items: center; gap: 10px;">
                            <img src="\${dmgData.url}" style="width: 28px; height: 28px;" alt="\${skill.tipo_dano}">
                            <!-- Banner con corte diagonal derecho -->
                            <div class="skill-name-banner" style="background-color: \${sinData.color}; color: #000; padding: 4px 25px 4px 10px; font-weight: 900; font-size: 1.4rem; clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%); letter-spacing: 1px; text-shadow: \${sinData.color === '#FFFF00' ? '1px 1px 0px rgba(255,255,255,0.5)' : 'none'};">
                                \${skill.name || 'Unnamed Skill'}
                            </div>
                        </div>

                        <!-- Nivel, Peso y Cantidad -->
                        <div class="skill-stats" style="display: flex; gap: 15px; font-size: 1rem; color: #ccc;">
                            <span style="display: flex; align-items: center; gap: 5px;">
                                ⚔️ Base + Mod. (\${skill.scaling_stat})
                            </span>
                            <span style="color: #FFD700;">Atk Weight \${skill.weight || 1}</span>
                        </div>
                        <div class="skill-amount" style="font-weight: bold; font-size: 1.1rem;">
                            Amt. x\${skill.coinAmount || 1}
                        </div>

                        <!-- Lista de Efectos (Coin Triggers) -->
                        <div class="coin-effects-list" style="margin-top: 5px; display: flex; flex-direction: column; gap: 4px;">
                            \${effectsHtml}
                        </div>

                    </div>
                </div>
            \`;

            previewContainer.innerHTML = html;
        }`;

content = content.replace(search, replace);
fs.writeFileSync('dm-combat-creator.html', content);
