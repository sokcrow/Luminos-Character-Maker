const skills_template = {
    atletismo: { attribute: 'str', bonus: 0, proficient: false },
    acrobacias: { attribute: 'dex', bonus: 0, proficient: false },
    juego_de_manos: { attribute: 'dex', bonus: 0, proficient: false },
    sigilo: { attribute: 'dex', bonus: 0, proficient: false },
    arcanos: { attribute: 'int', bonus: 0, proficient: false },
    historia: { attribute: 'int', bonus: 0, proficient: false },
    investigacion: { attribute: 'int', bonus: 0, proficient: false },
    naturaleza: { attribute: 'int', bonus: 0, proficient: false },
    religion: { attribute: 'int', bonus: 0, proficient: false },
    trato_con_animales: { attribute: 'wis', bonus: 0, proficient: false },
    perspicacia: { attribute: 'wis', bonus: 0, proficient: false },
    medicina: { attribute: 'wis', bonus: 0, proficient: false },
    percepcion: { attribute: 'wis', bonus: 0, proficient: false },
    supervivencia: { attribute: 'wis', bonus: 0, proficient: false },
    engano: { attribute: 'cha', bonus: 0, proficient: false },
    intimidacion: { attribute: 'cha', bonus: 0, proficient: false },
    interpretacion: { attribute: 'cha', bonus: 0, proficient: false },
    persuasion: { attribute: 'cha', bonus: 0, proficient: false }
};

const example_player_node = {
  combatStats: {
    // ... other stats
    proficiency_bonus: 2,
    skills: skills_template
  }
};
console.log(JSON.stringify(example_player_node, null, 2));
