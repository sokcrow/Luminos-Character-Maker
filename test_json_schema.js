const example_player_node = {
  // Other properties like xp, level, ahn, etc.
  combatStats: {
    hp_max: 20,
    hp_actual: 20,
    hp_base: 10,
    hp_coefficient: 0.5,
    sp_max: 45,
    sp_actual: 45,
    ac: 14,
    speed: 30,
    initiative: 2,
    stats: {
      fuerza: { base: 10, bonus: 0 },
      destreza: { base: 14, bonus: 0 },
      constitucion: { base: 12, bonus: 0 },
      inteligencia: { base: 10, bonus: 0 },
      sabiduria: { base: 10, bonus: 0 },
      carisma: { base: 10, bonus: 0 }
    },
    combat_actions: [
      {
        id: "attack_1",
        name: "Ataque Base",
        cantidad_monedas: 1,
        valor_moneda: 4
      }
    ]
  }
};
console.log(JSON.stringify(example_player_node, null, 2));
