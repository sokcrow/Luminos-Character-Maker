// Data Maps for resolving IDs to Names
const racesData = [
  { id: "humano", nombre: "Humano" },
  { id: "lizalin", nombre: "Lizalin" },
  { id: "kobold", nombre: "Kobold" },
  { id: "kenku", nombre: "Kenku" },
  { id: "centauro", nombre: "Centauro" },
  { id: "goliat", nombre: "Goliat" },
  { id: "goblin", nombre: "Goblin" },
  { id: "hada", nombre: "Hada" },
  { id: "aasimar", nombre: "Aasimar" },
  { id: "tiefling", nombre: "Tiefling" },
  { id: "warforged", nombre: "Warforged" },
  { id: "felinae", nombre: "Felinae" },
  { id: "semi_dragon", nombre: "Semi Dragón" },
  { id: "lupae", nombre: "Lupae" },
  { id: "moonfae", nombre: "Moonfae" },
  { id: "undae", nombre: "Undae" },
  { id: "elnae", nombre: "Elnae" },
  { id: "yuanti_pura_sangre", nombre: "Yuan-ti Pura Sangre" },
  { id: "lanae", nombre: "Lanae" },
  { id: "tsune", nombre: "Tsune" },
];

const backgroundsData = [
  {
    id: "alta_cuna",
    name: "Alta Cuna",
    funds: "7,500,000 Ahn",
    benefit: "+1 Empatía, +1 Negociación, -1 Supervivencia",
  },
  {
    id: "aristocracia_mercantil",
    name: "Aristocracia Mercantil",
    funds: "9,000,000 Ahn",
    benefit: "+2 Negociación, +1 Engaño, -1 Vigor",
  },
  {
    id: "nobleza_caida",
    name: "Nobleza Caída",
    funds: "1,500,000 Ahn",
    benefit: "+1 Presencia, +1 Sigilo",
  },
  {
    id: "cuna_de_eruditos",
    name: "Cuna de Eruditos",
    funds: "4,500,000 Ahn",
    benefit: "+2 Ciencia, +1 Lore, -1 Carisma",
  },
  {
    id: "linaje_militar",
    name: "Linaje Militar",
    funds: "2,400,000 Ahn",
    benefit: "+1 Fortaleza, +1 Manejo",
  },
  {
    id: "familia_de_granjeros",
    name: "Familia de Granjeros",
    funds: "900,000 Ahn",
    benefit: "+1 Vigor, +1 Supervivencia",
  },
  {
    id: "artesano_independiente",
    name: "Artesano Independiente",
    funds: "1,800,000 Ahn",
    benefit: "+1 Reflejos, +1 Análisis",
  },
  {
    id: "fuerzas_de_seguridad",
    name: "Fuerzas de Seguridad (Bajas)",
    funds: "2,100,000 Ahn",
    benefit: "+1 Percepción, +1 Voluntad",
  },
  {
    id: "burocracia_menor",
    name: "Burocracia Menor",
    funds: "1,350,000 Ahn",
    benefit: "+1 Memoria, +1 Prudencia",
  },
  {
    id: "huerfano_callejero",
    name: "Huérfano Callejero",
    funds: "150,000 Ahn",
    benefit: "+2 Sigilo, +1 Agilidad, -1 Educación Formal (Lore)",
  },
  {
    id: "escoria_criminal",
    name: "Escoria Criminal",
    funds: "600,000 Ahn",
    benefit: "+1 Engaño, +1 Seducción",
  },
  {
    id: "exiliado_proscrito",
    name: "Exiliado / Proscrito",
    funds: "300,000 Ahn",
    benefit: "+2 Supervivencia, +1 Instinto, -1 Carisma",
  },
  {
    id: "esclavo_liberado",
    name: "Esclavo Liberado / Fugitivo",
    funds: "60,000 Ahn",
    benefit: "+2 Voluntad, +1 Templanza, -1 Confianza (Empatía)",
  },
  {
    id: "experimento_fallido",
    name: "Experimento Fallido",
    funds: "0 Ahn",
    benefit: "+2 Resistencia (Fortaleza), +1 Arcana, -1 Apariencia (Presencia)",
  },
  {
    id: "academico_desacreditado",
    name: "Académico Desacreditado",
    funds: "450,000 Ahn",
    benefit: "+2 Investigación, +1 Ciencia, -1 Reputación (Perspicacia)",
  },
  {
    id: "siervo_corporativo",
    name: "Siervo Corporativo (Bajo Rango)",
    funds: "750,000 Ahn",
    benefit: "+1 Represión, +1 Negociación",
  },
  {
    id: "deudor_vitalicio",
    name: "Deudor Vitalicio",
    funds: "-30,000,000 Ahn",
    benefit:
      "+2 Agilidad (huyendo de cobradores), +1 Supervivencia, -1 Tranquilidad (Templanza)",
  },
  {
    id: "miembro_culto",
    name: "Miembro de Culto Menor",
    funds: "240,000 Ahn",
    benefit: "+2 Fe, +1 Lore, -1 Razón (Análisis)",
  },
];

