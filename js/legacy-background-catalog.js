(function (global) {
  "use strict";

  // Exact snapshot of creacion_personaje.html's 18 legacy Background choices.
  // They are NOT interchangeable with the 158 modern Backgrounds, and their
  // bonuses were already applied to saved character modifiers during creation.
  // Keep the entries synchronized with backgroundsData in the legacy creator.
  const ENTRIES = Object.freeze([
    {
      "id": "alta_cuna",
      "name": "Alta Cuna",
      "category": "La Alta Sociedad",
      "description": "Nacido en la opulencia, educado por tutores privados y protegido de la crudeza del mundo exterior. Tu vida siempre ha estado planificada.",
      "benefit": "+1 Empatía, +1 Negociación, -1 Supervivencia",
      "initialFunds": "7,500,000 Ahn"
    },
    {
      "id": "aristocracia_mercantil",
      "name": "Aristocracia Mercantil",
      "category": "La Alta Sociedad",
      "description": "Tu linaje proviene de exitosos comerciantes. Entiendes el valor de un Ahn y cómo manipular el mercado.",
      "benefit": "+2 Negociación, +1 Engaño, -1 Vigor",
      "initialFunds": "9,000,000 Ahn"
    },
    {
      "id": "nobleza_caida",
      "name": "Nobleza Caída",
      "category": "La Alta Sociedad",
      "description": "Tu apellido alguna vez inspiró respeto, pero ahora solo quedan deudas y el recuerdo de la grandeza. Tienes que sobrevivir con tu ingenio.",
      "benefit": "+1 Presencia, +1 Sigilo",
      "initialFunds": "1,500,000 Ahn"
    },
    {
      "id": "cuna_de_eruditos",
      "name": "Cuna de Eruditos",
      "category": "La Alta Sociedad",
      "description": "Creciste rodeado de bibliotecas y laboratorios. La búsqueda del conocimiento siempre fue más importante que las relaciones sociales.",
      "benefit": "+2 Ciencia, +1 Lore, -1 Carisma",
      "initialFunds": "4,500,000 Ahn"
    },
    {
      "id": "linaje_militar",
      "name": "Linaje Militar",
      "category": "Trabajadores, Milicia y Gremios",
      "description": "Las historias antes de dormir eran sobre batallas y tácticas. Naciste para seguir órdenes y liderar escuadrones.",
      "benefit": "+1 Fortaleza, +1 Manejo",
      "initialFunds": "2,400,000 Ahn"
    },
    {
      "id": "familia_de_granjeros",
      "name": "Familia de Granjeros",
      "category": "Trabajadores, Milicia y Gremios",
      "description": "Trabajo duro bajo soles artificiales o naturales. Conoces el ciclo de la vida, la tierra y el sudor honesto.",
      "benefit": "+1 Vigor, +1 Supervivencia",
      "initialFunds": "900,000 Ahn"
    },
    {
      "id": "artesano_independiente",
      "name": "Artesano Independiente",
      "category": "Trabajadores, Milicia y Gremios",
      "description": "Manos callosas y atención al detalle. Aprendiste un oficio que te permite ganarte la vida, pero siempre al borde de la quiebra.",
      "benefit": "+1 Reflejos, +1 Análisis",
      "initialFunds": "1,800,000 Ahn"
    },
    {
      "id": "fuerzas_de_seguridad",
      "name": "Fuerzas de Seguridad (Bajas)",
      "category": "Trabajadores, Milicia y Gremios",
      "description": "La ley y el orden, o al menos la versión que imponen los de arriba. Has visto lo peor de la sociedad de cerca.",
      "benefit": "+1 Percepción, +1 Voluntad",
      "initialFunds": "2,100,000 Ahn"
    },
    {
      "id": "burocracia_menor",
      "name": "Burocracia Menor",
      "category": "Trabajadores, Milicia y Gremios",
      "description": "Sellos, formularios y la lenta muerte por aburrimiento. Eres parte de la maquinaria que mantiene el sistema girando.",
      "benefit": "+1 Memoria, +1 Prudencia",
      "initialFunds": "1,350,000 Ahn"
    },
    {
      "id": "huerfano_callejero",
      "name": "Huérfano Callejero",
      "category": "Los Bajos Fondos y Olvidados",
      "description": "Criado por las ratas y el neón parpadeante. Aprendiste a ser invisible y a tomar lo que no es tuyo para sobrevivir.",
      "benefit": "+2 Sigilo, +1 Agilidad, -1 Educación Formal (Lore)",
      "initialFunds": "150,000 Ahn"
    },
    {
      "id": "escoria_criminal",
      "name": "Escoria Criminal",
      "category": "Los Bajos Fondos y Olvidados",
      "description": "Las leyes son sugerencias; la supervivencia es mandato. Extorsión, contrabando o robos menores fueron tu escuela.",
      "benefit": "+1 Engaño, +1 Seducción",
      "initialFunds": "600,000 Ahn"
    },
    {
      "id": "exiliado_proscrito",
      "name": "Exiliado / Proscrito",
      "category": "Los Bajos Fondos y Olvidados",
      "description": "Alguien te quería muerto o lejos. Conseguiste lo segundo. Aprendiste a vivir en los márgenes de la civilización.",
      "benefit": "+2 Supervivencia, +1 Instinto, -1 Carisma",
      "initialFunds": "300,000 Ahn"
    },
    {
      "id": "esclavo_liberado",
      "name": "Esclavo Liberado / Fugitivo",
      "category": "Los Bajos Fondos y Olvidados",
      "description": "Conoces el peso de las cadenas. Escapaste o compraste tu libertad, pero las cicatrices mentales y físicas permanecen.",
      "benefit": "+2 Voluntad, +1 Templanza, -1 Confianza (Empatía)",
      "initialFunds": "60,000 Ahn"
    },
    {
      "id": "experimento_fallido",
      "name": "Experimento Fallido",
      "category": "Los Bajos Fondos y Olvidados",
      "description": "Un sujeto de prueba descartado. Memorias fragmentadas, un cuerpo alterado y una resistencia antinatural al dolor.",
      "benefit": "+2 Resistencia (Fortaleza), +1 Arcana, -1 Apariencia (Presencia)",
      "initialFunds": "0 Ahn"
    },
    {
      "id": "academico_desacreditado",
      "name": "Académico Desacreditado",
      "category": "Eruditos, Siervos y Deudores",
      "description": "Descubriste una verdad incómoda o cometiste un error fatal. Te quitaron tus credenciales, pero no lo que sabes.",
      "benefit": "+2 Investigación, +1 Ciencia, -1 Reputación (Perspicacia)",
      "initialFunds": "450,000 Ahn"
    },
    {
      "id": "siervo_corporativo",
      "name": "Siervo Corporativo (Bajo Rango)",
      "category": "Eruditos, Siervos y Deudores",
      "description": "Tu vida pertenece a un logo. Eres prescindible, un engranaje reemplazable en la colosal máquina corporativa.",
      "benefit": "+1 Represión, +1 Negociación",
      "initialFunds": "750,000 Ahn"
    },
    {
      "id": "deudor_vitalicio",
      "name": "Deudor Vitalicio",
      "category": "Eruditos, Siervos y Deudores",
      "description": "Naciste debiendo Ahn. Heredaste las deudas de tus padres y ahora cada respiro que tomas le pertenece al banco.",
      "benefit": "+2 Agilidad (huyendo de cobradores), +1 Supervivencia, -1 Tranquilidad (Templanza)",
      "initialFunds": "-1,500,000 Ahn (Comienzas con deuda)"
    },
    {
      "id": "miembro_culto",
      "name": "Miembro de Culto Menor",
      "category": "Eruditos, Siervos y Deudores",
      "description": "Promesas de salvación susurradas en sótanos oscuros. Dedicaste tu vida a un dogma marginal que exige fe ciega.",
      "benefit": "+2 Fe, +1 Lore, -1 Razón (Análisis)",
      "initialFunds": "240,000 Ahn"
    }
  ].map((entry) => Object.freeze(entry)));
  const byId = new Map(ENTRIES.map((entry) => [entry.id, entry]));

  global.LuminousLegacyBackgroundCatalog = Object.freeze({
    get(id) { return byId.get(String(id ?? "").trim()) || null; },
    all() { return ENTRIES; },
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.LuminousLegacyBackgroundCatalog;
  }
})(typeof window !== "undefined" ? window : globalThis);
