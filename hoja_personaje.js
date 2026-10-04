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

let lastCharacterSheetRenderSignature = "";

function characterSheetRenderSignature(data) {
  const skills = {};
  Object.keys(data || {}).forEach((key) => {
    if (key.startsWith("skill_")) skills[key] = data[key];
  });
  return JSON.stringify({
    characterName: data?.characterName,
    ahn: data?.ahn,
    hp: data?.hp,
    hp_max: data?.hp_max,
    sp: data?.sp,
    luck: data?.luck,
    luck_max: data?.luck_max,
    xp: data?.xp,
    level: data?.level,
    stats: data?.stats || null,
    baseStats: data?.baseStats || null,
    modifiers: data?.modifiers || null,
    skills,
    perks: data?.perks || null,
    humanPerks: data?.humanPerks || null,
    mails: data?.mails || null,
    financeTransactions: data?.finance?.transactionHistory || null,
    transacciones: data?.transacciones || null,
    transactions: data?.transactions || null,
    combatStats: data?.combatStats || null,
    icono_jugador: data?.icono_jugador || null,
  });
}

function renderCharacterSheet(data) {
  if (!data) return;
  const nextRenderSignature = characterSheetRenderSignature(data);
  if (nextRenderSignature === lastCharacterSheetRenderSignature) return;
  lastCharacterSheetRenderSignature = nextRenderSignature;

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


  // --- D&D Core Attributes ---
  if (data.stats) {
      const coreStats = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
      coreStats.forEach(stat => {
          const val = data.stats[stat] !== undefined ? data.stats[stat] : 10;
          const inputEl = document.getElementById(`stat-${stat}`);
          if (inputEl && document.activeElement !== inputEl && inputEl.value !== String(val)) {
              inputEl.value = val;
          }
          const mod = Math.floor((val - 10) / 2);
          const modEl = document.getElementById(`mod-${stat}`);
          if (modEl) {
              const nextMod = (mod >= 0 ? '+' : '') + mod;
              if (modEl.textContent !== nextMod) modEl.textContent = nextMod;
          }
      });
  }

  // --- ACTUALIZAR RETRATO DEL HUD DE VITALES ---
  const combatHudPortrait = document.getElementById("portrait-img");

  if (combatHudPortrait) {
    // Al ser un elemento SVG <image>, se debe usar setAttribute con 'href'
    const iconUrl = data.icono_jugador || "https://i.imgur.com/kP8s7Ww.png";
    if (combatHudPortrait.getAttribute("href") !== iconUrl) combatHudPortrait.setAttribute("href", iconUrl);
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
    const dataTrans = (data.finance && data.finance.transactionHistory) ? data.finance.transactionHistory : (data.transacciones || data.transactions);
    if (dataTrans) {
      // Convertir a array, ordenar por fecha y tomar las últimas 3
      const transArray = Object.values(dataTrans)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 5);

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
  // One visual contract for the numeric HP/SP, HP path fill/delay and SP sphere.
  // The data source remains the realtime Player record; Combat authority mirrors
  // its canonical combatant vitals into that same record through the vitals bridge.
  window.LuminousPlayerVitalsHud?.sync?.(data, document);
}

function updatePlayerDeviceNumberUI(data = window.datosJugador) {
  const deviceNumberUI = document.getElementById("player-device-number");
  if (!deviceNumberUI) return;
  const nextText = data?.phoneNumber
    ? `Mi Dispositivo: [${data.phoneNumber}]`
    : "Mi Dispositivo: Sin Red";
  if (deviceNumberUI.innerText !== nextText) deviceNumberUI.innerText = nextText;
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

    const RUNTIME_IGNORED_PLAYER_KEYS = new Set([
      "online",
      "ultima_conexion",
      "backgroundHeartbeat",
      "finance",
      "chats",
      "correos",
      "contactos",
      "mails",
      "transactionHistory",
      "transacciones",
      "transactions",
      "settings",
      "phoneNumber",
      "inventario_activo",
      "inventario_stash",
      "itemInventorySchemaVersion",
    ]);
    const NOTIFICATION_PLAYER_KEYS = new Set([
      "finance",
      "chats",
      "correos",
      "settings",
    ]);
    const CACHE_IGNORED_PLAYER_KEYS = new Set([
      "online",
      "ultima_conexion",
      "backgroundHeartbeat",
      "finance",
      "chats",
      "correos",
      "contactos",
      "mails",
      "transactionHistory",
      "transacciones",
      "transactions",
    ]);
    const CRAFTING_PLAYER_KEYS = new Set([
      "inventario_activo",
      "inventario_stash",
      "recetas",
      "recipes",
      "crafting",
      "materiales",
      "materials",
    ]);
    const EXPRESSION_PLAYER_KEYS = new Set([
      "expresiones",
      "expressions",
      "expression",
      "sprite",
      "icono_jugador",
      "actorId",
      "vinculo_jugador",
      "characterName",
    ]);

    function applyPlayerData(nextData, changedKeys = [], initial = false) {
      window.datosJugador = nextData || {};
      currentPlayerData = window.datosJugador;

      if (initial || changedKeys.includes("phoneNumber")) {
        updatePlayerDeviceNumberUI(window.datosJugador);
      }

      const runtimeRelevant = initial || changedKeys.some((key) => !RUNTIME_IGNORED_PLAYER_KEYS.has(key));
      if (runtimeRelevant) {
        window.dispatchEvent(new CustomEvent("luminous:player-data", {
          detail: {
            playerId,
            data: window.datosJugador,
            changedKeys: [...changedKeys],
            initial,
          },
        }));
      }

      const notificationRelevant = initial || changedKeys.some((key) => NOTIFICATION_PLAYER_KEYS.has(key));
      if (notificationRelevant) {
        window.dispatchEvent(new CustomEvent("luminous:player-notification-data", {
          detail: {
            playerId,
            data: window.datosJugador,
            changedKeys: [...changedKeys],
            initial,
          },
        }));
      }

      const cacheRelevant = initial || changedKeys.some((key) => !CACHE_IGNORED_PLAYER_KEYS.has(key));
      if (cacheRelevant) {
        localStorage.setItem(
          "datosJugadorCache",
          JSON.stringify(window.datosJugador),
        );
      }

      try {
        renderCharacterSheet(window.datosJugador);
      } catch (error) {
        console.error("[Luminous][Boot] Character render failed; keeping core UI alive:", error);
      }

      if (
        typeof window.renderRecetasCrafteo === "function"
        && (initial || changedKeys.some((key) => CRAFTING_PLAYER_KEYS.has(key)))
      ) {
        try {
          window.renderRecetasCrafteo();
        } catch (error) {
          console.error("[Luminous][Boot] Crafting render failed:", error);
        }
      }

      if (
        typeof window.actualizarExpresionesDesdeDropdown === "function"
        && (initial || changedKeys.some((key) => EXPRESSION_PLAYER_KEYS.has(key)))
      ) {
        try {
          window.actualizarExpresionesDesdeDropdown();
        } catch (error) {
          console.error("[Luminous][Boot] Expression render failed:", error);
        }
      }
    }

    // Hydrate once, then listen to top-level child deltas. A change to chat,
    // presence or another unrelated subtree must not rerun every player runtime.
    const initialSnapshot = await playerRef.once("value");
    if (!initialSnapshot.exists() || initialSnapshot.val() === null) {
      throw new Error("Expediente vacío o permisos denegados.");
    }

    const initialData = initialSnapshot.val() || {};
    const knownTopLevelKeys = new Set(Object.keys(initialData));
    applyPlayerData(initialData, Object.keys(initialData), true);

    playerRef.on("child_changed", (snap) => {
      const key = snap.key;
      if (!key) return;
      const nextData = { ...(window.datosJugador || {}), [key]: snap.val() };
      knownTopLevelKeys.add(key);
      applyPlayerData(nextData, [key], false);
    });

    playerRef.on("child_removed", (snap) => {
      const key = snap.key;
      if (!key) return;
      const nextData = { ...(window.datosJugador || {}) };
      delete nextData[key];
      knownTopLevelKeys.delete(key);
      applyPlayerData(nextData, [key], false);
    });

    playerRef.on("child_added", (snap) => {
      const key = snap.key;
      if (!key || knownTopLevelKeys.has(key)) return;
      knownTopLevelKeys.add(key);
      const nextData = { ...(window.datosJugador || {}), [key]: snap.val() };
      applyPlayerData(nextData, [key], false);
    });

    // Success: core interaction must come up even if one optional UI subsystem is malformed.
    window.hideLoadingOverlay();
    try {
      initializeCharacterSheet(); // Bind Theatre/HUD/phone controls after canonical player hydration.
    } catch (error) {
      console.error("[Luminous][Boot] Core sheet initialization partially failed:", error);
      window.dispatchEvent(new CustomEvent("luminous:player-ui-init-error", { detail: { error } }));
    }
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

  // Contracts are lazy: subscribe only while the Contracts tab is actually open.
  window.LuminousPlayerContractsRuntime?.dispose?.();

  // --- DESCARGAR ACTORES PARA EL JUGADOR ---
  if (typeof db !== "undefined") {
    if (!actorListenerActive) {
      actorListenerActive = true;

      let rawActorsCache = {};
      let npcsCache = {};

      function refreshAllActoresCache() {
          window.actoresJugador = {};
          // Load legacy path first
          for (const [id, data] of Object.entries(rawActorsCache)) {
              window.actoresJugador[id] = data;
          }
          // Load modern path second (overwrites if collision)
          for (const [id, data] of Object.entries(npcsCache)) {
              window.actoresJugador[id] = data;
          }
          window.allActoresCache = window.actoresJugador; // Usado para pintar iconos en el chat

          // Disparar un evento para que el log se re-renderice si ya estaba cargado
          const event = new CustomEvent("actoresCacheUpdated");
          window.dispatchEvent(event);

          const assignedActorId = window.datosJugador?.actorId;
          if (assignedActorId && window.actoresJugador[assignedActorId]) {
            const actorData = window.actoresJugador[assignedActorId];

            // Sincronizar el phoneNumber del Actor con el nodo del Jugador
            if (actorData.phoneNumber && window.datosJugador && window.datosJugador.phoneNumber !== actorData.phoneNumber) {
               db.ref(`campaña/jugadores/${playerId}`).update({
                   phoneNumber: actorData.phoneNumber
               });
            }
          }
          if (window.syncPlayerTheatreComposer) window.syncPlayerTheatreComposer();
      }

      let actorLoadGeneration = 0;
      const loadActorsForTheatre = () => {
        const generation = ++actorLoadGeneration;
        Promise.all([
          db.ref("campaña/actores").once("value"),
          db.ref("campaña/base_datos_npcs").once("value"),
        ]).then(([actorsSnap, npcsSnap]) => {
          if (generation !== actorLoadGeneration) return;
          rawActorsCache = actorsSnap.val() || {};
          npcsCache = npcsSnap.val() || {};
          refreshAllActoresCache();
        }).catch((error) => {
          console.error("[Luminous] No se pudo cargar el cache de actores del teatro:", error);
        });
      };

      const syncActorCacheLifecycle = (theatreActive) => {
        if (theatreActive) {
          loadActorsForTheatre();
          return;
        }
        actorLoadGeneration += 1;
        rawActorsCache = {};
        npcsCache = {};
        window.actoresJugador = {};
        window.allActoresCache = window.actoresJugador;
      };

      window.addEventListener("luminous:player-instance-changed", (event) => {
        syncActorCacheLifecycle(event?.detail?.theatreActive === true);
      });
      syncActorCacheLifecycle(document.body?.classList?.contains("player-instance-theatre") === true);
    }
  }

  // --- REPARACIÓN: LÓGICA DE ENVÍO Y LECTURA DEL TEATRO DE LA MENTE ---
  {
    function resolveTheatreLogIcon(msg, actorsCache, fallbackIcon) {
      const cache =
        actorsCache && typeof actorsCache === "object"
          ? actorsCache
          : {};

      const actors = Object.values(cache);

      const actorById = msg.actorId
        ? cache[msg.actorId] ||
          actors.find((actor) => actor.id === msg.actorId)
        : null;

      const normalizedName =
        typeof msg.nombre === "string"
          ? msg.nombre.trim().toLowerCase()
          : "";

      const actorByName =
        !actorById && normalizedName
          ? actors.find(
              (actor) =>
                typeof actor.nombre === "string" &&
                actor.nombre.trim().toLowerCase() === normalizedName,
            )
          : null;

      const cachedIcon =
        actorById?.icon_url ||
        actorById?.avatar ||
        actorById?.icono ||
        actorById?.icono_jugador ||
        actorByName?.icon_url ||
        actorByName?.avatar ||
        actorByName?.icono ||
        actorByName?.icono_jugador ||
        "";

      return msg.icono || cachedIcon || fallbackIcon;
    }

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

            const iconoSrc = resolveTheatreLogIcon(
              msg,
              window.allActoresCache,
              defaultFallbackIcon,
            );

            row.innerHTML = `
                        <div class="character-col">
                          <div class="hex-border">
                            <div class="hex-portrait">
                              <img src="${iconoSrc}" alt="${msg.nombre || "Desconocido"}">
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

      const theatreLogRef = db.ref("campaña/teatro/log").limitToLast(20);
      const theatreBlockRef = db.ref("campaña/teatro/bloqueo_interaccion");
      let theatreRealtimeBound = false;

      const theatreLogHandler = (snap) => {
        ultimoSnapLog = snap;
        renderizarLog(snap);
      };
      const theatreBlockHandler = (snap) => {
        window.isTheatreBlocked = snap.val();
        if (window.syncPlayerTheatreComposer) window.syncPlayerTheatreComposer();
      };
      const syncTheatreRealtime = (active) => {
        if (active && !theatreRealtimeBound) {
          theatreRealtimeBound = true;
          theatreLogRef.on("value", theatreLogHandler);
          theatreBlockRef.on("value", theatreBlockHandler);
          return;
        }
        if (!active && theatreRealtimeBound) {
          theatreRealtimeBound = false;
          theatreLogRef.off("value", theatreLogHandler);
          theatreBlockRef.off("value", theatreBlockHandler);
          ultimoSnapLog = null;
          window.isTheatreBlocked = false;
        }
      };

      window.addEventListener("actoresCacheUpdated", () => {
        if (ultimoSnapLog) renderizarLog(ultimoSnapLog);
      });
      window.addEventListener("luminous:player-instance-changed", (event) => {
        syncTheatreRealtime(event?.detail?.theatreActive === true);
      });
      syncTheatreRealtime(document.body?.classList?.contains("player-instance-theatre") === true);
    }

    // === ENVÍO AL TEATRO DE LA MENTE ===
    const btnSend = document.getElementById("btn-enviar-teatro-modal");
    const inputEl = document.getElementById("input-teatro-modal");
    const DEFAULT_TITLE_COLOR = "#3b2918";

    function normalizeAssignedTheatreActorIds(value) {
      const canonical = window.LuminousTheatreState?.normalizeAssignedActorIds;
      if (typeof canonical === "function") return canonical(value);
      const out = [];
      const visit = (candidate) => {
        if (candidate === undefined || candidate === null || candidate === false) return;
        if (Array.isArray(candidate)) return candidate.forEach(visit);
        if (typeof candidate === "object") {
          if (candidate.actorId !== undefined) visit(candidate.actorId);
          if (candidate.id !== undefined) visit(candidate.id);
          Object.entries(candidate).forEach(([key, entry]) => {
            if (key === "actorId" || key === "id") return;
            if (entry === true || entry === 1) visit(key);
            else visit(entry);
          });
          return;
        }
        const id = String(candidate).trim();
        if (id && id !== "true" && id !== "false" && !out.includes(id)) out.push(id);
      };
      visit(value);
      return out;
    }

    async function resolveTheatreActorForSend() {
      const selectedId = document.getElementById("player-actor-select")?.value || "";
      const assignedSource =
        window.datosJugador?.actorId ??
        window.datosJugador?.vinculo_jugador ??
        null;
      const assignedIds = normalizeAssignedTheatreActorIds(assignedSource);
      const preferredId = selectedId || assignedIds[0] || "";

      const resolved = window.getAssignedTheatreActor?.();
      if (resolved) return resolved;
      if (!preferredId) return null;

      const cached =
        window.actoresJugador?.[preferredId] ||
        window.allActoresCache?.[preferredId];
      if (cached) return { actorId: preferredId, ...cached };

      // The send path must not depend on the Theatre cache having finished loading.
      const [actorSnap, npcSnap] = await Promise.all([
        db.ref(`campaña/actores/${preferredId}`).once("value"),
        db.ref(`campaña/base_datos_npcs/${preferredId}`).once("value"),
      ]);
      const actorData = actorSnap.val() || npcSnap.val();
      if (!actorData) return null;

      window.actoresJugador = window.actoresJugador || {};
      window.actoresJugador[preferredId] = actorData;
      window.allActoresCache = window.actoresJugador;
      window.dispatchEvent(new CustomEvent("actoresCacheUpdated"));
      return { actorId: preferredId, ...actorData };
    }

    const sendTheatreMessage = async () => {
      const domInput = document.getElementById("input-teatro-modal");
      const sendButton = document.getElementById("btn-enviar-teatro-modal");
      if (!domInput || !domInput.value.trim() || typeof db === "undefined") return;
      if (sendButton?.dataset.sending === "true") return;

      if (sendButton) {
        sendButton.dataset.sending = "true";
        sendButton.disabled = true;
      }

      try {
        const msgText = domInput.value.trim();
        const selectExp = document.getElementById("player-expression");
        const actorAssigned = await resolveTheatreActorForSend();

        if (!actorAssigned?.actorId) {
          throw new Error("No se pudo resolver el actor asignado para Theater.");
        }

        const resolveCanonicalIdentityText = window.LuminousTheatreState?.resolveCanonicalIdentityText || ((...values) => {
          for (const value of values) {
            const candidate = typeof value === "string" ? value.trim() : "";
            if (candidate && !/^\?{3,}$/.test(candidate)) return candidate;
          }
          return "";
        });

        const actorParaEnviar = {
          nombre: resolveCanonicalIdentityText(
            actorAssigned.nombre,
            actorAssigned.name,
            window.datosJugador?.characterName,
            window.datosJugador?.character_name,
            window.datosJugador?.nombre,
            window.datosJugador?.name
          ) || "Jugador",
          titulo: resolveCanonicalIdentityText(
            actorAssigned.titulo,
            actorAssigned.title,
            window.datosJugador?.titulo,
            window.datosJugador?.title
          ),
          color_nombre: actorAssigned.color_nombre || "#ffffff",
          color_titulo: actorAssigned.color_titulo || DEFAULT_TITLE_COLOR,
          escala: actorAssigned.escala !== undefined ? parseFloat(actorAssigned.escala) : 1.0,
          sprite: actorAssigned.sprite || null,
          icono: actorAssigned.icono || null,
          icono_jugador: actorAssigned.icono_jugador || null,
        };

        let selectedSprite = actorParaEnviar.sprite;
        let selectedExpression = "Neutral";
        if (selectExp && selectExp.style.display !== "none" && selectExp.options.length > 0) {
          const val = selectExp.value;
          if (val && val.trim() !== "") {
            selectedExpression = val;
            const expOpt = selectExp.options[selectExp.selectedIndex];
            if (expOpt?.dataset?.sprite) selectedSprite = expOpt.dataset.sprite;
          }
        }

        const tipoDialogoEl = document.getElementById("player-tipo-dialogo-select");
        const tipoDialogo = tipoDialogoEl?.value || "dialogo";
        const payload = {
          actorId: actorAssigned.actorId,
          nombre: actorParaEnviar.nombre,
          titulo: actorParaEnviar.titulo || "",
          color_nombre: actorParaEnviar.color_nombre,
          color_titulo: actorParaEnviar.color_titulo,
          escala: Number.isFinite(actorParaEnviar.escala) ? actorParaEnviar.escala : 1.0,
          expression: selectedExpression,
          sprite: selectedSprite || null,
          icono:
            actorParaEnviar.icono ||
            actorParaEnviar.icono_jugador ||
            window.datosJugador?.icono_jugador ||
            window.datosJugador?.icono ||
            null,
          mensaje: msgText,
          tipo_dialogo: tipoDialogo,
          mostrar_identidad: tipoDialogo !== "pensamiento",
        };

        const queuePath =
          window.LuminousTheatreState?.getPaths?.().queue ||
          "campaña/teatro/cola";
        await db.ref(queuePath).push({
          ...payload,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
        });

        domInput.value = "";
        const modal = document.getElementById("modal-escritura-teatro");
        if (modal) modal.style.display = "none";
      } catch (error) {
        console.error("[Luminous][Theatre] No se pudo enviar el mensaje:", error);
        alert(error?.message || "No se pudo enviar el mensaje al Theater.");
      } finally {
        const currentButton = document.getElementById("btn-enviar-teatro-modal");
        if (currentButton) {
          currentButton.dataset.sending = "false";
          currentButton.disabled = Boolean(window.isTheatreBlocked);
        }
      }
    };

    // Keep the original DOM nodes. Replacing them with clones silently removes
    // listeners installed by Theatre compatibility modules.
    if (btnSend && btnSend.dataset.theatreSendBound !== "true") {
      btnSend.dataset.theatreSendBound = "true";
      btnSend.addEventListener("click", sendTheatreMessage);
    }

    if (inputEl && inputEl.dataset.theatreSendBound !== "true") {
      inputEl.dataset.theatreSendBound = "true";
      inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendTheatreMessage();
        }
      });
    }
  }


  window.getAssignedTheatreActor = function() {
    // 1. Return the one explicitly selected by the user in the selector (if visible and valid)
    const selectActor = document.getElementById("player-actor-select");
    if (selectActor && selectActor.value) {
        const selId = selectActor.value;
        const selActor = window.actoresJugador && window.actoresJugador[selId];
        if (selActor) {
            return { actorId: selId, ...selActor };
        }
    }

    // 2. Fallback to the assigned ones
    const assignedIds = normalizeAssignedTheatreActorIds(
        window.datosJugador?.actorId ?? window.datosJugador?.vinculo_jugador ?? null
    );

    if (!assignedIds || assignedIds.length === 0) return null;

    const firstValidId = assignedIds.find(id => window.actoresJugador && window.actoresJugador[id]);
    if (firstValidId) {
        return { actorId: firstValidId, ...window.actoresJugador[firstValidId] };
    }

    return null;
  };

  window.syncPlayerTheatreComposer = function(forceActorChange = false) {
      const assignedIds = normalizeAssignedTheatreActorIds(
          window.datosJugador?.actorId ?? window.datosJugador?.vinculo_jugador ?? null
      );

      const selectActor = document.getElementById("player-actor-select");

      if (selectActor && !forceActorChange) {
          const currentVal = selectActor.value;
          selectActor.innerHTML = "";

          let validCount = 0;
          assignedIds.forEach(id => {
              const ac = window.actoresJugador && window.actoresJugador[id];
              if (ac) {
                  validCount++;
                  const opt = document.createElement("option");
                  opt.value = id;
                  opt.textContent = ac.nombre || "Personaje";
                  if (id === currentVal) opt.selected = true;
                  selectActor.appendChild(opt);
              }
          });

          if (validCount <= 1) {
              selectActor.style.display = "none";
          } else {
              selectActor.style.display = "block";
          }

          // Add event listener only once (prevent duplicates)
          if (!selectActor.dataset.listenerAttached) {
              selectActor.addEventListener("change", () => {
                  window.syncPlayerTheatreComposer(true); // force UI refresh for newly selected actor
              });
              selectActor.dataset.listenerAttached = "true";
          }
      }

      const assignedActor = window.getAssignedTheatreActor();

      if (!assignedActor && assignedIds.length && !window.__luminousTheatreActorHydrationPending) {
          window.__luminousTheatreActorHydrationPending = true;
          resolveTheatreActorForSend()
              .then((actor) => {
                  if (actor) window.syncPlayerTheatreComposer?.(true);
              })
              .catch((error) => {
                  console.error("[Luminous][Theatre] No se pudo hidratar el actor asignado:", error);
              })
              .finally(() => {
                  window.__luminousTheatreActorHydrationPending = false;
              });
      }

      const exprSelect = document.getElementById("player-expression");
      const btnSend = document.getElementById("btn-enviar-teatro-modal");
      const inputEl = document.getElementById("input-teatro-modal");
      const modalNameEl = document.getElementById("theatre-modal-readonly-name");
      const modalTitleEl = document.getElementById("theatre-modal-readonly-title");
      const modalIconEl = document.getElementById("theatre-modal-readonly-icon");

      if (assignedActor) {
          if (exprSelect) {
              const currentExp = exprSelect.value;
              exprSelect.innerHTML = "";
              let hasExpressions = false;
              if (assignedActor.expresiones) {
                  for (const expName in assignedActor.expresiones) {
                      hasExpressions = true;
                      const opt = document.createElement("option");
                      opt.value = expName;
                      opt.textContent = expName;

                      const expressionData = assignedActor.expresiones[expName];
                      const spriteUrl = typeof expressionData === "string" ? expressionData : (expressionData?.sprite || "");
                      opt.dataset.sprite = spriteUrl;

                      if (expName === currentExp) opt.selected = true;
                      exprSelect.appendChild(opt);
                  }
              }
              if (!hasExpressions) {
                  exprSelect.innerHTML = '<option value="Neutral">Neutral</option>';
              }
          }

          if (modalNameEl) {
              modalNameEl.textContent = assignedActor.nombre || 'Jugador';

              const colorNombre = assignedActor.color_nombre || "#4a4a4a";
              modalNameEl.style.setProperty("color", "#ffffff", "important");
              modalNameEl.style.setProperty("background", `linear-gradient(90deg, ${colorNombre} 0%, ${colorNombre} 68%, #17110b 100%)`, "important");
              modalNameEl.style.setProperty("border-left", `4px solid ${colorNombre}`, "important");
              modalNameEl.style.padding = "2px 20px";
          }

          if (modalTitleEl) {
              if (assignedActor.titulo) {
                  modalTitleEl.textContent = assignedActor.titulo;
                  modalTitleEl.style.display = 'inline';

                  const colorTitulo = assignedActor.color_titulo || "#4a4a4a";
                  modalTitleEl.style.setProperty("color", "#ffffff", "important");
                  modalTitleEl.style.setProperty("background", `linear-gradient(90deg, ${colorTitulo} 0%, ${colorTitulo} 68%, #17110b 100%)`, "important");
                  modalTitleEl.style.setProperty("border-left", `4px solid ${colorTitulo}`, "important");
                  modalTitleEl.style.padding = "2px 20px";
              } else {
                  modalTitleEl.style.display = 'none';
              }
          }

          if (modalIconEl) {
              const iconUrl = assignedActor.icono || assignedActor.icono_jugador || window.datosJugador?.icono_jugador || window.datosJugador?.icono;
              if (iconUrl) {
                  modalIconEl.src = iconUrl;
                  modalIconEl.style.display = 'block';
              } else {
                  modalIconEl.style.display = 'none';
              }
          }

          if (btnSend) {
              if (window.isTheatreBlocked) {
                  btnSend.disabled = true;
                  btnSend.style.opacity = '0.5';
                  btnSend.title = "El Teatro está bloqueado por el Director.";
                  if(inputEl) {
                      inputEl.disabled = true;
                      inputEl.placeholder = "Escritura bloqueada en Modo Narrativo...";
                  }
              } else {
                  btnSend.disabled = false;
                  btnSend.style.opacity = '1';
                  btnSend.title = "Enviar Actuación";
                  if(inputEl) {
                      inputEl.disabled = false;
                      inputEl.placeholder = "Describe tu acción o diálogo...";
                  }
              }
          }
      } else {
          // Bloquear si no hay actor
          if (btnSend) {
              btnSend.disabled = true;
              btnSend.style.opacity = '0.5';
              btnSend.title = "No tienes personajes asignados.";
          }
          if (inputEl) {
              inputEl.disabled = true;
              inputEl.placeholder = "Requiere asignar un actor...";
          }
          if (modalNameEl) modalNameEl.textContent = "Sin Asignar";
          if (modalTitleEl) modalTitleEl.style.display = "none";
          if (modalIconEl) modalIconEl.style.display = "none";
      }
  };

  const btnAbrirModal = document.getElementById('btn-abrir-escritura');
  if (btnAbrirModal) {
      btnAbrirModal.addEventListener('click', () => {
          const modal = document.getElementById('modal-escritura-teatro');
          if (modal) {
              modal.style.display = 'flex';
              if (window.syncPlayerTheatreComposer) window.syncPlayerTheatreComposer();
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
        const terminalHidden = phoneWrapper.classList.contains("phone-hidden");
        if (terminalHidden) {
          window.LuminousPlayerContractsRuntime?.dispose?.();
        } else {
          const activeTab =
            document.querySelector('input[name="attr_tab"]')?.value ||
            document.querySelector(".sheet-state-tab")?.value ||
            "";
          if (activeTab === "contratos") {
            window.LuminousPlayerContractsRuntime?.init?.({ db, playerId });
          }
        }
        window.LuminousInstanceControl?.syncPlayerCombatOcclusion?.(document);
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


    function checkCellphone(playerKey, callback) {
      if (!playerKey) {
        callback(false);
        return;
      }

      db.ref(`campaña/jugadores/${playerKey}`).once("value")
        .then((playerSnap) => {
          const playerData = playerSnap.val() || {};

          // A provisioned phone number means the player's terminal is ready.
          // Keep inventory detection as a legacy fallback for unprovisioned characters.
          if (String(playerData.phoneNumber || "").trim()) {
            callback(true);
            return;
          }

          let hasCellphone = false;
          const inventories = [
            playerData.inventario_activo || {},
            playerData.inventario_stash || {}
          ];

          inventories.forEach((inv) => {
            Object.values(inv).forEach((item) => {
              const tags = Array.isArray(item?.tags)
                ? item.tags.join(" ")
                : String(item?.tags || "");
              if (
                item?.id === "cellphone" ||
                tags.toLowerCase().includes("cellphone")
              ) {
                hasCellphone = true;
              }
            });
          });

          callback(hasCellphone);
        })
        .catch((error) => {
          console.error("[Luminous][Phone] No se pudo verificar el dispositivo:", error);
          callback(false);
        });
    }

    // Tab switching logic for Main Nav
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('button[type="action"]');
      if (!btn || !btn.name || !btn.name.startsWith("act_tab_")) return;

      const tabName = btn.name.replace("act_tab_", "");

      if (tabName === "contratos") {
        window.LuminousPlayerContractsRuntime?.init?.({ db, playerId });
      } else {
        window.LuminousPlayerContractsRuntime?.dispose?.();
      }

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

        if (tabName === "banco" || tabName === "mail") {
          if (playerId) {
            checkCellphone(playerId, (hasDevice) => {
              const overlay = targetTab.querySelector('.sheet-no-signal-overlay');
              const bodyElements = targetTab.querySelectorAll('.sheet-app-body, .sheet-app-body-mail');

              if (!hasDevice) {
                if (overlay) overlay.style.display = "flex";
                bodyElements.forEach(el => el.style.display = "none");
              } else {
                if (overlay) overlay.style.display = "none";
                bodyElements.forEach((el) => {
                  // Bank is a vertical document; forcing flex here collapses its
                  // balance card, transfer CTA and history into side-by-side columns.
                  el.style.display = tabName === "banco" ? "block" : "flex";
                });
              }

              if (tabName === "banco") {
                  // Limpiar unread transacciones usando la key canónica del jugador.
                  const txRef = db.ref(`campaña/jugadores/${playerId}/finance/transactionHistory`);
                  txRef.once("value", snap => {
                      const updates = {};
                      let hasUpdates = false;
                      snap.forEach(child => {
                          const tx = child.val();
                          if (tx.unread) {
                              updates[`${child.key}/unread`] = false;
                              hasUpdates = true;
                          }
                      });
                      if (hasUpdates) txRef.update(updates);
                  });
              }
            });
          }
        }
      }
    });

    // Show Home by default
    document
      .querySelectorAll(".sheet-tab-content")
      .forEach((el) => (el.style.display = "none"));
    const homeTab = document.querySelector(".sheet-tab-home");
    if (homeTab) homeTab.style.display = "block";


  // Transferencia P2P por inbox.
  // El emisor solo modifica su propio saldo y crea un paquete para el receptor.
  // El receptor acredita el paquete desde su propia sesión; processedP2P evita dobles créditos.
  const btnOpenTransfer = document.getElementById("btn-open-transfer");
  const transferModal = document.getElementById("transfer-modal");
  const btnCancelTransfer = document.getElementById("btn-cancel-transfer");
  const btnConfirmTransfer = document.getElementById("btn-confirm-transfer");
  let p2pInboxListenerActive = false;

  function normalizePhoneLookup(value) {
      return String(value || "").trim().replace(/\s+/g, "");
  }

  function resolveTransferLookup(rawValue) {
      const raw = String(rawValue || "").trim();
      if (!raw) return "";
      const normalizedRaw = normalizePhoneLookup(raw);
      const aliasMatch = Object.entries(contactsDictionary || {}).find(([, alias]) =>
          String(alias || "").trim().toLowerCase() === raw.toLowerCase()
      );
      return aliasMatch ? normalizePhoneLookup(aliasMatch[0]) : normalizedRaw;
  }

  function closeTransferModal() {
      if (!transferModal) return;
      transferModal.style.display = "none";
      ["transfer-contact-input", "transfer-amount-input", "transfer-concept-input"].forEach((id) => {
          const input = document.getElementById(id);
          if (input) input.value = "";
      });
  }

  async function queuePlayerTransfer(senderId, targetPlayerId, targetData, amount, concept) {
      if (!senderId || !targetPlayerId) throw new Error("Identificador de transferencia inválido.");
      if (senderId === targetPlayerId) throw new Error("No puedes transferirte Ahn a ti mismo.");

      const senderRef = db.ref(`campaña/jugadores/${senderId}`);
      const transferId = db.ref(`campaña/jugadores/${senderId}/p2pOutbox`).push().key;
      if (!transferId) throw new Error("No se pudo generar la transferencia.");

      let abortReason = "";
      let targetName = targetData.characterName || targetData.character_name || targetData.nombre || targetPlayerId;

      const result = await senderRef.transaction((current) => {
          if (!current) {
              abortReason = "No se encontró tu cuenta.";
              return;
          }

          const currentBalance = Number(current.finance?.currentBalance ?? current.ahn ?? 0);
          if (!Number.isFinite(currentBalance) || currentBalance < amount) {
              abortReason = "Ahn insuficientes para esta transferencia.";
              return;
          }

          const timestamp = Date.now();
          const senderName = current.characterName || current.character_name || current.nombre || senderId;
          targetName = targetData.characterName || targetData.character_name || targetData.nombre || targetPlayerId;
          const nextBalance = currentBalance - amount;
          const txOut = {
              id: transferId,
              monto: -amount,
              concepto: `A: ${targetName} - ${concept}`,
              timestamp,
              unread: true,
              type: "p2p_out"
          };

          const packet = {
              transferId,
              senderPlayerId: senderId,
              senderUid: auth.currentUser?.uid || current.uid || null,
              senderName,
              senderPhone: current.phoneNumber || "",
              recipientPlayerId: targetPlayerId,
              recipientUid: targetData.uid || null,
              recipientName: targetName,
              amount,
              concept,
              createdAt: timestamp,
              status: "pending"
          };

          current.ahn = nextBalance;
          current.finance = current.finance || {};
          current.finance.currentBalance = nextBalance;
          current.finance.transactionHistory = current.finance.transactionHistory || {};
          current.finance.transactionHistory[transferId] = txOut;
          current.transacciones = current.transacciones || {};
          current.transacciones[transferId] = txOut;
          current.p2pOutbox = current.p2pOutbox || {};
          current.p2pOutbox[transferId] = packet;
          return current;
      });

      if (!result.committed) {
          throw new Error(abortReason || "No se pudo registrar la transferencia.");
      }

      return { transferId, targetName };
  }

  function initP2PInboxSettlement() {
      if (p2pInboxListenerActive || !playerId) return;
      p2pInboxListenerActive = true;

      const inFlight = new Set();

      async function settlePacket(packet, transferId) {
          const amount = Number(packet?.amount);
          if (
              !transferId ||
              packet?.recipientPlayerId !== playerId ||
              !Number.isFinite(amount) ||
              amount <= 0 ||
              inFlight.has(transferId)
          ) {
              return;
          }

          inFlight.add(transferId);
          try {
              const recipientRef = db.ref(`campaña/jugadores/${playerId}`);
              const result = await recipientRef.transaction((current) => {
                  if (!current) return current;

                  current.finance = current.finance || {};
                  current.finance.transactionHistory = current.finance.transactionHistory || {};
                  current.transacciones = current.transacciones || {};
                  current.processedP2P = current.processedP2P || {};

                  if (current.processedP2P[transferId]) return current;

                  const currentBalance = Number(current.finance.currentBalance ?? current.ahn ?? 0);
                  const nextBalance = currentBalance + amount;
                  const txIn = {
                      id: transferId,
                      monto: amount,
                      concepto: `De: ${packet.senderName || packet.senderPlayerId || "Contacto"} - ${packet.concept || "Transferencia P2P"}`,
                      timestamp: packet.createdAt || Date.now(),
                      unread: true,
                      type: "p2p_in"
                  };

                  current.ahn = nextBalance;
                  current.finance.currentBalance = nextBalance;
                  current.finance.transactionHistory[transferId] = txIn;
                  current.transacciones[transferId] = txIn;
                  current.processedP2P[transferId] = packet.createdAt || Date.now();
                  return current;
              });

              if (!result.committed) {
                  console.error("[Luminous][P2P] No se pudo acreditar transferencia:", transferId);
              }
          } catch (error) {
              console.error("[Luminous][P2P] No se pudo liquidar transferencia:", transferId, error);
          } finally {
              inFlight.delete(transferId);
          }
      }

      function inspectSenderSnapshot(senderSnap) {
          const senderData = senderSnap?.val?.() || {};
          const outbox = senderData.p2pOutbox || {};
          for (const [transferId, packet] of Object.entries(outbox)) {
              if (packet?.recipientPlayerId === playerId) {
                  settlePacket(packet, packet.transferId || transferId);
              }
          }
      }

      // Sender-owned outboxes work with the long-standing player write rules:
      // sender writes only their node, recipient reads campaign data and credits only their own node.
      const playersRef = db.ref("campaña/jugadores");
      playersRef.on("child_added", inspectSenderSnapshot);
      playersRef.on("child_changed", inspectSenderSnapshot);

      // Backwards compatibility: settle packets created by the short-lived p2pInbox implementation.
      const legacyInboxRef = db.ref(`campaña/economia/p2pInbox/${playerId}`);
      legacyInboxRef.on("child_added", (snap) => {
          const packet = snap.val() || {};
          settlePacket(packet, packet.transferId || snap.key);
      });
  }

  initP2PInboxSettlement();

  if (btnOpenTransfer && transferModal) {
    btnOpenTransfer.addEventListener("click", () => {
        transferModal.style.display = "flex";
        const contactInput = document.getElementById("transfer-contact-input");
        const options = document.getElementById("transfer-contact-options");
        if (contactInput) contactInput.setAttribute("list", "transfer-contact-options");
        if (options) {
            options.innerHTML = "";
            for (const [phone, alias] of Object.entries(contactsDictionary || {})) {
                const option = document.createElement("option");
                option.value = alias || phone;
                option.label = phone;
                options.appendChild(option);
            }
        }
    });

    btnCancelTransfer?.addEventListener("click", closeTransferModal);

    btnConfirmTransfer?.addEventListener("click", async () => {
        const contactInput = document.getElementById("transfer-contact-input")?.value.trim() || "";
        const amount = Number.parseInt(document.getElementById("transfer-amount-input")?.value || "", 10);
        const concept = document.getElementById("transfer-concept-input")?.value.trim() || "Transferencia P2P";

        if (!contactInput || !Number.isFinite(amount) || amount <= 0) {
            alert("Datos inválidos.");
            return;
        }

        const lookup = resolveTransferLookup(contactInput);
        btnConfirmTransfer.disabled = true;

        try {
            const snap = await db.ref("campaña/jugadores").once("value");
            const players = snap.val() || {};
            let targetPlayerId = null;
            let targetData = null;

            for (const [candidateId, candidateData] of Object.entries(players)) {
                const candidatePhone = normalizePhoneLookup(candidateData?.phoneNumber);
                const candidateName = String(candidateData?.characterName || candidateData?.character_name || candidateData?.nombre || "").trim().toLowerCase();
                if (
                    candidatePhone === lookup ||
                    candidateId.toLowerCase() === contactInput.toLowerCase() ||
                    candidateName === contactInput.toLowerCase()
                ) {
                    targetPlayerId = candidateId;
                    targetData = candidateData;
                    break;
                }
            }

            if (!targetPlayerId || !targetData) {
                throw new Error("Destinatario no encontrado. Usa un contacto guardado o un número asignado.");
            }

            const result = await queuePlayerTransfer(playerId, targetPlayerId, targetData, amount, concept);
            alert(`Transferencia de ${amount} Ahn a ${result.targetName} enviada.`);
            closeTransferModal();
        } catch (error) {
            console.error("[Luminous][P2P] Error de transferencia:", error);
            alert(error?.message || "No se pudo completar la transferencia.");
        } finally {
            btnConfirmTransfer.disabled = false;
        }
    });
  }

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

  // --- GLOBALS FOR CHAT ---
  let chatListenerActive = false;
  let currentChatId = null;
  let currentChatType = null;
  let currentGroupMeta = null;
  let myPhoneNumber = null;
  let contactsDictionary = {}; // phoneNumber -> alias
  let knownPortraits = {}; // phoneNumber -> sprite URL
  let legacyChatIds = {};
  let chatPlayersCache = {};
  let groupPlayerFingerprints = {};
  let groupSyncTimer = null;
  let discoveredPhoneGroups = {};
  let groupEditId = null;
  let chatListRenderGeneration = 0;
  let activeLegacyMessagesRef = null;
  let activeLegacyMessagesListener = null;

  function normalizeChatPhone(value) {
      return String(value || "").trim().replace(/\s+/g, "");
  }

  function playerChatDisplayName(playerKey, data = {}) {
      return (
          data.characterName ||
          data.character_name ||
          data.nombre ||
          data.name ||
          playerKey
      );
  }

  function groupMemberIds(group = {}) {
      return Object.keys(group.members || {}).filter(Boolean);
  }

  function groupHasMember(group, memberPlayerId) {
      return Boolean(memberPlayerId && group?.members?.[memberPlayerId]);
  }

  function collectDiscoveredPhoneGroups(players = {}) {
      const groups = {};
      for (const [ownerPlayerId, ownerData] of Object.entries(players)) {
          for (const [groupId, rawGroup] of Object.entries(ownerData?.phoneGroups || {})) {
              if (!rawGroup || rawGroup.active === false) continue;
              const group = {
                  ...rawGroup,
                  groupId: rawGroup.groupId || groupId,
                  ownerPlayerId: rawGroup.ownerPlayerId || ownerPlayerId,
              };
              if (groupHasMember(group, playerId)) groups[group.groupId] = group;
          }
      }
      return groups;
  }

  function groupLastMessageTimestamp(groupId, group = {}) {
      let latest = Number(group.updatedAt || group.createdAt) || 0;
      const allowed = new Set(groupMemberIds(group));
      for (const [senderPlayerId, senderData] of Object.entries(chatPlayersCache || {})) {
          if (!allowed.has(senderPlayerId)) continue;
          const messages = senderData?.phoneGroupMessages?.[groupId] || {};
          for (const message of Object.values(messages)) {
              latest = Math.max(latest, Number(message?.timestamp) || 0);
          }
      }
      return latest;
  }

  function refreshGroupUnreadState() {
      const reads = chatPlayersCache?.[playerId]?.phoneGroupReads || {};
      window.__luminousUnreadGroupChat = Object.values(discoveredPhoneGroups).some((group) => {
          const lastRead = Number(reads?.[group.groupId]) || 0;
          return groupLastMessageTimestamp(group.groupId, group) > lastRead;
      });
      window.updateNotifications?.();
  }

  function stopLegacyChatListener() {
      if (activeLegacyMessagesRef && activeLegacyMessagesListener) {
          activeLegacyMessagesRef.off("value", activeLegacyMessagesListener);
      }
      activeLegacyMessagesRef = null;
      activeLegacyMessagesListener = null;
  }

  function clearActiveChat(message = "Selecciona un Chat") {
      stopLegacyChatListener();
      currentChatId = null;
      currentChatType = null;
      currentGroupMeta = null;
      const headerName = document.getElementById("chat-header-name");
      if (headerName) headerName.innerText = message;
      const manage = document.getElementById("btn-manage-group");
      if (manage) manage.style.display = "none";
      const save = document.getElementById("btn-save-contact");
      if (save) save.style.display = "none";
      const messages = document.getElementById("chat-messages");
      if (messages) messages.innerHTML = "";
  }

  function renderMessageBubble(container, { isMe, senderName, text, timestamp }) {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = isMe ? "flex-end" : "flex-start";

      const bubble = document.createElement("div");
      bubble.style.maxWidth = "80%";
      bubble.style.padding = "8px 12px";
      bubble.style.borderRadius = "4px";
      bubble.style.background = isMe ? "var(--cyan-tech)" : "#222";
      bubble.style.color = isMe ? "#000" : "#fff";
      bubble.style.border = isMe ? "none" : "1px solid #444";
      bubble.style.fontFamily = "'Share Tech Mono', monospace";
      bubble.style.overflowWrap = "anywhere";

      const sender = document.createElement("strong");
      sender.style.cssText = "font-size:0.8em;display:block;opacity:0.7;margin-bottom:2px;";
      sender.textContent = senderName || "Contacto";
      bubble.appendChild(sender);
      bubble.appendChild(document.createTextNode(String(text || "")));

      if (timestamp) {
          const time = document.createElement("small");
          time.style.cssText = "display:block;opacity:.55;margin-top:4px;font-size:.7em;";
          time.textContent = new Date(Number(timestamp)).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit"
          });
          bubble.appendChild(time);
      }

      wrap.appendChild(bubble);
      container.appendChild(wrap);
  }

  function renderActiveGroupMessages() {
      if (currentChatType !== "group" || !currentChatId || !currentGroupMeta) return;
      const msgsContainer = document.getElementById("chat-messages");
      if (!msgsContainer) return;

      const allowed = new Set(groupMemberIds(currentGroupMeta));
      const messages = [];
      for (const [senderPlayerId, senderData] of Object.entries(chatPlayersCache || {})) {
          if (!allowed.has(senderPlayerId)) continue;
          const senderMessages = senderData?.phoneGroupMessages?.[currentChatId] || {};
          for (const [messageId, message] of Object.entries(senderMessages)) {
              if (!message || message.groupId !== currentChatId) continue;
              messages.push({
                  messageId,
                  senderPlayerId,
                  text: message.text || "",
                  timestamp: Number(message.timestamp) || 0,
              });
          }
      }

      messages.sort((a, b) => (a.timestamp - b.timestamp) || a.messageId.localeCompare(b.messageId));
      msgsContainer.innerHTML = "";

      for (const message of messages) {
          const senderData = chatPlayersCache?.[message.senderPlayerId] || {};
          const senderPhone = normalizeChatPhone(senderData.phoneNumber);
          const isMe = message.senderPlayerId === playerId;
          const senderName = isMe
              ? "Yo"
              : (contactsDictionary[senderPhone] || playerChatDisplayName(message.senderPlayerId, senderData));
          renderMessageBubble(msgsContainer, {
              isMe,
              senderName,
              text: message.text,
              timestamp: message.timestamp,
          });
      }
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
  }

  function syncPhoneGroupsFromPlayers(players = {}) {
      chatPlayersCache = players || {};
      discoveredPhoneGroups = collectDiscoveredPhoneGroups(chatPlayersCache);

      if (currentChatType === "group" && currentChatId) {
          const fresh = discoveredPhoneGroups[currentChatId];
          if (!fresh) {
              clearActiveChat("Ya no perteneces a este grupo");
          } else {
              currentGroupMeta = fresh;
              const headerName = document.getElementById("chat-header-name");
              if (headerName) {
                  const count = groupMemberIds(fresh).length;
                  headerName.innerText = `${fresh.name || "Chat Grupal"} · ${count} miembro${count === 1 ? "" : "s"}`;
              }
              const manage = document.getElementById("btn-manage-group");
              if (manage) manage.style.display = fresh.ownerPlayerId === playerId ? "block" : "none";
              renderActiveGroupMessages();
          }
      }

      renderChatList(legacyChatIds);
      refreshGroupUnreadState();
  }

  async function getPlayersForGroupCreation() {
      // Creation is rare; take one authoritative snapshot so a contact is not
      // rejected merely because the incremental cache is still warming up.
      const snapshot = await db.ref("campaña/jugadores").once("value");
      const players = snapshot.val() || {};
      chatPlayersCache = { ...chatPlayersCache, ...players };
      return players;
  }

  function buildGroupContactPicker(group = null) {
      const listDiv = document.getElementById("new-group-contacts-list");
      if (!listDiv) return;
      listDiv.innerHTML = "";

      const existingPhones = new Set();
      if (group) {
          for (const [memberId, member] of Object.entries(group.members || {})) {
              if (memberId === playerId) continue;
              const phone = normalizeChatPhone(
                  member?.phone || chatPlayersCache?.[memberId]?.phoneNumber
              );
              if (phone) existingPhones.add(phone);
          }
      }

      const entries = new Map();
      for (const [phoneRaw, alias] of Object.entries(contactsDictionary || {})) {
          const phone = normalizeChatPhone(phoneRaw);
          if (phone) entries.set(phone, String(alias || phone));
      }
      for (const phone of existingPhones) {
          if (!entries.has(phone)) {
              const match = Object.entries(chatPlayersCache).find(([, data]) =>
                  normalizeChatPhone(data?.phoneNumber) === phone
              );
              entries.set(phone, match ? playerChatDisplayName(match[0], match[1]) : phone);
          }
      }

      if (!entries.size) {
          listDiv.innerHTML = "<div style='color:#666;font-style:italic;'>No tienes contactos guardados.</div>";
          return;
      }

      for (const [phone, alias] of [...entries.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
          const row = document.createElement("label");
          row.style.cssText = "display:flex;align-items:center;gap:10px;cursor:pointer;color:#ddd;font-family:'Share Tech Mono',monospace;padding:7px 5px;border-bottom:1px solid #333;";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "group-contact-cb";
          checkbox.value = phone;
          checkbox.checked = existingPhones.has(phone);

          const labelText = document.createElement("span");
          labelText.textContent = `${alias} [${phone}]`;

          row.append(checkbox, labelText);
          listDiv.appendChild(row);
      }
  }

  function openGroupEditor(group = null) {
      const modal = document.getElementById("modal-new-group");
      if (!modal) return;
      groupEditId = group?.groupId || null;

      const title = modal.querySelector("h3");
      if (title) title.textContent = group ? "ADMINISTRAR GRUPO" : "NUEVO GRUPO";

      const nameInput = document.getElementById("new-group-name");
      const iconInput = document.getElementById("new-group-icon-url");
      if (nameInput) nameInput.value = group?.name || "";
      if (iconInput) iconInput.value = group?.icon || "";

      const confirm = document.getElementById("btn-confirm-group");
      if (confirm) confirm.textContent = group ? "GUARDAR" : "CREAR";

      buildGroupContactPicker(group);
      modal.style.display = "flex";
  }

  async function resolveGroupMembers(selectedPhones) {
      const players = await getPlayersForGroupCreation();
      const phoneIndex = new Map();
      for (const [candidateId, data] of Object.entries(players)) {
          const phone = normalizeChatPhone(data?.phoneNumber);
          if (!phone) continue;
          if (!phoneIndex.has(phone)) phoneIndex.set(phone, []);
          phoneIndex.get(phone).push([candidateId, data]);
      }

      const members = {};
      const selfData = players[playerId] || window.datosJugador || {};
      members[playerId] = {
          phone: normalizeChatPhone(selfData.phoneNumber || myPhoneNumber),
          name: playerChatDisplayName(playerId, selfData),
      };

      const unresolved = [];
      for (const phone of selectedPhones) {
          const matches = phoneIndex.get(normalizeChatPhone(phone)) || [];
          if (matches.length !== 1) {
              unresolved.push(phone);
              continue;
          }
          const [memberId, memberData] = matches[0];
          members[memberId] = {
              phone: normalizeChatPhone(memberData.phoneNumber),
              name: playerChatDisplayName(memberId, memberData),
          };
      }

      if (unresolved.length) {
          throw new Error(
              "Estos números no están vinculados a un único jugador: " + unresolved.join(", ")
          );
      }
      return members;
  }

  async function savePhoneGroup() {
      const modal = document.getElementById("modal-new-group");
      const confirm = document.getElementById("btn-confirm-group");
      const groupName = String(document.getElementById("new-group-name")?.value || "").trim();
      const iconUrl = String(document.getElementById("new-group-icon-url")?.value || "").trim();
      const selectedPhones = Array.from(document.querySelectorAll(".group-contact-cb:checked"))
          .map((cb) => normalizeChatPhone(cb.value))
          .filter(Boolean);

      if (!groupName) throw new Error("Nombre del Grupo requerido.");
      if (!selectedPhones.length) throw new Error("Debes seleccionar al menos un contacto.");
      if (!playerId || !myPhoneNumber) throw new Error("Tu dispositivo todavía no está listo.");

      const members = await resolveGroupMembers(selectedPhones);
      if (Object.keys(members).length < 2) throw new Error("El grupo necesita al menos dos miembros.");

      const isEditing = Boolean(groupEditId);
      const existing = isEditing ? discoveredPhoneGroups[groupEditId] : null;
      if (isEditing && existing?.ownerPlayerId !== playerId) {
          throw new Error("Solo el creador del grupo puede cambiar sus miembros.");
      }

      const groupId = groupEditId || db.ref(`campaña/jugadores/${playerId}/phoneGroups`).push().key;
      if (!groupId) throw new Error("No se pudo generar el grupo.");

      const now = Date.now();
      const payload = {
          schemaVersion: 1,
          groupId,
          ownerPlayerId: playerId,
          ownerUid: auth.currentUser?.uid || null,
          name: groupName,
          icon: iconUrl || null,
          members,
          active: true,
          createdAt: Number(existing?.createdAt) || now,
          updatedAt: now,
      };

      if (confirm) confirm.disabled = true;
      try {
          await db.ref(`campaña/jugadores/${playerId}/phoneGroups/${groupId}`).set(payload);
          await db.ref(`campaña/jugadores/${playerId}/phoneGroupReads/${groupId}`).set(now);
          groupEditId = null;
          if (modal) modal.style.display = "none";
          currentChatId = groupId;
          currentChatType = "group";
          currentGroupMeta = payload;
          loadPhoneGroup(groupId, payload);
      } finally {
          if (confirm) confirm.disabled = false;
      }
  }

  async function sendCurrentChatMessage() {
      const input = document.getElementById("chat-input");
      const msg = String(input?.value || "").trim();
      if (!msg || !currentChatId || !myPhoneNumber) return;

      if (currentChatType === "group") {
          if (!currentGroupMeta || !groupHasMember(currentGroupMeta, playerId)) {
              alert("Ya no perteneces a este grupo.");
              return;
          }
          const messageRef = db.ref(
              `campaña/jugadores/${playerId}/phoneGroupMessages/${currentChatId}`
          ).push();
          await messageRef.set({
              schemaVersion: 1,
              groupId: currentChatId,
              text: msg,
              timestamp: Date.now(),
          });
          if (input) input.value = "";
          return;
      }

      // Legacy direct chat path retained for existing one-to-one threads.
      const ts = Date.now();
      await db.ref(`campaña/comms/chats/${currentChatId}/messages`).push({
          sender: myPhoneNumber,
          text: msg,
          timestamp: ts
      });
      await db.ref(`campaña/comms/chats/${currentChatId}`).update({ lastMessageTimestamp: ts });
      if (input) input.value = "";
  }

  function initChatSystem() {
      if (chatListenerActive) return;
      if (!playerId) return;
      chatListenerActive = true;

      db.ref(`campaña/jugadores/${playerId}`).on("value", (snap) => {
          const pData = snap.val();
          if (!pData) return;
          myPhoneNumber = normalizeChatPhone(pData.phoneNumber);

          const rawContacts = pData.contactos || pData.contacts || {};
          contactsDictionary = {};
          for (const [phone, data] of Object.entries(rawContacts)) {
              if (typeof data === "object" && data?.alias) contactsDictionary[normalizeChatPhone(phone)] = data.alias;
              else if (typeof data === "string") contactsDictionary[normalizeChatPhone(phone)] = data;
          }

          legacyChatIds = pData.chats || {};
          renderChatList(legacyChatIds);
      });

      // Incremental player snapshots power group discovery and message fan-in
      // without reprocessing the entire player tree on every group message.
      const groupPlayersRef = db.ref("campaña/jugadores");
      const groupRelevantFingerprint = (data = {}) => JSON.stringify({
          phoneNumber: data.phoneNumber || "",
          characterName: data.characterName || data.character_name || data.nombre || data.name || "",
          phoneGroups: data.phoneGroups || {},
          phoneGroupMessages: data.phoneGroupMessages || {},
          phoneGroupReads: data.phoneGroupReads || {},
      });
      const scheduleGroupSync = () => {
          if (groupSyncTimer) return;
          groupSyncTimer = setTimeout(() => {
              groupSyncTimer = null;
              syncPhoneGroupsFromPlayers(chatPlayersCache);
          }, 0);
      };
      const syncGroupPlayerSnapshot = (snapshot) => {
          if (!snapshot?.key) return;
          const nextData = snapshot.val() || {};
          const nextFingerprint = groupRelevantFingerprint(nextData);
          if (groupPlayerFingerprints[snapshot.key] === nextFingerprint) return;
          groupPlayerFingerprints[snapshot.key] = nextFingerprint;
          chatPlayersCache[snapshot.key] = nextData;
          scheduleGroupSync();
      };
      groupPlayersRef.on("child_added", syncGroupPlayerSnapshot);
      groupPlayersRef.on("child_changed", syncGroupPlayerSnapshot);
      groupPlayersRef.on("child_removed", (snapshot) => {
          if (snapshot?.key) {
              delete chatPlayersCache[snapshot.key];
              delete groupPlayerFingerprints[snapshot.key];
          }
          scheduleGroupSync();
      });

      const btnSend = document.getElementById("btn-send-chat");
      if (btnSend && btnSend.dataset.chatSendBound !== "true") {
          btnSend.dataset.chatSendBound = "true";
          btnSend.addEventListener("click", () => {
              sendCurrentChatMessage().catch((error) => {
                  console.error("[Luminous][Chat] No se pudo enviar:", error);
                  alert(error?.code === "PERMISSION_DENIED"
                      ? "Firebase rechazó este chat legacy. Los grupos nuevos usan el canal compatible."
                      : (error?.message || "No se pudo enviar el mensaje."));
              });
          });
      }

      const chatInput = document.getElementById("chat-input");
      if (chatInput && chatInput.dataset.chatSendBound !== "true") {
          chatInput.dataset.chatSendBound = "true";
          chatInput.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              sendCurrentChatMessage().catch((error) => {
                  console.error("[Luminous][Chat] No se pudo enviar:", error);
              });
          });
      }

      const btnGroup = document.getElementById("btn-create-group");
      if (btnGroup && btnGroup.dataset.groupCreateBound !== "true") {
          btnGroup.dataset.groupCreateBound = "true";
          btnGroup.addEventListener("click", () => openGroupEditor());
      }

      const btnManage = document.getElementById("btn-manage-group");
      if (btnManage && btnManage.dataset.groupManageBound !== "true") {
          btnManage.dataset.groupManageBound = "true";
          btnManage.addEventListener("click", () => {
              if (currentChatType === "group" && currentGroupMeta?.ownerPlayerId === playerId) {
                  openGroupEditor(currentGroupMeta);
              }
          });
      }

      const btnCancelGroup = document.getElementById("btn-cancel-group");
      if (btnCancelGroup && btnCancelGroup.dataset.groupCancelBound !== "true") {
          btnCancelGroup.dataset.groupCancelBound = "true";
          btnCancelGroup.addEventListener("click", () => {
              groupEditId = null;
              const modal = document.getElementById("modal-new-group");
              if (modal) modal.style.display = "none";
          });
      }

      const btnConfirmGroup = document.getElementById("btn-confirm-group");
      if (btnConfirmGroup && btnConfirmGroup.dataset.groupConfirmBound !== "true") {
          btnConfirmGroup.dataset.groupConfirmBound = "true";
          btnConfirmGroup.addEventListener("click", () => {
              savePhoneGroup().catch((error) => {
                  console.error("[Luminous][Chat] No se pudo guardar el grupo:", error);
                  alert(error?.message || "No se pudo guardar el grupo.");
              });
          });
      }
  }

  function createChatThreadRow({ name, icon, isGroup, memberCount, unread, onClick }) {
      const div = document.createElement("div");
      div.style.cssText = "padding:10px;border-bottom:1px solid #333;cursor:pointer;color:#ddd;font-family:'Share Tech Mono',monospace;display:flex;align-items:center;gap:10px;";
      if (unread) div.style.borderLeft = "3px solid var(--cyan-tech)";

      if (isGroup && icon) {
          const img = document.createElement("img");
          img.src = icon;
          img.alt = "";
          img.style.cssText = "width:30px;height:30px;border-radius:2px;border:1px solid var(--cyan-tech);object-fit:cover;";
          div.appendChild(img);
      } else if (isGroup) {
          const initials = document.createElement("div");
          initials.style.cssText = "width:30px;height:30px;background:#111;border:1px solid var(--cyan-tech);border-radius:2px;display:flex;align-items:center;justify-content:center;color:var(--cyan-tech);font-family:'BebasKai',sans-serif;font-size:14px;";
          initials.textContent = String(name || "GR").substring(0, 2).toUpperCase();
          div.appendChild(initials);
      } else {
          const iconEl = document.createElement("div");
          iconEl.style.cssText = "width:30px;height:30px;background:#222;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#aaa;";
          iconEl.textContent = "👤";
          div.appendChild(iconEl);
      }

      const textWrap = document.createElement("div");
      textWrap.style.cssText = "flex:1;min-width:0;";
      const title = document.createElement("div");
      title.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      title.textContent = name || "Chat";
      textWrap.appendChild(title);
      if (isGroup) {
          const meta = document.createElement("small");
          meta.style.cssText = "display:block;color:#666;margin-top:2px;";
          meta.textContent = `${memberCount || 0} miembros`;
          textWrap.appendChild(meta);
      }
      div.appendChild(textWrap);
      div.addEventListener("click", onClick);
      return div;
  }

  function renderChatList(chatIds = {}) {
      const listDiv = document.getElementById("chat-threads-list");
      if (!listDiv) return;
      const generation = ++chatListRenderGeneration;
      listDiv.innerHTML = "";

      const reads = chatPlayersCache?.[playerId]?.phoneGroupReads || {};
      const groups = Object.values(discoveredPhoneGroups).sort((a, b) =>
          groupLastMessageTimestamp(b.groupId, b) - groupLastMessageTimestamp(a.groupId, a)
      );

      for (const group of groups) {
          const last = groupLastMessageTimestamp(group.groupId, group);
          const unread = last > (Number(reads?.[group.groupId]) || 0);
          listDiv.appendChild(createChatThreadRow({
              name: group.name || "Chat Grupal",
              icon: group.icon || "",
              isGroup: true,
              memberCount: groupMemberIds(group).length,
              unread,
              onClick: () => loadPhoneGroup(group.groupId, group),
          }));
      }

      for (const chatId of Object.keys(chatIds || {})) {
          db.ref(`campaña/comms/chats/${chatId}`).once("value", (snap) => {
              if (generation !== chatListRenderGeneration) return;
              const chatData = snap.val();
              if (!chatData) return;
              // Do not duplicate legacy group rows when a migrated live group uses the same key.
              if (chatData.isGroup && discoveredPhoneGroups[chatId]) return;
              listDiv.appendChild(createChatThreadRow({
                  name: chatData.name || (chatData.isGroup ? "Grupo Legacy" : "Chat"),
                  icon: chatData.icon || "",
                  isGroup: Boolean(chatData.isGroup),
                  memberCount: Object.keys(chatData.participants || {}).length,
                  unread: false,
                  onClick: () => loadChat(chatId, chatData),
              }));
          });
      }
  }

  function loadPhoneGroup(groupId, groupData) {
      stopLegacyChatListener();
      currentChatId = groupId;
      currentChatType = "group";
      currentGroupMeta = groupData;

      const count = groupMemberIds(groupData).length;
      const headerName = document.getElementById("chat-header-name");
      if (headerName) {
          headerName.innerText = `${groupData.name || "Chat Grupal"} · ${count} miembro${count === 1 ? "" : "s"}`;
      }

      const btnSave = document.getElementById("btn-save-contact");
      if (btnSave) btnSave.style.display = "none";
      const btnManage = document.getElementById("btn-manage-group");
      if (btnManage) btnManage.style.display = groupData.ownerPlayerId === playerId ? "block" : "none";

      const now = Date.now();
      db.ref(`campaña/jugadores/${playerId}/phoneGroupReads/${groupId}`).set(now)
          .catch((error) => console.error("[Luminous][Chat] No se pudo marcar grupo como leído:", error));

      renderActiveGroupMessages();
  }

  function loadChat(chatId, chatData) {
      stopLegacyChatListener();
      currentChatId = chatId;
      currentChatType = "legacy";
      currentGroupMeta = null;

      if (playerId) {
          db.ref(`campaña/jugadores/${playerId}/chats/${chatId}`).set({ lastRead: Date.now() }).then(() => {
              if (typeof window.updateNotifications === "function") {
                  db.ref(`campaña/jugadores/${playerId}/chats`).once("value", () => {});
              }
          });
      }

      const headerName = document.getElementById("chat-header-name");
      if (headerName) headerName.innerText = chatData.name || (chatData.isGroup ? "Grupo Legacy" : "Chat");

      const btnManage = document.getElementById("btn-manage-group");
      if (btnManage) btnManage.style.display = "none";
      const btnSave = document.getElementById("btn-save-contact");
      if (btnSave) btnSave.style.display = "none";

      if (chatData.participants && !chatData.isGroup) {
          const others = Object.keys(chatData.participants).filter((phone) => normalizeChatPhone(phone) !== myPhoneNumber);
          if (others.length === 1) {
              const otherPhone = normalizeChatPhone(others[0]);
              if (!contactsDictionary[otherPhone]) {
                  if (btnSave) {
                      btnSave.style.display = "block";
                      btnSave.onclick = () => saveContactPrompt(otherPhone);
                  }
              } else if (headerName) {
                  headerName.innerText = contactsDictionary[otherPhone];
              }
          }
      }

      activeLegacyMessagesRef = db.ref(`campaña/comms/chats/${chatId}/messages`);
      activeLegacyMessagesListener = (snap) => {
          const msgsContainer = document.getElementById("chat-messages");
          if (!msgsContainer || currentChatType !== "legacy" || currentChatId !== chatId) return;
          msgsContainer.innerHTML = "";
          snap.forEach((child) => {
              const m = child.val() || {};
              const senderPhone = normalizeChatPhone(m.sender);
              const isMe = senderPhone === myPhoneNumber;
              renderMessageBubble(msgsContainer, {
                  isMe,
                  senderName: isMe ? "Yo" : (contactsDictionary[senderPhone] || senderPhone),
                  text: m.text,
                  timestamp: m.timestamp,
              });
          });
          msgsContainer.scrollTop = msgsContainer.scrollHeight;
      };
      activeLegacyMessagesRef.on("value", activeLegacyMessagesListener);
  }

  function saveContactPrompt(phoneStr) {
      const normalizedPhone = normalizeChatPhone(phoneStr);
      const alias = prompt(`Guardar contacto para el número ${normalizedPhone}:`);
      if (alias && playerId) {
          db.ref(`campaña/jugadores/${playerId}/contactos/${normalizedPhone}`).set({ alias: alias.trim() }).then(() => {
              contactsDictionary[normalizedPhone] = alias.trim();
              const btnSave = document.getElementById("btn-save-contact");
              if (btnSave) btnSave.style.display = "none";
              const headerName = document.getElementById("chat-header-name");
              if (headerName) headerName.innerText = alias.trim();
          });
      }
  }


  // Mute System Toggle
  const btnMute = document.getElementById("btn-toggle-mute");
  if (btnMute) {
      btnMute.addEventListener("click", () => {
          if (playerId) {
              db.ref(`campaña/jugadores/${playerId}/settings/isMuted`).once("value", snap => {
                  const currentMuted = snap.val() === true;
                  db.ref(`campaña/jugadores/${playerId}/settings/isMuted`).set(!currentMuted);
              });
          }
      });
  }

  // --- SISTEMA DE NOTIFICACIONES REACTIVAS ---
  // Player-owned state comes from the canonical player listener. Do not open
  // parallel Firebase subscriptions for mute/bank/mail/chat metadata.
  let unreadBank = false;
  let unreadMail = false;
  let unreadChat = false;
  let notificationChats = {};
  let notificationChatSignature = "";

  window.updateNotifications = function() {
      const renderBadge = (elementIdOrSelector, hasUnread, checkMuted = false) => {
          const el = document.querySelector(elementIdOrSelector);
          if (!el) return;

          let badge = el.querySelector('.limbus-badge');
          const shouldShow = hasUnread && (!checkMuted || !window.isPhoneMuted);

          if (shouldShow) {
              if (!badge) {
                  badge = document.createElement('div');
                  badge.className = 'limbus-badge';
                  badge.innerText = '!';
                  el.appendChild(badge);
              }
          } else if (badge) {
              badge.remove();
          }
      };

      const groupUnread = window.__luminousUnreadGroupChat === true;
      renderBadge('#btn-toggle-phone', unreadBank || unreadMail || unreadChat || groupUnread, true);
      renderBadge('button[name="act_tab_banco"]', unreadBank, false);
      renderBadge('button[name="act_tab_mail"]', unreadMail || unreadChat || groupUnread, false);
      renderBadge('#btn-show-mail', unreadMail, false);
      renderBadge('#btn-show-chat', unreadChat || groupUnread, false);
  };

  const refreshUnreadChat = async (chats, onlyChatId = null) => {
      const entries = Object.entries(chats || {}).filter(([chatId]) => !onlyChatId || chatId === onlyChatId);
      if (onlyChatId && !entries.length) return;
      const results = await Promise.all(entries.map(async ([chatId, data]) => {
          const lastRead = typeof data === "object" && data?.lastRead ? data.lastRead : 0;
          const tsSnap = await db.ref(`campaña/comms/chats/${chatId}/lastMessageTimestamp`).once("value");
          return (tsSnap.val() || 0) > lastRead;
      }));
      if (onlyChatId) {
          if (results.some(Boolean)) unreadChat = true;
      } else {
          unreadChat = results.some(Boolean);
      }
      window.updateNotifications();
  };

  const syncPlayerNotificationState = (playerData = {}) => {
      window.isPhoneMuted = playerData.settings?.isMuted === true;
      if (btnMute) btnMute.innerText = window.isPhoneMuted ? "🔕" : "🔔";

      unreadBank = Object.values(playerData.finance?.transactionHistory || {})
        .some((tx) => tx?.unread === true);
      unreadMail = Object.values(playerData.correos || {})
        .some((mail) => mail?.leido === false);

      notificationChats = playerData.chats && typeof playerData.chats === "object"
        ? playerData.chats
        : {};
      const nextSignature = Object.entries(notificationChats)
        .map(([chatId, data]) => `${chatId}:${data?.lastRead || 0}`)
        .sort()
        .join("|");
      if (nextSignature !== notificationChatSignature) {
          notificationChatSignature = nextSignature;
          refreshUnreadChat(notificationChats).catch((error) => {
              console.error("[Luminous] No se pudieron actualizar notificaciones de chat:", error);
          });
      }
      window.updateNotifications();
  };

  window.addEventListener("luminous:player-notification-data", (event) => {
      syncPlayerNotificationState(event?.detail?.data || window.datosJugador || {});
  });
  if (window.datosJugador) syncPlayerNotificationState(window.datosJugador);

  // Keep one global chat change subscription so incoming messages can raise
  // the badge, but ignore chats the player does not participate in.
  db.ref("campaña/comms/chats").on("child_changed", (snap) => {
      const chatId = snap?.key;
      if (!chatId || !notificationChats?.[chatId]) return;
      refreshUnreadChat(notificationChats, chatId).catch((error) => {
          console.error("[Luminous] No se pudo actualizar badge de chat:", error);
      });
  });

  // Phone communication subtabs must bind even when async auth finishes
  // after DOMContentLoaded (the normal production path).
  function initPhoneCommunicationTabs() {
        const btnMail = document.getElementById("btn-show-mail");
        const btnChat = document.getElementById("btn-show-chat");
        const btnContacts = document.getElementById("btn-show-contacts");
        const subMail = document.getElementById("subtab-mail");
        const subChat = document.getElementById("subtab-chat");
        const subContacts = document.getElementById("subtab-contacts");

        function switchTab(activeBtn, activeSub) {
            [btnMail, btnChat, btnContacts].forEach(b => {
                if(b) {
                    b.style.borderBottom = "none";
                    b.style.color = "#aaa";
                }
            });
            [subMail, subChat, subContacts].forEach(s => {
                if(s) s.style.display = "none";
            });
            if(activeBtn) {
                activeBtn.style.borderBottom = "2px solid var(--cyan-tech)";
                activeBtn.style.color = "var(--cyan-tech)";
            }
            if(activeSub) activeSub.style.display = "flex";
        }

        if (btnMail && btnMail.dataset.phoneSubtabBound !== "true") {
            btnMail.dataset.phoneSubtabBound = "true";
            btnMail.addEventListener("click", () => switchTab(btnMail, subMail));
        }
        if (btnChat && btnChat.dataset.phoneSubtabBound !== "true") {
            btnChat.dataset.phoneSubtabBound = "true";
            btnChat.addEventListener("click", () => {
                switchTab(btnChat, subChat);
                initChatSystem();
            });
        }
        if (btnContacts && btnContacts.dataset.phoneSubtabBound !== "true") {
            btnContacts.dataset.phoneSubtabBound = "true";
            btnContacts.addEventListener("click", () => {
                switchTab(btnContacts, subContacts);
                initContactsSystem();
            });
        }
  }

  if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPhoneCommunicationTabs, { once: true });
  } else {
      initPhoneCommunicationTabs();
  }

  // --- Mail listener setup (Inventory UI migrated to LuminousInventoryHudV2) ---
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

    // Inventory modal lifecycle, rendering, actions and realtime are owned by
    // LuminousInventoryHudV2 + the canonical Item Runtime stack.
  } // Cierra el bloque de Mail / bootstrap; Inventory V2 lives in js/inventory-hud-v2.js

  // LÓGICA DE TIENDA DINÁMICA (COMPRAR / VENDER)
  let tiendaActivaData = null;
  let tiendaActivaId = null;
  let tiendasFisicasDisponibles = {}; // Para el modal físico
  let tiendaFisicaActivaId = null; // ID de la tienda seleccionada en el modal
  let tiendaFisicaModo = "buy";

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

  const getShopRuntime = () => window.LuminousShopRuntime || null;
  const canAccessShop = (shop, playerName) =>
    !getShopRuntime()?.isPlayerAllowed ||
    getShopRuntime().isPlayerAllowed(shop, playerName);

  function buildShopCommerceContext(playerData = {}, shop = {}, shopId = "") {
    const runtime = getShopRuntime();
    const commerce = playerData.shop_commerce || playerData.shopCommerce || {};
    const merchant = runtime?.merchantNpc?.(shop) || null;
    const chain = runtime?.shopChain?.(shop) || null;
    const loyalty = runtime?.loyaltyProgram?.(shop) || null;
    const shopState = commerce.shops?.[shopId] || {};
    const merchantState = merchant?.id ? (commerce.merchants?.[merchant.id] || {}) : {};
    const chainState = chain?.id ? (commerce.chains?.[chain.id] || {}) : {};
    const loyaltyState = loyalty?.id ? (commerce.loyalty?.[loyalty.id] || {}) : {};

    const relationSource =
      (merchant?.id && (
        playerData.npc_relationships?.[merchant.id] ??
        playerData.npcRelationships?.[merchant.id] ??
        playerData.relaciones_npc?.[merchant.id] ??
        playerData.relationships?.[merchant.id]
      )) ||
      null;
    const relationshipTier =
      typeof relationSource === "string"
        ? relationSource
        : (
            relationSource?.tier ??
            relationSource?.stage ??
            relationSource?.relationshipTier ??
            relationSource?.levelName ??
            ""
          );

    const promotionProgress = {};
    for (const [promotionId, state] of Object.entries(commerce.promotions || {})) {
      promotionProgress[promotionId] = Math.max(
        0,
        parseInt(state?.progress ?? state, 10) || 0,
      );
    }

    const merchantPurchaseCount = Math.max(
      0,
      parseInt(
        merchant?.id
          ? (merchantState.purchase_count ?? merchantState.purchaseCount ?? 0)
          : (shopState.purchase_count ?? shopState.purchaseCount ?? 0),
        10,
      ) || 0,
    );

    return {
      shopId,
      shopPurchaseCount: merchantPurchaseCount,
      relationshipTier: String(relationshipTier || ""),
      loyalty: loyaltyState,
      loyaltyPrograms: loyalty?.id ? { [loyalty.id]: loyaltyState } : {},
      loyaltyProgress: Math.max(
        0,
        parseInt(loyaltyState.progress ?? loyaltyState.stamps ?? 0, 10) || 0,
      ),
      promotionProgress,
      chainPurchaseCount: Math.max(
        0,
        parseInt(chainState.purchase_count ?? chainState.purchaseCount ?? 0, 10) || 0,
      ),
    };
  }

  const getShopPriceBreakdown = (
    item,
    shop,
    playerData = currentPlayerData || {},
    shopId = "",
  ) => {
    const runtime = getShopRuntime();
    if (runtime?.priceBreakdown) {
      return runtime.priceBreakdown(item, shop, {
        context: buildShopCommerceContext(playerData || {}, shop, shopId),
      });
    }
    const legacy = Math.max(0, parseInt(item?.costo, 10) || 0);
    return {
      priceResolved: legacy > 0,
      listPriceAhn: legacy > 0 ? legacy : null,
      priceAhn: legacy > 0 ? legacy : null,
      totalDiscountPercent: 0,
      loyaltyRewardApplied: false,
    };
  };

  const getShopPrice = (
    item,
    shop,
    playerData = currentPlayerData || {},
    shopId = "",
  ) => getShopPriceBreakdown(item, shop, playerData, shopId).priceAhn;

  function shopLoyaltyLabel(shop = {}, playerData = currentPlayerData || {}, shopId = "") {
    const runtime = getShopRuntime();
    const program = runtime?.loyaltyProgram?.(shop);
    if (!program) return "";
    const context = buildShopCommerceContext(playerData, shop, shopId);
    const status = runtime?.loyaltyStatus?.(shop, context);
    const progress = status?.progress ?? context.loyaltyProgress ?? 0;
    const required = status?.required ?? program.paidPurchasesRequired ?? 0;
    if (status?.rewardReady) return program.name + " · próxima elegible gratis";
    return program.name + " · " + progress + "/" + required + " sellos";
  }

  function renderShopMerchantPresence(shop = {}, shopId = "", surface = "physical") {
    const runtime = getShopRuntime();
    const merchant = runtime?.merchantNpc?.(shop);
    const loyaltyText = shopLoyaltyLabel(shop, currentPlayerData || {}, shopId);

    const prefix = surface === "theater" ? "theater-shop-" : "shop-";
    const root = document.getElementById(prefix + "merchant" + (surface === "theater" ? "" : "-presence"));
    const sprite = document.getElementById(prefix + "merchant-sprite");
    const name = document.getElementById(prefix + "merchant-name");
    const loyalty = document.getElementById(
      surface === "theater" ? "theater-shop-loyalty" : "shop-loyalty-status",
    );

    if (root) root.style.display = merchant || loyaltyText ? "flex" : "none";
    if (name) name.textContent = merchant?.name ? "Atiende " + merchant.name : "";
    if (loyalty) loyalty.textContent = loyaltyText;
    if (sprite) {
      if (merchant?.sprite) {
        sprite.src = merchant.sprite;
        sprite.style.display = "block";
      } else {
        sprite.removeAttribute("src");
        sprite.style.display = "none";
      }
    }
  }

  async function recordShopCommerceActivity(
    playerKey,
    playerData,
    shopData,
    shopId,
    details = {},
  ) {
    const runtime = getShopRuntime();
    if (!playerKey || !shopId || !runtime) return;

    const commerceRef = db.ref(`campaña/jugadores/${playerKey}/shop_commerce`);
    await commerceRef.transaction((current) => {
      const next =
        current && typeof current === "object"
          ? JSON.parse(JSON.stringify(current))
          : {};
      next.shops = next.shops || {};
      next.merchants = next.merchants || {};
      next.chains = next.chains || {};
      next.loyalty = next.loyalty || {};
      next.promotions = next.promotions || {};

      const paidAhn = Math.max(0, Number(details.paidAhn) || 0);
      const incrementBucket = (bucket, id, field) => {
        if (!id) return;
        bucket[id] = bucket[id] || {};
        bucket[id][field] = Math.max(0, parseInt(bucket[id][field], 10) || 0) + 1;
        bucket[id].ahn_spent =
          Math.max(0, Number(bucket[id].ahn_spent) || 0) + paidAhn;
        bucket[id].updated_at = Date.now();
      };

      const activityField = details.kind === "service"
        ? "service_count"
        : "purchase_count";
      incrementBucket(next.shops, shopId, activityField);

      const merchant = runtime.merchantNpc?.(shopData);
      if (merchant?.id) incrementBucket(next.merchants, merchant.id, activityField);

      const chain = runtime.shopChain?.(shopData);
      if (chain?.id) incrementBucket(next.chains, chain.id, activityField);

      const context = buildShopCommerceContext(
        { ...(playerData || {}), shop_commerce: next },
        shopData,
        shopId,
      );
      const program = runtime.loyaltyProgram?.(shopData);

      if (program?.id) {
        const status =
          details.kind === "service"
            ? runtime.loyaltyServiceStatus?.(
                shopData,
                context,
                details.serviceId || "repair",
              )
            : runtime.loyaltyStatus?.(shopData, context, details.item || null);

        if (status?.active && status.eligible !== false) {
          const currentProgress = Math.max(0, Number(status.progress) || 0);
          const required = Math.max(
            1,
            Number(status.required ?? program.paidPurchasesRequired) || 1,
          );
          const redeemed = details.breakdown?.loyaltyRewardApplied === true;
          next.loyalty[program.id] = {
            ...(next.loyalty[program.id] || {}),
            name: program.name,
            progress: redeemed
              ? 0
              : Math.min(required, currentProgress + 1),
            updated_at: Date.now(),
          };
        }
      }

      if (details.kind !== "service" && details.item) {
        for (const promotion of runtime.shopPromotions?.(shopData) || []) {
          if (
            promotion.type !== runtime.PROMOTION_TYPES?.BUY_X_GET_Y ||
            !runtime.promotionMatchesItem?.(promotion, details.item)
          ) {
            continue;
          }
          const row = next.promotions[promotion.id] || {};
          const currentProgress = Math.max(0, parseInt(row.progress, 10) || 0);
          const triggered = currentProgress + 1 >= promotion.buyQuantity;
          next.promotions[promotion.id] = {
            ...row,
            progress: triggered ? 0 : currentProgress + 1,
            updated_at: Date.now(),
          };
        }
      }

      return next;
    });
  }
  window.LuminousShopCommerceContext = buildShopCommerceContext;
  window.LuminousRecordShopCommerceActivity = recordShopCommerceActivity;
  window.LuminousRenderShopMerchantPresence = renderShopMerchantPresence;

  const legacySellUnitBase = (item = {}) => {
    const unit = Number(
      item.unitValueAhn ??
      item.standardUnitValueAhn ??
      item.mediumStandardValueAhn ??
      item.standardMediumValueAhn,
    );
    if (Number.isFinite(unit) && unit > 0) return unit;

    const total = Number(item.totalValueAhn);
    const quantity = Math.max(1, parseInt(item.quantity ?? item.cantidad ?? 1, 10) || 1);
    if (Number.isFinite(total) && total > 0) return total / quantity;

    return Number(item.valorBase ?? item.productionValueAhn ?? item.costo) || 0;
  };
  const getShopSellPrice = (item, shop) => {
    const runtime = getShopRuntime();
    if (runtime?.sellPrice) return runtime.sellPrice(item, shop);
    const base = legacySellUnitBase(item);
    return base > 0 ? Math.max(0, Math.round(base * 0.8)) : null;
  };
  const getShopTierNumber = (value) =>
    getShopRuntime()?.tierNumber?.(value) ??
    Math.max(1, parseInt(value, 10) || 1);
  const shopDisplayName = (shop = {}) => {
    const meta = getShopRuntime()?.describeShop?.(shop);
    return meta
      ? `${shop.nombre || "Tienda"} · ${meta.typeLabel} · TIER ${meta.tierRoman}`
      : (shop.nombre || "Tienda");
  };

  // Esperar a que el DOM y typeof db !== 'undefined' existan
  {
    if (typeof db === "undefined") return;

    // Abrir/Cerrar el modal de tienda física
    const badgeFisica = document.getElementById("tienda-fisica-badge");
    const shopModal = document.getElementById("shop-modal");
    const shopModalClose = document.getElementById("shop-modal-close");
    const physicalShopBalance = document.getElementById("shop-display-ahn");

    function canonicalPlayerBalance(playerData = {}) {
      return playerData.finance?.currentBalance !== undefined
        ? Number(playerData.finance.currentBalance) || 0
        : Number(playerData.ahn) || 0;
    }

    const marketEventOverlay = document.getElementById("market-event-overlay");
    const marketEventTitle = document.getElementById("market-event-title-display");
    const marketEventMessage = document.getElementById("market-event-message-display");
    const marketEventLines = document.getElementById("market-event-lines");

    function dismissMarketEventHud() {
      if (!marketEventOverlay) return;
      marketEventOverlay.classList.remove("active");
      marketEventOverlay.setAttribute("aria-hidden", "true");
    }

    function marketEventSignature(eventData = {}) {
      return String(eventData.id || "market") + ":" + String(eventData.revision || eventData.updatedAt || 0);
    }

    function showMarketEventHud(eventData = {}) {
      const runtime = getShopRuntime();
      const activeEvent = runtime?.getMarketEvent?.();
      if (!marketEventOverlay || !activeEvent || eventData.active === false) return;

      const storageKey =
        "luminous_market_event_seen:" +
        String(playerId || "player") +
        ":" +
        marketEventSignature(activeEvent);

      try {
        if (localStorage.getItem(storageKey) === "1") return;
      } catch (_) {}

      if (marketEventTitle) {
        marketEventTitle.textContent = activeEvent.title || "Variación de precios";
      }
      if (marketEventMessage) {
        marketEventMessage.textContent =
          activeEvent.message ||
          "Se registraron cambios de oferta y demanda en distintos sectores comerciales del Distrito.";
      }
      if (marketEventLines) {
        marketEventLines.innerHTML = "";
        for (const [shopTypeId, percentRaw] of Object.entries(activeEvent.modifiers || {})) {
          const percent = Number(percentRaw);
          if (!Number.isFinite(percent) || percent === 0) continue;

          const row = document.createElement("div");
          row.className = "market-event-line";

          const label = document.createElement("span");
          label.className = "market-event-shop-label";
          label.textContent = runtime?.SHOP_TYPES?.[shopTypeId]?.label || shopTypeId;

          const value = document.createElement("span");
          value.className =
            "market-event-percent " + (percent < 0 ? "discount" : "surcharge");
          value.textContent = (percent > 0 ? "+" : "") + Math.round(percent) + "%";

          row.append(label, value);
          marketEventLines.appendChild(row);
        }
      }

      marketEventOverlay.classList.add("active");
      marketEventOverlay.setAttribute("aria-hidden", "false");
      try {
        localStorage.setItem(storageKey, "1");
      } catch (_) {}
    }

    if (marketEventOverlay && marketEventOverlay.dataset.bound !== "true") {
      marketEventOverlay.dataset.bound = "true";
      marketEventOverlay.addEventListener("click", dismissMarketEventHud);
      document.addEventListener("keydown", (event) => {
        if (!marketEventOverlay.classList.contains("active")) return;
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
          dismissMarketEventHud();
        }
      });
    }

    db.ref("campaña/economia/market_event").on("value", (snapshot) => {
      const eventData = snapshot.val();
      getShopRuntime()?.setMarketEvent?.(eventData);

      if (eventData?.active !== false && eventData) {
        showMarketEventHud(eventData);
      } else {
        dismissMarketEventHud();
      }

      if (
        shopModal?.classList.contains("active") &&
        tiendaFisicaActivaId &&
        tiendasFisicasDisponibles[tiendaFisicaActivaId]
      ) {
        if (tiendaFisicaModo === "sell") renderizarGridVentaFisica(tiendaFisicaActivaId);
        else if (tiendaFisicaModo === "service") renderizarGridServiciosFisica(tiendaFisicaActivaId);
        else renderizarGridFisica(tiendaFisicaActivaId);
      }
      if (tiendaActivaData) renderizarComprar();

      const theaterShopId = window.__luminousActiveTheaterShopId;
      if (theaterShopId && typeof window.abrirTiendaDinamica === "function") {
        setTimeout(() => window.abrirTiendaDinamica(theaterShopId), 0);
      }
    });

    if (playerId && physicalShopBalance) {
      db.ref(`campaña/jugadores/${playerId}`).on("value", (snap) => {
        physicalShopBalance.textContent = canonicalPlayerBalance(snap.val() || {}).toLocaleString();
      });
    }

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

    const shopFooterBuyMode = document.getElementById("shop-footer-buy-mode");
    const shopFooterSellMode = document.getElementById("shop-footer-sell-mode");
    const shopFooterServiceMode = document.getElementById("shop-footer-service-mode");

    function setPhysicalShopMode(mode) {
      tiendaFisicaModo =
        mode === "sell" ? "sell" : mode === "service" ? "service" : "buy";
      if (shopFooterBuyMode) {
        const active = tiendaFisicaModo === "buy";
        shopFooterBuyMode.classList.toggle("active", active);
        shopFooterBuyMode.setAttribute("aria-selected", active ? "true" : "false");
      }
      if (shopFooterSellMode) {
        const active = tiendaFisicaModo === "sell";
        shopFooterSellMode.classList.toggle("active", active);
        shopFooterSellMode.setAttribute("aria-selected", active ? "true" : "false");
      }
      if (shopFooterServiceMode) {
        const active = tiendaFisicaModo === "service";
        shopFooterServiceMode.classList.toggle("active", active);
        shopFooterServiceMode.setAttribute("aria-selected", active ? "true" : "false");
      }
      if (!tiendaFisicaActivaId) return;
      if (tiendaFisicaModo === "sell") {
        renderizarGridVentaFisica(tiendaFisicaActivaId);
      } else if (tiendaFisicaModo === "service") {
        renderizarGridServiciosFisica(tiendaFisicaActivaId);
      } else {
        renderizarGridFisica(tiendaFisicaActivaId);
      }
    }

    if (shopFooterBuyMode) {
      shopFooterBuyMode.addEventListener("click", () => setPhysicalShopMode("buy"));
    }
    if (shopFooterSellMode) {
      shopFooterSellMode.addEventListener("click", () => setPhysicalShopMode("sell"));
    }
    if (shopFooterServiceMode) {
      shopFooterServiceMode.addEventListener("click", () => setPhysicalShopMode("service"));
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
        if (data.activa === true && playerName && canAccessShop(data, playerName)) {
          encontrada = true;
          tiendaActivaId = id;
          tiendaActivaData = data;
        }

        // Lógica Física
        if (
          data.fisica_activa === true &&
          playerName &&
          canAccessShop(data, playerName)
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
              if (tiendaFisicaModo === "sell") renderizarGridVentaFisica(tiendaFisicaActivaId);
              else if (tiendaFisicaModo === "service") renderizarGridServiciosFisica(tiendaFisicaActivaId);
              else renderizarGridFisica(tiendaFisicaActivaId);
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
        const meta = getShopRuntime()?.describeShop?.(data);
        const suffix = meta ? ` · T${meta.tierRoman}` : "";
        btn.innerHTML = `<img src="${iconUrl}" alt="${data.nombre}"> ${data.nombre}${suffix}`;

        btn.addEventListener("click", () => {
          seleccionarTiendaFisica(id);
        });

        sidebar.appendChild(btn);
      }
    }

    function seleccionarTiendaFisica(id) {
      tiendaFisicaActivaId = id;
      renderizarSidebarFisica();
      const shop = tiendasFisicasDisponibles[id];
      renderShopMerchantPresence(shop || {}, id, "physical");
      if (tiendaFisicaModo === "sell") renderizarGridVentaFisica(id);
      else if (tiendaFisicaModo === "service") renderizarGridServiciosFisica(id);
      else renderizarGridFisica(id);
    }

    function renderizarGridFisica(idTienda) {
      const grid = document.getElementById("shop-items-grid");
      const title = document.getElementById("shop-active-name");
      if (!grid || !title) return;

      const data = tiendasFisicasDisponibles[idTienda];
      if (!data) return;

      title.innerText = shopDisplayName(data);
      grid.innerHTML = "";

      const items = data.items || {};

      if (Object.keys(items).length === 0) {
        grid.innerHTML =
          '<div style="color:#666; font-size: 20px; padding: 20px; grid-column: 1 / -1; text-align: center;">Sin inventario.</div>';
        return;
      }

      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();
      const accountId = playerId || playerName;
      if (!accountId) return;

      db.ref(`campaña/jugadores/${accountId}/inventario_stash`).once(
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
            const itemTier = getShopTierNumber(item.tier);
            const priceBreakdown = getShopPriceBreakdown(
              item,
              data,
              currentPlayerData || {},
              idTienda,
            );
            const precio = priceBreakdown.priceAhn;
            const availability = getShopRuntime()?.itemAvailability?.(item, data);
            const sinPrecio = priceBreakdown.priceResolved === false;
            const gratis =
              !sinPrecio &&
              Number(precio) === 0 &&
              priceBreakdown.loyaltyRewardApplied === true;
            const disponiblePorTier = availability?.available !== false && !sinPrecio;
            const isAgotado = item.stock_actual === 0 || !disponiblePorTier;
            const benefitText = gratis
              ? "Recompensa de lealtad"
              : priceBreakdown.totalDiscountPercent > 0
                ? "Beneficio comercial -" + Math.round(priceBreakdown.totalDiscountPercent) + "%"
                : "";
            const stockStr = sinPrecio
              ? "Sin valor económico"
              : !disponiblePorTier
                ? "No disponible"
                : (item.stock_actual === -1 ? "∞" : item.stock_actual);
            const tierStr =
              getShopRuntime()?.tierRoman?.(itemTier) ||
              romanTiersShop[Math.min(itemTier, 10)] ||
              "I";
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
                        ${benefitText ? '<div style="font-size:11px;color:#d6b75c;margin-top:3px;">' + benefitText + '</div>' : ""}
                    </div>
                    <div class="shop-item-meta">
                        <div class="shop-item-possession">
                            <span class="shop-item-possession-label">POSEES</span>
                            <span class="shop-item-possession-value">${countOwned}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                            <div class="shop-item-tier">${tierStr}</div>
                            <button class="shop-item-buy-btn btn-comprar-fisico" data-tienda="${idTienda}" data-item="${itemId}" data-precio="${precio ?? ""}" ${isAgotado ? "disabled" : ""}>
                                ${sinPrecio ? "SIN PRECIO" : gratis ? "GRATIS" : '<span class="currency-symbol">₳</span> ' + precio}
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

    async function renderizarGridServiciosFisica(idTienda) {
      const grid = document.getElementById("shop-items-grid");
      const title = document.getElementById("shop-active-name");
      const data = tiendasFisicasDisponibles[idTienda];
      const runtime = getShopRuntime();
      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();
      const accountId = playerId || playerName;
      if (!grid || !title || !data || !accountId) return;

      renderShopMerchantPresence(data, idTienda, "physical");
      title.innerText = shopDisplayName(data) + " · SERVICIOS";
      grid.innerHTML = "";

      if (!runtime?.serviceEnabled?.(data, "repair")) {
        grid.innerHTML =
          '<div style="color:#777;font-size:18px;padding:28px;grid-column:1/-1;text-align:center;">Este establecimiento no ofrece reparaciones.</div>';
        return;
      }

      const playerSnap = await db.ref(`campaña/jugadores/${accountId}`).once("value");
      const playerData = playerSnap.val() || {};
      const context = buildShopCommerceContext(playerData, data, idTienda);
      const entries = [
        ...Object.entries(playerData.inventario_activo || {}).map(([key, item]) => ({
          key,
          item,
          inventory: "inventario_activo",
          inventoryLabel: "Inventario activo",
        })),
        ...Object.entries(playerData.inventario_stash || {}).map(([key, item]) => ({
          key,
          item,
          inventory: "inventario_stash",
          inventoryLabel: "Stash",
        })),
      ].filter(({ item }) => {
        const durability = runtime.durabilityState?.(item);
        return durability?.resolved && durability.missing > 0;
      });

      if (!entries.length) {
        grid.innerHTML =
          '<div style="color:#777;font-size:18px;padding:28px;grid-column:1/-1;text-align:center;">No tienes equipo dañado que necesite reparación.</div>';
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const { key, item, inventory, inventoryLabel } of entries) {
        const quote = runtime.repairBreakdown?.(item, data, { context });
        const unavailable = !quote?.available;
        const gratis = quote?.available && quote.loyaltyRewardApplied === true && Number(quote.priceAhn) === 0;
        const priceText = unavailable
          ? "NO DISPONIBLE"
          : gratis
            ? "GRATIS"
            : '<span class="currency-symbol">₳</span> ' + Number(quote.priceAhn || 0).toLocaleString();
        const materialText =
          quote?.materialValuePerPointAhn != null
            ? "Material/PD: ₳" + Number(quote.materialValuePerPointAhn).toLocaleString()
            : "Material de reparación sin valor";
        const reasonText =
          quote?.reason === "material_unpriced"
            ? "No se pudo determinar el costo del material de este objeto."
            : quote?.reason === "durability_unresolved"
              ? "Este objeto no expone Durabilidad reparable."
              : "";

        const card = document.createElement("div");
        card.className = "shop-item-card";
        card.innerHTML = `
          <div class="shop-item-image-container">
            <img src="${item.icono || item.icon || "https://via.placeholder.com/120"}" alt="${item.nombre || item.name || "Equipo"}">
          </div>
          <div class="shop-item-details">
            <div class="shop-item-header">
              <h4 class="shop-item-name">${item.nombre || item.name || "Equipo"}</h4>
              <span class="shop-item-tag">${inventoryLabel}</span>
            </div>
            <div class="shop-item-description">
              Durabilidad: ${quote?.currentDurability ?? "?"}/${quote?.maxDurability ?? "?"}
              · Faltan ${quote?.missingDurability ?? "?"} PD
            </div>
            <div style="font-size:11px;color:#777;margin-top:4px;">${materialText}</div>
            ${reasonText ? '<div style="font-size:11px;color:#b56b6b;margin-top:4px;">' + reasonText + '</div>' : ""}
          </div>
          <div class="shop-item-meta">
            <div class="shop-item-possession">
              <span class="shop-item-possession-label">REPARAR</span>
              <span class="shop-item-possession-value">${quote?.missingDurability ?? 0} PD</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
              <div style="color:${gratis ? "#d6b75c" : "#0df"};font-weight:bold;">${priceText}</div>
              <button
                class="shop-item-buy-btn btn-reparar-fisico"
                data-tienda="${idTienda}"
                data-inventory="${inventory}"
                data-key="${key}"
                ${unavailable ? "disabled" : ""}
              >
                ${gratis ? "CANJEAR REPARACIÓN" : "REPARAR COMPLETO"}
              </button>
            </div>
          </div>
        `;
        fragment.appendChild(card);
      }
      grid.appendChild(fragment);
    }

    function renderizarGridVentaFisica(idTienda) {
      const grid = document.getElementById("shop-items-grid");
      const title = document.getElementById("shop-active-name");
      const data = tiendasFisicasDisponibles[idTienda];
      const playerName = document
        .querySelector('input[name="attr_character_name"]')
        ?.value.trim();
      const accountId = playerId || playerName;
      if (!grid || !title || !data || !accountId) return;

      title.innerText = `${shopDisplayName(data)} · VENDER`;
      grid.innerHTML = "";

      db.ref(`campaña/jugadores/${accountId}/inventario_stash`).once(
        "value",
        (snap) => {
          const stash = snap.val() || {};
          const entries = Object.entries(stash).filter(([, item]) => {
            const quantity =
              window.LuminousShopItemPurchaseRuntime?.quantityOf?.(item) ??
              Math.max(0, parseInt(item?.quantity ?? item?.cantidad ?? 1, 10) || 0);
            return quantity > 0;
          });

          if (!entries.length) {
            grid.innerHTML =
              '<div style="color:#666; font-size:20px; padding:20px; grid-column:1 / -1; text-align:center;">Tu Stash está vacío.</div>';
            return;
          }

          const fragment = document.createDocumentFragment();
          for (const [key, item] of entries) {
            const quantity =
              window.LuminousShopItemPurchaseRuntime?.quantityOf?.(item) ??
              Math.max(0, parseInt(item.quantity ?? item.cantidad ?? 1, 10) || 0);
            const precioVenta = getShopSellPrice(item, data);
            const tierStr =
              getShopRuntime()?.tierRoman?.(item.tier) ||
              String(item.tier || "I");

            const card = document.createElement("div");
            card.className = "shop-item-card";
            card.innerHTML = `
              <div class="shop-item-image-container">
                <img src="${item.icono || "https://via.placeholder.com/120"}" alt="${item.nombre || item.name || "Objeto"}">
              </div>
              <div class="shop-item-info">
                <div class="shop-item-name">${item.nombre || item.name || "Objeto"}</div>
                <div class="shop-item-tag">POSEES: ${quantity}</div>
                <div class="shop-item-desc">${item.descripcion || item.desc || "Sin descripción disponible."}</div>
              </div>
              <div class="shop-item-meta">
                <div class="shop-item-possession">
                  <span class="shop-item-possession-label">REVENTA</span>
                  <span class="shop-item-possession-value">80%</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:10px;">
                  <div class="shop-item-tier">${tierStr}</div>
                  <button class="shop-item-buy-btn btn-vender-fisico" data-tienda="${idTienda}" data-key="${key}">
                    <span class="currency-symbol">₳</span> +${precioVenta}
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
    document.addEventListener("click", async (e) => {
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
        if (!canAccessShop(tiendaActualData, playerName)) {
          alert("Esta tienda no está disponible para tu personaje.");
          return;
        }
        const itemAvailability = getShopRuntime()?.itemAvailability?.(itemTienda, tiendaActualData);
        if (itemAvailability?.available === false) {
          alert(
            itemAvailability.reason === "unpriced"
              ? "Este objeto no tiene un valor económico canónico y no puede comprarse."
              : "Este objeto no está disponible para esta tienda o su Tier.",
          );
          return;
        }
        if (itemTienda.stock_actual === 0) {
          alert("Este objeto está agotado.");
          return;
        }

        const accountId = playerId || playerName;
        const accountRef = db.ref(`campaña/jugadores/${accountId}`);
        const accountSnap = await accountRef.once("value");
        const accountData = accountSnap.val() || {};
        const commerceContext = buildShopCommerceContext(
          accountData,
          tiendaActualData,
          idTiendaActual,
        );
        const priceBreakdown = getShopRuntime()?.priceBreakdown
          ? getShopRuntime().priceBreakdown(itemTienda, tiendaActualData, {
              context: commerceContext,
            })
          : getShopPriceBreakdown(
              itemTienda,
              tiendaActualData,
              accountData,
              idTiendaActual,
            );
        if (priceBreakdown?.priceResolved === false) {
          alert("Este objeto no tiene un valor económico canónico y no puede comprarse.");
          return;
        }
        const precio = Math.max(0, Number(priceBreakdown?.priceAhn) || 0);
        const ahnActual = canonicalPlayerBalance(accountData);
        if (ahnActual < precio) {
          alert("Fondos insuficientes.");
          return;
        }

        let stockReservation;
        try {
          stockReservation = await reserveShopStock(idTiendaActual, itemId);
        } catch (error) {
          console.error("Error reservando stock:", error);
          alert("No se pudo reservar el stock de la tienda.");
          return;
        }
        if (!stockReservation.reserved) {
          alert("El objeto se agotó antes de completar la compra.");
          return;
        }

        // La tienda física usa el mismo saldo canónico que Banco/App:
        // finance.currentBalance con fallback legacy a ahn, y mantiene ambos espejos sincronizados.
        const newBalance = ahnActual - precio;
        try {
          await db.ref().update({
            [`campaña/jugadores/${accountId}/ahn`]: newBalance,
            [`campaña/jugadores/${accountId}/finance/currentBalance`]: newBalance,
          });
        } catch (error) {
          await restoreShopStock(idTiendaActual, itemId);
          throw error;
        }

        const purchaseTx = {
          monto: -precio,
          concepto:
            priceBreakdown?.loyaltyRewardApplied === true
              ? `Recompensa de lealtad: ${itemTienda.nombre || itemTienda.name || "Objeto"}`
              : `Compra: ${itemTienda.nombre || itemTienda.name || "Objeto"}`,
          timestamp: Date.now(),
          unread: true,
          shopId: idTiendaActual,
          shopType: getShopRuntime()?.shopTypeId?.(tiendaActualData) || "general",
          shopTier: getShopRuntime()?.shopTier?.(tiendaActualData) || 1,
          listPriceAhn: priceBreakdown?.listPriceAhn ?? precio,
          discountPercent: priceBreakdown?.totalDiscountPercent || 0,
          loyaltyReward: priceBreakdown?.loyaltyRewardApplied === true,
        };

        try {
          await Promise.all([
            db.ref(`campaña/jugadores/${accountId}/finance/transactionHistory`).push(purchaseTx),
            db.ref(`campaña/jugadores/${accountId}/transacciones`).push(purchaseTx),
            recordShopCommerceActivity(
              accountId,
              accountData,
              tiendaActualData,
              idTiendaActual,
              {
                kind: "item",
                item: itemTienda,
                paidAhn: precio,
                breakdown: priceBreakdown,
              },
            ),
          ]);
        } catch (commerceError) {
          console.warn("[Luminous][Shop] Purchase completed but commerce history could not be fully recorded.", commerceError);
        }

          // Preserve the canonical functional definition when an item leaves a
          // shop. Rebuilding a cosmetic subset here used to strip runtime.healing
          // (and other item mechanics), producing consumables that rendered
          // correctly but returned USE FAILED in the player's inventory.
          const purchaseRuntime = window.LuminousShopItemPurchaseRuntime;
          const itemToSave =
            purchaseRuntime?.buildPurchasePayload?.(
              itemId,
              itemTienda,
              playerName,
              { inventoryRuntime: window.LuminousItemInventoryRuntime },
            ) || {
              ...itemTienda,
              id: itemTienda.id || itemId,
              definitionId:
                itemTienda.definitionId ||
                itemTienda.canonicalId ||
                itemTienda.id ||
                itemId,
              canonicalId:
                itemTienda.canonicalId ||
                itemTienda.definitionId ||
                itemTienda.id ||
                itemId,
              nombre: itemTienda.nombre,
              name: itemTienda.name || itemTienda.nombre,
              valorBase: itemTienda.costo,
              tier: parseInt(itemTienda.tier) || 1,
              tipo: itemTienda.tipo || "Consumible",
              category:
                itemTienda.category ||
                itemTienda.tipo_categoria ||
                "consumable",
              itemType:
                itemTienda.itemType ||
                itemTienda.category ||
                itemTienda.tipo_categoria ||
                "consumable",
              icono: itemTienda.icono || "",
              descripcion: itemTienda.descripcion || "",
              quantity: 1,
              cantidad: 1,
              currentOwnerId: playerName,
            };

          if (isFisico) {
            // Añadir directo al Stash (Física)
            const stashRef = db.ref(
              `campaña/jugadores/${accountId}/inventario_stash`,
            );
            stashRef.once("value", (stashSnap) => {
              let foundKey = null;
              stashSnap.forEach((child) => {
                const owned = child.val() || {};
                const ownedDefinitionId =
                  owned.definitionId ||
                  owned.canonicalId ||
                  owned.id;
                const sameTier = purchaseRuntime?.sameTier
                  ? purchaseRuntime.sameTier(owned.tier, itemTienda.tier)
                  : String(owned.tier || "I") === String(itemTienda.tier || "I");
                if (
                  ownedDefinitionId === itemToSave.definitionId &&
                  sameTier
                ) {
                  foundKey = child.key;
                }
              });

              if (foundKey) {
                // Also repair legacy stacks purchased before this fix. If the old
                // stack is missing runtime.healing/category metadata, merging a
                // newly purchased canonical item restores those fields while
                // preserving the existing instance identity.
                stashRef.child(foundKey).transaction((current) => {
                  if (!current) return itemToSave;
                  if (purchaseRuntime?.mergePurchasedStack) {
                    return purchaseRuntime.mergePurchasedStack(
                      current,
                      itemToSave,
                      1,
                    );
                  }
                  const currentCant =
                    parseInt(current.quantity ?? current.cantidad) || 1;
                  return {
                    ...itemToSave,
                    ...current,
                    runtime: current.runtime || itemToSave.runtime,
                    definitionId:
                      current.definitionId || itemToSave.definitionId,
                    canonicalId:
                      current.canonicalId || itemToSave.canonicalId,
                    category: current.category || itemToSave.category,
                    itemType: current.itemType || itemToSave.itemType,
                    family: current.family || itemToSave.family,
                    quantity: currentCant + 1,
                    cantidad: currentCant + 1,
                  };
                });
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
      }

      // SERVICIO DE REPARACIÓN (tienda física)
      const btnRepair = e.target.closest(".btn-reparar-fisico");
      if (btnRepair && !btnRepair.disabled) {
        const shopId = btnRepair.getAttribute("data-tienda");
        const inventory = btnRepair.getAttribute("data-inventory");
        const itemKey = btnRepair.getAttribute("data-key");
        const shopData = tiendasFisicasDisponibles[shopId];
        const accountId = playerId || playerName;
        if (!shopId || !inventory || !itemKey || !shopData || !accountId) return;

        try {
          const result = await repairShopInventoryItem(
            accountId,
            shopId,
            inventory,
            itemKey,
          );
          if (!result.repaired) {
            alert(result.message || "No se pudo completar la reparación.");
            return;
          }
          alert(
            result.priceAhn === 0
              ? `${result.itemName} ha sido reparado sin costo por tu recompensa de lealtad.`
              : `${result.itemName} reparado por ₳${Number(result.priceAhn).toLocaleString()}.`,
          );
          await renderizarGridServiciosFisica(shopId);
        } catch (error) {
          console.error("Error reparando item:", error);
          alert("No se pudo completar la reparación.");
        }
      }

      // LÓGICA DE VENDER (App o Física)
      const btnVenta = e.target.closest(".btn-vender-item, .btn-vender-fisico");
      if (btnVenta && !btnVenta.disabled) {
        const isFisico = btnVenta.classList.contains("btn-vender-fisico");
        const key = btnVenta.getAttribute("data-key");
        const shopId = isFisico
          ? btnVenta.getAttribute("data-tienda")
          : tiendaActivaId;
        const shopData = isFisico
          ? tiendasFisicasDisponibles[shopId]
          : tiendaActivaData;

        if (!key || !shopData) return;
        if (!canAccessShop(shopData, playerName)) {
          alert("Esta tienda no está disponible para tu personaje.");
          return;
        }

        try {
          const accountId = playerId || playerName;
          const result = await sellShopItemFromStash(
            accountId,
            key,
            shopData,
            shopId,
          );
          if (!result.sold) {
            alert("El objeto ya no está disponible en tu Stash.");
            return;
          }

          alert(
            `Venta completada: ${result.itemName} por ${result.priceAhn} ₳.`,
          );
          if (isFisico) {
            renderizarGridVentaFisica(shopId);
          } else {
            renderizarVender();
          }
        } catch (error) {
          console.error("Error vendiendo item:", error);
          alert("No se pudo completar la venta.");
        }
      }
    });

    function renderizarComprar() {
      const grid = document.getElementById("shop-comprar-grid");
      if (!grid || !tiendaActivaData) return;

      grid.innerHTML = "";
      const items = tiendaActivaData.items || {};

      if (Object.keys(items).length === 0) {
        grid.innerHTML =
          '<div style="color:#666; text-align:center; padding: 20px;">Sin inventario.</div>';
        return;
      }

      // Optimization: Use DocumentFragment to batch DOM insertions for performance
      const fragment = document.createDocumentFragment();

      for (const [itemId, item] of Object.entries(items)) {
        const priceBreakdown = getShopPriceBreakdown(
          item,
          tiendaActivaData,
          currentPlayerData || {},
          tiendaActivaId || "",
        );
        const precio = priceBreakdown.priceAhn;
        const availability = getShopRuntime()?.itemAvailability?.(item, tiendaActivaData);
        const sinPrecio = priceBreakdown.priceResolved === false;
        const gratis =
          !sinPrecio &&
          Number(precio) === 0 &&
          priceBreakdown.loyaltyRewardApplied === true;
        const disponiblePorTier = availability?.available !== false && !sinPrecio;
        const isAgotado = item.stock_actual === 0 || !disponiblePorTier;
        const stockStr = sinPrecio
          ? "Sin valor económico"
          : !disponiblePorTier
            ? "No disponible"
            : (item.stock_actual === -1 ? "∞" : item.stock_actual);

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
                <div style="color: ${gratis ? "#d6b75c" : "#0df"}; font-weight: bold;">${sinPrecio ? "SIN PRECIO" : gratis ? "GRATIS" : '<span class="currency-symbol">₳</span> ' + precio}</div>
                ${priceBreakdown.totalDiscountPercent > 0 && !gratis ? '<div style="font-size:10px;color:#d6b75c;">Beneficio -' + Math.round(priceBreakdown.totalDiscountPercent) + '%</div>' : ""}
                <button class="btn-comprar-item" data-id="${itemId}" data-precio="${precio ?? ""}" ${isAgotado ? "disabled" : ""}
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

          const fragment = document.createDocumentFragment();

          for (const [key, item] of Object.entries(stash)) {
            const itemQuantity =
              window.LuminousShopItemPurchaseRuntime?.quantityOf?.(item) ??
              Math.max(
                0,
                parseInt(item.quantity ?? item.cantidad ?? 1) || 0,
              );
            if (itemQuantity <= 0) continue;

            const precioVenta = getShopSellPrice(item, tiendaActivaData);

            const row = document.createElement("div");
            row.style.cssText =
              "background: #111; border: 1px solid #333; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 10px;";

            row.innerHTML = `
                <img src="${item.icono || "https://via.placeholder.com/40"}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #000;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nombre}</div>
                    <div style="font-size: 12px; color: #888;">Cant: ${itemQuantity}</div>
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
    document.addEventListener("click", async (e) => {
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
      if (actName === "act_short_rest" || actName === "act_long_rest") {
        e.preventDefault();
        const restGate = await window.LuminousPlayerVitalsHud?.outOfCombatWriteGate?.(db, playerId);
        if (restGate && restGate.allowed === false) {
          console.warn("[Player Vitals] Rest blocked while Player is deployed in Combat.", restGate);
          window.alert?.("REST BLOCKED // Tu Player sigue desplegado en Combat. Usa Combat Engine / DM authority o retíralo del encounter antes de descansar.");
          return;
        }
      }

      if (actName === "act_short_rest") {
        if (window.LuminousFoodRestUi?.openRest && window.LuminousFoodRestRuntime) {
          e.preventDefault();
          window.LuminousFoodRestUi.openRest(currentPlayerData, "short", {
            includeStash: window.isStashUnlocked === true,
            onComplete: async (_result, unit) => {
              if (window.LuminousItemPersistenceRuntime?.saveInventoryState) {
                await window.LuminousItemPersistenceRuntime.saveInventoryState(db, playerId, unit);
              }
              await db.ref("campaña/jugadores/" + playerId).update({
                ...(window.LuminousPlayerVitalsHud?.persistencePatch?.(unit) || {
                  hp: unit.hp,
                  sp: unit.sp,
                  "combatStats/hp_actual": unit.hp,
                  "combatStats/sp_actual": unit.sp,
                }),
                stagger_1_active: unit.stagger_1_active || "1",
                stagger_2_active: unit.stagger_2_active || "1",
                stagger_3_active: unit.stagger_3_active || "1",
                culinarySurvival: unit.culinarySurvival || null,
                culinaryEffects: unit.culinaryEffects || [],
              });
            },
          });
          return;
        }

        const currentHP = parseInt(currentPlayerData.hp) || 0;
        const maxHP = parseInt(currentPlayerData.hp_max) || 0;
        const heal = Math.floor(maxHP * 0.34);
        let newHP = currentHP + heal;
        if (newHP > maxHP) newHP = maxHP;

        db.ref("campaña/jugadores/" + playerId).update({
          ...(window.LuminousPlayerVitalsHud?.persistencePatch?.({ hp: newHP, hp_max: maxHP, sp: 0 }) || {
            hp: newHP,
            hp_max: maxHP,
            sp: 0,
            "combatStats/hp_actual": newHP,
            "combatStats/hp_max": maxHP,
            "combatStats/sp_actual": 0,
          }),
          stagger_1_active: "1",
          stagger_2_active: "1",
          stagger_3_active: "1",
        });
      }

      if (actName === "act_long_rest") {
        if (window.LuminousFoodRestUi?.openRest && window.LuminousFoodRestRuntime) {
          e.preventDefault();
          window.LuminousFoodRestUi.openRest(currentPlayerData, "long", {
            includeStash: window.isStashUnlocked === true,
            onComplete: async (_result, unit) => {
              if (window.LuminousItemPersistenceRuntime?.saveInventoryState) {
                await window.LuminousItemPersistenceRuntime.saveInventoryState(db, playerId, unit);
              }
              await db.ref("campaña/jugadores/" + playerId).update({
                ...(window.LuminousPlayerVitalsHud?.persistencePatch?.(unit) || {
                  hp: unit.hp,
                  sp: unit.sp,
                  "combatStats/hp_actual": unit.hp,
                  "combatStats/sp_actual": unit.sp,
                }),
                culinarySurvival: unit.culinarySurvival || null,
                culinaryEffects: unit.culinaryEffects || [],
              });
            },
          });
          return;
        }

        const maxHP = parseInt(currentPlayerData.hp_max) || 0;
        db.ref("campaña/jugadores/" + playerId).update(
          window.LuminousPlayerVitalsHud?.persistencePatch?.({ hp: maxHP, hp_max: maxHP, sp: 0 }) || {
            hp: maxHP,
            hp_max: maxHP,
            sp: 0,
            "combatStats/hp_actual": maxHP,
            "combatStats/hp_max": maxHP,
            "combatStats/sp_actual": 0,
          },
        );
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
    document.addEventListener("change", async (e) => {
      // D&D Core Attributes Save
      if (e.target.id && e.target.id.match(/^stat-(fuerza|destreza|constitucion|inteligencia|sabiduria|carisma)$/)) {
        const statName = e.target.id.replace('stat-', '');
        let val = parseInt(e.target.value) || 10;

        // Update local UI
        const mod = Math.floor((val - 10) / 2);
        const modEl = document.getElementById(`mod-${statName}`);
        if (modEl) modEl.textContent = (mod >= 0 ? '+' : '') + mod;

        if (window.currentPlayerId) {
           db.ref(`campaña/jugadores/${window.currentPlayerId}/stats/${statName}`).set(val);
        }
        return; // Prevent other logic
      }


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
          const xpGate = await window.LuminousPlayerVitalsHud?.outOfCombatWriteGate?.(db, playerId);
          if (xpGate && xpGate.allowed === false) {
            console.warn("[Player Vitals] XP/level edit blocked while Player is deployed in Combat.", xpGate);
            window.alert?.("XP EDIT BLOCKED // El Player sigue desplegado en Combat. Termina o retíralo del encounter antes de cambiar XP/nivel.");
            renderCharacterSheet?.(currentPlayerData);
            return;
          }
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
            "combatStats/hp_max": newHpMax,
          });
        } else if (["hp", "hp_max", "sp"].includes(attrName)) {
          const vitalGate = await window.LuminousPlayerVitalsHud?.outOfCombatWriteGate?.(db, playerId);
          if (vitalGate && vitalGate.allowed === false) {
            console.warn("[Player Vitals] Manual vital edit blocked while Player is deployed in Combat.", vitalGate);
            window.alert?.("VITAL EDIT BLOCKED // HP/SP durante Combat se controla desde Combat Engine / DM authority.");
            renderCharacterSheet?.(currentPlayerData);
            return;
          }
          const parsedVital = Number(val);
          const nextVital = Number.isFinite(parsedVital) ? parsedVital : 0;
          const mirrorKey = attrName === "hp"
            ? "combatStats/hp_actual"
            : attrName === "sp"
              ? "combatStats/sp_actual"
              : "combatStats/hp_max";
          db.ref("campaña/jugadores/" + playerId).update({
            [attrName]: nextVital,
            [mirrorKey]: nextVital,
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
          if (["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"].includes(skillNameRaw.toLowerCase())) {
            const statName = skillNameRaw.toLowerCase();
            const rawVal = pd.stats && pd.stats[statName] !== undefined ? parseInt(pd.stats[statName]) : 10;
            // The modifier is the base for the roll!
            baseVal = Math.floor((rawVal - 10) / 2);
            modVal = 0;
          }
          // For Core Stats (cuerpo, mente, alma)
          else if (
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

        let sp = parseInt(pd.sp ?? pd.sp_actual ?? pd.combatStats?.sp_actual) || 0;

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
              currentTotal += 4;
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

    // --- LÓGICA DEL TOGGLE DEL MENÚ HAMBURGUESA DERECHO ---
    document.addEventListener("click", (e) => {
      const btnMenu = e.target.closest("#btn-toggle-hud-menu");
      if (btnMenu) {
        const sidebar = btnMenu.closest(".hud-sidebar-right");
        const dropdown = document.getElementById("hud-menu-dropdown");
        if (dropdown && sidebar) {
          const isOpen = sidebar.classList.toggle("is-open");
          btnMenu.setAttribute("aria-expanded", String(isOpen));
          btnMenu.setAttribute("aria-label", isOpen ? "Ocultar menú de personaje" : "Mostrar menú de personaje");
          btnMenu.title = isOpen ? "Ocultar menú" : "Mostrar menú";
        }
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

// --- LÓGICA DE TIENDAS DINÁMICAS / THEATER ---
function applyFullShopRepair(item = {}, maxDurability = 0) {
  const next = JSON.parse(JSON.stringify(item || {}));
  const max = Math.max(0, Number(maxDurability) || 0);

  if (Object.prototype.hasOwnProperty.call(next, "durabilityCurrent")) {
    next.durabilityCurrent = max;
  } else if (Object.prototype.hasOwnProperty.call(next, "currentDurability")) {
    next.currentDurability = max;
  } else if (next.durability && typeof next.durability === "object") {
    next.durability = { ...next.durability, current: max };
  } else if (Object.prototype.hasOwnProperty.call(next, "durabilidad_actual")) {
    next.durabilidad_actual = max;
  } else if (Object.prototype.hasOwnProperty.call(next, "durabilidadActual")) {
    next.durabilidadActual = max;
  } else if (
    Object.prototype.hasOwnProperty.call(next, "durabilidad") &&
    typeof next.durabilidad === "number"
  ) {
    next.durabilidad = max;
  } else {
    next.currentDurability = max;
  }

  return next;
}

async function repairShopInventoryItem(playerKey, shopId, inventoryKey, itemKey) {
  const allowedInventories = new Set(["inventario_activo", "inventario_stash"]);
  if (!playerKey || !shopId || !itemKey || !allowedInventories.has(inventoryKey)) {
    return { repaired: false, message: "No se pudo identificar el equipo a reparar." };
  }

  const runtime = window.LuminousShopRuntime;
  if (!runtime?.repairBreakdown) {
    return { repaired: false, message: "El servicio de reparación no está disponible." };
  }

  const [shopSnap, playerSnap] = await Promise.all([
    db.ref(`campaña/tiendas/${shopId}`).once("value"),
    db.ref(`campaña/jugadores/${playerKey}`).once("value"),
  ]);
  const shopData = shopSnap.val();
  const playerBefore = playerSnap.val() || {};
  if (!shopData) {
    return { repaired: false, message: "La tienda ya no está disponible." };
  }

  const accessKey = currentShopPlayerAccessKey(playerBefore);
  if (runtime.isPlayerAllowed && !runtime.isPlayerAllowed(shopData, accessKey)) {
    return { repaired: false, message: "Esta tienda no está disponible para tu personaje." };
  }
  if (!runtime.serviceEnabled?.(shopData, "repair")) {
    return { repaired: false, message: "Este establecimiento no ofrece reparaciones." };
  }

  let capturedQuote = null;
  let capturedName = "Equipo";
  let failureMessage = "No se pudo completar la reparación.";
  const playerRef = db.ref(`campaña/jugadores/${playerKey}`);

  const transactionResult = await playerRef.transaction((current) => {
    if (!current?.[inventoryKey]?.[itemKey]) {
      failureMessage = "El objeto ya no está en ese inventario.";
      return;
    }

    const item = current[inventoryKey][itemKey];
    const context = window.LuminousShopCommerceContext
      ? window.LuminousShopCommerceContext(current, shopData, shopId)
      : {};
    const quote = runtime.repairBreakdown(item, shopData, { context });
    capturedName = item.nombre || item.name || "Equipo";

    if (!quote?.available) {
      if (quote?.reason === "not_damaged") {
        failureMessage = "Ese objeto ya está en Durabilidad máxima.";
      } else if (quote?.reason === "material_unpriced") {
        failureMessage = "No se pudo calcular el material necesario para reparar este objeto.";
      } else if (quote?.reason === "durability_unresolved") {
        failureMessage = "Este objeto no tiene una Durabilidad reparable.";
      } else {
        failureMessage = "Este establecimiento no puede reparar ese objeto.";
      }
      return;
    }

    const balance =
      current.finance?.currentBalance !== undefined
        ? Number(current.finance.currentBalance) || 0
        : Number(current.ahn) || 0;
    const price = Math.max(0, Number(quote.priceAhn) || 0);
    if (balance < price) {
      failureMessage = "Ahn insuficientes para completar la reparación.";
      return;
    }

    const next = JSON.parse(JSON.stringify(current));
    next[inventoryKey][itemKey] = applyFullShopRepair(
      item,
      quote.maxDurability,
    );
    const balanceAfter = balance - price;
    next.ahn = balanceAfter;
    next.finance = {
      ...(next.finance || {}),
      currentBalance: balanceAfter,
    };
    capturedQuote = quote;
    return next;
  });

  if (!transactionResult.committed || !capturedQuote) {
    return { repaired: false, message: failureMessage };
  }

  const priceAhn = Math.max(0, Number(capturedQuote.priceAhn) || 0);
  const tx = {
    monto: -priceAhn,
    concepto:
      capturedQuote.loyaltyRewardApplied === true
        ? `Recompensa de lealtad: reparación de ${capturedName}`
        : `Reparación: ${capturedName}`,
    timestamp: Date.now(),
    unread: true,
    kind: "shop_service_repair",
    shopId,
    shopType: runtime.shopTypeId?.(shopData) || "general",
    shopTier: runtime.shopTier?.(shopData) || 1,
    repairPoints: capturedQuote.points,
    materialValuePerPointAhn: capturedQuote.materialValuePerPointAhn,
    listPriceAhn: capturedQuote.listPriceAhn,
    discountPercent: capturedQuote.totalDiscountPercent || 0,
    loyaltyReward: capturedQuote.loyaltyRewardApplied === true,
  };

  try {
    await Promise.all([
      db.ref(`campaña/jugadores/${playerKey}/finance/transactionHistory`).push(tx),
      db.ref(`campaña/jugadores/${playerKey}/transacciones`).push(tx),
      window.LuminousRecordShopCommerceActivity?.(
        playerKey,
        playerBefore,
        shopData,
        shopId,
        {
          kind: "service",
          serviceId: "repair",
          paidAhn: priceAhn,
          breakdown: capturedQuote,
        },
      ),
    ]);
  } catch (commerceError) {
    console.warn("[Luminous][Shop] Repair completed but commerce history could not be fully recorded.", commerceError);
  }

  const after = transactionResult.snapshot.val() || {};
  const balanceAfter =
    after.finance?.currentBalance !== undefined
      ? Number(after.finance.currentBalance) || 0
      : Number(after.ahn) || 0;

  return {
    repaired: true,
    itemName: capturedName,
    priceAhn,
    balanceAfter,
    quote: capturedQuote,
  };
}

function currentShopPlayerAccessKey(playerData = {}) {
  return (
    document
      .querySelector('input[name="attr_character_name"]')
      ?.value.trim() ||
    playerData.nombre ||
    playerData.name ||
    playerId ||
    ""
  );
}

function reserveShopStock(tiendaId, itemKey) {
  return new Promise((resolve, reject) => {
    const stockRef = db.ref(
      `campaña/tiendas/${tiendaId}/items/${itemKey}/stock_actual`,
    );
    stockRef.transaction(
      (current) => {
        // Legacy Shops without stock used effectively unlimited inventory.
        if (current == null || current === -1) return -1;
        const stock = Math.max(0, parseInt(current, 10) || 0);
        if (stock <= 0) return;
        return stock - 1;
      },
      (error, committed, snapshot) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          reserved: committed,
          remaining: snapshot?.val?.() ?? null,
          unlimited: snapshot?.val?.() === -1,
        });
      },
      false,
    );
  });
}

function restoreShopStock(tiendaId, itemKey) {
  const stockRef = db.ref(
    `campaña/tiendas/${tiendaId}/items/${itemKey}/stock_actual`,
  );
  return stockRef.transaction((current) => {
    if (current == null || current === -1) return -1;
    return Math.max(0, parseInt(current, 10) || 0) + 1;
  });
}

async function deliverShopPurchaseToStash(playerKey, itemKey, itemData) {
  const purchaseRuntime = window.LuminousShopItemPurchaseRuntime;
  const payload =
    purchaseRuntime?.buildPurchasePayload?.(
      itemKey,
      itemData,
      playerKey,
      { inventoryRuntime: window.LuminousItemInventoryRuntime },
    ) || {
      ...itemData,
      id: itemData.id || itemKey,
      definitionId:
        itemData.definitionId ||
        itemData.canonicalId ||
        itemData.id ||
        itemKey,
      canonicalId:
        itemData.canonicalId ||
        itemData.definitionId ||
        itemData.id ||
        itemKey,
      quantity: 1,
      cantidad: 1,
      currentOwnerId: playerKey,
    };

  const stashRef = db.ref(`campaña/jugadores/${playerKey}/inventario_stash`);
  const stashSnap = await stashRef.once("value");
  let foundKey = null;

  stashSnap.forEach((child) => {
    const owned = child.val() || {};
    const ownedDefinitionId =
      owned.definitionId ||
      owned.canonicalId ||
      owned.id;
    const sameTier = purchaseRuntime?.sameTier
      ? purchaseRuntime.sameTier(owned.tier, itemData.tier)
      : String(owned.tier || "I") === String(itemData.tier || "I");
    if (
      ownedDefinitionId === payload.definitionId &&
      sameTier
    ) {
      foundKey = child.key;
    }
  });

  if (!foundKey) {
    await stashRef.push(payload);
    return payload;
  }

  await stashRef.child(foundKey).transaction((current) => {
    if (!current) return payload;
    if (purchaseRuntime?.mergePurchasedStack) {
      return purchaseRuntime.mergePurchasedStack(current, payload, 1);
    }
    const quantity =
      parseInt(current.quantity ?? current.cantidad, 10) || 1;
    return {
      ...payload,
      ...current,
      runtime: current.runtime || payload.runtime,
      quantity: quantity + 1,
      cantidad: quantity + 1,
    };
  });
  return payload;
}

async function deliverShopPurchaseToPending(
  playerKey,
  itemKey,
  itemData,
  deliveryDays = 0,
) {
  const purchaseRuntime = window.LuminousShopItemPurchaseRuntime;
  const payload =
    purchaseRuntime?.buildPurchasePayload?.(
      itemKey,
      itemData,
      playerKey,
      { inventoryRuntime: window.LuminousItemInventoryRuntime },
    ) || {
      ...itemData,
      id: itemData.id || itemKey,
      definitionId:
        itemData.definitionId ||
        itemData.canonicalId ||
        itemData.id ||
        itemKey,
      canonicalId:
        itemData.canonicalId ||
        itemData.definitionId ||
        itemData.id ||
        itemKey,
      quantity: 1,
      cantidad: 1,
      currentOwnerId: playerKey,
    };

  const calSnap = await db.ref("campaña/calendario").once("value");
  const calendar = calSnap.val();
  const days = Math.max(0, parseInt(deliveryDays, 10) || 0);
  const arrivalDay = calendar?.dia !== undefined
    ? Number(calendar.dia || 0) + days
    : days;

  const delivery = {
    ...payload,
    diaDeLlegada: arrivalDay,
  };
  await db.ref(`campaña/jugadores/${playerKey}/entregasPendientes`).push(delivery);
  return delivery;
}

function shopPromotionRewardPlan(playerData, shopData, shopId, itemData) {
  const runtime = window.LuminousShopRuntime;
  if (!runtime?.promotionRewardPlan) return [];
  const context = window.LuminousShopCommerceContext
    ? window.LuminousShopCommerceContext(playerData || {}, shopData || {}, shopId || "")
    : {};
  return runtime.promotionRewardPlan(itemData, shopData, context) || [];
}

async function reserveShopPromotionRewards(shopId, shopData, rewards = []) {
  const reservations = [];
  for (const reward of rewards) {
    const rewardItem = shopData?.items?.[reward.itemId];
    if (!rewardItem) {
      await Promise.allSettled(
        reservations.map((entry) => restoreShopStock(shopId, entry.itemKey)),
      );
      return {
        reserved: false,
        reservations: [],
        message: "La recompensa de esta promoción ya no forma parte del catálogo.",
      };
    }

    const quantity = Math.max(1, parseInt(reward.quantity, 10) || 1);
    for (let unit = 0; unit < quantity; unit += 1) {
      const stock = await reserveShopStock(shopId, reward.itemId);
      if (!stock.reserved) {
        await Promise.allSettled(
          reservations.map((entry) => restoreShopStock(shopId, entry.itemKey)),
        );
        return {
          reserved: false,
          reservations: [],
          message: "La recompensa de la promoción se agotó antes de completar la compra.",
        };
      }
      reservations.push({
        promotionId: reward.promotionId,
        itemKey: reward.itemId,
        itemData: rewardItem,
      });
    }
  }

  return { reserved: true, reservations };
}

async function restoreShopPromotionRewards(shopId, reservations = []) {
  await Promise.allSettled(
    reservations.map((entry) => restoreShopStock(shopId, entry.itemKey)),
  );
}

async function deliverShopPromotionRewards(
  playerKey,
  reservations = [],
  options = {},
) {
  const deliveredNames = [];
  for (const reservation of reservations) {
    if (options.mode === "pending") {
      await deliverShopPurchaseToPending(
        playerKey,
        reservation.itemKey,
        reservation.itemData,
        options.deliveryDays || 0,
      );
    } else {
      await deliverShopPurchaseToStash(
        playerKey,
        reservation.itemKey,
        reservation.itemData,
      );
    }
    deliveredNames.push(
      reservation.itemData.nombre ||
      reservation.itemData.name ||
      "Recompensa",
    );
  }
  return deliveredNames;
}

function sellShopItemFromStash(playerKey, itemKey, shopData = {}, shopId = "") {
  return new Promise((resolve, reject) => {
    const playerRef = db.ref(`campaña/jugadores/${playerKey}`);
    let soldPrice = 0;
    let soldName = "Objeto";
    let balanceAfter = null;

    playerRef.transaction(
      (current) => {
        if (!current || !current.inventario_stash || !current.inventario_stash[itemKey]) {
          return;
        }

        const next = JSON.parse(JSON.stringify(current));
        const item = next.inventario_stash[itemKey];
        const quantity =
          window.LuminousShopItemPurchaseRuntime?.quantityOf?.(item) ??
          Math.max(0, parseInt(item.quantity ?? item.cantidad ?? 1, 10) || 0);
        if (quantity <= 0) return;

        const sellBreakdown = window.LuminousShopRuntime?.sellBreakdown
          ? window.LuminousShopRuntime.sellBreakdown(item, shopData)
          : null;
        if (sellBreakdown?.priceResolved) {
          soldPrice = sellBreakdown.priceAhn;
        } else {
          const legacyBase = legacySellUnitBase(item);
          soldPrice = legacyBase > 0 ? Math.max(0, Math.round(legacyBase * 0.8)) : null;
        }
        if (!(Number.isFinite(Number(soldPrice)) && Number(soldPrice) > 0)) return;
        soldName = item.nombre || item.name || "Objeto";

        if (quantity > 1) {
          const remainingQuantity = quantity - 1;
          const remainingItem = {
            ...item,
            quantity: remainingQuantity,
            cantidad: remainingQuantity,
          };
          if (
            Number(item.totalValueAhn) > 0 &&
            Number(sellBreakdown?.baseValueAhn) > 0
          ) {
            remainingItem.totalValueAhn =
              Number(sellBreakdown.baseValueAhn) * remainingQuantity;
          }
          next.inventario_stash[itemKey] = remainingItem;
        } else {
          delete next.inventario_stash[itemKey];
        }

        const currentBalance =
          next.finance?.currentBalance !== undefined
            ? Number(next.finance.currentBalance) || 0
            : Number(next.ahn) || 0;
        balanceAfter = currentBalance + soldPrice;
        next.ahn = balanceAfter;
        next.finance = {
          ...(next.finance || {}),
          currentBalance: balanceAfter,
        };
        return next;
      },
      (error, committed) => {
        if (error) {
          reject(error);
          return;
        }
        if (!committed) {
          resolve({ sold: false });
          return;
        }

        const tx = {
          monto: soldPrice,
          concepto: `Venta: ${soldName}`,
          timestamp: Date.now(),
          unread: true,
          kind: "shop_sale",
          shopId: shopId || null,
          shopType: window.LuminousShopRuntime?.shopTypeId?.(shopData) || "general",
          shopTier: window.LuminousShopRuntime?.shopTier?.(shopData) || 1,
        };

        Promise.allSettled([
          db.ref(`campaña/jugadores/${playerKey}/finance/transactionHistory`).push(tx),
          db.ref(`campaña/jugadores/${playerKey}/transacciones`).push(tx),
        ]).finally(() => {
          resolve({
            sold: true,
            priceAhn: soldPrice,
            itemName: soldName,
            balanceAfter,
          });
        });
      },
      false,
    );
  });
}

window.abrirTiendaDinamica = async function(tiendaId) {
  if (!playerId || !tiendaId) return;
  window.__luminousActiveTheaterShopId = tiendaId;

  try {
    const [playerSnap, shopSnap] = await Promise.all([
      db.ref(`campaña/jugadores/${playerId}`).once("value"),
      db.ref(`campaña/tiendas/${tiendaId}`).once("value"),
    ]);

    const playerData = playerSnap.val() || {};
    const data = shopSnap.val();
    if (!data) return;

    const shopRuntime = window.LuminousShopRuntime;
    const accessKey = currentShopPlayerAccessKey(playerData);
    if (shopRuntime?.isPlayerAllowed && !shopRuntime.isPlayerAllowed(data, accessKey)) {
      const overlay = document.getElementById("tienda-overlay");
      if (overlay) overlay.style.display = "none";
      alert("Esta tienda no está disponible para tu personaje.");
      return;
    }

    const currentBalance =
      playerData.finance?.currentBalance !== undefined
        ? Number(playerData.finance.currentBalance) || 0
        : Number(playerData.ahn) || 0;
    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay) balanceDisplay.innerText = currentBalance;
    window.LuminousRenderShopMerchantPresence?.(data, tiendaId, "theater");

    const meta = shopRuntime?.describeShop?.(data);
    document.getElementById("shop-name-display").innerText = meta
      ? `${data.nombre || "Tienda"} · ${meta.typeLabel} · TIER ${meta.tierRoman}`
      : (data.nombre || "Tienda");

    const lista = document.getElementById("lista-items-tienda");
    lista.innerHTML = "";

    document.getElementById("panel-item-name").innerText = "---";
    document.getElementById("panel-item-qty").innerText = "--";
    document.getElementById("panel-item-desc").innerHTML =
      "<span style='color: #666; font-style: italic;'>Selecciona un objeto...</span>";
    const btnComprar = document.getElementById("btn-comprar-seleccionado");
    btnComprar.style.display = "none";

    if (data.items) {
      const itemsArray = Array.isArray(data.items)
        ? data.items.map((item, index) => item ? { ...item, _key: index } : item)
        : Object.keys(data.items).map((key) => ({ ...data.items[key], _key: key }));

      itemsArray.forEach((item, index) => {
        if (!item) return;
        const row = document.createElement("div");
        row.className = "item-row";

        let iconHTML = "📦";
        if (item.icono) {
          if (item.icono.startsWith("http") || item.icono.includes(".")) {
            iconHTML = `<img src="${item.icono}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src=''; this.alt='📦';">`;
          } else {
            iconHTML = item.icono;
          }
        }

        const tierText =
          shopRuntime?.tierRoman?.(item.tier) ||
          String(item.tier || "-");
        const commerceContext = window.LuminousShopCommerceContext
          ? window.LuminousShopCommerceContext(playerData, data, tiendaId)
          : {};
        const priceBreakdown = shopRuntime?.priceBreakdown
          ? shopRuntime.priceBreakdown(item, data, { context: commerceContext })
          : null;
        const precioItem = priceBreakdown
          ? priceBreakdown.priceAhn
          : (Math.max(0, parseInt(item.costo, 10) || 0) || null);
        const availability = shopRuntime?.itemAvailability?.(item, data);
        const priceResolved = priceBreakdown
          ? priceBreakdown.priceResolved !== false
          : Number.isFinite(Number(precioItem)) && Number(precioItem) > 0;
        const loyaltyFree =
          priceResolved &&
          Number(precioItem) === 0 &&
          priceBreakdown?.loyaltyRewardApplied === true;
        const availableByTier = availability?.available !== false && priceResolved;
        const exhausted = item.stock_actual === 0;
        const unavailable = exhausted || !availableByTier;
        const benefitText = loyaltyFree
          ? "Recompensa de lealtad"
          : priceBreakdown?.totalDiscountPercent > 0
            ? "Beneficio comercial -" + Math.round(priceBreakdown.totalDiscountPercent) + "%"
            : "";

        row.innerHTML = `
          <div class="icon-slot">
              <span class="tier">${tierText}</span>
              <span class="icono-img" style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">${iconHTML}</span>
          </div>
          <div class="item-details">
              <span class="item-name">${item.nombre || "Objeto"}</span>
              <span class="item-cost">
                  ${!priceResolved ? "SIN PRECIO" : loyaltyFree ? "GRATIS" : precioItem + ' <span style="color: var(--brillo-ambar);">₳</span>'}
              </span>
              <span style="font-size: 11px; color: ${unavailable ? "#aa5555" : "#888"};">
                ${!priceResolved ? "Sin valor económico" : (!availableByTier ? "No disponible para esta tienda" : (exhausted ? "Agotado" : (benefitText || "Disponible")))}
              </span>
          </div>
        `;

        row.onclick = () => {
          document
            .querySelectorAll(".item-row")
            .forEach((entry) => entry.classList.remove("selected"));
          row.classList.add("selected");

          document.getElementById("panel-item-name").innerText = item.nombre;
          document.getElementById("panel-item-desc").innerText =
            item.descripcion || item.desc || "Sin descripción disponible.";

          let stockDisplay = "--";
          if (!availableByTier) {
            stockDisplay = "TIER";
          } else if (item.stock_actual !== undefined) {
            stockDisplay = item.stock_actual === -1 ? "∞" : item.stock_actual;
          }
          document.getElementById("panel-item-qty").innerText = stockDisplay;

          btnComprar.style.display = "block";
          btnComprar.disabled = unavailable;
          btnComprar.innerHTML = unavailable
            ? (!priceResolved ? "SIN PRECIO" : (!availableByTier ? "NO DISPONIBLE" : "AGOTADO"))
            : loyaltyFree
              ? "CANJEAR GRATIS"
              : `COMPRAR [${precioItem} ₳]`;

          const passKey = item._key !== undefined ? item._key : index;
          btnComprar.onclick = unavailable
            ? null
            : () => comprarItemTienda(tiendaId, passKey);
        };

        lista.appendChild(row);
      });
    } else {
      lista.innerHTML =
        "<span style='color: #888; padding: 20px;'>No hay objetos disponibles en esta tienda.</span>";
    }

    document.getElementById("tienda-overlay").style.display = "flex";
  } catch (error) {
    console.error("Error abriendo tienda:", error);
  }
};

window.abrirVentaTiendaDinamica = async function(
  tiendaId = window.__luminousActiveTheaterShopId,
) {
  if (!playerId || !tiendaId) return;
  window.__luminousActiveTheaterShopId = tiendaId;

  try {
    const [playerSnap, shopSnap] = await Promise.all([
      db.ref(`campaña/jugadores/${playerId}`).once("value"),
      db.ref(`campaña/tiendas/${tiendaId}`).once("value"),
    ]);
    const playerData = playerSnap.val() || {};
    const shopData = shopSnap.val();
    if (!shopData) return;

    const shopRuntime = window.LuminousShopRuntime;
    const accessKey = currentShopPlayerAccessKey(playerData);
    if (shopRuntime?.isPlayerAllowed && !shopRuntime.isPlayerAllowed(shopData, accessKey)) {
      alert("Esta tienda no está disponible para tu personaje.");
      return;
    }

    const currentBalance =
      playerData.finance?.currentBalance !== undefined
        ? Number(playerData.finance.currentBalance) || 0
        : Number(playerData.ahn) || 0;
    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay) balanceDisplay.innerText = currentBalance;
    window.LuminousRenderShopMerchantPresence?.(shopData, tiendaId, "theater");

    const meta = shopRuntime?.describeShop?.(shopData);
    document.getElementById("shop-name-display").innerText = meta
      ? `${shopData.nombre || "Tienda"} · ${meta.typeLabel} · TIER ${meta.tierRoman} · VENDER`
      : `${shopData.nombre || "Tienda"} · VENDER`;

    const lista = document.getElementById("lista-items-tienda");
    const btnAccion = document.getElementById("btn-comprar-seleccionado");
    lista.innerHTML = "";
    btnAccion.style.display = "none";
    document.getElementById("panel-item-name").innerText = "---";
    document.getElementById("panel-item-qty").innerText = "--";
    document.getElementById("panel-item-desc").innerHTML =
      "<span style='color:#666; font-style:italic;'>Selecciona un objeto de tu Stash para venderlo...</span>";

    const stash = playerData.inventario_stash || {};
    const entries = Object.entries(stash).filter(([, item]) => {
      const quantity =
        window.LuminousShopItemPurchaseRuntime?.quantityOf?.(item) ??
        Math.max(0, parseInt(item?.quantity ?? item?.cantidad ?? 1, 10) || 0);
      return quantity > 0;
    });

    if (!entries.length) {
      lista.innerHTML =
        "<span style='color:#888; padding:20px;'>Tu Stash está vacío.</span>";
    }

    for (const [key, item] of entries) {
      const quantity =
        window.LuminousShopItemPurchaseRuntime?.quantityOf?.(item) ??
        Math.max(0, parseInt(item.quantity ?? item.cantidad ?? 1, 10) || 0);
      const precioVenta =
        shopRuntime?.sellPrice?.(item, shopData) ??
        Math.max(0, Math.round((Number(item.valorBase ?? item.costo) || 0) * 0.8));
      const tierText =
        shopRuntime?.tierRoman?.(item.tier) ||
        String(item.tier || "-");

      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="icon-slot">
          <span class="tier">${tierText}</span>
          <span class="icono-img" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
            ${item.icono ? `<img src="${item.icono}" style="width:100%; height:100%; object-fit:contain;">` : "📦"}
          </span>
        </div>
        <div class="item-details">
          <span class="item-name">${item.nombre || item.name || "Objeto"}</span>
          <span class="item-cost">+${precioVenta} <span style="color:var(--brillo-ambar);">₳</span></span>
          <span style="font-size:11px; color:#888;">Posees: ${quantity} · Reventa 80%</span>
        </div>
      `;

      row.onclick = () => {
        document
          .querySelectorAll("#lista-items-tienda .item-row")
          .forEach((entry) => entry.classList.remove("selected"));
        row.classList.add("selected");
        document.getElementById("panel-item-name").innerText =
          item.nombre || item.name || "Objeto";
        document.getElementById("panel-item-qty").innerText = quantity;
        document.getElementById("panel-item-desc").innerText =
          item.descripcion || item.desc || "Sin descripción disponible.";
        btnAccion.style.display = "block";
        btnAccion.disabled = false;
        btnAccion.innerHTML = `VENDER [+${precioVenta} ₳]`;
        btnAccion.onclick = () => window.venderItemTienda(tiendaId, key);
      };

      lista.appendChild(row);
    }

    document.getElementById("tienda-overlay").style.display = "flex";
  } catch (error) {
    console.error("Error abriendo venta de tienda:", error);
  }
};

window.abrirServiciosTiendaDinamica = async function(
  tiendaId = window.__luminousActiveTheaterShopId,
) {
  if (!playerId || !tiendaId) return;
  window.__luminousActiveTheaterShopId = tiendaId;

  try {
    const [playerSnap, shopSnap] = await Promise.all([
      db.ref(`campaña/jugadores/${playerId}`).once("value"),
      db.ref(`campaña/tiendas/${tiendaId}`).once("value"),
    ]);
    const playerData = playerSnap.val() || {};
    const shopData = shopSnap.val();
    if (!shopData) return;

    const runtime = window.LuminousShopRuntime;
    const accessKey = currentShopPlayerAccessKey(playerData);
    if (runtime?.isPlayerAllowed && !runtime.isPlayerAllowed(shopData, accessKey)) {
      alert("Esta tienda no está disponible para tu personaje.");
      return;
    }

    const currentBalance =
      playerData.finance?.currentBalance !== undefined
        ? Number(playerData.finance.currentBalance) || 0
        : Number(playerData.ahn) || 0;
    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay) balanceDisplay.innerText = currentBalance;
    window.LuminousRenderShopMerchantPresence?.(shopData, tiendaId, "theater");

    const meta = runtime?.describeShop?.(shopData);
    document.getElementById("shop-name-display").innerText = meta
      ? `${shopData.nombre || "Tienda"} · ${meta.typeLabel} · TIER ${meta.tierRoman} · SERVICIOS`
      : `${shopData.nombre || "Tienda"} · SERVICIOS`;

    const lista = document.getElementById("lista-items-tienda");
    const btnAccion = document.getElementById("btn-comprar-seleccionado");
    lista.innerHTML = "";
    btnAccion.style.display = "none";
    document.getElementById("panel-item-name").innerText = "---";
    document.getElementById("panel-item-qty").innerText = "--";

    if (!runtime?.serviceEnabled?.(shopData, "repair")) {
      document.getElementById("panel-item-desc").innerHTML =
        "<span style='color:#777;'>Este establecimiento no ofrece reparaciones.</span>";
      lista.innerHTML =
        "<span style='color:#888;padding:20px;'>No hay servicios disponibles.</span>";
      document.getElementById("tienda-overlay").style.display = "flex";
      return;
    }

    document.getElementById("panel-item-desc").innerHTML =
      "<span style='color:#888;'>Selecciona equipo dañado para ver el costo de reparación.</span>";

    const context = window.LuminousShopCommerceContext
      ? window.LuminousShopCommerceContext(playerData, shopData, tiendaId)
      : {};
    const entries = [
      ...Object.entries(playerData.inventario_activo || {}).map(([key, item]) => ({
        key,
        item,
        inventory: "inventario_activo",
        label: "ACTIVO",
      })),
      ...Object.entries(playerData.inventario_stash || {}).map(([key, item]) => ({
        key,
        item,
        inventory: "inventario_stash",
        label: "STASH",
      })),
    ].filter(({ item }) => {
      const state = runtime.durabilityState?.(item);
      return state?.resolved && state.missing > 0;
    });

    if (!entries.length) {
      lista.innerHTML =
        "<span style='color:#888;padding:20px;'>No tienes equipo dañado.</span>";
    }

    for (const { key, item, inventory, label } of entries) {
      const quote = runtime.repairBreakdown(item, shopData, { context });
      const unavailable = !quote?.available;
      const free =
        quote?.available &&
        quote.loyaltyRewardApplied === true &&
        Number(quote.priceAhn) === 0;
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="icon-slot">
          <span class="tier">${label}</span>
          <span class="icono-img" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;">
            ${item.icono ? `<img src="${item.icono}" style="width:100%;height:100%;object-fit:contain;">` : "🔧"}
          </span>
        </div>
        <div class="item-details">
          <span class="item-name">${item.nombre || item.name || "Equipo"}</span>
          <span class="item-cost">
            ${unavailable ? "NO DISPONIBLE" : free ? "GRATIS" : Number(quote.priceAhn).toLocaleString() + ' <span style="color:var(--brillo-ambar);">₳</span>'}
          </span>
          <span style="font-size:11px;color:${unavailable ? "#aa5555" : "#888"};">
            Durabilidad ${quote?.currentDurability ?? "?"}/${quote?.maxDurability ?? "?"} · ${quote?.missingDurability ?? "?"} PD por reparar
          </span>
        </div>
      `;

      row.onclick = () => {
        document
          .querySelectorAll("#lista-items-tienda .item-row")
          .forEach((entry) => entry.classList.remove("selected"));
        row.classList.add("selected");
        document.getElementById("panel-item-name").innerText =
          item.nombre || item.name || "Equipo";
        document.getElementById("panel-item-qty").innerText =
          quote?.missingDurability ?? "--";
        document.getElementById("panel-item-desc").innerText =
          unavailable
            ? "No se pudo determinar el material necesario para esta reparación."
            : `Reparación completa: ${quote.points} PD. Material/PD: ₳${Number(quote.materialValuePerPointAhn).toLocaleString()}. Mano de obra incluida.`;
        btnAccion.style.display = "block";
        btnAccion.disabled = unavailable;
        btnAccion.innerHTML = unavailable
          ? "NO DISPONIBLE"
          : free
            ? "CANJEAR REPARACIÓN"
            : `REPARAR [${Number(quote.priceAhn).toLocaleString()} ₳]`;
        btnAccion.onclick = unavailable
          ? null
          : () => window.repararItemTienda(tiendaId, inventory, key);
      };

      lista.appendChild(row);
    }

    document.getElementById("tienda-overlay").style.display = "flex";
  } catch (error) {
    console.error("Error abriendo servicios de tienda:", error);
  }
};

window.repararItemTienda = async function(tiendaId, inventoryKey, itemKey) {
  if (!playerId) return alert("Error: Jugador no identificado.");
  try {
    const result = await repairShopInventoryItem(
      playerId,
      tiendaId,
      inventoryKey,
      itemKey,
    );
    if (!result.repaired) {
      return alert(result.message || "No se pudo completar la reparación.");
    }
    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay) balanceDisplay.innerText = result.balanceAfter;
    alert(
      result.priceAhn === 0
        ? `${result.itemName} ha sido reparado sin costo por tu recompensa de lealtad.`
        : `${result.itemName} reparado por ₳${Number(result.priceAhn).toLocaleString()}.`,
    );
    await window.abrirServiciosTiendaDinamica(tiendaId);
  } catch (error) {
    console.error("Error reparando item:", error);
    alert("No se pudo completar la reparación.");
  }
};

window.venderItemTienda = async function(tiendaId, itemKey) {
  if (!playerId) return alert("Error: Jugador no identificado.");

  try {
    const [shopSnap, playerSnap] = await Promise.all([
      db.ref(`campaña/tiendas/${tiendaId}`).once("value"),
      db.ref(`campaña/jugadores/${playerId}`).once("value"),
    ]);
    const shopData = shopSnap.val();
    const playerData = playerSnap.val() || {};
    if (!shopData) return alert("La tienda ya no está disponible.");

    const shopRuntime = window.LuminousShopRuntime;
    const accessKey = currentShopPlayerAccessKey(playerData);
    if (shopRuntime?.isPlayerAllowed && !shopRuntime.isPlayerAllowed(shopData, accessKey)) {
      return alert("Esta tienda no está disponible para tu personaje.");
    }

    const result = await sellShopItemFromStash(
      playerId,
      itemKey,
      shopData,
      tiendaId,
    );
    if (!result.sold) {
      return alert("El objeto ya no está disponible en tu Stash.");
    }

    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay && result.balanceAfter !== null) {
      balanceDisplay.innerText = result.balanceAfter;
    }
    alert(`Venta completada: ${result.itemName} por ${result.priceAhn} ₳.`);
    await window.abrirVentaTiendaDinamica(tiendaId);
  } catch (error) {
    console.error("Error vendiendo item:", error);
    alert("No se pudo completar la venta.");
  }
};

window.comprarItemTienda = async function(tiendaId, itemKey) {
  if (!playerId) return alert("Error: Jugador no identificado.");

  try {
    const [shopSnap, playerSnap] = await Promise.all([
      db.ref(`campaña/tiendas/${tiendaId}`).once("value"),
      db.ref(`campaña/jugadores/${playerId}`).once("value"),
    ]);
    const shopData = shopSnap.val();
    const playerData = playerSnap.val() || {};
    if (!shopData) return alert("La tienda ya no está disponible.");

    const itemData = shopData.items?.[itemKey];
    if (!itemData) return alert("El objeto ya no está disponible.");

    const shopRuntime = window.LuminousShopRuntime;
    const accessKey = currentShopPlayerAccessKey(playerData);
    if (shopRuntime?.isPlayerAllowed && !shopRuntime.isPlayerAllowed(shopData, accessKey)) {
      return alert("Esta tienda no está disponible para tu personaje.");
    }
    const availability = shopRuntime?.itemAvailability?.(itemData, shopData);
    if (availability?.available === false) {
      return alert(
        availability.reason === "unpriced"
          ? "Este objeto no tiene un valor económico canónico y no puede comprarse."
          : "Este objeto no está disponible para esta tienda o su Tier.",
      );
    }

    const commerceContext = window.LuminousShopCommerceContext
      ? window.LuminousShopCommerceContext(playerData, shopData, tiendaId)
      : {};
    const priceBreakdown = shopRuntime?.priceBreakdown
      ? shopRuntime.priceBreakdown(itemData, shopData, { context: commerceContext })
      : null;
    if (priceBreakdown?.priceResolved === false) {
      return alert("Este objeto no tiene un valor económico canónico y no puede comprarse.");
    }
    const precioReal = priceBreakdown
      ? Math.max(0, Number(priceBreakdown.priceAhn) || 0)
      : (Math.max(0, parseInt(itemData.costo, 10) || 0) || null);
    if (precioReal == null) {
      return alert("Este objeto no tiene un valor económico canónico y no puede comprarse.");
    }
    const currentBalance =
      playerData.finance?.currentBalance !== undefined
        ? Number(playerData.finance.currentBalance) || 0
        : Number(playerData.ahn) || 0;

    if (currentBalance < precioReal) {
      return alert("Ahn insuficientes para esta compra.");
    }

    const stockReservation = await reserveShopStock(tiendaId, itemKey);
    if (!stockReservation.reserved) {
      return alert("El objeto se agotó antes de completar la compra.");
    }

    const rewardPlan = shopPromotionRewardPlan(
      playerData,
      shopData,
      tiendaId,
      itemData,
    );
    const rewardReservation = await reserveShopPromotionRewards(
      tiendaId,
      shopData,
      rewardPlan,
    );
    if (!rewardReservation.reserved) {
      await restoreShopStock(tiendaId, itemKey);
      return alert(
        rewardReservation.message ||
          "La promoción no puede completarse porque su recompensa no está disponible.",
      );
    }

    const newBalance = currentBalance - precioReal;
    const tx = {
      monto: -precioReal,
      concepto:
        priceBreakdown?.loyaltyRewardApplied === true
          ? `Recompensa de lealtad: ${itemData.nombre || itemData.name || "Objeto"}`
          : `Compra: ${itemData.nombre || itemData.name || "Objeto"}`,
      timestamp: Date.now(),
      unread: true,
      shopId: tiendaId,
      shopType: shopRuntime?.shopTypeId?.(shopData) || "general",
      shopTier: shopRuntime?.shopTier?.(shopData) || 1,
      listPriceAhn: priceBreakdown?.listPriceAhn ?? precioReal,
      discountPercent: priceBreakdown?.totalDiscountPercent || 0,
      loyaltyReward: priceBreakdown?.loyaltyRewardApplied === true,
    };

    try {
      await db.ref().update({
        [`campaña/jugadores/${playerId}/ahn`]: newBalance,
        [`campaña/jugadores/${playerId}/finance/currentBalance`]: newBalance,
      });
      await deliverShopPurchaseToStash(playerId, itemKey, itemData);
      var deliveredPromotionRewards = await deliverShopPromotionRewards(
        playerId,
        rewardReservation.reservations,
        { mode: "stash" },
      );
    } catch (error) {
      await Promise.allSettled([
        restoreShopStock(tiendaId, itemKey),
        restoreShopPromotionRewards(
          tiendaId,
          rewardReservation.reservations,
        ),
        db.ref().update({
          [`campaña/jugadores/${playerId}/ahn`]: currentBalance,
          [`campaña/jugadores/${playerId}/finance/currentBalance`]: currentBalance,
        }),
      ]);
      throw error;
    }

    try {
      await Promise.all([
        db.ref(`campaña/jugadores/${playerId}/finance/transactionHistory`).push(tx),
        db.ref(`campaña/jugadores/${playerId}/transacciones`).push(tx),
        window.LuminousRecordShopCommerceActivity?.(
          playerId,
          playerData,
          shopData,
          tiendaId,
          {
            kind: "item",
            item: itemData,
            paidAhn: precioReal,
            breakdown: priceBreakdown,
          },
        ),
      ]);
    } catch (commerceError) {
      console.warn("[Luminous][Shop] Purchase completed but commerce history could not be fully recorded.", commerceError);
    }

    const balanceDisplay = document.getElementById("shop-player-balance");
    if (balanceDisplay) balanceDisplay.innerText = newBalance;
    const rewardSuffix =
      Array.isArray(deliveredPromotionRewards) && deliveredPromotionRewards.length
        ? " · Promoción: recibes " + deliveredPromotionRewards.join(", ")
        : "";
    alert(
      (
        priceBreakdown?.loyaltyRewardApplied === true
          ? `${itemData.nombre || itemData.name || "Objeto"} corre por cuenta de la tienda.`
          : `¡Has comprado: ${itemData.nombre || itemData.name || "Objeto"}!`
      ) + rewardSuffix,
    );
    await window.abrirTiendaDinamica(tiendaId);
  } catch (error) {
    console.error("Error comprando item:", error);
    alert("No se pudo completar la compra.");
  }
};

  // Note: Contacts listener and globals are handled above in initChatSystem which already initializes contactsDictionary
  // but we should separate it for the explicit agenda UI.

  let contactsListenerActive = false;
  function initContactsSystem() {
      if (contactsListenerActive) return;
      if (!playerId) return;
      contactsListenerActive = true;

      const contactsRef = db.ref(`campaña/jugadores/${playerId}/contactos`);

      contactsRef.on("value", snap => {
          const listDiv = document.getElementById("contacts-list");
          if (!listDiv) return;
          listDiv.innerHTML = "";

          const contacts = snap.val() || {};
          // Update the dictionary for chats
          contactsDictionary = {};

          for (const [phone, data] of Object.entries(contacts)) {
              if (typeof data === "object" && data.alias) {
                 contactsDictionary[phone] = data.alias;
              } else if (typeof data === "string") {
                  contactsDictionary[phone] = data; // Legacy support
              }

              const alias = contactsDictionary[phone];

              const itemDiv = document.createElement("div");
              itemDiv.className = "contact-item";

              itemDiv.innerHTML = `
                  <div class="contact-info">
                      <span class="contact-alias">${alias}</span>
                      <span class="contact-number">[${phone}]</span>
                  </div>
                  <div class="contact-actions">
                      <button class="btn-contact-edit" data-phone="${phone}">EDITAR</button>
                      <button class="btn-contact-delete" data-phone="${phone}">ELIMINAR</button>
                  </div>
              `;

              listDiv.appendChild(itemDiv);
          }

          if (Object.keys(contacts).length === 0) {
              listDiv.innerHTML = "<div style='color: #666; text-align: center; padding: 20px;'><span style='font-family: \"Share Tech Mono\", monospace;'>El directorio está vacío.</span></div>";
          }

          // Re-attach listeners to dynamically created buttons
          document.querySelectorAll(".btn-contact-edit").forEach(btn => {
              btn.addEventListener("click", (e) => {
                  const phone = e.target.getAttribute("data-phone");
                  const currentAlias = contactsDictionary[phone];
                  const newAlias = prompt("Nuevo alias para " + phone + ":", currentAlias);
                  if (newAlias && newAlias.trim() !== "") {
                      db.ref(`campaña/jugadores/${playerId}/contactos/${phone}`).set({ alias: newAlias.trim() });
                  }
              });
          });

          document.querySelectorAll(".btn-contact-delete").forEach(btn => {
              btn.addEventListener("click", (e) => {
                  const phone = e.target.getAttribute("data-phone");
                  if (confirm("¿Eliminar a " + (contactsDictionary[phone] || phone) + " de tus contactos?")) {
                      db.ref(`campaña/jugadores/${playerId}/contactos/${phone}`).remove();
                  }
              });
          });
      });

      const btnAdd = document.getElementById("btn-add-contact");
      if (btnAdd && btnAdd.dataset.contactAddBound !== "true") {
          btnAdd.dataset.contactAddBound = "true";
          btnAdd.addEventListener("click", async () => {
              const numInput = document.getElementById("new-contact-number");
              const aliasInput = document.getElementById("new-contact-alias");
              const phone = String(numInput?.value || "").trim();
              const alias = String(aliasInput?.value || "").trim();

              if (!phone || !alias) {
                  alert("Debe ingresar un número y un alias.");
                  return;
              }

              btnAdd.disabled = true;
              try {
                  await db.ref(`campaña/jugadores/${playerId}/contactos/${phone}`).set({ alias });
                  contactsDictionary[phone] = alias;
                  if (numInput) numInput.value = "";
                  if (aliasInput) aliasInput.value = "";
              } catch (error) {
                  console.error("[Luminous][Phone] No se pudo guardar el contacto:", error);
                  alert(error?.code === "PERMISSION_DENIED"
                      ? "Firebase rechazó guardar el contacto. Verifica que esta cuenta esté vinculada al jugador correcto."
                      : "No se pudo guardar el contacto.");
              } finally {
                  btnAdd.disabled = false;
              }
          });
      }
  }

  // ==========================================
  // MOTOR DE SÍNTESIS (FORJA)
  // ==========================================
  let forjaInitialized = false;
  let forjaResolutionInitialized = false;
  let refreshForjaMesaCrafteo = null;
  let forjaCookingStationsGlobal = [];
  const getForjaPlayerData = () => window.datosJugador || {};

  function initForja() {
      if (forjaInitialized) return;
      forjaInitialized = true;

      let forjaSlots = {
          1: null, // { key, inventarioTipo, data }
          2: null,
          3: null,
          4: null,
          5: null
      };

      let mesaCrafteoGlobal = false;
      let targetSlot = null;

      // Refrescar bajo demanda: no dejamos listeners Firebase vivos cuando Synthesis está cerrado.
      // Cooking Stations son estado mundial autorizado por el Director.
      refreshForjaMesaCrafteo = () => Promise.all([
          db.ref("campaña/estado_mundo/mesa_crafteo_activa").once("value"),
          db.ref("campaña/estado_mundo/cooking_stations").once("value")
      ]).then(([mesaSnap, stationsSnap]) => {
          mesaCrafteoGlobal = !!mesaSnap.val();
          const stationState = stationsSnap.val() || {};
          forjaCookingStationsGlobal = Object.entries(stationState)
              .filter(([, enabled]) => enabled === true)
              .map(([stationId]) => stationId);
          updateForjaSlotsVisuals();

          const stationContext = document.getElementById("forja-station-context");
          if (stationContext) {
              stationContext.textContent = forjaCookingStationsGlobal.length
                  ? `Station autorizada: ${forjaCookingStationsGlobal.join(" / ")}`
                  : "Station autorizada: ninguna";
              stationContext.style.color = forjaCookingStationsGlobal.length ? "#0df" : "#888";
          }
      }).catch(() => {
          mesaCrafteoGlobal = false;
          forjaCookingStationsGlobal = [];
          updateForjaSlotsVisuals();
      });

      function tieneHerramientaCanonicaSintesis() {
          const registry = window.LuminousItemContentRegistry;
          if (!registry?.isSynthesisSlotUnlockTool) return false;

          const inventories = [
              getForjaPlayerData().inventario_activo || {},
              getForjaPlayerData().inventario_stash || {}
          ];

          return inventories.some(inventory =>
              Object.values(inventory).some(item =>
                  registry.isSynthesisSlotUnlockTool(item, window)
              )
          );
      }

      function updateForjaSlotsVisuals() {
          const unlocked4_5 = mesaCrafteoGlobal || tieneHerramientaCanonicaSintesis();

          [4, 5].forEach(slotNum => {
              const el = document.querySelector(`.synth-slot[data-slot="${slotNum}"]`);
              if (el) {
                  const lockOverlay = el.querySelector('.lock-overlay');
                  if (unlocked4_5) {
                      el.classList.remove("locked");
                      if (lockOverlay) lockOverlay.style.display = 'none';
                  } else {
                      el.classList.add("locked");
                      if (lockOverlay) lockOverlay.style.display = 'block';
                      forjaSlots[slotNum] = null; // Clear if locked
                  }
              }
          });

          renderSlotsContent();
      }

      function renderSlotsContent() {
          [1, 2, 3, 4, 5].forEach(slotNum => {
              const el = document.querySelector(`.synth-slot[data-slot="${slotNum}"]`);
              if (!el || el.classList.contains("locked")) return;

              const inner = el.querySelector('.synth-slot-inner');
              if(!inner) return;

              const item = forjaSlots[slotNum];
              if (item) {
                  // Clear inner, preserve lock-overlay just in case though it shouldn't be here
                  inner.innerHTML = `<img src="${item.data.icono || ''}" alt="${item.data.nombre}" title="${item.data.nombre}" style="width: 100%; height: 100%; object-fit: contain;">`;
              } else {
                  inner.innerHTML = '';
              }
          });
      }

      // Slot click logic
      document.querySelectorAll(".synth-slot, .synth-slot-center").forEach(slotEl => {
          slotEl.addEventListener("click", (e) => {
              if (slotEl.classList.contains("locked")) return;
              const slotNum = slotEl.getAttribute("data-slot");

              // Only regular slots are clickable for ingredients
              if(slotNum === "result") return;

              const sNum = parseInt(slotNum);

              if (forjaSlots[sNum]) {
                  // Click on filled slot -> remove item
                  forjaSlots[sNum] = null;
                  renderSlotsContent();
              } else {
                  // Click on empty slot -> open inventory selection
                  targetSlot = sNum;
                  openForjaSelectionModal();
              }
          });
      });

      function openForjaSelectionModal() {
          document.getElementById("forja-selection-modal").style.display = "flex";
          renderForjaSelectionInventory();
      }

      document.getElementById("forja-selection-close").addEventListener("click", () => {
          document.getElementById("forja-selection-modal").style.display = "none";
      });

      // Tabs in Forja Selection Modal
      document.querySelectorAll("#forja-selection-modal .inv-tab-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
              document.querySelectorAll("#forja-selection-modal .inv-tab-btn").forEach((b) => b.classList.remove("active"));
              document.querySelectorAll("#forja-selection-modal .inventory-tab-content").forEach((c) => c.classList.remove("active"));
              e.target.classList.add("active");
              document.getElementById(e.target.getAttribute("data-tab")).classList.add("active");
          });
      });

      function renderForjaSelectionInventory() {
          const activeGrid = document.getElementById("forja-sel-active-grid");
          const stashGrid = document.getElementById("forja-sel-stash-grid");
          activeGrid.innerHTML = "";
          stashGrid.innerHTML = "";

          // Count how many of each item are already in slots
          let usedCounts = {};
          Object.values(forjaSlots).forEach(slotItem => {
              if (slotItem) {
                  const id = slotItem.data.nombre; // We use nombre as ID for recipes
                  usedCounts[id] = (usedCounts[id] || 0) + 1;
              }
          });

          function renderGrid(dataNode, gridEl, invType) {
              if (!dataNode) return;
              for (const [key, item] of Object.entries(dataNode)) {
                  let cant = item.cantidad || 1;
                  let used = usedCounts[item.nombre] || 0;

                  // If all available copies of this item are in slots, hide it from selection
                  if (cant <= used) continue;

                  // Solo permitir items que podrían ser ingredientes (no filtrar por ahora, mostrar todos)

                  const div = document.createElement("div");
                  div.className = "inv-item";
                  div.innerHTML = `
                      <div class="item-img" style="background-image: url('${item.icono}')"></div>
                      <div class="item-qty">x${cant - used}</div>
                  `;
                  div.addEventListener("click", () => {
                      // Asignar al slot
                      forjaSlots[targetSlot] = { key, inventarioTipo: invType, data: item };
                      document.getElementById("forja-selection-modal").style.display = "none";
                      renderSlotsContent();
                  });
                  gridEl.appendChild(div);
              }
          }

          renderGrid(getForjaPlayerData().inventario_activo, activeGrid, "inventario_activo");
          renderGrid(getForjaPlayerData().inventario_stash, stashGrid, "inventario_stash");
      }

      // Player inventory state already arrives through the canonical player listener.
      // Do not open a second Firebase listener for the forge.

      // INIT
      updateForjaSlotsVisuals();

      // Make globals accessible for the next step
      window.forjaSlots = forjaSlots;
  }

  // Forge setup is lazy and runs only when the synthesis tab is opened.
  window.addEventListener("luminous:inventory-tab-changed", (event) => {
      if (event?.detail?.tab !== "inv-sintesis") return;
      initForja();
      initForjaResolution();
      refreshForjaMesaCrafteo?.();
  });


  // ==========================================
  // RESOLUCIÓN DE CRAFTEO (SÍNTESIS)
  // ==========================================
  function initForjaResolution() {
      if (forjaResolutionInitialized) return;
      forjaResolutionInitialized = true;

      const btnIniciar = document.querySelector(".btn-synth-action");
      const btnForecast = document.querySelector(".btn-forecast");
      const probValueEl = document.querySelector(".prob-value");
      const contentRegistry = window.LuminousItemContentRegistry;
      const recipeSelect = document.getElementById("forja-recipe-select");
      const stationContextEl = document.getElementById("forja-station-context");
      const toolRequirementEl = document.getElementById("forja-tool-requirement");

      if (!btnIniciar || !btnForecast || !probValueEl || !recipeSelect) return;

      function selectedSynthesisItems() {
          const rows = [];
          [1,2,3,4,5].forEach(slotNum => {
              const slot = window.forjaSlots?.[slotNum];
              if (!slot?.data) return;
              rows.push({
                  ...slot.data,
                  __selectedUnits: 1,
                  __forjaSlot: slotNum,
                  __forjaInventoryKey: slot.key,
                  __forjaInventoryType: slot.inventarioTipo
              });
          });
          return rows;
      }

      function availableToolItems() {
          const player = getForjaPlayerData();
          return [
              ...Object.values(player.inventario_activo || {}),
              ...Object.values(player.inventario_stash || {})
          ].filter(Boolean);
      }

      function authoritativeCookingStationIds() {
          // Only Director-managed world state is authoritative for cooking stations.
          return Array.from(new Set(
              forjaCookingStationsGlobal
                  .map(value => String(value || "").trim())
                  .filter(Boolean)
          ));
      }

      function renderStationContext(stationIds = authoritativeCookingStationIds()) {
          if (!stationContextEl) return;
          stationContextEl.textContent = stationIds.length
              ? `Station autorizada: ${stationIds.join(" / ")}`
              : "Station autorizada: ninguna";
          stationContextEl.style.color = stationIds.length ? "#0df" : "#888";
      }
      renderStationContext();

      function recipeDisplayName(entry) {
          const recipe = entry?.recipe || {};
          const base = recipe.name || recipe.label || recipe.id || "Recipe";
          const method = recipe.method || recipe.methodId || recipe.semanticCheck || "";
          return method ? `${base} · ${method}` : base;
      }

      function populateRecipeChoices(matches) {
          const previous = recipeSelect.value;
          recipeSelect.innerHTML = "";

          if (!matches.length) {
              recipeSelect.innerHTML = '<option value="">Sin Recipes disponibles para estos ingredientes</option>';
              recipeSelect.value = "";
              return;
          }

          if (matches.length > 1) {
              const placeholder = document.createElement("option");
              placeholder.value = "";
              placeholder.textContent = `Selecciona una Recipe (${matches.length} compatibles)...`;
              recipeSelect.appendChild(placeholder);
          }

          matches.forEach(entry => {
              const option = document.createElement("option");
              option.value = entry.recipeKey;
              option.textContent = recipeDisplayName(entry);
              recipeSelect.appendChild(option);
          });

          const canRestore = matches.some(entry => entry.recipeKey === previous);
          if (canRestore) {
              recipeSelect.value = previous;
          } else if (matches.length === 1) {
              recipeSelect.value = matches[0].recipeKey;
          } else {
              recipeSelect.value = "";
          }
      }

      function updateToolRequirement(match) {
          if (!toolRequirementEl) return;
          if (!match) {
              toolRequirementEl.textContent = "";
              toolRequirementEl.style.color = "#aaa";
              return;
          }

          const parts = [];
          const required = contentRegistry?.requiredToolType?.(match.recipe) || "";
          if (required) parts.push(`Tool: ${required}`);

          const equipment = match.resolution?.equipment;
          if (equipment?.profile?.requiredToolIds?.length) {
              parts.push(`Tool: ${equipment.profile.requiredToolIds.join(" / ")}`);
          }
          if (equipment?.profile?.requiredStationIds?.length) {
              parts.push(`Station: ${equipment.profile.requiredStationIds.join(" / ")}`);
          }

          toolRequirementEl.textContent = parts.length ? Array.from(new Set(parts)).join(" · ") : "Sin equipo obligatorio";
          toolRequirementEl.style.color = parts.length ? "#0df" : "#888";
      }

      function resolveCanonicalSynthesis(options = {}) {
          if (!contentRegistry?.findMatchingRecipes) return null;
          const items = selectedSynthesisItems();
          if (!items.length) return null;

          const toolItems = availableToolItems();
          const unit = getForjaPlayerData();
          const availableStationIds = authoritativeCookingStationIds(unit);
          renderStationContext(availableStationIds);
          const allMatches = contentRegistry.findMatchingRecipes(window, items, {
              toolItems,
              unit,
              availableStationIds,
              enforceTools: false,
              enforceEquipment: false
          });
          const usableMatches = contentRegistry.findMatchingRecipes(window, items, {
              toolItems,
              unit,
              availableStationIds,
              enforceTools: true,
              enforceEquipment: true
          });

          populateRecipeChoices(usableMatches);

          if (!usableMatches.length) {
              const missingTools = new Set();
              const missingStations = new Set();

              allMatches.forEach(entry => {
                  const strict = contentRegistry.resolveRecipe(entry.recipe, items, window, {
                      toolItems,
                      unit,
                      availableStationIds,
                      enforceTools: true,
                      enforceEquipment: true
                  });
                  const required = contentRegistry.requiredToolType?.(entry.recipe);
                  if (strict?.reason === "missing_required_tool" && required) missingTools.add(required);
                  (strict?.missingToolIds || strict?.equipment?.missingToolIds || []).forEach(id => missingTools.add(id));
                  (strict?.missingStationIds || strict?.equipment?.missingStationIds || []).forEach(id => missingStations.add(id));
              });

              const missingParts = [];
              if (missingTools.size) missingParts.push(`Tool: ${[...missingTools].join(" / ")}`);
              if (missingStations.size) missingParts.push(`Station: ${[...missingStations].join(" / ")}`);
              if (toolRequirementEl) {
                  toolRequirementEl.textContent = missingParts.length
                      ? `Falta ${missingParts.join(" · ")}`
                      : "Sin Recipe válida";
                  toolRequirementEl.style.color = "#ff6b6b";
              }
              if (options.notify !== false) {
                  alert(missingParts.length
                      ? `Tienes los ingredientes, pero falta equipo canónico: ${missingParts.join(" · ")}.`
                      : "La combinación de materiales es inestable. No se encontró ninguna Recipe canónica.");
              }
              return null;
          }

          if (usableMatches.length === 1) {
              updateToolRequirement(usableMatches[0]);
              return usableMatches[0];
          }

          const selectedKey = recipeSelect.value;
          const chosen = usableMatches.find(entry => entry.recipeKey === selectedKey) || null;
          if (!chosen) {
              if (toolRequirementEl) {
                  toolRequirementEl.textContent = "Elige una Recipe explícitamente";
                  toolRequirementEl.style.color = "#c49a00";
              }
              if (options.notify !== false) {
                  alert(`Hay ${usableMatches.length} Recipes compatibles. Selecciona explícitamente cuál quieres sintetizar.`);
              }
              return null;
          }

          updateToolRequirement(chosen);
          return chosen;
      }

      recipeSelect.addEventListener("change", () => {
          const items = selectedSynthesisItems();
          if (!items.length) return;
          const toolItems = availableToolItems();
          const unit = getForjaPlayerData();
          const matches = contentRegistry?.findMatchingRecipes?.(window, items, {
              toolItems,
              unit,
              availableStationIds: authoritativeCookingStationIds(unit),
              enforceTools: true,
              enforceEquipment: true
          }) || [];
          updateToolRequirement(matches.find(entry => entry.recipeKey === recipeSelect.value) || null);
      });

      function synthesisDifficulty(match, includeLabels = false) {
          const recipe = match?.recipe || {};
          let dcActual = contentRegistry?.recipeDifficulty
              ? contentRegistry.recipeDifficulty(recipe, match?.resolution)
              : Math.max(0, Number(recipe?.baseThreshold ?? recipe?.dificultad_base ?? 18) || 18);
          const modTexto = [];
          const activeInventory = getForjaPlayerData().inventario_activo || {};

          Object.values(activeInventory).forEach(item => {
              const rawKeywords = Array.isArray(item?.keywords)
                  ? item.keywords
                  : typeof item?.keywords === "string"
                    ? item.keywords.split(",").map(value => value.trim())
                    : [];

              rawKeywords.forEach(kw => {
                  const synthMatch = String(kw).match(/synth_bonus_(\d+)/i);
                  if (synthMatch) {
                      dcActual -= parseInt(synthMatch[1]);
                      if (includeLabels) modTexto.push(`+${synthMatch[1]} (Synth)`);
                  }
                  const craftMatch = String(kw).match(/crafting_up_(\d+)/i);
                  if (craftMatch) {
                      dcActual -= parseInt(craftMatch[1]);
                      if (includeLabels) modTexto.push(`+${craftMatch[1]} (Craft)`);
                  }
              });
          });

          return {
              dc: Math.max(0, dcActual),
              labels: modTexto
          };
      }

      btnForecast.addEventListener("click", async () => {
          await refreshForjaMesaCrafteo?.();
          const selectedItems = selectedSynthesisItems();
          if (!selectedItems.length) {
              alert("Debes colocar ingredientes en los slots para predecir.");
              probValueEl.innerText = "0%";
              return;
          }

          const match = resolveCanonicalSynthesis();
          if (!match) {
              probValueEl.innerText = "0%";
              return;
          }

          const difficulty = synthesisDifficulty(match);
          let prob = 100 - (difficulty.dc * 5);
          prob = Math.max(0, Math.min(100, prob));
          probValueEl.innerText = `${prob}% [DC:${difficulty.dc}] · ${match.recipe.name || match.recipe.label || match.recipe.id}`;
      });

      btnIniciar.addEventListener("click", async () => {
          await refreshForjaMesaCrafteo?.();
          const selectedItems = selectedSynthesisItems();
          if (!selectedItems.length) {
              alert("Debes colocar ingredientes en los slots.");
              return;
          }

          const match = resolveCanonicalSynthesis();
          if (!match) return;

          const difficulty = synthesisDifficulty(match, true);
          document.getElementById("forja-roll-dc").innerText =
              difficulty.dc + (difficulty.labels.length > 0 ? ` [${difficulty.labels.join(", ")}]` : "");
          document.getElementById("forja-roll-input").value = "";
          document.getElementById("forja-roll-modal").style.display = "flex";

          window.currentForjaAttempt = {
              receta: match.recipe,
              resolution: match.resolution,
              dc: difficulty.dc,
              slots: { ...window.forjaSlots }
          };
      });

      document.getElementById("btn-forja-cancel").addEventListener("click", () => {
          document.getElementById("forja-roll-modal").style.display = "none";
          window.currentForjaAttempt = null;
      });

      document.getElementById("btn-forja-confirm").addEventListener("click", async () => {
          const tirada = parseInt(document.getElementById("forja-roll-input").value) || 0;
          const attempt = window.currentForjaAttempt;
          if (!attempt) return;

          // Claim this attempt synchronously before the first await. A second
          // click must not be able to capture and submit the same craft.
          window.currentForjaAttempt = null;

          // Re-authorize world-owned station state at the moment the craft is
          // committed. A station may have been disabled after the roll modal
          // was opened, so the stale resolution must never be trusted.
          await refreshForjaMesaCrafteo?.();

          const currentItems = selectedSynthesisItems();
          const currentUnit = getForjaPlayerData();
          const refreshedResolution = contentRegistry?.resolveRecipe?.(
              attempt.receta,
              currentItems,
              window,
              {
                  toolItems: availableToolItems(),
                  unit: currentUnit,
                  availableStationIds: authoritativeCookingStationIds(),
                  enforceTools: true,
                  enforceEquipment: true
              }
          );

          if (!refreshedResolution?.valid) {
              alert("La Recipe ya no está autorizada con el estado actual de Tools/Stations.");
              document.getElementById("forja-roll-modal").style.display = "none";
              window.currentForjaAttempt = null;
              return;
          }

          attempt.resolution = refreshedResolution;
          const refreshedDifficulty = synthesisDifficulty({
              recipe: attempt.receta,
              resolution: refreshedResolution
          });
          attempt.dc = refreshedDifficulty.dc;

          document.getElementById("forja-roll-modal").style.display = "none";
          ejecutarTransaccionForja(attempt, tirada >= attempt.dc, tirada);
      });

      function ejecutarTransaccionForja(attempt, exito, tirada) {
          const playerRef = db.ref(`campaña/jugadores/${pName}`);

          playerRef.once("value").then(snap => {
              const playerData = snap.val() || {};
              const updates = {};
              let error = false;
              const itemsARestarActivo = {};
              const itemsARestarStash = {};

              [1,2,3,4,5].forEach(slotNum => {
                  const slotData = attempt.slots?.[slotNum];
                  if (!slotData) return;
                  const target = slotData.inventarioTipo === "inventario_activo"
                      ? itemsARestarActivo
                      : itemsARestarStash;
                  target[slotData.key] = (target[slotData.key] || 0) + 1;
              });

              function prepareConsumption(containerName, requested) {
                  const inventory = playerData[containerName] || {};
                  for (const [key, amount] of Object.entries(requested)) {
                      const row = inventory[key];
                      const current = Number(row?.quantity ?? row?.cantidad ?? 1);
                      if (!row || current < amount) {
                          error = true;
                          return;
                      }
                      const next = current - amount;
                      if (next <= 0) {
                          updates[`${containerName}/${key}`] = null;
                      } else {
                          updates[`${containerName}/${key}/quantity`] = next;
                          updates[`${containerName}/${key}/cantidad`] = next;
                      }
                  }
              }

              prepareConsumption("inventario_activo", itemsARestarActivo);
              if (!error) prepareConsumption("inventario_stash", itemsARestarStash);

              if (error) {
                  alert("Error de sincronización de inventario. No se tienen los ítems necesarios.");
                  limpiarSlotsForja();
                  return;
              }

              if (exito) {
                  if (!contentRegistry?.createRecipeOutput) {
                      alert("El registro canónico de Recipes no está disponible.");
                      limpiarSlotsForja();
                      return;
                  }

                  const canonicalOutput = contentRegistry.createRecipeOutput(attempt.receta, {
                      resolution: attempt.resolution,
                      checkResult: tirada,
                      unit: playerData
                  });
                  if (!canonicalOutput) {
                      alert("No se pudo construir el resultado canónico de la Recipe.");
                      limpiarSlotsForja();
                      return;
                  }

                  const outputQuantity = Math.max(1, Number(canonicalOutput.quantity || 1));
                  let runtimeInstance = canonicalOutput.instanceId ? canonicalOutput : null;
                  if (!runtimeInstance) {
                      try {
                          runtimeInstance = window.LuminousItemInventoryRuntime?.createItemInstance?.(
                              canonicalOutput,
                              {
                                  quantity: outputQuantity,
                                  qualityTier: canonicalOutput.qualityTier
                              }
                          ) || null;
                      } catch (error) {
                          console.warn("No se pudo crear instancia runtime de síntesis; usando payload canónico.", error);
                      }
                  }

                  const itemData = JSON.parse(JSON.stringify({
                      ...canonicalOutput,
                      ...(runtimeInstance || {}),
                      quantity: outputQuantity,
                      cantidad: outputQuantity
                  }));
                  const newItemKey = "forjado_" + Date.now();
                  updates[`inventario_activo/${newItemKey}`] = itemData;

                  playerRef.update(updates).then(() => {
                      alert(`¡Síntesis Exitosa! Has creado: ${itemData.nombre || itemData.name}`);
                      limpiarSlotsForja();
                  });
              } else {
                  playerRef.update(updates).then(() => {
                      alert("Síntesis Fallida. Los materiales se han consumido.");
                      limpiarSlotsForja();
                  });
              }
          });
      }

      function limpiarSlotsForja() {
          window.forjaSlots = {1:null, 2:null, 3:null, 4:null, 5:null};
          recipeSelect.innerHTML = '<option value="">Coloca ingredientes para detectar Recipes...</option>';
          renderStationContext();
          if (toolRequirementEl) {
              toolRequirementEl.textContent = "";
              toolRequirementEl.style.color = "#aaa";
          }
          document.querySelectorAll(".synth-slot").forEach(el => {
              if (!el.classList.contains("locked")) {
                  const inner = el.querySelector(".synth-slot-inner");
                  if (inner) inner.innerHTML = "";
              }
          });
      }
  }