const professionsData = [
  {
    id: "medico_cirujano",
    name: "Médico Cirujano / Anatomista",
    perks: [
      {
        id: "precision_quirurgica",
        nombre: "Precisión Quirúrgica",
        desc: "Nunca tratas con basura. Cualquier botiquín común (Tier 1) se considera automáticamente de 1 Tier superior en tus manos. Al curar fuera de combate recuperas 15 + 10% del HP Máx adicional.",
      },
      {
        id: "autopsia_expres",
        nombre: "Autopsia Exprés",
        desc: "Tienes +3 en Investigación o Ciencia para determinar la causa exacta de muerte, hora, y extraer un recuerdo residual o traza química útil de un cadáver fresco.",
      },
      {
        id: "mercado_rojo",
        nombre: "Mercado Rojo",
        desc: "Sabes cómo conservar la carne. Puedes extraer implantes cibernéticos o biomateriales intactos de cadáveres en minutos para venderlos en el mercado negro sin que pierdan su Tier.",
      },
      {
        id: "falso_diagnostico",
        nombre: "Falso Diagnóstico",
        desc: "Tienes +3 en Engaño o Perspicacia al tratar con NPCs heridos o enfermos, convenciéndolos de que tienen una afección letal que solo tú puedes tratar para extorsionarlos o interrogarlos.",
      },
      {
        id: "inyecciones",
        nombre: "Inyecciones",
        desc: "En tus descansos, creas estimulantes (Tier 2). Si es un descanso corto, creas 2; si es largo, 4. Pueden usarse para mantener a alguien despierto por días o darle energía antes de un interrogatorio.",
      },
    ],
  },
  {
    id: "ingeniero_mecanico",
    name: "Ingeniero / Artífice Mecánico",
    perks: [
      {
        id: "mantenimiento_eficiente",
        nombre: "Mantenimiento Eficiente",
        desc: "Puedes tomar chatarra y hacerla funcional. Un arma mecánica o prótesis en la que trabajes en un descanso largo (pasando el DC), sube 1 Tier.",
      },
      {
        id: "cortocircuito",
        nombre: "Cortocircuito",
        desc: "Usas 10 minutos para desactivar, puentear o reprogramar puertas de seguridad, cámaras o cerraduras electrónicas sin dejar rastro de forzamiento (Tienes +3 en Manejo para esto).",
      },
      {
        id: "chatarrero",
        nombre: "Chatarrero",
        desc: "Encuentras piezas donde otros ven basura. Al saquear enemigos mecánicos o ruinas, obtienes siempre materiales equivalentes a 1 Tier superior.",
      },
      {
        id: "ingenieria_inversa",
        nombre: "Ingeniería Inversa",
        desc: "Si pasas 1 hora analizando un dispositivo, trampa o arma desconocida (incluso tecnología corporativa), descubres quién la fabricó, su propósito exacto y cómo desactivarla de forma segura.",
      },
      {
        id: "sabotaje_sutil",
        nombre: "Sabotaje Sutil",
        desc: "Puedes alterar el equipo de un NPC (vehículo, arma de fuego, prótesis) para que falle catastróficamente horas o días después de tu intervención, dejándote con una coartada perfecta.",
      },
    ],
  },
  {
    id: "erudito_academico",
    name: "Erudito / Investigador Académico",
    perks: [
      {
        id: "rata_de_biblioteca",
        nombre: "Rata de Biblioteca",
        desc: "Obtienes un +3 automático a cualquier check de Investigación o Lore relacionado con identificar la función, origen o Tier real de artefactos y contratos corporativos.",
      },
      {
        id: "conocimiento_prohibido",
        nombre: "Conocimiento Prohibido",
        desc: "Sabes cosas que rompen la mente. Puedes gastar 10 SP antes de tirar Análisis sobre criaturas anormales para obtener un +3 y descubrir mecánicas ocultas que el DJ debe revelarte.",
      },
      {
        id: "lenguas_muertas",
        nombre: "Lenguas Muertas",
        desc: 'Entiendes cualquier idioma antiguo, corporativo encriptado o no humano. Tienes +3 en interacciones sociales con criaturas "salvajes" o habitantes de las Afueras.',
      },
      {
        id: "credenciales_falsificadas",
        nombre: "Credenciales Falsificadas",
        desc: 'Tu dominio de la burocracia académica te permite entrar a zonas de cuarentena, archivos corporativos o bibliotecas privadas alegando "investigación oficial", otorgándote +3 en Engaño ante guardias.',
      },
      {
        id: "mente_aislada",
        nombre: "Mente Aislada",
        desc: "Has leído tantas atrocidades que la realidad ya no te afecta. Tienes ventaja en tiradas de salvación contra Miedo, Locura o Pánico, y recuperas +5 SP adicionales en cualquier descanso.",
      },
    ],
  },
  {
    id: "abogado_burocrata",
    name: "Abogado / Burócrata de Alto Nivel",
    perks: [
      {
        id: "letra_pequena",
        nombre: "Letra Pequeña",
        desc: "Empiezas con credenciales corporativas Tier 2. Tienes +3 en Negociación para sobornar o manipular contratos con los guardias oficiales.",
      },
      {
        id: "burocracia_asfixiante",
        nombre: "Burocracia Asfixiante",
        desc: "Si un guardia o NPC intenta arrestarte, multarte o prohibirte el paso, tiras Negociación (+3). Si pasas, los enredas en tanto papeleo y tecnicismos que te dejan ir solo para no lidiar contigo.",
      },
      {
        id: "extorsion",
        nombre: "Extorsión",
        desc: "Tienes +5 en checks de Negociación o Engaño siempre que tengas al menos un secreto, deuda o dato comprometedor sobre el objetivo con el que hablas.",
      },
      {
        id: "ejecucion_hipotecaria",
        nombre: "Ejecución Hipotecaria",
        desc: "Eres experto en leer la miseria financiera ajena. Tienes +3 en Perspicacia para saber al instante el mayor miedo o la deuda aplastante de un NPC con solo hablar 5 minutos con él.",
      },
      {
        id: "inmunidad_diplomatica_falsa",
        nombre: "Inmunidad Diplomática Falsa",
        desc: "Portas un sello o documento (Tier 2) que te da estatus de intocable temporal. Los NPCs comunes te temen y los guardias dudan en registrar tus pertenencias, dándote ventaja en puntos de control.",
      },
    ],
  },
  {
    id: "chef_gastronomico",
    name: "Chef Gastronómico / Nutricionista",
    perks: [
      {
        id: "paladar_absoluto",
        nombre: "Paladar Absoluto",
        desc: "Te niegas a servir basura Tier 1. La comida que preparas sube 1 Tier. Tus platillos restauran +10 SP adicionales a todos y otorgan un escudo de 10 + 5% del HP Máx al grupo.",
      },
      {
        id: "dulce_veneno_social",
        nombre: "Dulce Veneno Social",
        desc: 'Tus postres o bebidas abren bocas. Un NPC que pruebe tus bocadillos "especiales" baja sus defensas mentales, dándote un +3 en checks de Seducción o Engaño para sacarle información.',
      },
      {
        id: "cocina_de_supervivencia",
        nombre: "Cocina de Supervivencia",
        desc: "Puedes preparar una comida decente (Tier 1) con literalmente cualquier cosa (carne de monstruo, maleza, ratas, sobras). Nadie se enfermará y el grupo no gastará Ahn en raciones ese día.",
      },
      {
        id: "raciones_de_combate",
        nombre: "Raciones de Combate",
        desc: "Puedes hacer 3 raciones rápidas (Tier 2) por descanso largo. Consumirlas en combate cuesta 1 Slot de Acción y cura 5 HP y SP instantáneamente.",
      },
      {
        id: "banquete_de_negocios",
        nombre: "Banquete de Negocios",
        desc: "Si cocinas un festín privado para un líder de facción o un PNJ clave, su disposición hacia el grupo mejora automáticamente un nivel de favorabilidad, facilitando alianzas o sobornos.",
      },
    ],
  },
  {
    id: "herrero_armero",
    name: "Herrero / Armero",
    perks: [
      {
        id: "forja_de_combate",
        nombre: "Forja de Combate",
        desc: "Dar mantenimiento a armas no mecánicas en un descanso las eleva 1 Tier superando el DC correspondiente durante ese día.",
      },
      {
        id: "tasador_de_sangre",
        nombre: "Tasador de Sangre",
        desc: "Con solo ver el arma o armadura de un PNJ desde lejos, sabes su Tier, si tiene buen mantenimiento, y deduces su estilo de lucha, otorgándote +3 en Perspicacia o Análisis al hablar con mercenarios.",
      },
      {
        id: "reparacion_estructural",
        nombre: "Reparación Estructural",
        desc: "Tienes el conocimiento arquitectónico para apuntalar techos a punto de colapsar, forzar puertas de metal oxidadas o crear barricadas impenetrables usando los escombros de la zona.",
      },
      {
        id: "marca_del_artesano",
        nombre: "Marca del Artesano",
        desc: "Tus armas tienen una firma reconocible. Puedes usar tu reputación de armero para ganar audiencias pacíficas o descuentos con líderes de sindicatos que siempre buscan buen acero.",
      },
      {
        id: "temple_de_acero",
        nombre: "Temple de Acero",
        desc: "Tu piel está curtida por la forja. El estado Burn baja 1 Count adicional por turno, y pierdes 1 menos de SP ante ataques o daños Psíquicos.",
      },
    ],
  },
  {
    id: "boticario_alquimista",
    name: "Boticario / Alquimista",
    perks: [
      {
        id: "destilacion_pura",
        nombre: "Destilación Pura",
        desc: "Refinas líquidos basura para que suban a Tier 2. Tus venenos u objetos consumibles aplican +2 Potency. Las pociones curativas restauran 5 + 5% del HP Máx adicional.",
      },
      {
        id: "nariz_quimica",
        nombre: "Nariz Química",
        desc: "Tu olfato detecta venenos, drogas, gas o enfermedades infecciosas en el aire o comida automáticamente. El DJ no puede envenenarte por sorpresa sin que tengas una oportunidad clara de notarlo.",
      },
      {
        id: "suero_de_la_verdad_casero",
        nombre: "Suero de la Verdad Casero",
        desc: "Fabrías un vial de suero interrogatorio por descanso largo. El NPC que lo ingiera sufre un -6 a sus tiradas para mentir y hablará de más durante 10 minutos seguidos de manera dócil.",
      },
      {
        id: "tolerancia_adquirida",
        nombre: "Tolerancia Adquirida",
        desc: "Sabes automedicarte. Las drogas recreativas, el alcohol industrial o los analgésicos de este mundo no te generan adicción ni penalizaciones de SP, pudiendo fingir embriaguez sin estarlo.",
      },
      {
        id: "traficante_de_alivio",
        nombre: "Traficante de Alivio",
        desc: "Puedes destilar analgésicos altamente adictivos (Tier 2). Te permite regalar dosis para ganar favores garantizados de PNJs adoloridos, adictos o guardias estresados en las calles.",
      },
    ],
  },
  {
    id: "sastre_tejedor",
    name: "Sastre / Tejedor de Armaduras",
    perks: [
      {
        id: "seda_y_acero",
        nombre: "Seda y Acero",
        desc: "Modificas ropa civil común (Tier 1) para que funcione como armadura ligera balística (Tier 2). Tus modificaciones otorgan +2 Slots de Inventario Activo ocultos bajo la tela.",
      },
      {
        id: "sastre_de_identidades",
        nombre: "Sastre de Identidades",
        desc: "Ajustas uniformes robados o ropa de otras facciones en solo 10 minutos para que te queden a ti o a tus aliados a la perfección. Nadie dudará de tu disfraz por culpa de la talla o el ajuste (+3 Engaño colectivo).",
      },
      {
        id: "costuras_ocultas",
        nombre: "Costuras Ocultas",
        desc: "Sabes esconder objetos pequeños (ganzúas, chips, viales, navajas) en los dobladillos. Un registro físico estándar de la guardia jamás los detectará a menos que rompan físicamente tu ropa.",
      },
      {
        id: "limpiador_de_escenas",
        nombre: "Limpiador de Escenas",
        desc: "Conoces la química de la tela. Sabes cómo lavar y alterar ropa para eliminar cualquier rastro de sangre, pólvora o veneno en minutos, destruyendo la evidencia física de un asesinato.",
      },
      {
        id: "etiqueta_de_alta_costura",
        nombre: "Etiqueta de Alta Costura",
        desc: "Con un simple vistazo a la ropa de alguien, descubres su clase social real, su poder adquisitivo y si lleva armas o chalecos ocultos bajo la tela (Tienes +3 en Percepción al observar humanoides).",
      },
    ],
  },
  {
    id: "ladron_de_guante_blanco",
    name: "Ladrón de Guante Blanco / Asaltante",
    perks: [
      {
        id: "ojo_de_tasador",
        nombre: "Ojo de Tasador",
        desc: "Sabes distinguir la basura del oro. Al entrar a una zona, el Director de Juego debe indicarte cuál es el objeto de mayor Tier o valor de la habitación sin que tengas que buscarlo.",
      },
      {
        id: "memoria_arquitectonica",
        nombre: "Memoria Arquitectónica",
        desc: "Si pasas 1 minuto observando un edificio desde la calle, sabes instintivamente dónde están los puntos ciegos de seguridad, las posibles bóvedas o las entradas de servicio ocultas.",
      },
      {
        id: "ladron_de_identidad",
        nombre: "Ladrón de Identidad",
        desc: "Si robas ropa, una placa o un pase de alguien, puedes imitar su comportamiento, postura y forma de hablar de manera tan natural que obtienes +3 en Engaño al infiltrarte en su lugar de trabajo.",
      },
      {
        id: "contacto_ciego",
        nombre: "Contacto Ciego",
        desc: "Conoces el lenguaje de señas del bajo mundo y las marcas de los gremios en las paredes. Puedes dejar, leer mensajes ocultos y encontrar refugios seguros que la guardia jamás notará.",
      },
      {
        id: "manos_de_seda",
        nombre: "Manos de Seda",
        desc: "Puedes robar objetos pequeños de los bolsillos de un NPC (tarjetas, llaves, monedas) o plantar evidencia incriminatoria en ellos durante una conversación social sin necesidad de tirar dados, siempre que el NPC esté distraído.",
      },
    ],
  },
  {
    id: "contrabandista_traficante",
    name: "Contrabandista / Traficante",
    perks: [
      {
        id: "doble_fondo",
        nombre: "Doble Fondo",
        desc: "Obtienes un contacto en los bajos fondos en cada distrito nuevo y posees compartimentos en tus mochilas/vehículos imposibles de detectar en registros visuales o de seguridad estándar.",
      },
      {
        id: "mercado_negro",
        nombre: "Mercado Negro",
        desc: "Puedes comprar y vender objetos de Tier 2 en cualquier ciudad sin hacer preguntas, y siempre tienes la opción de conseguir un 20% de descuento en el mercado criminal.",
      },
      {
        id: "ojo_para_el_corrupto",
        nombre: "Ojo para el Corrupto",
        desc: "Sabes a quién puedes sobornar. Con una sola charla, el DJ te dirá qué guardia es comprable, qué precio aproximado tiene, o qué vicio padece para chantajearlo a futuro.",
      },
      {
        id: "mentiroso_patologico",
        nombre: "Mentiroso Patológico",
        desc: "Tienes +3 en checks de Engaño. Si te atrapan en una mentira en un diálogo, puedes inventar otra completamente distinta inmediatamente sin penalización por parte del NPC. (Al tercer intento la penalización es de -6).",
      },
      {
        id: "tarifas_de_aduana",
        nombre: "Tarifas de Aduana",
        desc: "Al interactuar con inspectores o guardias de peajes, sabes exactamente cuánto Ahn u objetos ofrecer para que miren a otro lado sin ofenderlos por ofrecer de menos, ni desperdiciar oro ofreciendo de más.",
      },
    ],
  },
  {
    id: "cazarrecompensas_rastreador",
    name: "Cazarrecompensas / Rastreador",
    perks: [
      {
        id: "licencia_de_persecucion",
        nombre: "Licencia de Persecución",
        desc: "Tienes una placa del gremio. Cuando interrogas a civiles sobre el paradero de alguien, tienes +3 en Presencia y legalmente no pueden negarse a darte información básica sin meterse en problemas.",
      },
      {
        id: "marca_del_depredador",
        nombre: "Marca del Depredador",
        desc: "Memorizas la forma de caminar y respirar de tu objetivo. Tienes +3 en Perspicacia para saber si un NPC te está tendiendo una trampa, y puedes seguir un rastro de huellas en una multitud sin perderte.",
      },
      {
        id: "reputacion_implacable",
        nombre: "Reputación Implacable",
        desc: "Tu presencia asfixia a la escoria. Tienes +3 en Presencia al intimidar a criminales de bajo nivel. Si ceden y te dan información, recuperas 5 SP por la satisfacción del dominio absoluto.",
      },
      {
        id: "red_de_informantes_locales",
        nombre: "Red de Informantes Locales",
        desc: "En cada distrito tienes un matón, adicto o vagabundo que te debe la vida (o teme tu nombre), asegurando un refugio temporal o información rápida sobre quién entró o salió del área.",
      },
      {
        id: "ojo_de_la_calle",
        nombre: "Ojo de la Calle",
        desc: "Identificas de inmediato las fronteras invisibles del territorio de pandillas o corporaciones solo por los grafitis, la basura y el comportamiento de la gente, evitando entrar a zonas calientes por accidente.",
      },
    ],
  },
  {
    id: "informante_espia",
    name: "Informante / Espía",
    perks: [
      {
        id: "red_de_susurros",
        nombre: "Red de Susurros",
        desc: "Al llegar a cualquier zona nueva, recolectas información pasivamente para saber quién está al mando en la sombra, qué facciones operan y cuáles son las reglas no escritas del lugar.",
      },
      {
        id: "lectura_de_labios",
        nombre: "Lectura de Labios",
        desc: "No necesitas escuchar para saber qué traman. Puedes entender conversaciones a la perfección desde lejos, a través de cristales o en bares ruidosos, siempre que puedas ver la boca de los hablantes.",
      },
      {
        id: "camaleon_social",
        nombre: "Camaleón Social",
        desc: "Eres psicológicamente invisible en multitudes. Si estás rodeado de al menos 3 civiles, la guardia local o los sicarios que te busquen a pie serán incapaces de distinguirte como una amenaza.",
      },
      {
        id: "falsificador_agil",
        nombre: "Falsificador Ágil",
        desc: "Eres un experto replicando firmas y sellos. Con una hora y materiales básicos, puedes crear documentos falsos (Tier 1 o 2) que pasarán cualquier inspección visual humana o de burócratas cansados.",
      },
      {
        id: "memoria_fotografica",
        nombre: "Memoria Fotográfica",
        desc: "Tienes +3 en checks de Memoria para recordar planos de seguridad, códigos, rostros o conversaciones exactas. Nunca te pierdes en un edificio si has visto el plano de evacuación una sola vez.",
      },
    ],
  },
  {
    id: "musico_artista",
    name: "Músico / Artista Escénico",
    perks: [
      {
        id: "audiencia_cautiva",
        nombre: "Audiencia Cautiva",
        desc: "En un descanso corto, interpretas para el grupo. Los aliados que te toleren y escuchen recuperan 10 SP adicionales en ese momento. Su moral queda condicionada, ganando +1 Attack Power Up solo durante la primera ronda de su próximo combate.",
      },
      {
        id: "centro_de_atencion",
        nombre: "Centro de Atención",
        desc: "Puedes iniciar una actuación pública que atrae instintivamente las miradas de los guardias y NPCs civiles en la zona, dando un bono de +5 automático a las tiradas de Sigilo de tus aliados mientras te escuchan.",
      },
      {
        id: "acto_de_tragedia",
        nombre: "Acto de Tragedia",
        desc: "La primera vez en combate que tu HP cae bajo el 25% o sufres Stagger, finges un colapso cataclísmico o la muerte misma. Los enemigos humanoides cancelarán sus ataques apuntados a ti esa ronda para ir por otra presa, asumiendo que ya eres un cadáver.",
      },
      {
        id: "melodia_de_cuna",
        nombre: "Melodía de Cuna",
        desc: "Tienes +3 en checks de Seducción o Carisma en interacciones pacíficas. Si tocas una canción durante un descanso largo, el sueño del grupo es profundo y sin pesadillas, curando 20 HP extra al despertar.",
      },
      {
        id: "pase_vip",
        nombre: "Pase VIP",
        desc: 'Tu carisma te precede. Tienes +3 en Engaño para convencer a los guardias de eventos exclusivos o corporativos de que eres el entretenimiento contratado o un invitado excéntrico, dejando pasar al grupo como tu "staff".',
      },
    ],
  },
  {
    id: "clerigo_fanatico",
    name: "Clérigo / Fanático Religioso",
    perks: [
      {
        id: "palabra_sagrada",
        nombre: "Palabra Sagrada",
        desc: "Tu fanatismo te aísla de la realidad. Eres completamente inmune al primer efecto de reducción de SP o al primer chequeo de daño mental (Pánico/Terror) que sufras cada día.",
      },
      {
        id: "confesionario",
        nombre: "Confesionario",
        desc: 'Tu aura de devoción o fanatismo incita la culpa. Tienes +3 en Empatía para lograr que un NPC quebrado o asustado te revele sus crímenes, contraseñas o pecados ocultos a cambio de tu "absolución".',
      },
      {
        id: "inquisidor",
        nombre: "Inquisidor",
        desc: "Tienes un +3 automático en checks de Análisis o Investigación exclusivamente cuando se trata de rastrear escondites de herejes, sectas del bajo mundo u objetos profanos ocultos en la ciudad.",
      },
      {
        id: "diezmo_de_los_desesperados",
        nombre: "Diezmo de los Desesperados",
        desc: "En zonas de baja clase, puedes predicar durante 1 hora para conseguir refugio seguro, raciones de Tier 1 y pequeñas donaciones de información de los creyentes sin tener que gastar un solo Ahn.",
      },
      {
        id: "funeral_apropiado",
        nombre: "Funeral Apropiado",
        desc: "Si pasas 10 minutos dando los ritos funerarios a un cadáver en el camino o a un aliado caído, recuperas 15 SP y tu mente se blinda, volviéndote inmune a los efectos pasivos de Miedo por el resto del día.",
      },
    ],
  },
  {
    id: "guardia_soldado",
    name: "Guardia / Soldado Raso",
    perks: [
      {
        id: "centinela",
        nombre: "Centinela",
        desc: "Tu cuerpo está hecho para vigilar. Ignoras las penalizaciones de tiradas por falta de sueño o luz baja en tus checks de Percepción mientras montas guardia.",
      },
      {
        id: "ojo_marcial",
        nombre: "Ojo Marcial",
        desc: "Con solo ver la postura, cicatrices y equipo de un NPC, sabes exactamente su nivel de entrenamiento, qué armas oculta bajo el abrigo y si es un soldado organizado o un simple matón de callejón.",
      },
      {
        id: "jerga_de_cuartel",
        nombre: "Jerga de Cuartel",
        desc: "Sabes cómo piensan los perros de la corporación. Tienes +3 en Engaño o Negociación al interactuar con patrullas militares o mercenarios, fingiendo ser un veterano o usando códigos de radio correctos.",
      },
      {
        id: "marcha_forzada",
        nombre: "Marcha Forzada",
        desc: "Puedes guiar al grupo para viajar por túneles, páramos o ruinas durante la noche o el doble de rápido sin que nadie en el equipo sufra penalizaciones mecánicas por fatiga al día siguiente.",
      },
      {
        id: "disciplina_militar",
        nombre: "Disciplina Militar",
        desc: "Eres resistente al interrogatorio físico. Si eres capturado, tienes +5 en tiradas de Voluntad para no revelar los planes de tu grupo ni las contraseñas, incluso bajo tortura directa.",
      },
    ],
  },
];

const psychoData = [
  { id: "el_atormentado", name: "El Atormentado" },
  { id: "el_trasgresor", name: "El Trasgresor" },
  { id: "el_caido", name: "El Caído" },
  { id: "la_herramienta_rota", name: "La Herramienta Rota" },
  { id: "el_aspirante", name: "El Aspirante" },
  { id: "el_archivista", name: "El Archivista" },
  { id: "el_artesano", name: "El Artesano" },
  { id: "el_residente", name: "El Residente" },
  { id: "el_mensajero", name: "El Mensajero" },
  { id: "el_mediador", name: "El Mediador" },
  { id: "el_idealista", name: "El Idealista" },
  { id: "el_sabelotodo", name: "El Sabelotodo" },
  { id: "el_inocente", name: "El Inocente" },
  { id: "el_arma", name: "El Arma" },
  { id: "el_investigador", name: "El Investigador" },
  { id: "el_sanador", name: "El Sanador" },
  { id: "el_adoctrinado", name: "El Adoctrinado" },
  { id: "el_testigo", name: "El Testigo" },
  { id: "el_rencoroso", name: "El Rencoroso" },
  { id: "el_naufragado", name: "El Naufragado" },
];

// Firebase Init for Character Sheet
const auth = firebase.auth();

let playerId = null;
let currentPlayerData = {};
let currentActorListener = null;

// VARIABLES GLOBALES ESTRICTAS
window.datosJugador = null;
window.actoresJugador = {}; // Diccionario global por Actor ID

// Helper to hide the loading overlay
window.hideLoadingOverlay = function () {
  const overlay = document.getElementById("system-loading-overlay");
  if (overlay && overlay.style.display !== "none") {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
      overlay.remove();
    }, 1000);
  }
};

// Route Guard and Data Init

function updateBootLog(message, isError = false) {
  const logDiv = document.getElementById("boot-status-log");
  if (logDiv) {
    logDiv.innerText = message;
    if (isError) {
      logDiv.style.color = "#ff3333";
      logDiv.style.textShadow = "0 0 5px #ff3333";
      const btn = document.getElementById("btn-reiniciar-sistema");
      if (btn) btn.style.display = "inline-block";
    }
  }
}

function renderCharacterSheet(data) {
  if (!data) return;

  // --- 1. ACTUALIZAR DATOS BÁSICOS Y DINERO ---
  const camposDinamicos = [
    "characterName",
    "ahn",
    "hp",
    "hp_max",
    "sp",
    "luck",
    "luck_max",
    "xp",
    "level",
  ];
  // ⚡ Bolt Optimization: Use conditional checks to prevent DOM attribute thrashing
  // 💡 What: Added checks (input.value !== newVal and span.innerText !== newVal) before assignment.
  // 🎯 Why: Unconditionally setting .value or .innerText on every real-time DB sync forces the browser to recalculate layouts and repaint even if data hasn't changed.
  // 📊 Impact: Substantially reduces unnecessary DOM reflows when receiving frequent Firebase updates.
  camposDinamicos.forEach((campo) => {
    const input = document.querySelector(`input[name="attr_${campo}"]`);
    if (input && document.activeElement !== input) {
      const newVal = data[campo] !== undefined ? data[campo] : "";
      if (input.value !== String(newVal)) input.value = newVal;
    }

    const spans = document.querySelectorAll(
      `.sheet-val-${campo}, span[name="attr_${campo}"], .player-${campo}`,
    );
    spans.forEach((span) => {
      const newVal = data[campo] !== undefined ? data[campo] : "0";
      if (span.innerText !== String(newVal)) span.innerText = newVal;
    });
  });

  const displayAhn = document.getElementById("display-ahn");
  if (displayAhn) {
    const newVal = data.ahn || "0";
    if (displayAhn.innerText !== String(newVal)) displayAhn.innerText = newVal;
  }

  // --- ACTUALIZAR RETRATO DEL HUD DE VITALES ---
  const combatHudPortrait = document.getElementById("portrait-img");

  if (combatHudPortrait) {
    // Al ser un elemento SVG <image>, se debe usar setAttribute con 'href'
    const iconUrl = data.icono_jugador || "https://i.imgur.com/kP8s7Ww.png";
    combatHudPortrait.setAttribute("href", iconUrl);
  }

  // --- 2. ACTUALIZAR CUERPO, MENTE Y ALMA ---
  // ⚡ Bolt Optimization: Skip DOM updates for unchanged core stats
  const coreStats = ["cuerpo", "mente", "alma"];
  coreStats.forEach((stat) => {
    let bVal = 0;
    let mVal = 0;
    if (data.baseStats && data.baseStats[stat])
      bVal = parseInt(data.baseStats[stat]) || 0;
    if (data.modifiers && data.modifiers[stat])
      mVal = parseInt(data.modifiers[stat]) || 0;

    const baseInput = document.querySelector(`input[name="attr_${stat}_base"]`);
    const modInput = document.querySelector(`input[name="attr_${stat}_mod"]`);
    const totalSpan =
      document.querySelector(`.sheet-skill-total[name="attr_${stat}"]`) ||
      document.querySelector(`span[name="attr_${stat}"]`);

    if (baseInput && document.activeElement !== baseInput && baseInput.value !== String(bVal))
      baseInput.value = bVal;
    if (modInput && document.activeElement !== modInput && modInput.value !== String(mVal))
      modInput.value = mVal;
    if (totalSpan) {
      const newTotal = bVal + mVal;
      if (totalSpan.innerText !== String(newTotal)) totalSpan.innerText = newTotal;
    }
  });

  // Update all skill rows (Base, Mod, Total)
  const skillRows = document.querySelectorAll(".sheet-skill-row");
  skillRows.forEach((row) => {
    const btn = row.querySelector(".sheet-roll-skill-btn");
    if (btn) {
      const actName = btn.getAttribute("name");
      if (actName && actName.startsWith("act_roll_skill_")) {
        const skillNameRaw = actName.replace("act_roll_skill_", "");
        let bVal = parseInt(data[`skill_${skillNameRaw}_base`]);
        bVal = !isNaN(bVal) ? bVal : 0;
        let mVal = parseInt(data[`skill_${skillNameRaw}_mod`]);
        mVal = !isNaN(mVal) ? mVal : 0;

        // fallback
        if (
          data[`skill_${skillNameRaw}_base`] === undefined &&
          data.baseStats
        ) {
          const baseKey = Object.keys(data.baseStats).find(
            (k) => k.toLowerCase() === skillNameRaw.toLowerCase(),
          );
          if (baseKey) bVal = parseInt(data.baseStats[baseKey]) || 0;
        }
        if (data[`skill_${skillNameRaw}_mod`] === undefined && data.modifiers) {
          const modKey = Object.keys(data.modifiers).find(
            (k) =>
              k.toLowerCase() === `skill_${skillNameRaw}`.toLowerCase() ||
              k.toLowerCase() === skillNameRaw.toLowerCase(),
          );
          if (modKey) mVal = parseInt(data.modifiers[modKey]) || 0;
        }

        // ⚡ Bolt Optimization: Skip DOM updates for unchanged skills
        const totalSpan = row.querySelector(
          `.sheet-skill-total[name="attr_skill_${skillNameRaw}"]`,
        );
        if (totalSpan) {
          const newTotal = bVal + mVal;
          if (totalSpan.innerText !== String(newTotal)) totalSpan.innerText = newTotal;
        }

        // Update inputs if not focused
        const baseInput = row.querySelector(
          `input[name="attr_skill_${skillNameRaw}_base"]`,
        );
        const modInput = row.querySelector(
          `input[name="attr_skill_${skillNameRaw}_mod"]`,
        );
        if (baseInput && document.activeElement !== baseInput && baseInput.value !== String(bVal))
          baseInput.value = bVal;
        if (modInput && document.activeElement !== modInput && modInput.value !== String(mVal))
          modInput.value = mVal;
      }
    }
  });

  // 3. Perks y Habilidades
  const perksContainer =
    document.querySelector(".repeating_skills") ||
    document.querySelector(".sheet-perks-list") ||
    document.getElementById("perks-container");
  if (perksContainer) {
    perksContainer.innerHTML = "";
    let perks = [];
    if (data.perks) perks = perks.concat(Object.values(data.perks));
    if (data.humanPerks) perks = perks.concat(Object.values(data.humanPerks));

    let perksHtml = "";
    perks.forEach((perk) => {
      perksHtml += `
                <div class="perk-card" style="border-left: 3px solid #c49a00; padding: 10px; margin-bottom: 10px; background: #111; box-shadow: 0 0 5px rgba(0,0,0,0.5);">
                    <div style="color: #00ffff; font-weight: bold; font-family: 'Share Tech Mono', monospace; font-size: 1.1em; text-transform: uppercase;">${perk.nombre || perk.id || "Perk Desconocido"}</div>
                    <div style="color: #ccc; font-size: 0.9em; margin-top: 5px;">${perk.desc || "Sin descripción"}</div>
                </div>
            `;
    });
    perksContainer.innerHTML = perksHtml;
  }

  // 4. Mails (Apps del Celular)
  const mailsContainer =
    document.querySelector(".mail-inbox-list") ||
    document.getElementById("mails-list") ||
    document.querySelector(".mails-container");
  if (mailsContainer) {
    mailsContainer.innerHTML = "";
    let mails = data.mails ? Object.values(data.mails) : [];

    mails.sort((a, b) => {
      let tA = a.timestamp || 0;
      let tB = b.timestamp || 0;
      return tB - tA;
    });

    if (mails.length === 0) {
      mailsContainer.innerHTML =
        '<div style="color: #666; font-style: italic; padding: 10px; text-align: center;">Bandeja de entrada vacía</div>';
    } else {
      mails.forEach((mail) => {
        let dateStr = mail.inGameTime || "";
        if (!dateStr && mail.timestamp) {
          const d = new Date(mail.timestamp);
          dateStr =
            d.toLocaleDateString() +
            " " +
            d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        const mailItem = document.createElement("div");
        mailItem.className = "mail-item";
        mailItem.style =
          "border-bottom: 1px solid #333; padding: 10px; cursor: pointer;";

        mailItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <strong style="color: var(--cyan-tech, #00ffff); font-family: 'Share Tech Mono', monospace;">${(mail.remitente || "Desconocido").replace(/</g, "&lt;")}</strong>
                        ${dateStr ? `<span style="color: #666; font-size: 0.7em;">${dateStr}</span>` : ""}
                    </div>
                    <p style="color: #ccc; margin: 4px 0 0 0; font-size: 0.9em; font-weight: bold;">${(mail.asunto || "Sin Asunto").replace(/</g, "&lt;")}</p>
                    <p style="color: #888; margin: 4px 0 0 0; font-size: 0.8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(mail.mensaje || "").replace(/</g, "&lt;")}</p>
                `;

        mailItem.addEventListener("click", () => {
          alert(
            `De: ${mail.remitente || "Desconocido"}\nAsunto: ${mail.asunto || "Sin Asunto"}\n\nMensaje:\n${mail.mensaje || "Vacío"}`,
          );
        });

        mailsContainer.appendChild(mailItem);
      });
    }
  }

  // 5. Transacciones (Apps del Celular)
  const transContainer =
    document.getElementById("lista-transacciones-banco") ||
    document.getElementById("transactions-list") ||
    document.querySelector(".transactions-container");
  if (transContainer) {
    transContainer.innerHTML = ""; // Limpia lo viejo

    // Ensure we check for transacciones too if transactions is not found
    const dataTrans = data.transacciones || data.transactions;
    if (dataTrans) {
      // Convertir a array, ordenar por fecha y tomar las últimas 3
      const transArray = Object.values(dataTrans)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 3);

      transArray.forEach((t) => {
        const div = document.createElement("div");
        div.className = "transaccion-item";
        // Pinta el HTML real:
        div.innerHTML = `
                    <span style="color: ${t.monto > 0 ? "#44ff44" : "#ff4444"}; font-weight: bold;">
                        ${t.monto > 0 ? "+" : ""}${t.monto} Ahn
                    </span>
                    <span style="color: #aaa; font-size: 0.9em;"> - ${(t.concepto || "Transacción").replace(/</g, "&lt;")}</span>
                `;
        transContainer.appendChild(div);
      });
    } else {
      transContainer.innerHTML =
        '<div style="color: #666;">Sin transacciones recientes.</div>';
    }
  }

  // --- ACTUALIZAR HUD DE VITALES (MECÁNICAS DE JUGADOR) ---
  const hpActual =
    data.combatStats?.hp_actual !== undefined
      ? data.combatStats.hp_actual
      : data.hp || 0;
  const hpMax =
    data.combatStats?.hp_max !== undefined
      ? data.combatStats.hp_max
      : data.hp_max || 0;
  const spActual =
    data.combatStats?.sp_actual !== undefined
      ? data.combatStats.sp_actual
      : data.sp || 0;

  // Buscar elementos usando los IDs exactos que YA existen en el HTML
  const hudPortrait = document.getElementById("portrait-img");
  const hudHpActual = document.getElementById("hud-hp-actual");
  const hudHpMax = document.getElementById("hud-hp-max");
  const hudSpDisplay = document.getElementById("hud-sp-text");

  // Inyectar datos en tiempo real
  if (hudPortrait) {
    const iconUrl = data.icono_jugador || "https://i.imgur.com/kP8s7Ww.png";
    hudPortrait.setAttribute("href", iconUrl);
  }

  // Respetar la estructura de spans separados para el HP
  if (hudHpActual && hudHpMax) {
    hudHpActual.innerText = hpActual;
    hudHpMax.innerText = hpMax;
  } else {
    // Fallback seguro por si la estructura cambia
    const hudHpContenedor = document.querySelector(".hud-hp-overlay-text");
    if (hudHpContenedor) hudHpContenedor.innerText = `${hpActual} / ${hpMax}`;
  }

  if (hudSpDisplay) {
    hudSpDisplay.innerText = spActual;
  }
}

async function runBootSequence() {
  try {
    // STEP 1: Verificación (Auth)
    updateBootLog("[EJECUTANDO] 1/4: Verificando credenciales...");
    const user = await new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      }, reject);
    });

    if (!user) {
      window.location.replace("index.html");
      return;
    }

    if (user.uid === "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1") {
      window.location.replace("pantalla_dm.html");
      return;
    }

    // STEP 2: Vinculación (UID Match)
    updateBootLog("[EJECUTANDO] 2/4: Buscando Vínculo de Alma (UID)...");
    const snapshot = await db
      .ref("campaña/jugadores/")
      .orderByChild("uid")
      .equalTo(user.uid)
      .once("value");

    if (!snapshot.exists()) {
      localStorage.removeItem("playerId");
      window.location.replace("vinculacion.html");
      return;
    }

    let matchFound = false;
    let fallbackKey = null;
    let fallbackChild = null;

    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === "approved") {
        playerId = child.key;
        localStorage.setItem("playerId", child.key);
        matchFound = true;
        return true;
      } else if (data.status === "pending") {
        window.location.replace("vinculacion.html");
        matchFound = true;
        return true;
      }
      if (!fallbackKey && child.val().uid === user.uid) {
        fallbackKey = child.key;
        fallbackChild = child.val();
      }
    });

    if (!matchFound) {
      if (fallbackKey) {
        playerId = fallbackKey;
        localStorage.setItem("playerId", fallbackKey);
      } else {
        localStorage.removeItem("playerId");
        window.location.replace("vinculacion.html");
        return;
      }
    }

    if (!playerId) {
      throw new Error(
        "No se pudo obtener el identificador de alma (playerId).",
      );
    }

    // STEP 3: Estado de Conexión (Presence)
    updateBootLog("[EJECUTANDO] 3/4: Estableciendo conexión neuronal...");
    const connectedRef = db.ref(".info/connected");
    const playerRef = db.ref("campaña/jugadores/" + playerId);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error("Fallo de conexión al servidor central. Timeout excedido."),
        );
      }, 10000);

      connectedRef.on(
        "value",
        (snap) => {
          if (snap.val() === true) {
            clearTimeout(timeout);
            playerRef.child("online").onDisconnect().set(false);
            playerRef
              .child("ultima_conexion")
              .onDisconnect()
              .set(firebase.database.ServerValue.TIMESTAMP);
            playerRef
              .update({ online: true })
              .then(() => {
                resolve();
              })
              .catch(reject);
          }
        },
        reject,
      );
    });

    // STEP 4: Datos de Jugador (Data Sync)
    updateBootLog("[EJECUTANDO] 4/4: Sincronizando expediente local...");

    // Set up the listener but wait for the first initial payload
    await new Promise((resolve, reject) => {
      playerRef.on(
        "value",
        (snap) => {
          if (!snap.exists() || snap.val() === null) {
            reject(new Error("Expediente vacío o permisos denegados."));
            return;
          }

          window.datosJugador = snap.val();
          currentPlayerData = snap.val();

          // Cache data
          localStorage.setItem(
            "datosJugadorCache",
            JSON.stringify(window.datosJugador),
          );

          renderCharacterSheet(window.datosJugador);
          if (typeof window.renderRecetasCrafteo === "function") {
            window.renderRecetasCrafteo();
          }
          if (typeof window.actualizarExpresionesDesdeDropdown === "function") {
            window.actualizarExpresionesDesdeDropdown();
          }

          resolve();
        },
        reject,
      );
    });

    // Success!
    window.hideLoadingOverlay();
    initializeCharacterSheet(); // Still call to setup remaining listeners if needed, though we moved data fetching here
  } catch (error) {
    console.error("Boot Sequence Error:", error);
    updateBootLog(`[ERROR CRÍTICO]\n${error.message}`, true);
  }
}

// Start the sequence globally
runBootSequence();

let actorListenerActive = false;
function initializeCharacterSheet() {
  // Sync Auto-Toss toggle state
  const autoTossToggle = document.getElementById("auto-toss-toggle");
  if (autoTossToggle) {
    const savedState = localStorage.getItem("autoTossState");
    if (savedState === "true") {
      autoTossToggle.checked = true;
    }
    autoTossToggle.addEventListener("change", (e) => {
      localStorage.setItem("autoTossState", e.target.checked);
    });
  }
  if (!playerId) return;

  // --- DESCARGAR ACTORES PARA EL JUGADOR ---
  if (typeof db !== "undefined") {
    if (!actorListenerActive) {
      actorListenerActive = true;
      db.ref("campaña/actores").on("value", (snap) => {
        window.actoresJugador = snap.val() || {};
        window.allActoresCache = snap.val() || {}; // Usado para pintar iconos en el chat

        // Disparar un evento para que el log se re-renderice si ya estaba cargado
        const event = new CustomEvent("actoresCacheUpdated");
        window.dispatchEvent(event);

        const assignedActorId = window.datosJugador?.actorId;
        const exprSelect = document.getElementById("player-expression-select");

        if (assignedActorId && window.actoresJugador[assignedActorId]) {
          const actorData = window.actoresJugador[assignedActorId];

          if (exprSelect && actorData.expresiones) {
            exprSelect.innerHTML = "";
            const expKeys = Object.keys(actorData.expresiones);
            if (expKeys.length > 1) {
              exprSelect.style.display = "block";
              for (const [name, url] of Object.entries(actorData.expresiones)) {
                const opt = document.createElement("option");
                opt.value = url;
                opt.innerText = name;
                exprSelect.appendChild(opt);
              }
            } else {
              exprSelect.style.display = "none";
            }
          }
        }
      });
    }
  }

  // --- REPARACIÓN: LÓGICA DE ENVÍO Y LECTURA DEL TEATRO DE LA MENTE ---
  {
    // === LECTURA DEL TEATRO DE LA MENTE ===
    if (typeof db !== "undefined") {
      // 1. Lectura del log de mensajes en tiempo real
      let ultimoSnapLog = null;

      const renderizarLog = (snap) => {
        const logContainer = document.getElementById("theatre-log-container");
        if (!logContainer) return;

        // Remove old entries, except the header/footer if any
        Array.from(logContainer.children).forEach((child) => {
          if (
            child.className !== "dialogue-footer" &&
            child.className !== "dialogue-scroll-area"
          ) {
            child.remove();
          }
        });

        // Ensure dialogue-scroll-area exists inside logContainer
        let scrollArea = logContainer.querySelector(".dialogue-scroll-area");
        if (!scrollArea) {
          scrollArea = document.createElement("div");
          scrollArea.className = "dialogue-scroll-area";
          logContainer.insertBefore(scrollArea, logContainer.firstChild);
        }
        scrollArea.innerHTML = ""; // clear messages

        const logs = snap.val();
        console.log("Teatro data received:", logs);

        if (!snap.exists() || logs === null) {
          scrollArea.innerHTML =
            "<div style='text-align:center; color:gray; font-style:italic;'>El teatro está en silencio... (No hay mensajes)</div>";
          return;
        }

        if (logs) {
          // Pre-compute actors map for O(1) lookup
          const actorsMap = new Map();
          if (window.allActoresCache) {
            for (const actor of Object.values(window.allActoresCache)) {
              if (actor.nombre) {
                if (!actorsMap.has(actor.nombre.toLowerCase())) {
                  actorsMap.set(actor.nombre.toLowerCase(), actor);
                }
              }
            }
          }

          let isFirst = true;
          for (const [key, msg] of Object.entries(logs)) {
            if (!isFirst) {
              const divider = document.createElement("hr");
              divider.className = "dialogue-divider";
              scrollArea.appendChild(divider);
            }
            isFirst = false;

            const row = document.createElement("div");
            row.className = "dialogue-row";

            const charHexColor = msg.color_nombre || "#ffffff";
            // Generate a default icon just in case one is missing
            const defaultFallbackIcon = `https://via.placeholder.com/80/000000/${charHexColor.replace("#", "")}?text=${msg.nombre ? msg.nombre.charAt(0) : "?"}`;

            let dynamicIcon = null;
            if (msg.nombre) {
              const actorMatch = actorsMap.get(msg.nombre.toLowerCase());
              if (actorMatch && actorMatch.icono) {
                dynamicIcon = actorMatch.icono;
              }
            }

            const iconoSrc = dynamicIcon || msg.icono || defaultFallbackIcon;

            row.innerHTML = `
                        <div class="character-col">
                          <div class="hex-border">
                            <div class="hex-portrait">
                              <img src="${iconoSrc}" alt="${msg.nombre || "Unknown"}">
                            </div>
                          </div>
                          <span class="character-name" style="color: ${charHexColor}">${msg.nombre || "Unknown"}</span>
                        </div>
                        <div class="text-col">
                          <p>${msg.mensaje}</p>
                        </div>
                      `;

            scrollArea.appendChild(row);
          }
          scrollArea.scrollTop = scrollArea.scrollHeight;
        }
      };

      db.ref("campaña/teatro/log")
        .limitToLast(20)
        .on("value", (snap) => {
          ultimoSnapLog = snap;
          renderizarLog(snap);
        });

      window.addEventListener("actoresCacheUpdated", () => {
        if (ultimoSnapLog) {
          renderizarLog(ultimoSnapLog);
        }
      });

      // 2. Lectura de estado de bloqueo (Modo Lore)
      db.ref("campaña/teatro/bloqueo_interaccion").on("value", (snap) => {
        const isBlocked = snap.val();
        const input = document.getElementById("input-teatro-modal");
        const btn = document.getElementById("btn-enviar-teatro-modal");
        if (input && btn) {
          input.disabled = isBlocked;
          btn.disabled = isBlocked;
          input.placeholder = isBlocked
            ? "El Director ha bloqueado las interacciones (Modo Lore)..."
            : "Escribe tu acción o diálogo...";
        }
      });
    }

    // === ENVÍO AL TEATRO DE LA MENTE ===
    const btnSend = document.getElementById("btn-enviar-teatro-modal");
    const inputEl = document.getElementById("input-teatro-modal");

    const sendTheatreMessage = () => {
      const domInput = document.getElementById("input-teatro-modal");
      if (!domInput || !domInput.value.trim() || typeof db === "undefined")
        return;

      try {
        const msgText = domInput.value.trim();
        const actorSelect = document.getElementById("player-actor-select");
        const selectExp = document.getElementById("player-expression-select");

        const assignedActorId = window.datosJugador?.actorId || null;
        // Se prioriza el DM pero se asegura que haya un fallback sano
        const selectedActorId = assignedActorId
          ? assignedActorId
          : actorSelect
            ? actorSelect.value
            : "base";

        let actorParaEnviar = {
          nombre: window.datosJugador?.characterName || "Jugador",
          titulo: "",
          color_nombre: "#ffffff",
          color_titulo: "#aaaaaa",
          escala: 1.0,
          sprite: "https://i.imgur.com/kP8s7Ww.png", // Sprite Base Default
        };

        // Rescatamos datos del actor seleccionado si no es la base
        // Bloque defensivo mejorado
        if (
          selectedActorId &&
          selectedActorId !== "base" &&
          window.actoresJugador &&
          window.actoresJugador[selectedActorId]
        ) {
          const dataActor = window.actoresJugador[selectedActorId];
          if (dataActor) {
            actorParaEnviar = {
              nombre: dataActor.nombre || actorParaEnviar.nombre,
              titulo: dataActor.titulo || "",
              color_nombre: dataActor.color_nombre || "#ffffff",
              color_titulo: dataActor.color_titulo || "#aaaaaa",
              escala:
                dataActor.escala !== undefined
                  ? parseFloat(dataActor.escala)
                  : 1.0,
              sprite: dataActor.sprite || actorParaEnviar.sprite,
            };
          }
        }

        // Validamos la expresión dinámica si existe y es visible (evitando leer valores ocultos rotos)
        let selectedSprite = actorParaEnviar.sprite;
        try {
          if (
            selectExp &&
            selectExp.style.display !== "none" &&
            selectExp.options.length > 0
          ) {
            const val = selectExp.value;
            if (val && val.trim() !== "") {
              selectedSprite = val;
            }
          }
        } catch (e) {
          console.warn(
            "Fallo leyendo expresión del select, usando sprite base.",
            e,
          );
        }

        // Construimos Payload Directo con valores limpios
        const payload = {
          nombre: actorParaEnviar.nombre || "Jugador",
          titulo: actorParaEnviar.titulo || "",
          color_nombre: actorParaEnviar.color_nombre || "#ffffff",
          color_titulo: actorParaEnviar.color_titulo || "#aaaaaa",
          escala: isNaN(actorParaEnviar.escala) ? 1.0 : actorParaEnviar.escala,
          sprite: selectedSprite || "https://i.imgur.com/kP8s7Ww.png",
          icono:
            actorParaEnviar.icono ||
            "https://via.placeholder.com/80/000000/ffffff?text=J",
          mensaje: msgText,
          timestamp: Date.now(),
        };

        // Aseguramos que la referencia no sea undefined y mandamos la cola
        if (db && db.ref) {
          db.ref("campaña/teatro/cola")
            .push(payload)
            .then(() => {
              const domInput = document.getElementById("input-teatro-modal");
              if (domInput) domInput.value = ""; // Limpiar input directo post-envío

              const modal = document.getElementById('modal-escritura-teatro');
              if (modal) modal.style.display = 'none';
            })
            .catch((e) => {
              console.error("Error en Firebase enviando a la cola:", e);
            });
        } else {
          console.error("La instancia db.ref es undefined.");
        }
      } catch (err) {
        console.error("Fallo crítico en sendTheatreMessage:", err);
      }
    };

    // Listeners Limpios globales
    // Reasignamos usando query selector al documento real porque el original se copió
    if (btnSend) {
      const currentBtn = document.getElementById("btn-enviar-teatro-modal");
      if (currentBtn) {
        const newBtnSend = currentBtn.cloneNode(true);
        currentBtn.parentNode.replaceChild(newBtnSend, currentBtn);
        newBtnSend.addEventListener("click", sendTheatreMessage);
      }
    }

    if (inputEl) {
      const currentInput = document.getElementById("input-teatro-modal");
      if (currentInput) {
        const newInputEl = currentInput.cloneNode(true);
        currentInput.parentNode.replaceChild(newInputEl, currentInput);

        newInputEl.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendTheatreMessage();
          }
        });
      }
    }
  }

  const btnAbrirModal = document.getElementById('btn-abrir-escritura');
  if (btnAbrirModal) {
      btnAbrirModal.addEventListener('click', () => {
          const modal = document.getElementById('modal-escritura-teatro');
          if (modal) {
              modal.style.display = 'flex';
              const input = document.getElementById('input-teatro-modal');
              if (input) input.focus();
          }
      });
  }

  const btnCerrarModal = document.getElementById('btn-cerrar-escritura');
  if (btnCerrarModal) {
      btnCerrarModal.addEventListener('click', () => {
          const modal = document.getElementById('modal-escritura-teatro');
          if (modal) modal.style.display = 'none';
      });
  }

  // Cierra la función renderCharacterSheet

  // UI EVENT LISTENERS
  {
    // Phone Toggle
    const toggleBtn = document.getElementById("btn-toggle-phone");
    const phoneWrapper = document.querySelector(".sheet-phone-wrapper");
    if (toggleBtn && phoneWrapper) {
      toggleBtn.addEventListener("click", () => {
        phoneWrapper.classList.toggle("phone-hidden");
      });
    }

    // Tabs List Main
    const tabsList = [
      "home",
      "stats",
      "abilities",
      "skills",
      "profile",
      "parts",
      "apego",
      "banco",
      "contratos",
      "codex",
      "mapa",
      "notas",
      "shop",
    ];

    // Tab switching logic for Main Nav
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('button[type="action"]');
      if (!btn || !btn.name || !btn.name.startsWith("act_tab_")) return;

      const tabName = btn.name.replace("act_tab_", "");

      const tabInput =
        document.querySelector('input[name="attr_tab"]') ||
        document.querySelector(".sheet-state-tab");
      if (tabInput) {
        tabInput.setAttribute("value", tabName);
        tabInput.value = tabName;
      }

      // Keep the JS display logic as a fallback to ensure tabs actually show/hide
      // even if CSS doesn't fully handle it. The user said CSS reacts to the attribute change,
      // but just in case, we also update the display block/none.
      document.querySelectorAll(".sheet-tab-content").forEach((el) => {
        el.style.display = "none";
      });

      const targetTab = document.querySelector(`.sheet-tab-${tabName}`);
      if (targetTab) {
        targetTab.style.display = "block";
      }
    });

    // Show Home by default
    document
      .querySelectorAll(".sheet-tab-content")
      .forEach((el) => (el.style.display = "none"));
    const homeTab = document.querySelector(".sheet-tab-home");
    if (homeTab) homeTab.style.display = "block";

    // --- NUEVO SISTEMA DE NAVEGACIÓN DE VENTANAS (VANILLA JS) ---
    // Buscar todos los botones de acción del HUD y Codex
    document.querySelectorAll('button[type="action"]').forEach((btn) => {
      btn.addEventListener("click", function () {
        const actionName = this.getAttribute("name");
        if (!actionName) return;

        // Lógica para abrir los modales principales (Stats, Perks, Skills, etc.)
        if (
          actionName.startsWith("act_hud_") &&
          actionName !== "act_hud_close"
        ) {
          const modalName = actionName.replace("act_hud_", "");

          // 1. Ocultar todos los modales
          document
            .querySelectorAll(".sheet-modal-container, .sheet-modal")
            .forEach((m) => {
              m.style.display = "none";
            });

          // 2. Buscar y mostrar el modal correcto
          const targetModal =
            document.getElementById(`modal-${modalName}`) ||
            document.querySelector(`.modal-${modalName}`);
          if (targetModal) {
            targetModal.style.display = "block";
          }
        }

        // Lógica para cerrar ventanas

        // Lógica para pestañas del Codex
        if (actionName.startsWith("act_codex_")) {
          const tabName = actionName.replace("act_codex_", "");
          const codexStateInputs = document.querySelectorAll(
            ".sheet-state-codex-tab",
          );
          codexStateInputs.forEach((input) => {
            input.value = tabName;
            input.setAttribute("value", tabName);
          });
        }

        if (actionName === "act_hud_close") {
          document
            .querySelectorAll(
              ".sheet-modal-container, .sheet-modal, .hud-modal",
            )
            .forEach((m) => {
              m.style.display = "none";
            });
        }
      });
    });
  }
  // --- Inventory Modal Logic ---
  {
    // Mail Tab Logic
    let mailListenerActive = false;
    const mailTabBtn = document.querySelector('button[name="act_tab_mail"]');
    if (mailTabBtn) {
      mailTabBtn.addEventListener("click", () => {
        if (mailListenerActive) return;
        mailListenerActive = true;

        const charNameInput = document.querySelector(
          'input[name="attr_character_name"]',
        );
        const playerName = charNameInput ? charNameInput.value.trim() : "";
        if (!playerName) return;

        db.ref(`campaña/jugadores/${playerName}/correos`).on(
          "value",
          (snapshot) => {
            const correos = [];
            snapshot.forEach((child) => {
              correos.push({ id: child.key, ...child.val() });
            });

            // Sort newest to oldest
            correos.sort((a, b) => b.fecha - a.fecha);

            const inboxList = document.querySelector(".mail-inbox-list");
            const readArea = document.querySelector(".mail-read-area");
            if (!inboxList || !readArea) return;

            inboxList.innerHTML = "";
            correos.forEach((correo) => {
              const item = document.createElement("div");
              item.className = `mail-item ${correo.leido ? "" : "unread"}`;
              item.innerHTML = `<strong>${correo.asunto}</strong><br><small>${correo.remitente}</small>`;

              item.addEventListener("click", () => {
                readArea.innerHTML = `<h3>${correo.asunto}</h3><h4>De: ${correo.remitente}</h4><hr><p style="white-space: pre-wrap;">${correo.mensaje}</p>`;
                item.classList.remove("unread");

                // Mark as read in Firebase so it persists
                db.ref(
                  `campaña/jugadores/${playerName}/correos/${correo.id}`,
                ).update({ leido: true });
              });

              inboxList.appendChild(item);
            });
          },
        );
      });
    }

    const invBtn = document.getElementById("btn-global-inventory");
    const invModal = document.getElementById("inventory-modal");
    const invClose = document.getElementById("inventory-modal-close");
    const invTabBtns = document.querySelectorAll(
      "#inventory-modal .inv-tab-btn",
    );
    const invTabContents = document.querySelectorAll(
      "#inventory-modal .inventory-tab-content",
    );

    if (invBtn && invModal) {
      invBtn.addEventListener("click", () => {
        invModal.classList.add("active");
      });
    }

    if (invClose && invModal) {
      invClose.addEventListener("click", () => {
        invModal.classList.remove("active");
      });
    }

    // Modal background click to close
    if (invModal) {
      invModal.addEventListener("click", (e) => {
        if (e.target === invModal) {
          invModal.classList.remove("active");
        }
      });
    }

    // Tab switching inside modal
    invTabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Remove active from all buttons and contents
        invTabBtns.forEach((b) => b.classList.remove("active"));
        invTabContents.forEach((c) => c.classList.remove("active"));

        // Add active to clicked button
        btn.classList.add("active");

        // Show target content
        const targetId = btn.getAttribute("data-tab");
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add("active");
        }

        // Hide detail card and reset selection when switching tabs
        const detailCard = document.getElementById("item-detail-card");
        if (detailCard) detailCard.classList.remove("active");
        document
          .querySelectorAll(".item-slot.active")
          .forEach((s) => s.classList.remove("active"));
      });
    });

    // --- Data Rendering for Inventory Grids ---
    window.renderInventoryGrid = function (gridId, itemsObj, isStash) {
      const grid = document.getElementById(gridId);
      if (!grid) return;

      grid.innerHTML = "";
      const items = itemsObj
        ? Object.entries(itemsObj).map(([key, val]) => ({ key, ...val }))
        : [];

      // Helper func to clean equipment slots
      const cleanEquipSlots = () => {
        document.querySelectorAll(".equip-slot").forEach((slot) => {
          const iconContainer = slot.querySelector(".item-icon");
          if (iconContainer) iconContainer.innerHTML = "";
          const nameContainer = slot.querySelector(".item-name");
          if (nameContainer) nameContainer.innerText = "Vacío";
          const tierContainer = slot.querySelector(".tier");
          if (tierContainer) tierContainer.innerText = "";
          slot.querySelectorAll(".keyword-node").forEach((node) => {
            node.className = "keyword-node empty";
          });
          slot.removeAttribute("draggable");
          slot.ondragstart = null;
          slot.dataset.equippedItemKey = "";
        });
      };
      if (!isStash) {
        cleanEquipSlots();
      }

      // Fill slots with items
      // ⚡ Bolt Optimization: Use DocumentFragment to batch DOM insertions.
      // 💡 What: Replaced direct `grid.appendChild` with `fragment.appendChild`.
      // 🎯 Why: Appending directly to the DOM in a loop causes O(n) layout reflows and repaints.
      // 📊 Impact: Reduces DOM reflows from O(n) to O(1) per render loop, improving list mounting speed.
      const fragment = document.createDocumentFragment();

      items.forEach((item) => {
        // Check if equipped
        if (!isStash && item.equipped_slot) {
          const targetSlot = document.querySelector(
            `.equip-slot[data-slot-id="${item.equipped_slot}"]`,
          );
          if (targetSlot) {
            const tierContainer = targetSlot.querySelector(".tier");
            if (tierContainer) {
              const romanTiers = [
                "",
                "I",
                "II",
                "III",
                "IV",
                "V",
                "VI",
                "VII",
                "VIII",
                "IX",
                "X",
              ];
              const t = parseInt(item.tier) || 0;
              tierContainer.innerText = romanTiers[t] || "";
            }
            const iconContainer = targetSlot.querySelector(".item-icon");
            if (iconContainer) {
              const imgSrc = item.icono || "https://via.placeholder.com/40";
              iconContainer.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;" />`;
            }
            const nameContainer = targetSlot.querySelector(".item-name");
            if (nameContainer) {
              nameContainer.innerText = item.nombre || "Desconocido";
            }
            const nodes = targetSlot.querySelectorAll(".keyword-node");
            const tierCount = parseInt(item.tier) || 1;
            for (let i = 0; i < nodes.length; i++) {
              if (i < tierCount) {
                nodes[i].className = "keyword-node active-glow";
              } else {
                nodes[i].className = "keyword-node empty";
              }
            }
            targetSlot.dataset.equippedItemKey = item.key;
            targetSlot.setAttribute("draggable", "true");
            targetSlot.ondragstart = (e) => {
              e.dataTransfer.setData("text/plain", item.key);
            };
          }
          return; // Skip rendering in normal grid
        }

        const slot = document.createElement("div");
        slot.className = "item-slot";

        // Drag and drop for inventory grid items
        if (!isStash) {
          slot.setAttribute("draggable", "true");
          slot.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", item.key);
          };
        }

        // Ensure array format for tags
        let itemTags =
          item.tags && Array.isArray(item.tags)
            ? item.tags
            : item.tipo
              ? [item.tipo]
              : [];

        const romanTiers = [
          "",
          "I",
          "II",
          "III",
          "IV",
          "V",
          "VI",
          "VII",
          "VIII",
          "IX",
          "X",
        ];
        const tIdx = parseInt(item.tier) || 1;
        const romanTier = romanTiers[tIdx] || "I";

        // Guardar info para los filtros
        slot.dataset.key = item.key;
        slot.dataset.name = (item.nombre || "").toLowerCase();
        slot.dataset.tier = romanTier.toLowerCase();
        slot.dataset.tags = itemTags.join(",").toLowerCase();

        slot.style.position = "relative";
        const imgSrc = item.icono || "https://via.placeholder.com/40";
        slot.innerHTML = `
                <span class="tier" style="position: absolute; top: 2px; left: 2px;">${romanTier}</span>
                <div class="item-display">
                    <div class="item-icon" style="background-image: url('${imgSrc}');"></div>
                    <span class="item-name">${item.nombre || "Vacío"}</span>
                </div>
                <div class="item-quantity" style="position: absolute; bottom: 2px; right: 2px; font-size: 0.7em; color: #aaa;">x${item.cantidad || 1}</div>
            `;
        slot.classList.add("inv-item-slot"); // Agregar la nueva clase del grid LCM
        slot.classList.remove("item-slot"); // Quitar la clase antigua para evitar conflictos

        slot.addEventListener("click", () => {
          // Remove active from all slots
          document
            .querySelectorAll(".item-slot, .inv-item-slot")
            .forEach((s) => s.classList.remove("active"));
          slot.classList.add("active");

          // Show detail card
          const detailCard = document.getElementById("item-detail-card");
          if (detailCard) detailCard.classList.add("active");

          // Populate data
          const iconEl = document.getElementById("detail-icon");
          if (iconEl) iconEl.src = imgSrc;

          const tierEl = document.getElementById("detail-tier-val");
          if (tierEl) tierEl.innerText = romanTier;

          const costEl = document.getElementById("detail-cost-val");
          if (costEl) costEl.innerText = item.valorBase || item.costo || 0;

          const titleBadge = document.getElementById("detail-title");
          if (titleBadge) {
            titleBadge.innerText = item.nombre || "Desconocido";
            // Limpiar clases de tier anteriores
            titleBadge.classList.remove(
              "tier-i-ii",
              "tier-iii-iv",
              "tier-v-vi",
              "tier-vii-viii",
              "tier-ix-x",
            );

            // Aplicar nueva clase según el tier
            if (tIdx === 1 || tIdx === 2) titleBadge.classList.add("tier-i-ii");
            else if (tIdx === 3 || tIdx === 4)
              titleBadge.classList.add("tier-iii-iv");
            else if (tIdx === 5 || tIdx === 6)
              titleBadge.classList.add("tier-v-vi");
            else if (tIdx === 7 || tIdx === 8)
              titleBadge.classList.add("tier-vii-viii");
            else if (tIdx === 9 || tIdx === 10)
              titleBadge.classList.add("tier-ix-x");
            else titleBadge.classList.add("tier-i-ii");
          }

          const descEl = document.getElementById("detail-desc");
          if (descEl) descEl.innerText = item.descripcion || "Sin descripción.";

          const tagsContainer = document.getElementById("detail-tags-val");
          if (tagsContainer) {
            tagsContainer.innerHTML = "";
            itemTags.forEach((tag) => {
              const t = document.createElement("span");
              t.className = "tag-pill";
              t.innerText = tag;
              tagsContainer.appendChild(t);
            });
          }

          // Show equip/unequip button
          const btnContainer = document.getElementById(
            "detail-equip-btn-container",
          );
          if (btnContainer) {
            btnContainer.innerHTML = "";
            const actionBtn = document.createElement("button");
            actionBtn.className = isStash ? "btn-equip" : "btn-unequip";
            actionBtn.innerText = isStash ? "Equipar" : "Desequipar";

            // If moving from stash, check if stash is unlocked
            if (isStash && !window.isStashUnlocked) {
              actionBtn.disabled = true;
              actionBtn.style.opacity = "0.5";
              actionBtn.style.cursor = "not-allowed";
              actionBtn.title = "El alijo está bloqueado por el DM.";
            } else {
              actionBtn.onclick = () => {
                window.dispatchEvent(
                  new CustomEvent("item-move-action", {
                    detail: {
                      itemKey: item.key,
                      itemData: item,
                      fromStash: isStash,
                    },
                  }),
                );
              };
            }
            btnContainer.appendChild(actionBtn);

            // Add Cargar button if item has vinculo
            const vinculoInfo = document.getElementById("detail-vinculo-info");
            if (
              item.vinculo_item &&
              item.vinculo_cantidad &&
              item.vinculo_stacks_max
            ) {
              const maxCargas = item.vinculo_stacks_max;
              const cargaActual = item.carga_actual || 0;
              const reqCant = item.vinculo_cantidad;
              const reqItem = item.vinculo_item;

              if (vinculoInfo) {
                vinculoInfo.style.display = "block";
                vinculoInfo.innerHTML = `
                                <div style="font-size: 0.85em; color: var(--cyan-tech); font-weight: bold; margin-bottom: 5px;">
                                    Cargas: ${cargaActual} / ${maxCargas}
                                </div>
                                <div style="font-size: 0.75em; color: #aaa;">
                                    Requiere ${reqCant}x "${reqItem}" para +1 carga.
                                </div>
                            `;
              }

              if (!isStash || window.isStashUnlocked) {
                const loadBtn = document.createElement("button");
                loadBtn.className = "btn-equip"; // Reuse class for styling
                loadBtn.style.backgroundColor = "var(--cyan-tech)";
                loadBtn.style.color = "#000";
                loadBtn.style.marginTop = "5px";
                loadBtn.innerText = `Cargar (${reqCant} ${reqItem})`;

                if (cargaActual >= maxCargas) {
                  loadBtn.disabled = true;
                  loadBtn.style.opacity = "0.5";
                  loadBtn.style.cursor = "not-allowed";
                  loadBtn.innerText = "Cargas al Máximo";
                } else {
                  loadBtn.onclick = () => {
                    window.dispatchEvent(
                      new CustomEvent("item-load-action", {
                        detail: {
                          itemKey: item.key,
                          itemData: item,
                          isStash: isStash,
                        },
                      }),
                    );
                  };
                }
                btnContainer.appendChild(loadBtn);
              }
            } else {
              if (vinculoInfo) vinculoInfo.style.display = "none";
            }
          }
        });

        fragment.appendChild(slot);
      });

      // ⚡ Mount batched DOM nodes
      grid.appendChild(fragment);
    };

    // --- Inventory Search & Filter Logic (Stash) ---
    const searchInputStash = document.getElementById("buscador-items-stash");
    const filterBtnsStash = document.querySelectorAll(
      "#filtros-stash .inv-filter-btn",
    );

    function filterStashItems() {
      const query = searchInputStash
        ? searchInputStash.value.toLowerCase()
        : "";
      let activeFilter = "todo";

      filterBtnsStash.forEach((btn) => {
        if (btn.classList.contains("active")) {
          activeFilter = btn.getAttribute("data-filter").toLowerCase();
        }
      });

      const stashGrid = document.getElementById("inv-stash-grid");
      if (stashGrid) {
        const slots = stashGrid.querySelectorAll(".item-slot:not(.empty-slot)");
        slots.forEach((slot) => {
          const name = slot.dataset.name || "";
          const tier = slot.dataset.tier || "";
          const tags = slot.dataset.tags || "";

          const matchesQuery =
            name.includes(query) ||
            tier.includes(query) ||
            tags.includes(query);
          const matchesFilter =
            activeFilter === "todo" || tags.includes(activeFilter);

          if (matchesQuery && matchesFilter) {
            slot.style.display = "flex";
          } else {
            slot.style.display = "none";
          }
        });
      }
    }

    // ⚡ Bolt Optimization: Added debounce to stash search input
    // 💡 What: Wrapped filterStashItems in a 250ms timeout.
    // 🎯 Why: Iterating over DOM elements and altering display properties synchronously on every keystroke blocks the main thread.
    // 📊 Impact: Significantly minimizes DOM layout thrashing during searches, reducing lag.
    if (searchInputStash) {
      if (searchInputStash._debounceStashHandler) {
        searchInputStash.removeEventListener("input", searchInputStash._debounceStashHandler);
      }
      let filterStashTimeout = null;
      searchInputStash._debounceStashHandler = function(e) {
        if (filterStashTimeout) clearTimeout(filterStashTimeout);
        filterStashTimeout = setTimeout(() => filterStashItems.call(this, e), 250);
      };
      searchInputStash.addEventListener("input", searchInputStash._debounceStashHandler);
    }

    filterBtnsStash.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtnsStash.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterStashItems();
      });
    });

    // Handle loading items (Vinculos)
    window.addEventListener("item-load-action", (e) => {
      const { itemKey, itemData, isStash } = e.detail;
      if (!playerId || typeof db === "undefined") return;

      const reqCant = parseInt(itemData.vinculo_cantidad) || 0;
      const reqItemName = itemData.vinculo_item;

      if (!reqCant || !reqItemName) return;

      // Function to find and consume the required items across both active and stash
      const consumeItems = async () => {
        let totalFound = 0;
        const activeRef = db.ref(
          `campaña/jugadores/${playerId}/inventario_activo`,
        );
        const stashRef = db.ref(
          `campaña/jugadores/${playerId}/inventario_stash`,
        );

        const activeSnap = await activeRef.once("value");
        const stashSnap = await stashRef.once("value");

        const activeItems = activeSnap.val() || {};
        const stashItems = stashSnap.val() || {};

        let itemsToDeduct = []; // { ref, key, currentCant, deductCant }
        let remainingNeeded = reqCant;

        // Search Active
        for (const [k, v] of Object.entries(activeItems)) {
          if (v.nombre === reqItemName && remainingNeeded > 0) {
            let cant = v.cantidad || 1;
            let toDeduct = Math.min(cant, remainingNeeded);
            itemsToDeduct.push({
              ref: activeRef,
              key: k,
              currentCant: cant,
              deductCant: toDeduct,
            });
            remainingNeeded -= toDeduct;
          }
        }

        // Search Stash
        if (remainingNeeded > 0 && window.isStashUnlocked) {
          for (const [k, v] of Object.entries(stashItems)) {
            if (v.nombre === reqItemName && remainingNeeded > 0) {
              let cant = v.cantidad || 1;
              let toDeduct = Math.min(cant, remainingNeeded);
              itemsToDeduct.push({
                ref: stashRef,
                key: k,
                currentCant: cant,
                deductCant: toDeduct,
              });
              remainingNeeded -= toDeduct;
            }
          }
        }

        if (remainingNeeded > 0) {
          if (!window.isStashUnlocked) {
            alert(
              `No tienes suficientes "${reqItemName}" en tu Inventario Activo (${reqCant} requeridos). El Alijo está bloqueado.`,
            );
          } else {
            alert(
              `No tienes suficientes "${reqItemName}" (${reqCant} requeridos).`,
            );
          }
          return;
        }

        // Deduct
        for (const item of itemsToDeduct) {
          if (item.currentCant - item.deductCant <= 0) {
            await item.ref.child(item.key).remove();
          } else {
            await item.ref
              .child(item.key)
              .update({ cantidad: item.currentCant - item.deductCant });
          }
        }

        // Increment charges
        const currentCargas = parseInt(itemData.carga_actual) || 0;
        const targetList = isStash ? "inventario_stash" : "inventario_activo";
        await db
          .ref(`campaña/jugadores/${playerId}/${targetList}/${itemKey}`)
          .update({
            carga_actual: currentCargas + 1,
          });

        // Auto-refresh the detail card to show new charges by simulating a click
        const activeSlot = document.querySelector(".item-slot.active");
        if (activeSlot) {
          activeSlot.click();
        }
      };

      consumeItems();
    });

    // Handle equip/unequip events
    window.addEventListener("item-move-action", (e) => {
      const { itemKey, itemData, fromStash } = e.detail;
      if (!playerId || typeof db === "undefined") return;

      const sourceListName = fromStash
        ? "inventario_stash"
        : "inventario_activo";
      const targetListName = fromStash
        ? "inventario_activo"
        : "inventario_stash";

      const sourceRef = db.ref(
        `campaña/jugadores/${playerId}/${sourceListName}/${itemKey}`,
      );
      const targetRef = db.ref(
        `campaña/jugadores/${playerId}/${targetListName}`,
      );

      let sourceCurrentCant = parseInt(itemData.cantidad) || 1;

      targetRef.once("value", (targetSnap) => {
        const targetData = targetSnap.val() || {};
        let foundKey = null;
        let targetCurrentCant = 0;

        for (const [k, targetItem] of Object.entries(targetData)) {
          if (
            targetItem.nombre === itemData.nombre &&
            (targetItem.tier || 1) == (itemData.tier || 1)
          ) {
            foundKey = k;
            targetCurrentCant = targetItem.cantidad || 1;
            break;
          }
        }

        // Check limits
        const activeStackLimit = parseInt(itemData.limite_activo) || 2; // Default 2 for active if not specified
        const stashStackLimit = parseInt(itemData.limite_alijo) || 99; // Default 99 for stash if not specified

        let moveAmount = 0;

        if (fromStash) {
          // Moving to Active Inventory
          let maxCanMove = activeStackLimit - targetCurrentCant;
          if (maxCanMove <= 0) {
            alert(
              `No puedes equipar más de ${activeStackLimit} de este ítem a la vez.`,
            );
            return;
          }
          // Check 10 slots limit for active inventory
          if (!foundKey && Object.keys(targetData).length >= 10) {
            alert(
              "El Inventario Activo está lleno. Solo puedes llevar 10 espacios.",
            );
            return;
          }
          moveAmount = Math.min(sourceCurrentCant, maxCanMove);
        } else {
          // Moving to Stash
          moveAmount = sourceCurrentCant; // Move entire stack
          let maxCanMove = stashStackLimit - targetCurrentCant;
          if (maxCanMove <= 0) {
            alert(
              `El alijo no puede almacenar más de ${stashStackLimit} de este ítem en un solo stack.`,
            );
            return;
          }
          moveAmount = Math.min(moveAmount, maxCanMove);
        }

        let itemToMove = { ...itemData, cantidad: moveAmount };
        delete itemToMove.key; // Clean up key

        let promiseAdd;
        if (foundKey) {
          promiseAdd = targetRef
            .child(foundKey)
            .update({ cantidad: targetCurrentCant + moveAmount });
        } else {
          promiseAdd = targetRef.push(itemToMove);
        }

        promiseAdd.then(() => {
          sourceRef.once("value", (sourceSnap) => {
            const sourceItem = sourceSnap.val();
            if (!sourceItem) return;

            let newSourceCant = sourceItem.cantidad - moveAmount;

            if (newSourceCant > 0) {
              sourceRef.update({ cantidad: newSourceCant });
            } else {
              sourceRef.remove();
              // Hide detail card if the last item is moved
              const detailCard = document.getElementById("item-detail-card");
              if (detailCard) detailCard.classList.remove("active");
            }
          });
        });
      });
    });

    // --- Dynamic Shop System Logic ---
    // Shop logic is now handled in the main Shop app tab
  } // Cierra Inventory Modal Logic

  // Listener for active and stash inventory
  let playerInventoryListenerActive = false;
  {
    if (typeof db !== "undefined" && playerId) {
      if (!playerInventoryListenerActive) {
        playerInventoryListenerActive = true;

        // Listen to Stash usando playerId directo
        db.ref(`campaña/jugadores/${playerId}/inventario_stash`).on(
          "value",
          (snap) => {
            const items = snap.val() || {};
            if (typeof window.renderInventoryGrid === "function") {
              window.renderInventoryGrid("inv-stash-grid", items, true);
            }
          },
        );

        // Listen to Activo usando playerId directo
        db.ref(`campaña/jugadores/${playerId}/inventario_activo`).on(
          "value",
          (snap) => {
            const items = snap.val() || {};
            if (typeof window.renderInventoryGrid === "function") {
              window.renderInventoryGrid("inv-active-grid", items, false);
            }
          },
        );
      }
    }
  }

  // LÓGICA DE TIENDA DINÁMICA (COMPRAR / VENDER)
  let tiendaActivaData = null;
  let tiendaActivaId = null;
  let tiendasFisicasDisponibles = {}; // Para el modal físico
  let tiendaFisicaActivaId = null; // ID de la tienda seleccionada en el modal

  // Helper array para convertir Tier en romano (ya existe en otro lado pero lo necesitamos aquí)
  const romanTiersShop = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
  ];

  // Esperar a que el DOM y typeof db !== 'undefined' existan
  {
    if (typeof db === "undefined") return;

    // Abrir/Cerrar el modal de tienda física
    const badgeFisica = document.getElementById("tienda-fisica-badge");
    const shopModal = document.getElementById("shop-modal");
    const shopModalClose = document.getElementById("shop-modal-close");

    if (badgeFisica && shopModal) {
      badgeFisica.addEventListener("click", (e) => {
        e.stopPropagation(); // Evitar que abra el inventario normal
        shopModal.classList.add("active");
        // Por defecto, seleccionar la primera tienda de la lista si hay
        const storeKeys = Object.keys(tiendasFisicasDisponibles);
        if (storeKeys.length > 0) {
          seleccionarTiendaFisica(storeKeys[0]);
        }
      });
    }

    if (shopModalClose && shopModal) {
      shopModalClose.addEventListener("click", () => {
        shopModal.classList.remove("active");
        tiendaFisicaActivaId = null;
      });
    }

    db.ref("campaña/tiendas").on("value", (snapshot) => {
      const tiendas = snapshot.val() || {};
      let encontrada = false;

      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();

      tiendasFisicasDisponibles = {};
      let badgeImageSrc = null;

      for (const [id, data] of Object.entries(tiendas)) {
        // Lógica App (En línea)
        if (data.activa === true) {
          encontrada = true;
          tiendaActivaId = id;
          tiendaActivaData = data;
        }

        // Lógica Física
        if (
          data.fisica_activa === true &&
          playerName &&
          data.jugadores_presentes &&
          data.jugadores_presentes[playerName]
        ) {
          tiendasFisicasDisponibles[id] = data;
          if (!badgeImageSrc)
            badgeImageSrc =
              data.icono_fisico ||
              data.icono ||
              "https://i.imgur.com/kP8s7Ww.png";
        }
      }

      // Actualizar UI App
      const btnShop = document.getElementById("btn-app-shop");
      const shopApp = document.getElementById("shop-app");

      if (encontrada && btnShop) {
        btnShop.style.display = "flex";
        renderizarComprar();
        renderizarVender();
      } else {
        if (btnShop) btnShop.style.display = "none";
        tiendaActivaData = null;
        tiendaActivaId = null;
        const tabInput = document.querySelector('input[name="attr_tab"]');
        if (tabInput && tabInput.value === "shop") {
          // Here we would normally change tab
          const homeBtn = document.querySelector('button[name="act_tab_home"]');
          if (homeBtn) homeBtn.click();
        }
      }

      // Actualizar UI Física (Badge)
      const badgeFisica = document.getElementById("tienda-fisica-badge");
      const shopModal = document.getElementById("shop-modal");
      if (badgeFisica) {
        if (Object.keys(tiendasFisicasDisponibles).length > 0) {
          badgeFisica.src = badgeImageSrc;
          badgeFisica.style.display = "block";
          renderizarSidebarFisica();

          // Si el modal está abierto, re-renderizar la grid actual
          if (
            shopModal &&
            shopModal.classList.contains("active") &&
            tiendaFisicaActivaId
          ) {
            if (tiendasFisicasDisponibles[tiendaFisicaActivaId]) {
              renderizarGridFisica(tiendaFisicaActivaId);
            } else {
              const storeKeys = Object.keys(tiendasFisicasDisponibles);
              if (storeKeys.length > 0) seleccionarTiendaFisica(storeKeys[0]);
              else shopModal.classList.remove("active");
            }
          }
        } else {
          badgeFisica.style.display = "none";
          if (shopModal) shopModal.classList.remove("active");
        }
      }
    });

    function renderizarSidebarFisica() {
      const sidebar = document.getElementById("shop-sidebar-list");
      if (!sidebar) return;

      sidebar.innerHTML = "";

      for (const [id, data] of Object.entries(tiendasFisicasDisponibles)) {
        const btn = document.createElement("button");
        btn.className = "shop-btn";
        if (id === tiendaFisicaActivaId) btn.classList.add("active");

        const iconUrl =
          data.icono_fisico || data.icono || "https://i.imgur.com/kP8s7Ww.png";
        btn.innerHTML = `<img src="${iconUrl}" alt="${data.nombre}"> ${data.nombre}`;

        btn.addEventListener("click", () => {
          seleccionarTiendaFisica(id);
        });

        sidebar.appendChild(btn);
      }
    }

    function seleccionarTiendaFisica(id) {
      tiendaFisicaActivaId = id;
      renderizarSidebarFisica();
      renderizarGridFisica(id);
    }

    function renderizarGridFisica(idTienda) {
      const grid = document.getElementById("shop-items-grid");
      const title = document.getElementById("shop-active-name");
      if (!grid || !title) return;

      const data = tiendasFisicasDisponibles[idTienda];
      if (!data) return;

      title.innerText = data.nombre;
      grid.innerHTML = "";

      const items = data.items || {};
      const modVenta = data.mod_venta || 100;

      if (Object.keys(items).length === 0) {
        grid.innerHTML =
          '<div style="color:#666; font-size: 20px; padding: 20px; grid-column: 1 / -1; text-align: center;">Sin inventario.</div>';
        return;
      }

      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();

      db.ref(`campaña/jugadores/${playerName}/inventario_stash`).once(
        "value",
        (snap) => {
          const userStash = snap.val() || {};
          const stashCounts = {};
          for (const itemStash of Object.values(userStash)) {
            if (itemStash.nombre) {
              stashCounts[itemStash.nombre] =
                (stashCounts[itemStash.nombre] || 0) +
                (parseInt(itemStash.cantidad) || 1);
            }
          }

          // Optimization: Use DocumentFragment to batch DOM insertions for performance
          const fragment = document.createDocumentFragment();

          for (const [itemId, item] of Object.entries(items)) {
            const itemTier = parseInt(item.tier) || 1;
            const valorConTier = Math.floor(
              (item.costo || 0) * (1 + (itemTier - 1) * 0.25),
            );
            const precio = Math.floor(valorConTier * (modVenta / 100));
            const isAgotado = item.stock_actual === 0;
            const stockStr = item.stock_actual === -1 ? "∞" : item.stock_actual;
            const tierStr = romanTiersShop[Math.min(itemTier, 10)] || "I";
            const countOwned = stashCounts[item.nombre] || 0;
            const tagStr = item.tag || "Objeto";
            const descStr =
              item.descripcion || item.desc || "Sin descripción disponible.";

            const card = document.createElement("div");
            card.className = "shop-item-card";

            card.innerHTML = `
                    <div class="shop-item-image-container">
                        <img src="${item.icono || "https://via.placeholder.com/80"}" alt="${item.nombre}">
                    </div>
                    <div class="shop-item-details">
                        <div class="shop-item-header">
                            <h4 class="shop-item-name">${item.nombre}</h4>
                            <span class="shop-item-tag">${tagStr}</span>
                        </div>
                        <div class="shop-item-description">${descStr}</div>
                        <div style="font-size: 11px; color: #555; margin-top: auto;">Stock en tienda: ${stockStr}</div>
                    </div>
                    <div class="shop-item-meta">
                        <div class="shop-item-possession">
                            <span class="shop-item-possession-label">POSEES</span>
                            <span class="shop-item-possession-value">${countOwned}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                            <div class="shop-item-tier">${tierStr}</div>
                            <button class="shop-item-buy-btn btn-comprar-fisico" data-tienda="${idTienda}" data-item="${itemId}" data-precio="${precio}" ${isAgotado ? "disabled" : ""}>
                                <span class="currency-symbol">₳</span> ${precio}
                            </button>
                        </div>
                    </div>
                `;
            fragment.appendChild(card);
          }
          grid.appendChild(fragment);
        },
      );
    }

    // Función para manejar las pestañas internas de la app de tienda
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("inv-tab-btn") &&
        e.target.closest("#shop-app")
      ) {
        const btns = document.querySelectorAll("#shop-app .inv-tab-btn");
        const contents = document.querySelectorAll(
          "#shop-app .inventory-tab-content",
        );

        btns.forEach((b) => b.classList.remove("active"));
        contents.forEach((c) => c.classList.remove("active"));

        e.target.classList.add("active");
        const tabId = e.target.getAttribute("data-tab");
        document.getElementById(tabId).classList.add("active");

        if (tabId === "shop-vender") {
          renderizarVender(); // Actualizar stash al abrir
        }
      }
    });

    // Delegación de eventos para botones Comprar/Vender
    document.addEventListener("click", (e) => {
      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();
      if (!playerName) return;

      // LÓGICA DE COMPRAR (App u Offline/Física)
      const btnCompra = e.target.closest(
        ".btn-comprar-item, .btn-comprar-fisico",
      );
      if (btnCompra && !btnCompra.disabled) {
        const isFisico = btnCompra.classList.contains("btn-comprar-fisico");

        const itemId = isFisico
          ? btnCompra.getAttribute("data-item")
          : btnCompra.getAttribute("data-id");
        const precio = parseInt(btnCompra.getAttribute("data-precio"));

        let idTiendaActual = null;
        let tiendaActualData = null;

        if (isFisico) {
          idTiendaActual = btnCompra.getAttribute("data-tienda");
          tiendaActualData = tiendasFisicasDisponibles[idTiendaActual];
        } else {
          idTiendaActual = tiendaActivaId;
          tiendaActualData = tiendaActivaData;
        }

        if (
          !tiendaActualData ||
          !tiendaActualData.items ||
          !tiendaActualData.items[itemId]
        )
          return;
        const itemTienda = tiendaActualData.items[itemId];

        db.ref(`campaña/jugadores/${playerName}/ahn`).once("value", (snap) => {
          const ahn_actual = snap.val() || 0;
          if (ahn_actual < precio) {
            alert("Fondos insuficientes.");
            return;
          }

          // Restar Ahn estrictamente
          db.ref(`campaña/jugadores/${playerName}/ahn`).set(
            ahn_actual - precio,
          );

          // Reducir Stock
          if (itemTienda.stock_actual !== -1) {
            db.ref(
              `campaña/tiendas/${idTiendaActual}/items/${itemId}/stock_actual`,
            ).transaction((current) => {
              return (current || 0) - 1;
            });
          }

          const itemToSave = {
            id: itemId,
            nombre: itemTienda.nombre,
            valorBase: itemTienda.costo, // Costo base
            tier: parseInt(itemTienda.tier) || 1,
            tipo: itemTienda.tipo || "Consumible",
            icono: itemTienda.icono || "",
            descripcion: itemTienda.descripcion || "",
            cantidad: 1,
          };
          if (itemTienda.tags) itemToSave.tags = itemTienda.tags;

          if (isFisico) {
            // Añadir directo al Stash (Física)
            const stashRef = db.ref(
              `campaña/jugadores/${playerName}/inventario_stash`,
            );
            stashRef.once("value", (stashSnap) => {
              let foundKey = null;
              let currentCant = 0;
              stashSnap.forEach((child) => {
                if (
                  child.val().id === itemId &&
                  (child.val().tier || 1) == (itemTienda.tier || 1)
                ) {
                  foundKey = child.key;
                  currentCant = child.val().cantidad || 1;
                }
              });

              if (foundKey) {
                stashRef.child(foundKey).update({ cantidad: currentCant + 1 });
              } else {
                stashRef.push(itemToSave);
              }

              // Feedback visual Físico
              const originalHtml = btnCompra.innerHTML;
              btnCompra.innerText = "COMPRADO";
              btnCompra.style.background = "#0df";
              btnCompra.style.color = "#000";
              setTimeout(() => {
                if (btnCompra) {
                  btnCompra.innerHTML = originalHtml;
                  btnCompra.style.background = "";
                  btnCompra.style.color = "";
                }
              }, 500);
            });
          } else {
            // Añadir a entregas pendientes (App En línea)
            const diasEntrega = tiendaActualData.dias_entrega || 0;

            db.ref("campaña/calendario")
              .once("value")
              .then((calSnap) => {
                let diaLlegada = diasEntrega; // Fallback si no hay calendario
                const calendario = calSnap.val();
                if (calendario) {
                  diaLlegada = calendario.dia + diasEntrega;
                }

                const entrega = {
                  ...itemToSave,
                  diaDeLlegada: diaLlegada,
                };

                db.ref(`campaña/jugadores/${playerName}/entregasPendientes`)
                  .push(entrega)
                  .then(() => {
                    // Feedback visual App
                    const originalText = btnCompra.innerText;
                    const originalBg = btnCompra.style.background;
                    btnCompra.innerText = "¡OK!";
                    btnCompra.style.background = "#0df";
                    setTimeout(() => {
                      if (btnCompra) {
                        btnCompra.innerText = originalText;
                        btnCompra.style.background = originalBg;
                      }
                    }, 500);
                  });
              });
          }
        });
      }

      // LÓGICA DE VENDER
      if (e.target.classList.contains("btn-vender-item")) {
        const key = e.target.getAttribute("data-key");
        const precio = parseInt(e.target.getAttribute("data-precio"));

        const itemRef = db.ref(
          `campaña/jugadores/${playerName}/inventario_stash/${key}`,
        );
        itemRef.once("value", (snap) => {
          const item = snap.val();
          if (!item) return;

          // Sumar Ahn
          db.ref(`campaña/jugadores/${playerName}/ahn`).once(
            "value",
            (ahnSnap) => {
              const currentAhn = ahnSnap.val() || 0;
              db.ref(`campaña/jugadores/${playerName}`).update({
                ahn: currentAhn + precio,
              });
            },
          );

          // Reducir cantidad o eliminar
          if (item.cantidad > 1) {
            itemRef.update({ cantidad: item.cantidad - 1 });
          } else {
            itemRef.remove();
          }

          // Refrescar vista
          setTimeout(renderizarVender, 200);
        });
      }
    });

    function renderizarComprar() {
      const grid = document.getElementById("shop-comprar-grid");
      if (!grid || !tiendaActivaData) return;

      grid.innerHTML = "";
      const items = tiendaActivaData.items || {};
      const modVenta = tiendaActivaData.mod_venta || 100;

      if (Object.keys(items).length === 0) {
        grid.innerHTML =
          '<div style="color:#666; text-align:center; padding: 20px;">Sin inventario.</div>';
        return;
      }

      // Optimization: Use DocumentFragment to batch DOM insertions for performance
      const fragment = document.createDocumentFragment();

      for (const [itemId, item] of Object.entries(items)) {
        const itemTier = parseInt(item.tier) || 1;
        const valorConTier = Math.floor(
          (item.costo || 0) * (1 + (itemTier - 1) * 0.25),
        );
        const precio = Math.floor(valorConTier * (modVenta / 100));
        const isAgotado = item.stock_actual === 0;
        const stockStr = item.stock_actual === -1 ? "∞" : item.stock_actual;

        const row = document.createElement("div");
        row.style.cssText =
          "background: #111; border: 1px solid #333; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 10px;";

        row.innerHTML = `
            <img src="${item.icono || "https://via.placeholder.com/40"}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #000;">
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nombre}</div>
                <div style="font-size: 12px; color: #888;">Stock: ${stockStr}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                <div style="color: #0df; font-weight: bold;"><span class="currency-symbol">₳</span> ${precio}</div>
                <button class="btn-comprar-item" data-id="${itemId}" data-precio="${precio}" ${isAgotado ? "disabled" : ""}
                        style="background: ${isAgotado ? "#333" : "#004400"}; color: ${isAgotado ? "#666" : "#fff"}; border: 1px solid ${isAgotado ? "#444" : "#00ff00"}; padding: 4px 8px; border-radius: 3px; cursor: ${isAgotado ? "not-allowed" : "pointer"}; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                    ${isAgotado ? "Agotado" : "Comprar"}
                </button>
            </div>
        `;
        fragment.appendChild(row);
      }
      grid.appendChild(fragment);
    }

    function renderizarVender() {
      const grid = document.getElementById("shop-vender-grid");
      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();
      if (!grid || !tiendaActivaData || !playerName) return;

      // Use typeof db !== 'undefined' inside functions to ensure it's available
      db.ref(`campaña/jugadores/${playerName}/inventario_stash`).once(
        "value",
        (snap) => {
          grid.innerHTML = "";
          const stash = snap.val();

          if (!stash) {
            grid.innerHTML =
              '<div style="color:#666; text-align:center; padding: 20px;">Tu Stash está vacío.</div>';
            return;
          }

          const reglas = tiendaActivaData.tasas_por_etiqueta || {};
          const tasaDefecto = tiendaActivaData.tasa_defecto || 50;

          const fragment = document.createDocumentFragment();

          for (const [key, item] of Object.entries(stash)) {
            if (item.cantidad <= 0) continue;

            // Calcular precio de venta basado en el primer tag (tipo) si existe
            // La nueva lógica usa array de tags, así que buscamos el primero
            let primerTag = item.tipo || ""; // Fallback a tipo si no hay tags en la DB vieja

            // Find matching rule with priority: tags > tipo
            const matchingTag =
              (Array.isArray(item.tags) &&
                item.tags.find((tag) => reglas[tag] !== undefined)) ||
              (reglas[primerTag] !== undefined ? primerTag : null);

            const pct = matchingTag ? reglas[matchingTag] : tasaDefecto;

            const itemTier = parseInt(item.tier) || 1;
            const valorConTier = Math.floor(
              (item.valorBase || 0) * (1 + (itemTier - 1) * 0.25),
            );
            const precioVenta = Math.floor(valorConTier * (pct / 100));

            const row = document.createElement("div");
            row.style.cssText =
              "background: #111; border: 1px solid #333; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 10px;";

            row.innerHTML = `
                <img src="${item.icono || "https://via.placeholder.com/40"}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #000;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nombre}</div>
                    <div style="font-size: 12px; color: #888;">Cant: ${item.cantidad}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                    <div style="color: #c49a00; font-weight: bold;"><span class="currency-symbol">₳</span> +${precioVenta}</div>
                    <button class="btn-vender-item" data-key="${key}" data-precio="${precioVenta}"
                            style="background: #440000; color: #fff; border: 1px solid #ff0000; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                        Vender
                    </button>
                </div>
            `;
            fragment.appendChild(row);
          }
          grid.appendChild(fragment);
        },
      );
    }
  } // Cierra Esperar a que el DOM...

  // NATIVE BUTTON LISTENERS
  {
    // Escuchar clicks globales para botones de acción (simulando Roll20)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('button[type="action"]');
      if (!btn) return;

      const actName = btn.getAttribute("name");
      if (!actName || typeof db === "undefined") return;

      // --- Ejemplos de Lógica Reescrita ---

      // Banco
      if (actName === "act_add_ahn") {
        const inputMod = document.querySelector('input[name="attr_ahn_mod"]');
        if (inputMod) {
          const modVal = parseInt(inputMod.value) || 0;
          const current = parseInt(currentPlayerData.ahn) || 0;
          db.ref("campaña/jugadores/" + playerId).update({
            ahn: current + modVal,
          });
          inputMod.value = 0;
        }
      }

      if (actName === "act_sub_ahn") {
        const inputMod = document.querySelector('input[name="attr_ahn_mod"]');
        if (inputMod) {
          const modVal = parseInt(inputMod.value) || 0;
          const current = parseInt(currentPlayerData.ahn) || 0;
          db.ref("campaña/jugadores/" + playerId).update({
            ahn: current - modVal,
          });
          inputMod.value = 0;
        }
      }

      if (actName === "act_toggle_profile_edit") {
        const inputState = document.querySelector(
          'input[name="attr_show_profile_edit"]',
        );
        if (inputState) {
          const currentVal = inputState.value;
          const newVal = currentVal === "0" ? "1" : "0";
          inputState.value = newVal;
          inputState.setAttribute("value", newVal);
        }
      }

      // --- Descansos ---
      if (actName === "act_short_rest") {
        const currentHP = parseInt(currentPlayerData.hp) || 0;
        const maxHP = parseInt(currentPlayerData.hp_max) || 0;
        const heal = Math.floor(maxHP * 0.34);
        let newHP = currentHP + heal;
        if (newHP > maxHP) newHP = maxHP;

        db.ref("campaña/jugadores/" + playerId).update({
          hp: newHP,
          sp: 0,
          stagger_1_active: "1",
          stagger_2_active: "1",
          stagger_3_active: "1",
        });
      }

      if (actName === "act_long_rest") {
        const maxHP = parseInt(currentPlayerData.hp_max) || 0;
        db.ref("campaña/jugadores/" + playerId).update({
          hp: maxHP,
          sp: 0,
        });
      }

      // --- Suerte ---
      if (actName === "act_luck_up") {
        const current = parseInt(currentPlayerData.luck) || 0;
        const max = parseInt(currentPlayerData.luck_max) || 0;
        if (current < max) {
          db.ref("campaña/jugadores/" + playerId).update({ luck: current + 1 });
        }
      }

      if (actName === "act_luck_down") {
        const current = parseInt(currentPlayerData.luck) || 0;
        if (current > 0) {
          db.ref("campaña/jugadores/" + playerId).update({ luck: current - 1 });
        }
      }
    });

    // Detectar cambios directos en los inputs y actualizarlos en Firebase (Reemplaza el auto-sync de Roll20)
    document.addEventListener("change", (e) => {
      if (!e.target.name || !e.target.name.startsWith("attr_")) return;
      if (
        e.target.tagName !== "INPUT" &&
        e.target.tagName !== "SELECT" &&
        e.target.tagName !== "TEXTAREA"
      )
        return;

      const attrName = e.target.name.replace("attr_", "");
      const val =
        e.target.type === "checkbox"
          ? e.target.checked
            ? e.target.value
            : "0"
          : e.target.value;

      // Match lowercase key against actual modifier keys
      let matchedStatKey = null;
      if (currentPlayerData && currentPlayerData.modifiers) {
        for (const key of Object.keys(currentPlayerData.modifiers)) {
          if (key.toLowerCase() === attrName.toLowerCase()) {
            matchedStatKey = key;
            break;
          }
        }
      }

      // Si el valor pertenece a modifier
      if (matchedStatKey) {
        db.ref("campaña/jugadores/" + playerId + "/modifiers").update({
          [matchedStatKey]: val,
        });
      } else if (typeof db !== "undefined") {
        // Interceptar la actualización de XP para calcular nivel y barras de progreso
        if (attrName === "xp" && typeof calculateLevelData === "function") {
          const xpData = calculateLevelData(val);

          const hpBase =
            parseInt(
              currentPlayerData?.combatStats?.hp_base ||
                currentPlayerData?.hp_base,
            ) || 0;
          const hpCoef =
            parseFloat(
              currentPlayerData?.combatStats?.hp_coefficient ||
                currentPlayerData?.hp_coefficient,
            ) || 0;
          const defLvlMod =
            parseInt(currentPlayerData?.combatStats?.def_lvl_mod) || 0;
          const totalDefLvl = xpData.level + defLvlMod;
          const newHpMax = Math.floor(hpBase + totalDefLvl * hpCoef);

          db.ref("campaña/jugadores/" + playerId).update({
            xp: parseInt(val) || 0,
            level: xpData.level,
            xpPercent: xpData.xpPercent,
            xpMissing: xpData.xpMissing,
            hp_max: newHpMax,
          });

          db.ref("campaña/jugadores/" + playerId + "/combatStats").update({
            hp_max: newHpMax,
          });
        } else {
          // Guardar directamente en la raiz
          db.ref("campaña/jugadores/" + playerId).update({ [attrName]: val });
        }
      }
    });

    // ====== COIN TOSS ENGINE ======
    document.addEventListener("click", (e) => {
      // Determine if the clicked element or its parent is the roll button
      const btn = e.target.closest(".sheet-roll-skill-btn");
      if (btn) {
        const actName = btn.getAttribute("name"); // e.g., act_roll_skill_cardio
        if (!actName || !actName.startsWith("act_roll_skill_")) return;

        const skillNameRaw = actName.replace("act_roll_skill_", "");
        // Find the parent row to get the visual name and values
        const row = btn.closest(".sheet-skill-row");
        if (!row) return;

        const displaySpan = row.querySelector(".sheet-skill-name");
        const displayName = displaySpan
          ? displaySpan.textContent
          : skillNameRaw;

        // SP Calculation & Data Lookup
        // currentPlayerData may be defined as an empty object in global scope.
        // We ensure we read `window.datosJugador` or global `currentPlayerData` if populated.
        const pd =
          Object.keys(currentPlayerData || {}).length > 0
            ? currentPlayerData
            : window.datosJugador || {};

        // Read Base + Mod from player data securely
        let baseVal = 0;
        let modVal = 0;

        if (pd) {
          // For Core Stats (cuerpo, mente, alma)
          if (
            ["cuerpo", "mente", "alma"].includes(skillNameRaw.toLowerCase())
          ) {
            if (pd.baseStats) {
              const baseKey = Object.keys(pd.baseStats).find(
                (k) => k.toLowerCase() === skillNameRaw.toLowerCase(),
              );
              if (baseKey) baseVal = parseInt(pd.baseStats[baseKey]) || 0;
            }
            if (pd.modifiers) {
              const modKey = Object.keys(pd.modifiers).find(
                (k) => k.toLowerCase() === skillNameRaw.toLowerCase(),
              );
              if (modKey) modVal = parseInt(pd.modifiers[modKey]) || 0;
            }
          } else {
            // For Skills, base and mod are usually stored at root as skill_name_base and skill_name_mod
            baseVal = parseInt(pd[`skill_${skillNameRaw.toLowerCase()}_base`]);
            baseVal = !isNaN(baseVal) ? baseVal : 0;
            modVal = parseInt(pd[`skill_${skillNameRaw.toLowerCase()}_mod`]);
            modVal = !isNaN(modVal) ? modVal : 0;

            // Fallbacks
            if (
              pd[`skill_${skillNameRaw.toLowerCase()}_base`] === undefined &&
              pd.baseStats
            ) {
              const baseKey = Object.keys(pd.baseStats).find(
                (k) => k.toLowerCase() === skillNameRaw.toLowerCase(),
              );
              if (baseKey) baseVal = parseInt(pd.baseStats[baseKey]) || 0;
            }
            if (
              pd[`skill_${skillNameRaw.toLowerCase()}_mod`] === undefined &&
              pd.modifiers
            ) {
              const modKey = Object.keys(pd.modifiers).find(
                (k) =>
                  k.toLowerCase() === `skill_${skillNameRaw.toLowerCase()}` ||
                  k.toLowerCase() === skillNameRaw.toLowerCase(),
              );
              if (modKey) modVal = parseInt(pd.modifiers[modKey]) || 0;
            }
          }
        }

        const skillTotal = baseVal + modVal;

        let sp = parseInt(pd.combatStats?.sp_actual ?? pd.sp) || 0;

        // Heads Probability = 50 + SP (min 5, max 95)
        let probHeads = 50 + sp;
        if (probHeads < 5) probHeads = 5;
        if (probHeads > 95) probHeads = 95;

        const container = document.getElementById("coin-toss-coins-container");
        if (container) container.innerHTML = "";

        const nameEl = document.getElementById("coin-toss-skill-name");
        if (nameEl) nameEl.textContent = displayName;

        const statsEl = document.getElementById("coin-toss-stats");
        if (statsEl) statsEl.textContent = `Probabilidad de Heads: ${probHeads}%`;

        const resultEl = document.getElementById("roll-total-score");
        let currentTotal = skillTotal;
        if (resultEl) resultEl.textContent = currentTotal;

        const closeBtn = document.getElementById("coin-toss-close-btn");
        if (closeBtn) {
            closeBtn.disabled = true;
            closeBtn.style.opacity = "0.5";
            closeBtn.style.cursor = "not-allowed";
        }

        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "flex";

        let coinsStopped = 0;
        const totalCoins = 5;

        // Auto-Toss Toggle status
        const autoTossToggle = document.getElementById("auto-toss-toggle");
        const isAuto = autoTossToggle ? autoTossToggle.checked : false;

        // ⚡ Bolt Optimization: Use DocumentFragment for batching coin wrapper insertions.
        // 💡 What: Create a fragment before the loop, append each coinWrapper to it, and append the fragment to container once.
        // 🎯 Why: This turns O(n) layout reflows into an O(1) single reflow operation, improving loop efficiency.
        // 📊 Impact: Significantly minimizes reflow and repaint during coin toss generation.
        const coinsFragment = document.createDocumentFragment();

        // Generate the 5 coins
        for (let i = 0; i < totalCoins; i++) {
          const coinWrapper = document.createElement("div");
          coinWrapper.className = "coin-toss-item";
          coinWrapper.style.width = "60px";
          coinWrapper.style.height = "60px";
          coinWrapper.style.position = "relative";
          coinWrapper.style.cursor = isAuto ? "default" : "pointer";

          const coinImg = document.createElement("img");
          coinImg.src = "https://imgur.com/XDx0ICt.png"; // Girando / Cruz
          coinImg.style.width = "100%";
          coinImg.style.height = "100%";
          coinImg.style.objectFit = "cover";
          coinImg.style.transition = "transform 0.3s";

          // Basic CSS animation to simulate spinning
          const spinAnim = coinImg.animate(
            [
              { transform: 'rotateY(0deg)' },
              { transform: 'rotateY(360deg)' }
            ],
            {
              duration: 150,
              iterations: Infinity
            }
          );

          coinWrapper.appendChild(coinImg);
          coinsFragment.appendChild(coinWrapper);

          const stopCoin = () => {
            if (coinWrapper.dataset.stopped === "true") return;
            coinWrapper.dataset.stopped = "true";

            spinAnim.cancel();

            const roll = Math.random() * 100;
            const isHeads = roll < probHeads;

            if (isHeads) {
              coinImg.src = "https://imgur.com/yshLPnQ.png"; // Cara / Heads
              const coinHeadsAudio = new Audio("Assets/Audio/SFX/UI/Coin%20SFX/Coin_Heads.wav");
              coinHeadsAudio.volume = 0.3;
              coinHeadsAudio.play().catch(e => console.warn("Audio play blocked:", e));
              currentTotal += 3;
              if (resultEl) resultEl.textContent = currentTotal;
            } else {
              coinImg.src = "https://imgur.com/XDx0ICt.png"; // Visual Cruz
              const coinTailsAudio = new Audio("Assets/Audio/SFX/UI/Coin%20SFX/Coin_Tails.wav");
              coinTailsAudio.volume = 0.3;
              coinTailsAudio.play().catch(e => console.warn("Audio play blocked:", e));
            }

            coinsStopped++;
            if (coinsStopped >= totalCoins) {
              if (closeBtn) {
                closeBtn.disabled = false;
                closeBtn.style.opacity = "1";
                closeBtn.style.cursor = "pointer";
              }
            }
          };

          if (!isAuto) {
            coinWrapper.addEventListener("click", stopCoin);
          } else {
            setTimeout(stopCoin, (i + 1) * 600);
          }
        }

        if (container) {
          container.appendChild(coinsFragment);
        }
      }

      // Close Coin Toss Panel
      const closeBtn = e.target.closest("#coin-toss-close-btn");
      if (closeBtn && !closeBtn.disabled) {
        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "none";
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "craft-cantidad") {
        const display = document.getElementById("craft-cantidad-display");
        if (display) display.innerText = e.target.value;
      }
    });

    // --- LÓGICA DEL TOGGLE DEL HUD DE COMBATE (DELEGACIÓN GLOBAL) ---
    document.addEventListener("click", (e) => {
      const btnToggleHud = e.target.closest("#btn-toggle-hud");
      if (btnToggleHud) {
        const combatHud = document.getElementById("player-combat-hud");
        if (!combatHud) return;

        const textLong = btnToggleHud.querySelector(".text-long");
        const textShort = btnToggleHud.querySelector(".text-short");

        if (
          combatHud.style.display === "none" ||
          combatHud.style.display === ""
        ) {
          combatHud.style.display = "flex";
          if (textLong) textLong.innerText = "[-] OCULTAR VITALES";
          if (textShort) textShort.innerText = "❌";
          btnToggleHud.style.color = "#d4af37";
          btnToggleHud.style.borderColor = "#d4af37";
        } else {
          combatHud.style.display = "none";
          if (textLong) textLong.innerText = "[+] REVISAR VITALES";
          if (textShort) textShort.innerText = "❤️";
          btnToggleHud.style.color = "#ff3333";
          btnToggleHud.style.borderColor = "#ff3333";
        }
      }
    });
  } // Cierra el bloque de UI EVENT LISTENERS

  // --- SENSOR DE TIENDAS CERCANAS ---
  if (typeof db !== "undefined") {
    db.ref("campaña/estado_mundo/tienda_activa").on("value", (snapshot) => {
      const tiendaId = snapshot.val();
      const btnShop = document.getElementById("btn-shop-notifier");

      if (btnShop) {
        if (tiendaId) {
          btnShop.classList.add("show");
          // Forzar el puntero y la prioridad de clic
          btnShop.style.pointerEvents = "auto";

          btnShop.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation(); // Evitar que el clic se pierda en capas inferiores
              console.log("Iniciando apertura de tienda:", tiendaId);
              if (typeof abrirTiendaDinamica === "function") {
                  abrirTiendaDinamica(tiendaId);
              }
          };
        } else {
          btnShop.classList.remove("show");
          const overlay = document.getElementById('tienda-overlay');
          if (overlay) overlay.style.display = 'none';
        }
      }
    });
  }
} // Cierra la función initializeCharacterSheet()

// --- LÓGICA PARA CERRAR SESIÓN DEL JUGADOR ---
document.addEventListener("DOMContentLoaded", () => {
  const btnLogout = document.getElementById("btn-player-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        // Opcional: Marcar como offline antes de salir
        if (
          typeof playerId !== "undefined" &&
          playerId &&
          typeof db !== "undefined"
        ) {
          db.ref("campaña/jugadores/" + playerId).update({ online: false });
        }

        firebase
          .auth()
          .signOut()
          .then(() => {
            localStorage.removeItem("playerId");
            window.location.replace("index.html");
          })
          .catch((error) => {
            console.error("Error al cerrar sesión:", error);
            alert("Hubo un error al intentar cerrar sesión.");
          });
      }
    });
  }
});

// --- LÓGICA DE TIENDAS DINÁMICAS ---
window.abrirTiendaDinamica = function(tiendaId) {
  if (!playerId) return;

  db.ref(`campaña/jugadores/${playerId}/transacciones`).once('value', (transSnap) => {
    let saldoActual = 0;
    transSnap.forEach(t => { saldoActual += (t.val().monto || 0); });

    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay) balanceDisplay.innerText = saldoActual;

    db.ref(`campaña/tiendas/${tiendaId}`).once('value', (snap) => {
      const data = snap.val();
      if (!data) return;

      document.getElementById("shop-name-display").innerText = data.nombre || "Tienda";
      const lista = document.getElementById("lista-items-tienda");
      lista.innerHTML = "";

      document.getElementById("panel-item-name").innerText = "---";
      document.getElementById("panel-item-qty").innerText = "--";
      document.getElementById("panel-item-desc").innerHTML = "<span style='color: #666; font-style: italic;'>Selecciona un objeto...</span>";
      const btnComprar = document.getElementById("btn-comprar-seleccionado");
      btnComprar.style.display = "none";

      if (data.items) {
        const itemsArray = Array.isArray(data.items) ? data.items : Object.keys(data.items).map(k => ({...data.items[k], _key: k}));

        itemsArray.forEach((item, index) => {
          if(!item) return;
          const row = document.createElement("div");
          row.className = "item-row";

          let iconHTML = '📦';
          if (item.icono) {
              if (item.icono.startsWith('http') || item.icono.includes('.')) {
                  iconHTML = `<img src="${item.icono}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src=''; this.alt='📦';">`;
              } else {
                  iconHTML = item.icono;
              }
          }

          const mapRomanos = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V" };
          const tierText = mapRomanos[item.tier] || item.tier || "-";
          const precioItem = item.costo || 0;

          row.innerHTML = `
            <div class="icon-slot">
                <span class="tier">${tierText}</span>
                <span class="icono-img" style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">${iconHTML}</span>
            </div>
            <div class="item-details">
                <span class="item-name">${item.nombre || 'Objeto'}</span>
                <span class="item-cost">
                    ${precioItem} <span style="color: var(--brillo-ambar);">₳</span>
                </span>
            </div>
          `;

          row.onclick = () => {
              document.querySelectorAll('.item-row').forEach(r => r.classList.remove('selected'));
              row.classList.add('selected');

              document.getElementById("panel-item-name").innerText = item.nombre;
              document.getElementById("panel-item-desc").innerText = item.descripcion || item.desc || "Sin descripción disponible.";

              let stockDisplay = "--";
              if (item.stock_actual !== undefined) {
                  stockDisplay = (item.stock_actual === -1) ? "∞" : item.stock_actual;
              }
              document.getElementById("panel-item-qty").innerText = stockDisplay;

              btnComprar.style.display = "block";
              btnComprar.innerHTML = `COMPRAR [${precioItem} ₳]`;

              const passKey = item._key !== undefined ? item._key : index;
              btnComprar.onclick = () => comprarItemTienda(tiendaId, passKey, precioItem);
          };

          lista.appendChild(row);
        });
      } else {
        lista.innerHTML = "<span style='color: #888; padding: 20px;'>No hay objetos disponibles en esta tienda.</span>";
      }

      document.getElementById("tienda-overlay").style.display = "flex";
    });
  });
};

window.comprarItemTienda = function(tiendaId, itemKey, precioReal) {
  if (!playerId) return alert("Error: Jugador no identificado.");

  db.ref(`campaña/tiendas/${tiendaId}/items/${itemKey}`).once('value', (snap) => {
    const itemData = snap.val();
    if (!itemData) return alert("El objeto ya no está disponible.");

    db.ref(`campaña/jugadores/${playerId}/transacciones`).once('value', (transSnap) => {
      let saldoAhn = 0;
      transSnap.forEach(t => { saldoAhn += (t.val().monto || 0); });

      if (saldoAhn < precioReal) {
        return alert("Ahn insuficientes para esta compra.");
      }

      const nuevaTransaccion = {
        monto: -precioReal,
        motivo: `Compra en Tienda: ${itemData.nombre}`,
        timestamp: Date.now()
      };
      db.ref(`campaña/jugadores/${playerId}/transacciones`).push(nuevaTransaccion);

      const nuevoItem = { ...itemData };
      delete nuevoItem.costo;
      delete nuevoItem._key;
      nuevoItem.cantidad = 1;
      nuevoItem.id_instancia = 'item_' + Date.now() + Math.floor(Math.random() * 1000);

      db.ref(`campaña/jugadores/${playerId}/inventario_stash`).push(nuevoItem)
        .then(() => alert(`¡Has comprado: ${itemData.nombre}!`))
        .catch(err => console.error("Error al entregar item:", err));
    });
  });
};
