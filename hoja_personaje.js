// Data Maps for resolving IDs to Names
    const racesData = [
        { id: 'humano', nombre: 'Humano' },
        { id: 'lizalin', nombre: 'Lizalin' },
        { id: 'kobold', nombre: 'Kobold' },
        { id: 'kenku', nombre: 'Kenku' },
        { id: 'centauro', nombre: 'Centauro' },
        { id: 'goliat', nombre: 'Goliat' },
        { id: 'goblin', nombre: 'Goblin' },
        { id: 'hada', nombre: 'Hada' },
        { id: 'aasimar', nombre: 'Aasimar' },
        { id: 'tiefling', nombre: 'Tiefling' },
        { id: 'warforged', nombre: 'Warforged' },
        { id: 'felinae', nombre: 'Felinae' },
        { id: 'semi_dragon', nombre: 'Semi Dragón' },
        { id: 'lupae', nombre: 'Lupae' },
        { id: 'moonfae', nombre: 'Moonfae' },
        { id: 'undae', nombre: 'Undae' },
        { id: 'elnae', nombre: 'Elnae' },
        { id: 'yuanti_pura_sangre', nombre: 'Yuan-ti Pura Sangre' },
        { id: 'lanae', nombre: 'Lanae' },
        { id: 'tsune', nombre: 'Tsune' }
    ];

    const backgroundsData = [
        { id: "alta_cuna", name: "Alta Cuna", funds: "7,500,000 Ahn", benefit: "+1 Empatía, +1 Negociación, -1 Supervivencia" },
        { id: "aristocracia_mercantil", name: "Aristocracia Mercantil", funds: "9,000,000 Ahn", benefit: "+2 Negociación, +1 Engaño, -1 Vigor" },
        { id: "nobleza_caida", name: "Nobleza Caída", funds: "1,500,000 Ahn", benefit: "+1 Presencia, +1 Sigilo" },
        { id: "cuna_de_eruditos", name: "Cuna de Eruditos", funds: "4,500,000 Ahn", benefit: "+2 Ciencia, +1 Lore, -1 Carisma" },
        { id: "linaje_militar", name: "Linaje Militar", funds: "2,400,000 Ahn", benefit: "+1 Fortaleza, +1 Manejo" },
        { id: "familia_de_granjeros", name: "Familia de Granjeros", funds: "900,000 Ahn", benefit: "+1 Vigor, +1 Supervivencia" },
        { id: "artesano_independiente", name: "Artesano Independiente", funds: "1,800,000 Ahn", benefit: "+1 Reflejos, +1 Análisis" },
        { id: "fuerzas_de_seguridad", name: "Fuerzas de Seguridad (Bajas)", funds: "2,100,000 Ahn", benefit: "+1 Percepción, +1 Voluntad" },
        { id: "burocracia_menor", name: "Burocracia Menor", funds: "1,350,000 Ahn", benefit: "+1 Memoria, +1 Prudencia" },
        { id: "huerfano_callejero", name: "Huérfano Callejero", funds: "150,000 Ahn", benefit: "+2 Sigilo, +1 Agilidad, -1 Educación Formal (Lore)" },
        { id: "escoria_criminal", name: "Escoria Criminal", funds: "600,000 Ahn", benefit: "+1 Engaño, +1 Seducción" },
        { id: "exiliado_proscrito", name: "Exiliado / Proscrito", funds: "300,000 Ahn", benefit: "+2 Supervivencia, +1 Instinto, -1 Carisma" },
        { id: "esclavo_liberado", name: "Esclavo Liberado / Fugitivo", funds: "60,000 Ahn", benefit: "+2 Voluntad, +1 Templanza, -1 Confianza (Empatía)" },
        { id: "experimento_fallido", name: "Experimento Fallido", funds: "0 Ahn", benefit: "+2 Resistencia (Fortaleza), +1 Arcana, -1 Apariencia (Presencia)" },
        { id: "academico_desacreditado", name: "Académico Desacreditado", funds: "450,000 Ahn", benefit: "+2 Investigación, +1 Ciencia, -1 Reputación (Perspicacia)" },
        { id: "siervo_corporativo", name: "Siervo Corporativo (Bajo Rango)", funds: "750,000 Ahn", benefit: "+1 Represión, +1 Negociación" },
        { id: "deudor_vitalicio", name: "Deudor Vitalicio", funds: "-30,000,000 Ahn", benefit: "+2 Agilidad (huyendo de cobradores), +1 Supervivencia, -1 Tranquilidad (Templanza)" },
        { id: "miembro_culto", name: "Miembro de Culto Menor", funds: "240,000 Ahn", benefit: "+2 Fe, +1 Lore, -1 Razón (Análisis)" }
    ];

    const professionsData = [
        { id: "medico_cirujano", name: "Médico Cirujano / Anatomista", perks: [{id: "precision_quirurgica", nombre: "Precisión Quirúrgica", desc: "Nunca tratas con basura. Cualquier botiquín común (Tier 1) se considera automáticamente de 1 Tier superior en tus manos. Al curar fuera de combate recuperas 15 + 10% del HP Máx adicional."}, {id: "autopsia_expres", nombre: "Autopsia Exprés", desc: "Tienes +3 en Investigación o Ciencia para determinar la causa exacta de muerte, hora, y extraer un recuerdo residual o traza química útil de un cadáver fresco."}, {id: "mercado_rojo", nombre: "Mercado Rojo", desc: "Sabes cómo conservar la carne. Puedes extraer implantes cibernéticos o biomateriales intactos de cadáveres en minutos para venderlos en el mercado negro sin que pierdan su Tier."}, {id: "falso_diagnostico", nombre: "Falso Diagnóstico", desc: "Tienes +3 en Engaño o Perspicacia al tratar con NPCs heridos o enfermos, convenciéndolos de que tienen una afección letal que solo tú puedes tratar para extorsionarlos o interrogarlos."}, {id: "inyecciones", nombre: "Inyecciones", desc: "En tus descansos, creas estimulantes (Tier 2). Si es un descanso corto, creas 2; si es largo, 4. Pueden usarse para mantener a alguien despierto por días o darle energía antes de un interrogatorio."}] },
        { id: "ingeniero_mecanico", name: "Ingeniero / Artífice Mecánico", perks: [{id: "mantenimiento_eficiente", nombre: "Mantenimiento Eficiente", desc: "Puedes tomar chatarra y hacerla funcional. Un arma mecánica o prótesis en la que trabajes en un descanso largo (pasando el DC), sube 1 Tier."}, {id: "cortocircuito", nombre: "Cortocircuito", desc: "Usas 10 minutos para desactivar, puentear o reprogramar puertas de seguridad, cámaras o cerraduras electrónicas sin dejar rastro de forzamiento (Tienes +3 en Manejo para esto)."}, {id: "chatarrero", nombre: "Chatarrero", desc: "Encuentras piezas donde otros ven basura. Al saquear enemigos mecánicos o ruinas, obtienes siempre materiales equivalentes a 1 Tier superior."}, {id: "ingenieria_inversa", nombre: "Ingeniería Inversa", desc: "Si pasas 1 hora analizando un dispositivo, trampa o arma desconocida (incluso tecnología corporativa), descubres quién la fabricó, su propósito exacto y cómo desactivarla de forma segura."}, {id: "sabotaje_sutil", nombre: "Sabotaje Sutil", desc: "Puedes alterar el equipo de un NPC (vehículo, arma de fuego, prótesis) para que falle catastróficamente horas o días después de tu intervención, dejándote con una coartada perfecta."}] },
        { id: "erudito_academico", name: "Erudito / Investigador Académico", perks: [{id: "rata_de_biblioteca", nombre: "Rata de Biblioteca", desc: "Obtienes un +3 automático a cualquier check de Investigación o Lore relacionado con identificar la función, origen o Tier real de artefactos y contratos corporativos."}, {id: "conocimiento_prohibido", nombre: "Conocimiento Prohibido", desc: "Sabes cosas que rompen la mente. Puedes gastar 10 SP antes de tirar Análisis sobre criaturas anormales para obtener un +3 y descubrir mecánicas ocultas que el DJ debe revelarte."}, {id: "lenguas_muertas", nombre: "Lenguas Muertas", desc: "Entiendes cualquier idioma antiguo, corporativo encriptado o no humano. Tienes +3 en interacciones sociales con criaturas \"salvajes\" o habitantes de las Afueras."}, {id: "credenciales_falsificadas", nombre: "Credenciales Falsificadas", desc: "Tu dominio de la burocracia académica te permite entrar a zonas de cuarentena, archivos corporativos o bibliotecas privadas alegando \"investigación oficial\", otorgándote +3 en Engaño ante guardias."}, {id: "mente_aislada", nombre: "Mente Aislada", desc: "Has leído tantas atrocidades que la realidad ya no te afecta. Tienes ventaja en tiradas de salvación contra Miedo, Locura o Pánico, y recuperas +5 SP adicionales en cualquier descanso."}] },
        { id: "abogado_burocrata", name: "Abogado / Burócrata de Alto Nivel", perks: [{id: "letra_pequena", nombre: "Letra Pequeña", desc: "Empiezas con credenciales corporativas Tier 2. Tienes +3 en Negociación para sobornar o manipular contratos con los guardias oficiales."}, {id: "burocracia_asfixiante", nombre: "Burocracia Asfixiante", desc: "Si un guardia o NPC intenta arrestarte, multarte o prohibirte el paso, tiras Negociación (+3). Si pasas, los enredas en tanto papeleo y tecnicismos que te dejan ir solo para no lidiar contigo."}, {id: "extorsion", nombre: "Extorsión", desc: "Tienes +5 en checks de Negociación o Engaño siempre que tengas al menos un secreto, deuda o dato comprometedor sobre el objetivo con el que hablas."}, {id: "ejecucion_hipotecaria", nombre: "Ejecución Hipotecaria", desc: "Eres experto en leer la miseria financiera ajena. Tienes +3 en Perspicacia para saber al instante el mayor miedo o la deuda aplastante de un NPC con solo hablar 5 minutos con él."}, {id: "inmunidad_diplomatica_falsa", nombre: "Inmunidad Diplomática Falsa", desc: "Portas un sello o documento (Tier 2) que te da estatus de intocable temporal. Los NPCs comunes te temen y los guardias dudan en registrar tus pertenencias, dándote ventaja en puntos de control."}] },
        { id: "chef_gastronomico", name: "Chef Gastronómico / Nutricionista", perks: [{id: "paladar_absoluto", nombre: "Paladar Absoluto", desc: "Te niegas a servir basura Tier 1. La comida que preparas sube 1 Tier. Tus platillos restauran +10 SP adicionales a todos y otorgan un escudo de 10 + 5% del HP Máx al grupo."}, {id: "dulce_veneno_social", nombre: "Dulce Veneno Social", desc: "Tus postres o bebidas abren bocas. Un NPC que pruebe tus bocadillos \"especiales\" baja sus defensas mentales, dándote un +3 en checks de Seducción o Engaño para sacarle información."}, {id: "cocina_de_supervivencia", nombre: "Cocina de Supervivencia", desc: "Puedes preparar una comida decente (Tier 1) con literalmente cualquier cosa (carne de monstruo, maleza, ratas, sobras). Nadie se enfermará y el grupo no gastará Ahn en raciones ese día."}, {id: "raciones_de_combate", nombre: "Raciones de Combate", desc: "Puedes hacer 3 raciones rápidas (Tier 2) por descanso largo. Consumirlas en combate cuesta 1 Slot de Acción y cura 5 HP y SP instantáneamente."}, {id: "banquete_de_negocios", nombre: "Banquete de Negocios", desc: "Si cocinas un festín privado para un líder de facción o un PNJ clave, su disposición hacia el grupo mejora automáticamente un nivel de favorabilidad, facilitando alianzas o sobornos."}] },
        { id: "herrero_armero", name: "Herrero / Armero", perks: [{id: "forja_de_combate", nombre: "Forja de Combate", desc: "Dar mantenimiento a armas no mecánicas en un descanso las eleva 1 Tier superando el DC correspondiente durante ese día."}, {id: "tasador_de_sangre", nombre: "Tasador de Sangre", desc: "Con solo ver el arma o armadura de un PNJ desde lejos, sabes su Tier, si tiene buen mantenimiento, y deduces su estilo de lucha, otorgándote +3 en Perspicacia o Análisis al hablar con mercenarios."}, {id: "reparacion_estructural", nombre: "Reparación Estructural", desc: "Tienes el conocimiento arquitectónico para apuntalar techos a punto de colapsar, forzar puertas de metal oxidadas o crear barricadas impenetrables usando los escombros de la zona."}, {id: "marca_del_artesano", nombre: "Marca del Artesano", desc: "Tus armas tienen una firma reconocible. Puedes usar tu reputación de armero para ganar audiencias pacíficas o descuentos con líderes de sindicatos que siempre buscan buen acero."}, {id: "temple_de_acero", nombre: "Temple de Acero", desc: "Tu piel está curtida por la forja. El estado Burn baja 1 Count adicional por turno, y pierdes 1 menos de SP ante ataques o daños Psíquicos."}] },
        { id: "boticario_alquimista", name: "Boticario / Alquimista", perks: [{id: "destilacion_pura", nombre: "Destilación Pura", desc: "Refinas líquidos basura para que suban a Tier 2. Tus venenos u objetos consumibles aplican +2 Potency. Las pociones curativas restauran 5 + 5% del HP Máx adicional."}, {id: "nariz_quimica", nombre: "Nariz Química", desc: "Tu olfato detecta venenos, drogas, gas o enfermedades infecciosas en el aire o comida automáticamente. El DJ no puede envenenarte por sorpresa sin que tengas una oportunidad clara de notarlo."}, {id: "suero_de_la_verdad_casero", nombre: "Suero de la Verdad Casero", desc: "Fabrías un vial de suero interrogatorio por descanso largo. El NPC que lo ingiera sufre un -6 a sus tiradas para mentir y hablará de más durante 10 minutos seguidos de manera dócil."}, {id: "tolerancia_adquirida", nombre: "Tolerancia Adquirida", desc: "Sabes automedicarte. Las drogas recreativas, el alcohol industrial o los analgésicos de este mundo no te generan adicción ni penalizaciones de SP, pudiendo fingir embriaguez sin estarlo."}, {id: "traficante_de_alivio", nombre: "Traficante de Alivio", desc: "Puedes destilar analgésicos altamente adictivos (Tier 2). Te permite regalar dosis para ganar favores garantizados de PNJs adoloridos, adictos o guardias estresados en las calles."}] },
        { id: "sastre_tejedor", name: "Sastre / Tejedor de Armaduras", perks: [{id: "seda_y_acero", nombre: "Seda y Acero", desc: "Modificas ropa civil común (Tier 1) para que funcione como armadura ligera balística (Tier 2). Tus modificaciones otorgan +2 Slots de Inventario Activo ocultos bajo la tela."}, {id: "sastre_de_identidades", nombre: "Sastre de Identidades", desc: "Ajustas uniformes robados o ropa de otras facciones en solo 10 minutos para que te queden a ti o a tus aliados a la perfección. Nadie dudará de tu disfraz por culpa de la talla o el ajuste (+3 Engaño colectivo)."}, {id: "costuras_ocultas", nombre: "Costuras Ocultas", desc: "Sabes esconder objetos pequeños (ganzúas, chips, viales, navajas) en los dobladillos. Un registro físico estándar de la guardia jamás los detectará a menos que rompan físicamente tu ropa."}, {id: "limpiador_de_escenas", nombre: "Limpiador de Escenas", desc: "Conoces la química de la tela. Sabes cómo lavar y alterar ropa para eliminar cualquier rastro de sangre, pólvora o veneno en minutos, destruyendo la evidencia física de un asesinato."}, {id: "etiqueta_de_alta_costura", nombre: "Etiqueta de Alta Costura", desc: "Con un simple vistazo a la ropa de alguien, descubres su clase social real, su poder adquisitivo y si lleva armas o chalecos ocultos bajo la tela (Tienes +3 en Percepción al observar humanoides)."}] },
        { id: "ladron_de_guante_blanco", name: "Ladrón de Guante Blanco / Asaltante", perks: [{id: "ojo_de_tasador", nombre: "Ojo de Tasador", desc: "Sabes distinguir la basura del oro. Al entrar a una zona, el Director de Juego debe indicarte cuál es el objeto de mayor Tier o valor de la habitación sin que tengas que buscarlo."}, {id: "memoria_arquitectonica", nombre: "Memoria Arquitectónica", desc: "Si pasas 1 minuto observando un edificio desde la calle, sabes instintivamente dónde están los puntos ciegos de seguridad, las posibles bóvedas o las entradas de servicio ocultas."}, {id: "ladron_de_identidad", nombre: "Ladrón de Identidad", desc: "Si robas ropa, una placa o un pase de alguien, puedes imitar su comportamiento, postura y forma de hablar de manera tan natural que obtienes +3 en Engaño al infiltrarte en su lugar de trabajo."}, {id: "contacto_ciego", nombre: "Contacto Ciego", desc: "Conoces el lenguaje de señas del bajo mundo y las marcas de los gremios en las paredes. Puedes dejar, leer mensajes ocultos y encontrar refugios seguros que la guardia jamás notará."}, {id: "manos_de_seda", nombre: "Manos de Seda", desc: "Puedes robar objetos pequeños de los bolsillos de un NPC (tarjetas, llaves, monedas) o plantar evidencia incriminatoria en ellos durante una conversación social sin necesidad de tirar dados, siempre que el NPC esté distraído."}] },
        { id: "contrabandista_traficante", name: "Contrabandista / Traficante", perks: [{id: "doble_fondo", nombre: "Doble Fondo", desc: "Obtienes un contacto en los bajos fondos en cada distrito nuevo y posees compartimentos en tus mochilas/vehículos imposibles de detectar en registros visuales o de seguridad estándar."}, {id: "mercado_negro", nombre: "Mercado Negro", desc: "Puedes comprar y vender objetos de Tier 2 en cualquier ciudad sin hacer preguntas, y siempre tienes la opción de conseguir un 20% de descuento en el mercado criminal."}, {id: "ojo_para_el_corrupto", nombre: "Ojo para el Corrupto", desc: "Sabes a quién puedes sobornar. Con una sola charla, el DJ te dirá qué guardia es comprable, qué precio aproximado tiene, o qué vicio padece para chantajearlo a futuro."}, {id: "mentiroso_patologico", nombre: "Mentiroso Patológico", desc: "Tienes +3 en checks de Engaño. Si te atrapan en una mentira en un diálogo, puedes inventar otra completamente distinta inmediatamente sin penalización por parte del NPC. (Al tercer intento la penalización es de -6)."}, {id: "tarifas_de_aduana", nombre: "Tarifas de Aduana", desc: "Al interactuar con inspectores o guardias de peajes, sabes exactamente cuánto Ahn u objetos ofrecer para que miren a otro lado sin ofenderlos por ofrecer de menos, ni desperdiciar oro ofreciendo de más."}] },
        { id: "cazarrecompensas_rastreador", name: "Cazarrecompensas / Rastreador", perks: [{id: "licencia_de_persecucion", nombre: "Licencia de Persecución", desc: "Tienes una placa del gremio. Cuando interrogas a civiles sobre el paradero de alguien, tienes +3 en Presencia y legalmente no pueden negarse a darte información básica sin meterse en problemas."}, {id: "marca_del_depredador", nombre: "Marca del Depredador", desc: "Memorizas la forma de caminar y respirar de tu objetivo. Tienes +3 en Perspicacia para saber si un NPC te está tendiendo una trampa, y puedes seguir un rastro de huellas en una multitud sin perderte."}, {id: "reputacion_implacable", nombre: "Reputación Implacable", desc: "Tu presencia asfixia a la escoria. Tienes +3 en Presencia al intimidar a criminales de bajo nivel. Si ceden y te dan información, recuperas 5 SP por la satisfacción del dominio absoluto."}, {id: "red_de_informantes_locales", nombre: "Red de Informantes Locales", desc: "En cada distrito tienes un matón, adicto o vagabundo que te debe la vida (o teme tu nombre), asegurando un refugio temporal o información rápida sobre quién entró o salió del área."}, {id: "ojo_de_la_calle", nombre: "Ojo de la Calle", desc: "Identificas de inmediato las fronteras invisibles del territorio de pandillas o corporaciones solo por los grafitis, la basura y el comportamiento de la gente, evitando entrar a zonas calientes por accidente."}] },
        { id: "informante_espia", name: "Informante / Espía", perks: [{id: "red_de_susurros", nombre: "Red de Susurros", desc: "Al llegar a cualquier zona nueva, recolectas información pasivamente para saber quién está al mando en la sombra, qué facciones operan y cuáles son las reglas no escritas del lugar."}, {id: "lectura_de_labios", nombre: "Lectura de Labios", desc: "No necesitas escuchar para saber qué traman. Puedes entender conversaciones a la perfección desde lejos, a través de cristales o en bares ruidosos, siempre que puedas ver la boca de los hablantes."}, {id: "camaleon_social", nombre: "Camaleón Social", desc: "Eres psicológicamente invisible en multitudes. Si estás rodeado de al menos 3 civiles, la guardia local o los sicarios que te busquen a pie serán incapaces de distinguirte como una amenaza."}, {id: "falsificador_agil", nombre: "Falsificador Ágil", desc: "Eres un experto replicando firmas y sellos. Con una hora y materiales básicos, puedes crear documentos falsos (Tier 1 o 2) que pasarán cualquier inspección visual humana o de burócratas cansados."}, {id: "memoria_fotografica", nombre: "Memoria Fotográfica", desc: "Tienes +3 en checks de Memoria para recordar planos de seguridad, códigos, rostros o conversaciones exactas. Nunca te pierdes en un edificio si has visto el plano de evacuación una sola vez."}] },
        { id: "musico_artista", name: "Músico / Artista Escénico", perks: [{id: "audiencia_cautiva", nombre: "Audiencia Cautiva", desc: "En un descanso corto, interpretas para el grupo. Los aliados que te toleren y escuchen recuperan 10 SP adicionales en ese momento. Su moral queda condicionada, ganando +1 Attack Power Up solo durante la primera ronda de su próximo combate."}, {id: "centro_de_atencion", nombre: "Centro de Atención", desc: "Puedes iniciar una actuación pública que atrae instintivamente las miradas de los guardias y NPCs civiles en la zona, dando un bono de +5 automático a las tiradas de Sigilo de tus aliados mientras te escuchan."}, {id: "acto_de_tragedia", nombre: "Acto de Tragedia", desc: "La primera vez en combate que tu HP cae bajo el 25% o sufres Stagger, finges un colapso cataclísmico o la muerte misma. Los enemigos humanoides cancelarán sus ataques apuntados a ti esa ronda para ir por otra presa, asumiendo que ya eres un cadáver."}, {id: "melodia_de_cuna", nombre: "Melodía de Cuna", desc: "Tienes +3 en checks de Seducción o Carisma en interacciones pacíficas. Si tocas una canción durante un descanso largo, el sueño del grupo es profundo y sin pesadillas, curando 20 HP extra al despertar."}, {id: "pase_vip", nombre: "Pase VIP", desc: "Tu carisma te precede. Tienes +3 en Engaño para convencer a los guardias de eventos exclusivos o corporativos de que eres el entretenimiento contratado o un invitado excéntrico, dejando pasar al grupo como tu \"staff\"."}] },
        { id: "clerigo_fanatico", name: "Clérigo / Fanático Religioso", perks: [{id: "palabra_sagrada", nombre: "Palabra Sagrada", desc: "Tu fanatismo te aísla de la realidad. Eres completamente inmune al primer efecto de reducción de SP o al primer chequeo de daño mental (Pánico/Terror) que sufras cada día."}, {id: "confesionario", nombre: "Confesionario", desc: "Tu aura de devoción o fanatismo incita la culpa. Tienes +3 en Empatía para lograr que un NPC quebrado o asustado te revele sus crímenes, contraseñas o pecados ocultos a cambio de tu \"absolución\"."}, {id: "inquisidor", nombre: "Inquisidor", desc: "Tienes un +3 automático en checks de Análisis o Investigación exclusivamente cuando se trata de rastrear escondites de herejes, sectas del bajo mundo u objetos profanos ocultos en la ciudad."}, {id: "diezmo_de_los_desesperados", nombre: "Diezmo de los Desesperados", desc: "En zonas de baja clase, puedes predicar durante 1 hora para conseguir refugio seguro, raciones de Tier 1 y pequeñas donaciones de información de los creyentes sin tener que gastar un solo Ahn."}, {id: "funeral_apropiado", nombre: "Funeral Apropiado", desc: "Si pasas 10 minutos dando los ritos funerarios a un cadáver en el camino o a un aliado caído, recuperas 15 SP y tu mente se blinda, volviéndote inmune a los efectos pasivos de Miedo por el resto del día."}] },
        { id: "guardia_soldado", name: "Guardia / Soldado Raso", perks: [{id: "centinela", nombre: "Centinela", desc: "Tu cuerpo está hecho para vigilar. Ignoras las penalizaciones de tiradas por falta de sueño o luz baja en tus checks de Percepción mientras montas guardia."}, {id: "ojo_marcial", nombre: "Ojo Marcial", desc: "Con solo ver la postura, cicatrices y equipo de un NPC, sabes exactamente su nivel de entrenamiento, qué armas oculta bajo el abrigo y si es un soldado organizado o un simple matón de callejón."}, {id: "jerga_de_cuartel", nombre: "Jerga de Cuartel", desc: "Sabes cómo piensan los perros de la corporación. Tienes +3 en Engaño o Negociación al interactuar con patrullas militares o mercenarios, fingiendo ser un veterano o usando códigos de radio correctos."}, {id: "marcha_forzada", nombre: "Marcha Forzada", desc: "Puedes guiar al grupo para viajar por túneles, páramos o ruinas durante la noche o el doble de rápido sin que nadie en el equipo sufra penalizaciones mecánicas por fatiga al día siguiente."}, {id: "disciplina_militar", nombre: "Disciplina Militar", desc: "Eres resistente al interrogatorio físico. Si eres capturado, tienes +5 en tiradas de Voluntad para no revelar los planes de tu grupo ni las contraseñas, incluso bajo tortura directa."}] }
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
        { id: "el_naufragado", name: "El Naufragado" }
    ];


// Firebase Init for Character Sheet
const playerId = localStorage.getItem('playerId');
if (!playerId) {
    window.location.href = 'index.html'; // Proteccion de ruta
}

let currentPlayerData = {};
let currentActorListener = null;

// VARIABLES GLOBALES ESTRICTAS
window.datosJugador = null;
window.actoresJugador = {}; // Diccionario global por Actor ID

// 1. Descargar datos base del jugador
db.ref('campaña/jugadores/' + playerId).on('value', (snapshot) => {
    if (snapshot.exists()) {
        window.datosJugador = snapshot.val();
        renderCharacterSheet(window.datosJugador);
    }
});

// 2. Llenar el menú principal con los Actores (Usando el Actor ID)
db.ref('campaña/actores').on('value', (snapshot) => {
    const actorSelect = document.getElementById('player-actor-select');
    if (!actorSelect || !snapshot.exists()) return;

    const currentSelection = actorSelect.value;
    const nombreBase = (window.datosJugador && window.datosJugador.characterName) ? window.datosJugador.characterName : "Mi Personaje";
    
    actorSelect.innerHTML = `<option value="base">${nombreBase}</option>`;
    window.actoresJugador = {};

    const actores = snapshot.val();
    for (const [actorId, actorData] of Object.entries(actores)) {
        if (actorData.tipo === "Jugador") {
            // Guardamos en el diccionario usando el Actor ID exacto
            window.actoresJugador[actorId] = actorData; 
            actorSelect.innerHTML += `<option value="${actorId}">[Actor] ${actorData.nombre}</option>`;
        }
    }

    if (currentSelection && actorSelect.querySelector(`option[value="${currentSelection}"]`)) {
        actorSelect.value = currentSelection;
    }
    
    window.actualizarExpresionesDesdeDropdown();
});

// 3. Función que inyecta las expresiones basada en el Actor ID seleccionado
window.actualizarExpresionesDesdeDropdown = function() {
    const actorSelect = document.getElementById('player-actor-select');
    const selectExp = document.getElementById('player-expression-select');
    if (!actorSelect || !selectExp) return;

    const selectedActorId = actorSelect.value; // ESTE ES EL ACTOR ID
    selectExp.innerHTML = '';

    if (selectedActorId !== 'base' && window.actoresJugador && window.actoresJugador[selectedActorId]) {
        const actor = window.actoresJugador[selectedActorId];
        if (actor.expresiones) {
            selectExp.style.display = 'inline-block';
            
            // Handle array of objects format (e.g. [{nombre: '...', url: '...'}] from Firebase)
            if (Array.isArray(actor.expresiones)) {
                actor.expresiones.forEach(exp => {
                    if (exp && exp.nombre && exp.url) {
                        const option = document.createElement('option');
                        option.value = exp.url;
                        option.textContent = exp.nombre;
                        selectExp.appendChild(option);
                    }
                });
            } else {
                // Legacy dictionary format ({'Feliz': 'url...', ...})
                for (const [nombreExp, urlSprite] of Object.entries(actor.expresiones)) {
                    // Check if the value is actually an object (malformed dictionary from Firebase array mutation)
                    if (typeof urlSprite === 'object' && urlSprite !== null) {
                       const option = document.createElement('option');
                       option.value = urlSprite.url || urlSprite.sprite || '';
                       option.textContent = urlSprite.nombre || urlSprite.name || nombreExp;
                       if (option.value) selectExp.appendChild(option);
                    } else {
                        const option = document.createElement('option');
                        option.value = urlSprite;
                        option.textContent = nombreExp;
                        selectExp.appendChild(option);
                    }
                }
            }
            
            // Si después de todo no hay opciones, ocultar
            if (selectExp.options.length > 0) return;
        }
    }
    
    // Ocultar si es el personaje base o no tiene expresiones
    selectExp.style.display = 'none';
};

// 4. Asignar el evento GLOBALMENTE (Event Delegation) a prueba de fallos
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'player-actor-select') {
        if (typeof window.actualizarExpresionesDesdeDropdown === 'function') {
            window.actualizarExpresionesDesdeDropdown();
        }
    }
});

window.renderCharacterSheet = function(data) {
    if (data.baseStats) {
        // Fuerza la actualización VISUAL en el HTML
        const elCuerpo = document.querySelector('input[name="attr_cuerpo"]') || document.getElementById('stat-cuerpo') || document.querySelector('span[name="attr_cuerpo"]');
        const elMente = document.querySelector('input[name="attr_mente"]') || document.getElementById('stat-mente') || document.querySelector('span[name="attr_mente"]');
        const elAlma = document.querySelector('input[name="attr_alma"]') || document.getElementById('stat-alma') || document.querySelector('span[name="attr_alma"]');

        if (elCuerpo) {
            if (elCuerpo.tagName === 'INPUT') elCuerpo.value = data.baseStats.cuerpo || 0;
            else elCuerpo.innerText = data.baseStats.cuerpo || 0;
        }

        if (elMente) {
            if (elMente.tagName === 'INPUT') elMente.value = data.baseStats.mente || 0;
            else elMente.innerText = data.baseStats.mente || 0;
        }

        if (elAlma) {
            if (elAlma.tagName === 'INPUT') elAlma.value = data.baseStats.alma || 0;
            else elAlma.innerText = data.baseStats.alma || 0;
        }
    }

    // 1. Stats Principales (Cuerpo, Mente, Alma)
    const coreStats = ['cuerpo', 'mente', 'alma'];
    coreStats.forEach(stat => {
        const statValue = (data.stats && data.stats[stat]) !== undefined ? data.stats[stat] : data[stat];
        const elements = document.querySelectorAll(`[name="attr_${stat}"]`);
        elements.forEach(el => {
            if (el.tagName === 'INPUT') el.value = statValue || 0;
            else el.innerText = statValue || 0;
        });
    });

    // Datos Básicos
    if (data.characterName) {
        document.querySelectorAll('input[name="attr_character_name"], span[name="attr_character_name"], div[name="attr_character_name"]').forEach(el => {
            if (el.tagName === 'INPUT') el.value = data.characterName;
            else el.innerText = data.characterName;
        });

        // Custom nameplaces (like the avatar id-name)
        const idNameEl = document.querySelector('.sheet-id-name');
        if (idNameEl) idNameEl.innerText = data.characterName;
    }

    if (data.ahn !== undefined) {
        document.querySelectorAll('.sheet-banco-amount-display, #display-ahn, input[name="attr_ahn"], span[name="attr_ahn"]').forEach(el => {
            if (el.tagName === 'INPUT') el.value = data.ahn;
            else el.innerText = data.ahn;
        });

        // Ensure standard .banco-balance or similar is updated if it exists
        const bancoBalance = document.getElementById('display-ahn');
        if (bancoBalance) {
            // Only update text content safely
            bancoBalance.textContent = new Intl.NumberFormat('en-US').format(data.ahn || 0);
        }

        // Update new Shop Modal Ahn display
        const shopAhn = document.getElementById('shop-display-ahn');
        if (shopAhn) {
            shopAhn.textContent = new Intl.NumberFormat('en-US').format(data.ahn || 0);
        }
    }

    // Subtitulos y avatares
    if (data.class) {
        document.querySelectorAll('span[name="attr_class"]').forEach(el => el.innerText = data.class);
    }
    if (data.race) {
        document.querySelectorAll('span[name="attr_race"]').forEach(el => el.innerText = data.race);
    }
    if (data.background) {
        document.querySelectorAll('span[name="attr_background"]').forEach(el => el.innerText = data.background);
    }
    if (data.identity) {
        document.querySelectorAll('span[name="attr_identity"]').forEach(el => el.innerText = data.identity);
    }

    // Nivel y XP
    if (data.level !== undefined) {
        document.querySelectorAll('span[name="attr_level"]').forEach(el => el.innerText = data.level);
        document.querySelectorAll('input[name="attr_level"]').forEach(el => el.value = data.level);
    }
    if (data.xp !== undefined) {
        document.querySelectorAll('span[name="attr_xp"]').forEach(el => el.innerText = data.xp);
        document.querySelectorAll('input[name="attr_xp"]').forEach(el => el.value = data.xp);
    }
    if (data.xpMissing !== undefined) {
        document.querySelectorAll('span[name="attr_xp_missing"]').forEach(el => el.innerText = data.xpMissing);
    }

    // Render Progress Bar
    const xpBarClass = document.querySelector('.sheet-state-xp-bar');
    if (xpBarClass && data.xpPercent !== undefined) {
        let roundedPercent = Math.floor(data.xpPercent / 5) * 5;
        xpBarClass.value = `sheet-xp-${roundedPercent}`;

        // Update DOM classes for CSS to trigger
        const xpBarParent = document.querySelector('.sheet-xp-bar-container');
        if (xpBarParent) {
            xpBarParent.className = `sheet-xp-bar-container sheet-xp-${roundedPercent}`;
        }
    }

    // Modificadores (Stats)
    if (data.modifiers) {
        for (const [stat, value] of Object.entries(data.modifiers)) {
            // Asume que los inputs en HTML tienen name="attr_stat_en_minuscula"
            // También manejamos los que empiezan con skill_
            const selectors = [
                `input[name="attr_${stat.toLowerCase()}"]`,
                `span[name="attr_${stat.toLowerCase()}"]`,
                `input[name="attr_skill_${stat.toLowerCase()}"]`,
                `span[name="attr_skill_${stat.toLowerCase()}"]`
            ];

            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                        el.value = value;
                    } else {
                        el.innerText = value;
                    }
                });
            });
        }
    }

    // 2. Inventario (Stash)
    // Nota para Jules: Firebase puede devolver arrays como objetos si sufrieron mutaciones. Usa Object.values.
    const stashContainer = document.getElementById('inv-stash-grid') || document.querySelector('.inventory-grid') || document.getElementById('inventory-list');
    if (stashContainer) {
        stashContainer.innerHTML = ''; // Limpiar antes de renderizar
        const stashItems = data.stash ? Object.values(data.stash) : [];
        stashItems.forEach(item => {
            stashContainer.innerHTML += `
                <div class="inventory-item-card" style="border: 1px solid #444; padding: 5px; margin-bottom: 5px; background: #1a1a1a; display: flex; justify-content: space-between;">
                    <div>
                        <span style="color: #fff; font-family: 'Mikodacs';">${item.nombre || 'Ítem Desconocido'}</span>
                        <span style="color: #aaa; font-size: 0.8em; display: block;">${item.tag || 'Suministro'}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: #ffd700; font-weight: bold;">Tier ${item.tier || 'I'}</span>
                        <span style="color: #00ffff; display: block;">x${item.cantidad || 1}</span>
                    </div>
                </div>
            `;
        });
    }

    // 3. Perks y Habilidades
    const perksContainer = document.querySelector('.repeating_skills') || document.querySelector('.sheet-perks-list') || document.getElementById('perks-container');
    if (perksContainer) {
        perksContainer.innerHTML = '';
        let perks = [];
        if (data.perks) perks = perks.concat(Object.values(data.perks));
        if (data.humanPerks) perks = perks.concat(Object.values(data.humanPerks));

        perks.forEach(perk => {
            perksContainer.innerHTML += `
                <div class="perk-card" style="border-left: 3px solid #c49a00; padding: 10px; margin-bottom: 10px; background: #111; box-shadow: 0 0 5px rgba(0,0,0,0.5);">
                    <div style="color: #00ffff; font-weight: bold; font-family: 'Share Tech Mono', monospace; font-size: 1.1em; text-transform: uppercase;">${perk.nombre || perk.id || 'Perk Desconocido'}</div>
                    <div style="color: #ccc; font-size: 0.9em; margin-top: 5px;">${perk.desc || 'Sin descripción'}</div>
                </div>
            `;
        });
    }

    // 4. Mails (Apps del Celular)
    const mailsContainer = document.querySelector('.mail-inbox-list') || document.getElementById('mails-list') || document.querySelector('.mails-container');
    if (mailsContainer) {
        mailsContainer.innerHTML = '';
        let mails = data.mails ? Object.values(data.mails) : [];

        mails.sort((a, b) => {
            let tA = a.timestamp || 0;
            let tB = b.timestamp || 0;
            return tB - tA;
        });

        if (mails.length === 0) {
            mailsContainer.innerHTML = '<div style="color: #666; font-style: italic; padding: 10px; text-align: center;">Bandeja de entrada vacía</div>';
        } else {
            mails.forEach(mail => {
                let dateStr = mail.inGameTime || "";
                if (!dateStr && mail.timestamp) {
                    const d = new Date(mail.timestamp);
                    dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }

                const mailItem = document.createElement('div');
                mailItem.className = 'mail-item';
                mailItem.style = 'border-bottom: 1px solid #333; padding: 10px; cursor: pointer;';

                mailItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <strong style="color: var(--cyan-tech, #00ffff); font-family: 'Share Tech Mono', monospace;">${(mail.remitente || 'Desconocido').replace(/</g, "&lt;")}</strong>
                        ${dateStr ? `<span style="color: #666; font-size: 0.7em;">${dateStr}</span>` : ''}
                    </div>
                    <p style="color: #ccc; margin: 4px 0 0 0; font-size: 0.9em; font-weight: bold;">${(mail.asunto || 'Sin Asunto').replace(/</g, "&lt;")}</p>
                    <p style="color: #888; margin: 4px 0 0 0; font-size: 0.8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(mail.mensaje || '').replace(/</g, "&lt;")}</p>
                `;

                mailItem.addEventListener('click', () => {
                    alert(`De: ${mail.remitente || 'Desconocido'}\nAsunto: ${mail.asunto || 'Sin Asunto'}\n\nMensaje:\n${mail.mensaje || 'Vacío'}`);
                });

                mailsContainer.appendChild(mailItem);
            });
        }
    }

    // 5. Transacciones (Apps del Celular)
    const transContainer = document.getElementById('lista-transacciones-banco') || document.getElementById('transactions-list') || document.querySelector('.transactions-container');
    if (transContainer) {
        transContainer.innerHTML = ''; // Limpia lo viejo

        // Ensure we check for transacciones too if transactions is not found
        const dataTrans = data.transacciones || data.transactions;
        if (dataTrans) {
            // Convertir a array, ordenar por fecha y tomar las últimas 3
            const transArray = Object.values(dataTrans).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 3);

            transArray.forEach(t => {
                const div = document.createElement('div');
                div.className = 'transaccion-item';
                // Pinta el HTML real:
                div.innerHTML = `
                    <span style="color: ${t.monto > 0 ? '#44ff44' : '#ff4444'}; font-weight: bold;">
                        ${t.monto > 0 ? '+' : ''}${t.monto} Ahn
                    </span>
                    <span style="color: #aaa; font-size: 0.9em;"> - ${(t.concepto || 'Transacción').replace(/</g, "&lt;")}</span>
                `;
                transContainer.appendChild(div);
            });
        } else {
            transContainer.innerHTML = '<div style="color: #666;">Sin transacciones recientes.</div>';
        }
    }
}

// UI EVENT LISTENERS
window.addEventListener('DOMContentLoaded', () => {
    // Phone Toggle
    const toggleBtn = document.getElementById('btn-toggle-phone');
    const phoneWrapper = document.querySelector('.sheet-phone-wrapper');
    if (toggleBtn && phoneWrapper) {
        toggleBtn.addEventListener('click', () => {
            phoneWrapper.classList.toggle('phone-hidden');
        });
    }

    // Tabs List Main
    const tabsList = ["home", "stats", "abilities", "skills", "profile", "parts", "apego", "banco", "contratos", "codex", "mapa", "notas", "shop", "crafteo"];

    // Tab switching logic for Main Nav
    document.querySelectorAll('button[name^="act_tab_"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let tabName = btn.getAttribute('name').replace('act_tab_', '');

            // Esconder todas las pestañas
            document.querySelectorAll('.sheet-tab-content').forEach(el => {
                el.style.display = 'none';
            });

            // Mostrar la seleccionada
            const targetTab = document.querySelector(`.sheet-tab-${tabName}`);
            if (targetTab) {
                targetTab.style.display = 'block';
            }

            // Set state input for CSS if any uses it
            const stateInput = document.querySelector('.sheet-state-tab');
            if (stateInput) stateInput.value = tabName;
        });
    });

    // Show Home by default
    document.querySelectorAll('.sheet-tab-content').forEach(el => el.style.display = 'none');
    const homeTab = document.querySelector('.sheet-tab-home');
    if (homeTab) homeTab.style.display = 'block';

    // --- NUEVO SISTEMA DE NAVEGACIÓN DE VENTANAS (VANILLA JS) ---
    // Buscar todos los botones de acción del HUD y Codex
    document.querySelectorAll('button[type="action"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const actionName = this.getAttribute('name');
            if (!actionName) return;

            // Lógica para abrir los modales principales (Stats, Perks, Skills, etc.)
            if (actionName.startsWith('act_hud_') && actionName !== 'act_hud_close') {
                const modalName = actionName.replace('act_hud_', '');

                // 1. Ocultar todos los modales
                document.querySelectorAll('.sheet-modal-container, .sheet-modal').forEach(m => {
                    m.style.display = 'none';
                });

                // 2. Buscar y mostrar el modal correcto
                const targetModal = document.getElementById(`modal-${modalName}`) || document.querySelector(`.modal-${modalName}`);
                if (targetModal) {
                    targetModal.style.display = 'block';
                }
            }

            // Lógica para cerrar ventanas

            // Lógica para pestañas del Codex
            if (actionName.startsWith('act_codex_')) {
                const tabName = actionName.replace('act_codex_', '');
                const codexStateInputs = document.querySelectorAll('.sheet-state-codex-tab');
                codexStateInputs.forEach(input => {
                    input.value = tabName;
                    input.setAttribute('value', tabName);
                });
            }

            if (actionName === 'act_hud_close') {
                document.querySelectorAll('.sheet-modal-container, .sheet-modal, .hud-modal').forEach(m => {
                    m.style.display = 'none';
                });
            }
        });
    });
});
// --- Inventory Modal Logic ---
window.addEventListener('DOMContentLoaded', () => {
    // Mail Tab Logic
    let mailListenerActive = false;
    const mailTabBtn = document.querySelector('button[name="act_tab_mail"]');
    if (mailTabBtn) {
        mailTabBtn.addEventListener('click', () => {
            if (mailListenerActive) return;
            mailListenerActive = true;

            const charNameInput = document.querySelector('input[name="attr_character_name"]');
            const playerName = charNameInput ? charNameInput.value.trim() : "";
            if (!playerName) return;

            db.ref(`campaña/jugadores/${playerName}/correos`).on('value', snapshot => {
                const correos = [];
                snapshot.forEach(child => {
                    correos.push({ id: child.key, ...child.val() });
                });

                // Sort newest to oldest
                correos.sort((a, b) => b.fecha - a.fecha);

                const inboxList = document.querySelector('.mail-inbox-list');
                const readArea = document.querySelector('.mail-read-area');
                if (!inboxList || !readArea) return;

                inboxList.innerHTML = '';
                correos.forEach(correo => {
                    const item = document.createElement('div');
                    item.className = `mail-item ${correo.leido ? '' : 'unread'}`;
                    item.innerHTML = `<strong>${correo.asunto}</strong><br><small>${correo.remitente}</small>`;

                    item.addEventListener('click', () => {
                        readArea.innerHTML = `<h3>${correo.asunto}</h3><h4>De: ${correo.remitente}</h4><hr><p style="white-space: pre-wrap;">${correo.mensaje}</p>`;
                        item.classList.remove('unread');

                        // Mark as read in Firebase so it persists
                        db.ref(`campaña/jugadores/${playerName}/correos/${correo.id}`).update({ leido: true });
                    });

                    inboxList.appendChild(item);
                });
            });
        });
    }

    const invBtn = document.getElementById('btn-global-inventory');
    const invModal = document.getElementById('inventory-modal');
    const invClose = document.getElementById('inventory-modal-close');
    const invTabBtns = document.querySelectorAll('#inventory-modal .inv-tab-btn');
    const invTabContents = document.querySelectorAll('#inventory-modal .inventory-tab-content');

    if (invBtn && invModal) {
        invBtn.addEventListener('click', () => {
            invModal.classList.add('active');
        });
    }

    if (invClose && invModal) {
        invClose.addEventListener('click', () => {
            invModal.classList.remove('active');
        });
    }

    // Modal background click to close
    if (invModal) {
        invModal.addEventListener('click', (e) => {
            if (e.target === invModal) {
                invModal.classList.remove('active');
            }
        });
    }

    // Tab switching inside modal
    invTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all buttons and contents
            invTabBtns.forEach(b => b.classList.remove('active'));
            invTabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked button
            btn.classList.add('active');

            // Show target content
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            // Hide detail card and reset selection when switching tabs
            const detailCard = document.getElementById('item-detail-card');
            if (detailCard) detailCard.classList.remove('active');
            document.querySelectorAll('.item-slot.active').forEach(s => s.classList.remove('active'));
        });
    });

    // --- Data Rendering for Inventory Grids ---
    window.renderInventoryGrid = function(gridId, itemsObj, isStash) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        grid.innerHTML = '';
        const items = itemsObj ? Object.entries(itemsObj).map(([key, val]) => ({ key, ...val })) : [];

        // Fill slots with items
        items.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'item-slot';

            // Ensure array format for tags
            let itemTags = item.tags && Array.isArray(item.tags) ? item.tags : (item.tipo ? [item.tipo] : []);

            const romanTiers = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
            const tIdx = parseInt(item.tier) || 1;
            const romanTier = romanTiers[tIdx] || "I";

            // Guardar info para los filtros
            slot.dataset.name = (item.nombre || '').toLowerCase();
            slot.dataset.tier = romanTier.toLowerCase();
            slot.dataset.tags = itemTags.join(',').toLowerCase();

            const imgSrc = item.icono || "https://via.placeholder.com/40";
            slot.innerHTML = `
                <div class="item-tier-indicator">${romanTier}</div>
                <img src="${imgSrc}" alt="${item.nombre || 'Desconocido'}" />
                <div class="item-quantity">x${item.cantidad || 1}</div>
            `;

            slot.addEventListener('click', () => {
                // Remove active from all slots
                document.querySelectorAll('.item-slot').forEach(s => s.classList.remove('active'));
                slot.classList.add('active');

                // Show detail card
                const detailCard = document.getElementById('item-detail-card');
                if (detailCard) detailCard.classList.add('active');

                // Populate data
                const iconEl = document.getElementById('detail-icon');
                if (iconEl) iconEl.src = imgSrc;

                const tierEl = document.getElementById('detail-tier-val');
                if (tierEl) tierEl.innerText = romanTier;

                const costEl = document.getElementById('detail-cost-val');
                if (costEl) costEl.innerText = item.valorBase || item.costo || 0;

                const titleBadge = document.getElementById('detail-title');
                if (titleBadge) {
                    titleBadge.innerText = item.nombre || 'Desconocido';
                    // Limpiar clases de tier anteriores
                    titleBadge.classList.remove('tier-i-ii', 'tier-iii-iv', 'tier-v-vi', 'tier-vii-viii', 'tier-ix-x');

                    // Aplicar nueva clase según el tier
                    if (tIdx === 1 || tIdx === 2) titleBadge.classList.add('tier-i-ii');
                    else if (tIdx === 3 || tIdx === 4) titleBadge.classList.add('tier-iii-iv');
                    else if (tIdx === 5 || tIdx === 6) titleBadge.classList.add('tier-v-vi');
                    else if (tIdx === 7 || tIdx === 8) titleBadge.classList.add('tier-vii-viii');
                    else if (tIdx === 9 || tIdx === 10) titleBadge.classList.add('tier-ix-x');
                    else titleBadge.classList.add('tier-i-ii');
                }

                const descEl = document.getElementById('detail-desc');
                if (descEl) descEl.innerText = item.descripcion || 'Sin descripción.';

                const tagsContainer = document.getElementById('detail-tags-val');
                if (tagsContainer) {
                    tagsContainer.innerHTML = '';
                    itemTags.forEach(tag => {
                        const t = document.createElement('span');
                        t.className = 'tag-pill';
                        t.innerText = tag;
                        tagsContainer.appendChild(t);
                    });
                }

                // Show equip/unequip button
                const btnContainer = document.getElementById('detail-equip-btn-container');
                if (btnContainer) {
                    btnContainer.innerHTML = '';
                    const actionBtn = document.createElement('button');
                    actionBtn.className = isStash ? 'btn-equip' : 'btn-unequip';
                    actionBtn.innerText = isStash ? 'Equipar' : 'Desequipar';

                    // If moving from stash, check if stash is unlocked
                    if (isStash && !window.isStashUnlocked) {
                        actionBtn.disabled = true;
                        actionBtn.style.opacity = '0.5';
                        actionBtn.style.cursor = 'not-allowed';
                        actionBtn.title = "El alijo está bloqueado por el DM.";
                    } else {
                        actionBtn.onclick = () => {
                            window.dispatchEvent(new CustomEvent('item-move-action', {
                                detail: {
                                    itemKey: item.key,
                                    itemData: item,
                                    fromStash: isStash
                                }
                            }));
                        };
                    }
                    btnContainer.appendChild(actionBtn);

                    // Add Cargar button if item has vinculo
                    const vinculoInfo = document.getElementById('detail-vinculo-info');
                    if (item.vinculo_item && item.vinculo_cantidad && item.vinculo_stacks_max) {
                        const maxCargas = item.vinculo_stacks_max;
                        const cargaActual = item.carga_actual || 0;
                        const reqCant = item.vinculo_cantidad;
                        const reqItem = item.vinculo_item;

                        if (vinculoInfo) {
                            vinculoInfo.style.display = 'block';
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
                            const loadBtn = document.createElement('button');
                            loadBtn.className = 'btn-equip'; // Reuse class for styling
                            loadBtn.style.backgroundColor = 'var(--cyan-tech)';
                            loadBtn.style.color = '#000';
                            loadBtn.style.marginTop = '5px';
                            loadBtn.innerText = `Cargar (${reqCant} ${reqItem})`;

                            if (cargaActual >= maxCargas) {
                                loadBtn.disabled = true;
                                loadBtn.style.opacity = '0.5';
                                loadBtn.style.cursor = 'not-allowed';
                                loadBtn.innerText = 'Cargas al Máximo';
                            } else {
                                loadBtn.onclick = () => {
                                    window.dispatchEvent(new CustomEvent('item-load-action', {
                                        detail: {
                                            itemKey: item.key,
                                            itemData: item,
                                            isStash: isStash
                                        }
                                    }));
                                };
                            }
                            btnContainer.appendChild(loadBtn);
                        }
                    } else {
                        if (vinculoInfo) vinculoInfo.style.display = 'none';
                    }
                }
            });

            grid.appendChild(slot);
        });

    }

    // --- Inventory Search & Filter Logic (Stash) ---
    const searchInputStash = document.getElementById('buscador-items-stash');
    const filterBtnsStash = document.querySelectorAll('#filtros-stash .inv-filter-btn');

    function filterStashItems() {
        const query = searchInputStash ? searchInputStash.value.toLowerCase() : '';
        let activeFilter = 'Todo';

        filterBtnsStash.forEach(btn => {
            if (btn.classList.contains('active')) {
                activeFilter = btn.getAttribute('data-filter').toLowerCase();
            }
        });

        const stashGrid = document.getElementById('inv-stash-grid');
        if (stashGrid) {
            const slots = stashGrid.querySelectorAll('.item-slot:not(.empty-slot)');
            slots.forEach(slot => {
                const name = slot.dataset.name || '';
                const tier = slot.dataset.tier || '';
                const tags = slot.dataset.tags || '';

                const matchesQuery = name.includes(query) || tier.includes(query) || tags.includes(query);
                const matchesFilter = activeFilter === 'todo' || tags.includes(activeFilter);

                if (matchesQuery && matchesFilter) {
                    slot.style.display = 'flex';
                } else {
                    slot.style.display = 'none';
                }
            });
        }
    }

    if (searchInputStash) {
        searchInputStash.addEventListener('input', filterStashItems);
    }

    filterBtnsStash.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtnsStash.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterStashItems();
        });
    });

    // Handle loading items (Vinculos)
    window.addEventListener('item-load-action', (e) => {
        const { itemKey, itemData, isStash } = e.detail;
        const charNameInput = document.querySelector('input[name="attr_character_name"]');
        const playerName = charNameInput ? charNameInput.value.trim() : "";
        if (!playerName || typeof db === 'undefined') return;

        const reqCant = parseInt(itemData.vinculo_cantidad) || 0;
        const reqItemName = itemData.vinculo_item;

        if (!reqCant || !reqItemName) return;

        // Function to find and consume the required items across both active and stash
        const consumeItems = async () => {
            let totalFound = 0;
            const activeRef = db.ref(`campaña/jugadores/${playerName}/inventario_activo`);
            const stashRef = db.ref(`campaña/jugadores/${playerName}/inventario_stash`);

            const activeSnap = await activeRef.once('value');
            const stashSnap = await stashRef.once('value');

            const activeItems = activeSnap.val() || {};
            const stashItems = stashSnap.val() || {};

            let itemsToDeduct = []; // { ref, key, currentCant, deductCant }
            let remainingNeeded = reqCant;

            // Search Active
            for (const [k, v] of Object.entries(activeItems)) {
                if (v.nombre === reqItemName && remainingNeeded > 0) {
                    let cant = v.cantidad || 1;
                    let toDeduct = Math.min(cant, remainingNeeded);
                    itemsToDeduct.push({ ref: activeRef, key: k, currentCant: cant, deductCant: toDeduct });
                    remainingNeeded -= toDeduct;
                }
            }

            // Search Stash
            if (remainingNeeded > 0 && window.isStashUnlocked) {
                for (const [k, v] of Object.entries(stashItems)) {
                    if (v.nombre === reqItemName && remainingNeeded > 0) {
                        let cant = v.cantidad || 1;
                        let toDeduct = Math.min(cant, remainingNeeded);
                        itemsToDeduct.push({ ref: stashRef, key: k, currentCant: cant, deductCant: toDeduct });
                        remainingNeeded -= toDeduct;
                    }
                }
            }

            if (remainingNeeded > 0) {
                if (!window.isStashUnlocked) {
                    alert(`No tienes suficientes "${reqItemName}" en tu Inventario Activo (${reqCant} requeridos). El Alijo está bloqueado.`);
                } else {
                    alert(`No tienes suficientes "${reqItemName}" (${reqCant} requeridos).`);
                }
                return;
            }

            // Deduct
            for (const item of itemsToDeduct) {
                if (item.currentCant - item.deductCant <= 0) {
                    await item.ref.child(item.key).remove();
                } else {
                    await item.ref.child(item.key).update({ cantidad: item.currentCant - item.deductCant });
                }
            }

            // Increment charges
            const currentCargas = parseInt(itemData.carga_actual) || 0;
            const targetList = isStash ? 'inventario_stash' : 'inventario_activo';
            await db.ref(`campaña/jugadores/${playerName}/${targetList}/${itemKey}`).update({
                carga_actual: currentCargas + 1
            });

            // Auto-refresh the detail card to show new charges by simulating a click
            const activeSlot = document.querySelector('.item-slot.active');
            if (activeSlot) {
                activeSlot.click();
            }
        };

        consumeItems();
    });

    // Handle equip/unequip events
    window.addEventListener('item-move-action', (e) => {
        const { itemKey, itemData, fromStash } = e.detail;
        const charNameInput = document.querySelector('input[name="attr_character_name"]');
        const playerName = charNameInput ? charNameInput.value.trim() : "";
        if (!playerName || typeof db === 'undefined') return;

        const sourceListName = fromStash ? 'inventario_stash' : 'inventario_activo';
        const targetListName = fromStash ? 'inventario_activo' : 'inventario_stash';

        const sourceRef = db.ref(`campaña/jugadores/${playerName}/${sourceListName}/${itemKey}`);
        const targetRef = db.ref(`campaña/jugadores/${playerName}/${targetListName}`);

        // Move 1 unit
        let itemToMove = { ...itemData, cantidad: 1 };
        delete itemToMove.key; // Clean up key

        targetRef.once('value', targetSnap => {
            const targetData = targetSnap.val() || {};
            let foundKey = null;
            let targetCurrentCant = 0;

            for (const [k, targetItem] of Object.entries(targetData)) {
                if (targetItem.nombre === itemData.nombre && (targetItem.tier || 1) == (itemData.tier || 1)) {
                    foundKey = k;
                    targetCurrentCant = targetItem.cantidad || 1;
                    break;
                }
            }

            // Check limits
            const activeStackLimit = parseInt(itemData.limite_activo) || 2; // Default 2 for active if not specified
            const stashStackLimit = parseInt(itemData.limite_alijo) || 99; // Default 99 for stash if not specified

            if (fromStash) {
                // Moving to Active Inventory
                if (foundKey && (targetCurrentCant + 1) > activeStackLimit) {
                    alert(`No puedes equipar más de ${activeStackLimit} de este ítem a la vez.`);
                    return;
                }
                // Check 10 slots limit for active inventory
                if (!foundKey && Object.keys(targetData).length >= 10) {
                    alert("El Inventario Activo está lleno. Solo puedes llevar 10 espacios.");
                    return;
                }
            } else {
                // Moving to Stash
                if (foundKey && (targetCurrentCant + 1) > stashStackLimit) {
                    alert(`El alijo no puede almacenar más de ${stashStackLimit} de este ítem en un solo stack.`);
                    return;
                }
            }

            let promiseAdd;
            if (foundKey) {
                promiseAdd = targetRef.child(foundKey).update({ cantidad: targetCurrentCant + 1 });
            } else {
                promiseAdd = targetRef.push(itemToMove);
            }

            promiseAdd.then(() => {
                sourceRef.once('value', sourceSnap => {
                    const sourceItem = sourceSnap.val();
                    if (!sourceItem) return;
                    if (sourceItem.cantidad > 1) {
                        sourceRef.update({ cantidad: sourceItem.cantidad - 1 });
                    } else {
                        sourceRef.remove();
                        // Hide detail card if the last item is moved
                        const detailCard = document.getElementById('item-detail-card');
                        if (detailCard) detailCard.classList.remove('active');
                    }
                });
            });
        });
    });

    // --- Dynamic Shop System Logic ---
    // Shop logic is now handled in the main Shop app tab
});

// LÓGICA DE MESA DE TRABAJO (CRAFTEO)
let recetasCache = {};
let currentSelectedRecetaId = null;

window.addEventListener('DOMContentLoaded', () => {
    if (typeof db === 'undefined') return;

    // We also need to re-render if the player name changes, but usually it's set on load
    setTimeout(() => renderRecetasCrafteo(), 2000);
});

function renderRecetasCrafteo() {
    const listaRecetas = document.getElementById('lista-recetas-crafteo');
    const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();

    if (!listaRecetas || !playerName) return;

    listaRecetas.innerHTML = '';

    if (Object.keys(recetasCache).length === 0) {
        listaRecetas.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No hay recetas disponibles.</div>';
        return;
    }

    for (const [idReceta, receta] of Object.entries(recetasCache)) {
        // Filtrar acceso
        if (receta.acceso === 'Restringido' && (!receta.jugadores || !receta.jugadores[playerName])) {
            continue;
        }

        const btn = document.createElement('button');
        btn.className = 'btn-cyber';
        btn.style.cssText = 'background:#111; color:#0df; border:1px solid #444; border-left:3px solid #0df; padding:10px; text-align:left; border-radius:4px; font-weight:bold; cursor:pointer; width:100%; transition:all 0.2s;';
        btn.innerText = receta.nombre;

        btn.onclick = () => {
            // Deseleccionar otros
            Array.from(listaRecetas.children).forEach(c => c.style.background = '#111');
            btn.style.background = '#222';

            seleccionarReceta(idReceta, receta);
        };

        listaRecetas.appendChild(btn);
    }
}

let dbItemsCacheGlobal = {}; // Fetch global items for name/icon lookups
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof db === 'undefined') return;
        db.ref('campaña/base_datos_items').on('value', snap => {
            dbItemsCacheGlobal = snap.val() || {};
        });
    }, 1500);
});

function seleccionarReceta(idReceta, receta) {
    const detalleContainer = document.getElementById('detalle-receta-crafteo');
    const titulo = document.getElementById('crafteo-titulo-receta');
    const nodosContainer = document.getElementById('crafteo-nodos-ingredientes');
    const reqSkill = document.getElementById('crafteo-req-skill');
    const reqDc = document.getElementById('crafteo-req-dc');
    const btnSintetizar = document.getElementById('btn-sintetizar');
    const inputMultiplicador = document.getElementById('crafteo-multiplicador');

    const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();
    if (!detalleContainer || !playerName) return;

    currentSelectedRecetaId = idReceta;
    detalleContainer.style.display = 'block';

    // Result Text
    const globalResData = dbItemsCacheGlobal[receta.item_resultado];
    const resName = globalResData ? globalResData.nombre : 'Ítem Desconocido';
    titulo.innerHTML = `Fabricar: <span style="color:#fff;">${resName} (Tier ${receta.tier_resultado}) x${receta.cantidad_resultado}</span>`;

    reqSkill.innerText = receta.habilidad.toUpperCase();
    reqDc.innerText = receta.dc;
    inputMultiplicador.value = 1;
    inputMultiplicador.max = 99;

    nodosContainer.innerHTML = '<span style="color:#888;">Cargando inventario...</span>';
    btnSintetizar.disabled = true;
    btnSintetizar.style.opacity = '0.5';

    // Leer stash del jugador
    db.ref(`campaña/jugadores/${playerName}/inventario_stash`).once('value').then(snap => {
        const stash = snap.val() || {};
        nodosContainer.innerHTML = '';

        let cumpleTodos = true;
        let maxMultiplicador = 99; // Límite basado en los mats

        // Sumar cantidades en stash (agrupando por ID/key)
        const stashCants = {};
        for (const [k, item] of Object.entries(stash)) {
            // For matching, we rely on the saved 'id' property or fallback to checking the name against dbItemsCacheGlobal
            const itemKey = item.id || Object.keys(dbItemsCacheGlobal).find(k => dbItemsCacheGlobal[k].nombre === item.nombre);
            if (itemKey) {
                stashCants[itemKey] = (stashCants[itemKey] || 0) + (parseInt(item.cantidad) || 1);
            }
        }

        // 5-Hexagon Layout Positions Mapping
        const hexPositions = [
            'hex-pos-center',
            'hex-pos-top-left',
            'hex-pos-top-right',
            'hex-pos-bottom-left',
            'hex-pos-bottom-right'
        ];

        receta.ingredientes.forEach((ing, index) => {
            if (index >= 5) return; // Support up to 5 max visually

            const globalData = dbItemsCacheGlobal[ing.id_item];
            const name = globalData ? globalData.nombre : 'Desconocido';
            const imgUrl = globalData ? globalData.icono : 'https://via.placeholder.com/30';

            const tiene = stashCants[ing.id_item] || 0;
            const requiere = ing.cantidad;
            const suficiente = tiene >= requiere;

            if (!suficiente) cumpleTodos = false;

            if (requiere > 0) {
                const posiblesMult = Math.floor(tiene / requiere);
                if (posiblesMult < maxMultiplicador) maxMultiplicador = posiblesMult;
            }

            const hexClass = suficiente ? 'hex-wrapper' : 'hex-wrapper missing';
            const textClass = suficiente ? 'hex-count' : 'hex-count missing-text';
            const posClass = hexPositions[index] || hexPositions[0];

            // Render Ingredient Hexagon
            const nodo = document.createElement('div');
            nodo.className = `hex-node ${posClass}`;
            nodo.title = `${name}
Req: ${requiere} | Tienes: ${tiene}`;

            nodo.innerHTML = `
                <div class="${hexClass}">
                    <img src="${imgUrl}" alt="${name}">
                </div>
                <div class="${textClass}">${tiene}/${requiere}</div>
            `;
            nodosContainer.appendChild(nodo);
        });

        // Fill empty slots up to 5 for visual consistency
        for (let i = receta.ingredientes.length; i < 5; i++) {
            const emptyNodo = document.createElement('div');
            emptyNodo.className = `hex-node ${hexPositions[i]}`;
            emptyNodo.innerHTML = `<div class="hex-wrapper empty"></div>`;
            nodosContainer.appendChild(emptyNodo);
        }

        // --- Render Result Node (Discovery Logic) ---
        db.ref(`campaña/jugadores/${playerName}/recetas_descubiertas/${idReceta}`).once('value').then(discSnap => {
            const isDiscovered = !!discSnap.val();

            const globalResData = dbItemsCacheGlobal[receta.item_resultado];
            const resImgUrl = globalResData ? globalResData.icono : 'https://via.placeholder.com/60';
            const resName = globalResData ? globalResData.nombre : 'Ítem';
            const romanTiers = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
            const tierIndex = parseInt(receta.tier_resultado) || 1;
            const tierStr = romanTiers[Math.min(tierIndex, 10)];

            const resultArea = document.getElementById('crafteo-resultado-area');
            const imgClass = isDiscovered ? '' : 'blacked-out';
            const finalName = isDiscovered ? resName : '???';

            resultArea.innerHTML = `
                <div class="result-node" title="${finalName}
Cantidad: x${receta.cantidad_resultado}">
                    <div class="result-tier">${tierStr}</div>
                    <img src="${resImgUrl}" class="${imgClass}">
                    <div class="result-count">x${receta.cantidad_resultado}</div>
                </div>
            `;
        });

        if (cumpleTodos && maxMultiplicador > 0) {
            btnSintetizar.disabled = false;
            btnSintetizar.style.opacity = '1';
            inputMultiplicador.max = maxMultiplicador;

            // Synthesis Action Handler
            btnSintetizar.onclick = () => {
                const multi = parseInt(inputMultiplicador.value) || 1;
                if (multi < 1 || multi > maxMultiplicador) {
                    alert('Multiplicador inválido.');
                    return;
                }

                btnSintetizar.disabled = true; // prevent double click
                btnSintetizar.innerText = 'SINTETIZANDO...';

                // Fetch Skill modifier
                // Fetch Skill modifier from currentPlayerData
                const skillMod = (currentPlayerData.modifiers && currentPlayerData.modifiers[receta.habilidad])
                    ? parseInt(currentPlayerData.modifiers[receta.habilidad])
                    : 0;
                {
                    const roll = Math.floor(Math.random() * 20) + 1;
                    const total = roll + skillMod;
                    const dc = parseInt(receta.dc);

                    if (total >= dc) {
                        // ÉXITO
                        ejecutarSintesis(playerName, receta, multi, stash, true, total);
                    } else {
                        // FALLO
                        ejecutarSintesis(playerName, receta, multi, stash, false, total);
                    }
                }
            };

        } else {
            btnSintetizar.disabled = true;
            btnSintetizar.style.opacity = '0.5';
            inputMultiplicador.max = 1;
            if (maxMultiplicador <= 0) inputMultiplicador.value = 1; // reset visualmente
            btnSintetizar.onclick = null;
        }
    });
}

function ejecutarSintesis(playerName, receta, multi, currentStash, exito, rollTotal) {
    const stashRef = db.ref(`campaña/jugadores/${playerName}/inventario_stash`);
    const updates = {};
    const removes = [];

    if (exito) {
        // Reducir ingredientes exactamente
        receta.ingredientes.forEach(ing => {
            let reqTotal = ing.cantidad * multi;
            for (const [k, item] of Object.entries(currentStash)) {
                if (reqTotal <= 0) break;
                const itemKey = item.id || Object.keys(dbItemsCacheGlobal).find(g => dbItemsCacheGlobal[g].nombre === item.nombre);

                if (itemKey === ing.id_item) {
                    let has = parseInt(item.cantidad) || 1;
                    if (has <= reqTotal) {
                        removes.push(k);
                        reqTotal -= has;
                        delete currentStash[k]; // update local copy for loop
                    } else {
                        updates[`${k}/cantidad`] = has - reqTotal;
                        reqTotal = 0;
                    }
                }
            }
        });

        // Marcar receta como descubierta
        db.ref(`campaña/jugadores/${playerName}/recetas_descubiertas/${receta.id_receta || currentSelectedRecetaId}`).set(true);

        // Crear/Añadir item resultante
        const resId = receta.item_resultado;
        const resData = dbItemsCacheGlobal[resId];
        const cantFinal = (parseInt(receta.cantidad_resultado) || 1) * multi;
        const tierResult = parseInt(receta.tier_resultado) || 1;

        if (resData) {
            let foundResKey = null;
            let currentResCant = 0;

            for (const [k, item] of Object.entries(currentStash)) {
                const itemKey = item.id || Object.keys(dbItemsCacheGlobal).find(g => dbItemsCacheGlobal[g].nombre === item.nombre);
                if (itemKey === resId && (parseInt(item.tier) || 1) === tierResult && !removes.includes(k)) {
                    foundResKey = k;
                    currentResCant = parseInt(item.cantidad) || 1;
                    break;
                }
            }

            if (foundResKey) {
                // If it was already updated in the reduction phase, adjust from the update object
                const existingUpdate = updates[`${foundResKey}/cantidad`];
                if (existingUpdate !== undefined) {
                    updates[`${foundResKey}/cantidad`] = existingUpdate + cantFinal;
                } else {
                    updates[`${foundResKey}/cantidad`] = currentResCant + cantFinal;
                }
            } else {
                const newItem = {
                    id: resId,
                    nombre: resData.nombre,
                    valorBase: resData.costo,
                    tier: tierResult,
                    tipo: resData.tipo || "Consumible",
                    icono: resData.icono || "",
                    descripcion: resData.descripcion || "",
                    cantidad: cantFinal
                };
                if (resData.tags) newItem.tags = resData.tags;

                // Generar nueva key push manualmente
                const newKey = stashRef.push().key;
                updates[newKey] = newItem;
            }
        }

    } else {
        // FALLO: Eliminar 1-3 mats aleatorios por cada intento fallido
        let matsParaPerder = [];
        for (let i = 0; i < multi; i++) {
            const numPerder = Math.floor(Math.random() * 3) + 1; // 1 to 3
            // Aplanar ingredientes para elegir aleatoriamente
            const pool = [];
            receta.ingredientes.forEach(ing => {
                for(let c=0; c<ing.cantidad; c++) pool.push(ing.id_item);
            });

            // shuffle and pick
            pool.sort(() => 0.5 - Math.random());
            matsParaPerder.push(...pool.slice(0, numPerder));
        }

        // Apply reductions based on matsParaPerder
        const lostCounts = {};
        matsParaPerder.forEach(id => {
            lostCounts[id] = (lostCounts[id] || 0) + 1;
        });

        for (const [idLost, amountLost] of Object.entries(lostCounts)) {
            let reqTotal = amountLost;
            for (const [k, item] of Object.entries(currentStash)) {
                if (reqTotal <= 0) break;
                const itemKey = item.id || Object.keys(dbItemsCacheGlobal).find(g => dbItemsCacheGlobal[g].nombre === item.nombre);

                if (itemKey === idLost) {
                    let has = updates[`${k}/cantidad`] !== undefined ? updates[`${k}/cantidad`] : (parseInt(item.cantidad) || 1);
                    if (has <= reqTotal) {
                        if(updates[`${k}/cantidad`] !== undefined) delete updates[`${k}/cantidad`];
                        removes.push(k);
                        reqTotal -= has;
                        delete currentStash[k];
                    } else {
                        updates[`${k}/cantidad`] = has - reqTotal;
                        reqTotal = 0;
                    }
                }
            }
        }
    }

    // Ejecutar en Firebase
    const promises = [];
    if (Object.keys(updates).length > 0) {
        promises.push(stashRef.update(updates));
    }
    removes.forEach(k => {
        promises.push(stashRef.child(k).remove());
    });

    Promise.all(promises).then(() => {
        const btnSintetizar = document.getElementById('btn-sintetizar');
        btnSintetizar.innerText = 'SINTETIZAR';
        btnSintetizar.disabled = false;

        if (exito) {
            alert(`¡Síntesis Exitosa! (Roll: ${rollTotal} vs DC ${receta.dc})\nItems añadidos al alijo.`);
        } else {
            alert(`Síntesis Fallida. (Roll: ${rollTotal} vs DC ${receta.dc})\nMateriales inestables destruidos.`);
        }

        // Recalcular vista
        seleccionarReceta(currentSelectedRecetaId, receta);
    }).catch(err => {
        alert('Error en la síntesis: ' + err);
        document.getElementById('btn-sintetizar').innerText = 'SINTETIZAR';
    });
}

// Listener for active and stash inventory
let playerInventoryListenerActive = false;
window.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure Firebase is initialized
    setTimeout(() => {
        if (typeof db === 'undefined') return;
        const charNameInput = document.querySelector('input[name="attr_character_name"]');

        // Use a generic interval or function to check when playerName is available
        const checkPlayerName = setInterval(() => {
            const playerName = charNameInput ? charNameInput.value.trim() : "";
            if (playerName && playerName !== "Nombre" && playerName !== "Desconocido") {
                clearInterval(checkPlayerName);

                if (playerInventoryListenerActive) return;
                playerInventoryListenerActive = true;

                // Listen to Stash
                db.ref(`campaña/jugadores/${playerName}/inventario_stash`).on('value', snap => {
                    const items = snap.val() || {};
                    // Re-use render function, passing true for isStash
                    if(typeof window.renderInventoryGrid === 'function') {
                        window.renderInventoryGrid('inv-stash-grid', items, true);
                        // Trigger filter to maintain state
                        const searchInputStash = document.getElementById('buscador-items-stash');
                        if (searchInputStash) searchInputStash.dispatchEvent(new Event('input'));
                    }
                });

                // Listen to Activo
                db.ref(`campaña/jugadores/${playerName}/inventario_activo`).on('value', snap => {
                    const items = snap.val() || {};
                    if(typeof window.renderInventoryGrid === 'function') {
                        window.renderInventoryGrid('inv-active-grid', items, false);
                    }
                });
            }
        }, 1000);
    }, 1000);
});


// LÓGICA DE TIENDA DINÁMICA (COMPRAR / VENDER)
let tiendaActivaData = null;
let tiendaActivaId = null;
let tiendasFisicasDisponibles = {}; // Para el modal físico
let tiendaFisicaActivaId = null; // ID de la tienda seleccionada en el modal

// Helper array para convertir Tier en romano (ya existe en otro lado pero lo necesitamos aquí)
const romanTiersShop = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// Esperar a que el DOM y typeof db !== 'undefined' existan
window.addEventListener('DOMContentLoaded', () => {
    if (typeof db === 'undefined') return;

    // Abrir/Cerrar el modal de tienda física
    const badgeFisica = document.getElementById('tienda-fisica-badge');
    const shopModal = document.getElementById('shop-modal');
    const shopModalClose = document.getElementById('shop-modal-close');

    if (badgeFisica && shopModal) {
        badgeFisica.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que abra el inventario normal
            shopModal.classList.add('active');
            // Por defecto, seleccionar la primera tienda de la lista si hay
            const storeKeys = Object.keys(tiendasFisicasDisponibles);
            if (storeKeys.length > 0) {
                seleccionarTiendaFisica(storeKeys[0]);
            }
        });
    }

    if (shopModalClose && shopModal) {
        shopModalClose.addEventListener('click', () => {
            shopModal.classList.remove('active');
            tiendaFisicaActivaId = null;
        });
    }

    db.ref('campaña/tiendas').on('value', (snapshot) => {
        const tiendas = snapshot.val() || {};
        let encontrada = false;

        const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();

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
            if (data.fisica_activa === true && playerName && data.jugadores_presentes && data.jugadores_presentes[playerName]) {
                tiendasFisicasDisponibles[id] = data;
                if (!badgeImageSrc) badgeImageSrc = data.icono_fisico || data.icono || 'https://i.imgur.com/kP8s7Ww.png';
            }
        }

        // Actualizar UI App
        const btnShop = document.getElementById('btn-app-shop');
        const shopApp = document.getElementById('shop-app');

        if (encontrada && btnShop) {
            btnShop.style.display = 'flex';
            renderizarComprar();
            renderizarVender();
        } else {
            if (btnShop) btnShop.style.display = 'none';
            tiendaActivaData = null;
            tiendaActivaId = null;
            const tabInput = document.querySelector('input[name="attr_tab"]');
            if (tabInput && tabInput.value === 'shop') {
                // Here we would normally change tab
                const homeBtn = document.querySelector('button[name="act_tab_home"]');
                if (homeBtn) homeBtn.click();
            }
        }

        // Actualizar UI Física (Badge)
        const badgeFisica = document.getElementById('tienda-fisica-badge');
        const shopModal = document.getElementById('shop-modal');
        if (badgeFisica) {
            if (Object.keys(tiendasFisicasDisponibles).length > 0) {
                badgeFisica.src = badgeImageSrc;
                badgeFisica.style.display = 'block';
                renderizarSidebarFisica();

                // Si el modal está abierto, re-renderizar la grid actual
                if (shopModal && shopModal.classList.contains('active') && tiendaFisicaActivaId) {
                    if (tiendasFisicasDisponibles[tiendaFisicaActivaId]) {
                        renderizarGridFisica(tiendaFisicaActivaId);
                    } else {
                        const storeKeys = Object.keys(tiendasFisicasDisponibles);
                        if (storeKeys.length > 0) seleccionarTiendaFisica(storeKeys[0]);
                        else shopModal.classList.remove('active');
                    }
                }
            } else {
                badgeFisica.style.display = 'none';
                if (shopModal) shopModal.classList.remove('active');
            }
        }
    });

    function renderizarSidebarFisica() {
        const sidebar = document.getElementById('shop-sidebar-list');
        if (!sidebar) return;

        sidebar.innerHTML = '';

        for (const [id, data] of Object.entries(tiendasFisicasDisponibles)) {
            const btn = document.createElement('button');
            btn.className = 'shop-btn';
            if (id === tiendaFisicaActivaId) btn.classList.add('active');

            const iconUrl = data.icono_fisico || data.icono || 'https://i.imgur.com/kP8s7Ww.png';
            btn.innerHTML = `<img src="${iconUrl}" alt="${data.nombre}"> ${data.nombre}`;

            btn.addEventListener('click', () => {
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
        const grid = document.getElementById('shop-items-grid');
        const title = document.getElementById('shop-active-name');
        if (!grid || !title) return;

        const data = tiendasFisicasDisponibles[idTienda];
        if (!data) return;

        title.innerText = data.nombre;
        grid.innerHTML = '';

        const items = data.items || {};
        const modVenta = data.mod_venta || 100;

        if (Object.keys(items).length === 0) {
            grid.innerHTML = '<div style="color:#666; font-size: 20px; padding: 20px; grid-column: 1 / -1; text-align: center;">Sin inventario.</div>';
            return;
        }

        const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();

        db.ref(`campaña/jugadores/${playerName}/inventario_stash`).once('value', snap => {
            const userStash = snap.val() || {};
            const stashCounts = {};
            for (const itemStash of Object.values(userStash)) {
                if (itemStash.nombre) {
                    stashCounts[itemStash.nombre] = (stashCounts[itemStash.nombre] || 0) + (parseInt(itemStash.cantidad) || 1);
                }
            }

            for (const [itemId, item] of Object.entries(items)) {
                const itemTier = parseInt(item.tier) || 1;
                const valorConTier = Math.floor((item.costo || 0) * (1 + ((itemTier - 1) * 0.25)));
                const precio = Math.floor(valorConTier * (modVenta / 100));
                const isAgotado = item.stock_actual === 0;
                const stockStr = item.stock_actual === -1 ? '∞' : item.stock_actual;
                const tierStr = romanTiersShop[Math.min(itemTier, 10)] || 'I';
                const countOwned = stashCounts[item.nombre] || 0;
                const tagStr = item.tag || 'Objeto';
                const descStr = item.descripcion || item.desc || 'Sin descripción disponible.';

                const card = document.createElement('div');
                card.className = 'shop-item-card';

                card.innerHTML = `
                    <div class="shop-item-image-container">
                        <img src="${item.icono || 'https://via.placeholder.com/80'}" alt="${item.nombre}">
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
                            <button class="shop-item-buy-btn btn-comprar-fisico" data-tienda="${idTienda}" data-item="${itemId}" data-precio="${precio}" ${isAgotado ? 'disabled' : ''}>
                                <span class="currency-symbol">₳</span> ${precio}
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            }
        });
    }

    // Función para manejar las pestañas internas de la app de tienda
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('inv-tab-btn') && e.target.closest('#shop-app')) {
            const btns = document.querySelectorAll('#shop-app .inv-tab-btn');
            const contents = document.querySelectorAll('#shop-app .inventory-tab-content');

            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            e.target.classList.add('active');
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'shop-vender') {
                renderizarVender(); // Actualizar stash al abrir
            }
        }
    });

    // Delegación de eventos para botones Comprar/Vender
    document.addEventListener('click', (e) => {
        const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();
        if (!playerName) return;

        // LÓGICA DE COMPRAR (App u Offline/Física)
        const btnCompra = e.target.closest('.btn-comprar-item, .btn-comprar-fisico');
        if (btnCompra && !btnCompra.disabled) {

            const isFisico = btnCompra.classList.contains('btn-comprar-fisico');

            const itemId = isFisico ? btnCompra.getAttribute('data-item') : btnCompra.getAttribute('data-id');
            const precio = parseInt(btnCompra.getAttribute('data-precio'));

            let idTiendaActual = null;
            let tiendaActualData = null;

            if (isFisico) {
                idTiendaActual = btnCompra.getAttribute('data-tienda');
                tiendaActualData = tiendasFisicasDisponibles[idTiendaActual];
            } else {
                idTiendaActual = tiendaActivaId;
                tiendaActualData = tiendaActivaData;
            }

            if (!tiendaActualData || !tiendaActualData.items || !tiendaActualData.items[itemId]) return;
            const itemTienda = tiendaActualData.items[itemId];

            db.ref(`campaña/jugadores/${playerName}/ahn`).once('value', snap => {
                const ahn_actual = snap.val() || 0;
                if (ahn_actual < precio) {
                    alert('Fondos insuficientes.');
                    return;
                }

                // Restar Ahn estrictamente
                db.ref(`campaña/jugadores/${playerName}/ahn`).set(ahn_actual - precio);

                // Reducir Stock
                if (itemTienda.stock_actual !== -1) {
                    db.ref(`campaña/tiendas/${idTiendaActual}/items/${itemId}/stock_actual`).transaction(current => {
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
                    cantidad: 1
                };
                if (itemTienda.tags) itemToSave.tags = itemTienda.tags;


                if (isFisico) {
                    // Añadir directo al Stash (Física)
                    const stashRef = db.ref(`campaña/jugadores/${playerName}/inventario_stash`);
                    stashRef.once('value', stashSnap => {
                        let foundKey = null;
                        let currentCant = 0;
                        stashSnap.forEach(child => {
                            if (child.val().id === itemId && (child.val().tier || 1) == (itemTienda.tier || 1)) {
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
                            if(btnCompra) {
                                btnCompra.innerHTML = originalHtml;
                                btnCompra.style.background = "";
                                btnCompra.style.color = "";
                            }
                        }, 500);
                    });
                } else {
                    // Añadir a entregas pendientes (App En línea)
                    const diasEntrega = tiendaActualData.dias_entrega || 0;

                    db.ref('campaña/calendario').once('value').then(calSnap => {
                        let diaLlegada = diasEntrega; // Fallback si no hay calendario
                        const calendario = calSnap.val();
                        if (calendario) {
                            diaLlegada = calendario.dia + diasEntrega;
                        }

                        const entrega = {
                            ...itemToSave,
                            diaDeLlegada: diaLlegada
                        };

                        db.ref(`campaña/jugadores/${playerName}/entregasPendientes`).push(entrega).then(() => {
                            // Feedback visual App
                            const originalText = btnCompra.innerText;
                            const originalBg = btnCompra.style.background;
                            btnCompra.innerText = "¡OK!";
                            btnCompra.style.background = "#0df";
                            setTimeout(() => {
                                if(btnCompra) {
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
        if (e.target.classList.contains('btn-vender-item')) {
            const key = e.target.getAttribute('data-key');
            const precio = parseInt(e.target.getAttribute('data-precio'));

            const itemRef = db.ref(`campaña/jugadores/${playerName}/inventario_stash/${key}`);
            itemRef.once('value', snap => {
                const item = snap.val();
                if (!item) return;

                // Sumar Ahn
                db.ref(`campaña/jugadores/${playerName}/ahn`).once('value', ahnSnap => {
                    const currentAhn = ahnSnap.val() || 0;
                    db.ref(`campaña/jugadores/${playerName}`).update({ ahn: currentAhn + precio });
                });

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
});

function renderizarComprar() {
    const grid = document.getElementById('shop-comprar-grid');
    if (!grid || !tiendaActivaData) return;

    grid.innerHTML = '';
    const items = tiendaActivaData.items || {};
    const modVenta = tiendaActivaData.mod_venta || 100;

    if (Object.keys(items).length === 0) {
        grid.innerHTML = '<div style="color:#666; text-align:center; padding: 20px;">Sin inventario.</div>';
        return;
    }

    for (const [itemId, item] of Object.entries(items)) {
        const itemTier = parseInt(item.tier) || 1;
        const valorConTier = Math.floor((item.costo || 0) * (1 + ((itemTier - 1) * 0.25)));
        const precio = Math.floor(valorConTier * (modVenta / 100));
        const isAgotado = item.stock_actual === 0;
        const stockStr = item.stock_actual === -1 ? '∞' : item.stock_actual;

        const row = document.createElement('div');
        row.style.cssText = 'background: #111; border: 1px solid #333; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 10px;';

        row.innerHTML = `
            <img src="${item.icono || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #000;">
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nombre}</div>
                <div style="font-size: 12px; color: #888;">Stock: ${stockStr}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                <div style="color: #0df; font-weight: bold;"><span class="currency-symbol">₳</span> ${precio}</div>
                <button class="btn-comprar-item" data-id="${itemId}" data-precio="${precio}" ${isAgotado ? 'disabled' : ''}
                        style="background: ${isAgotado ? '#333' : '#004400'}; color: ${isAgotado ? '#666' : '#fff'}; border: 1px solid ${isAgotado ? '#444' : '#00ff00'}; padding: 4px 8px; border-radius: 3px; cursor: ${isAgotado ? 'not-allowed' : 'pointer'}; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                    ${isAgotado ? 'Agotado' : 'Comprar'}
                </button>
            </div>
        `;
        grid.appendChild(row);
    }
}

function renderizarVender() {
    const grid = document.getElementById('shop-vender-grid');
    const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();
    if (!grid || !tiendaActivaData || !playerName) return;

    // Use typeof db !== 'undefined' inside functions to ensure it's available
    db.ref(`campaña/jugadores/${playerName}/inventario_stash`).once('value', snap => {
        grid.innerHTML = '';
        const stash = snap.val();

        if (!stash) {
            grid.innerHTML = '<div style="color:#666; text-align:center; padding: 20px;">Tu Stash está vacío.</div>';
            return;
        }

        const reglas = tiendaActivaData.tasas_por_etiqueta || {};
        const tasaDefecto = tiendaActivaData.tasa_defecto || 50;

        for (const [key, item] of Object.entries(stash)) {
            if (item.cantidad <= 0) continue;

            // Calcular precio de venta basado en el primer tag (tipo) si existe
            // La nueva lógica usa array de tags, así que buscamos el primero
            let primerTag = item.tipo || ''; // Fallback a tipo si no hay tags en la DB vieja

            let pct = tasaDefecto;
            if (primerTag && reglas[primerTag] !== undefined) {
                pct = reglas[primerTag];
            }
            // Si tiene array de tags, buscamos si alguno coincide con las reglas
            if (item.tags && Array.isArray(item.tags)) {
                for (let tag of item.tags) {
                    if (reglas[tag] !== undefined) {
                        pct = reglas[tag];
                        break;
                    }
                }
            }

            const itemTier = parseInt(item.tier) || 1;
            const valorConTier = Math.floor((item.valorBase || 0) * (1 + ((itemTier - 1) * 0.25)));
            const precioVenta = Math.floor(valorConTier * (pct / 100));

            const row = document.createElement('div');
            row.style.cssText = 'background: #111; border: 1px solid #333; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 10px;';

            row.innerHTML = `
                <img src="${item.icono || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #000;">
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
            grid.appendChild(row);
        }
    });
}






// NATIVE BUTTON LISTENERS
window.addEventListener('DOMContentLoaded', () => {
    // Escuchar clicks globales para botones de acción (simulando Roll20)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button[type="action"]');
        if (!btn) return;

        const actName = btn.getAttribute('name');
        if (!actName || typeof db === 'undefined') return;

        // --- Ejemplos de Lógica Reescrita ---

        // Banco
        if (actName === 'act_add_ahn') {
            const inputMod = document.querySelector('input[name="attr_ahn_mod"]');
            if (inputMod) {
                const modVal = parseInt(inputMod.value) || 0;
                const current = parseInt(currentPlayerData.ahn) || 0;
                db.ref('campaña/jugadores/' + playerId).update({ ahn: current + modVal });
                inputMod.value = 0;
            }
        }

        if (actName === 'act_sub_ahn') {
            const inputMod = document.querySelector('input[name="attr_ahn_mod"]');
            if (inputMod) {
                const modVal = parseInt(inputMod.value) || 0;
                const current = parseInt(currentPlayerData.ahn) || 0;
                db.ref('campaña/jugadores/' + playerId).update({ ahn: current - modVal });
                inputMod.value = 0;
            }
        }

        // --- Descansos ---
        if (actName === 'act_short_rest') {
            const currentHP = parseInt(currentPlayerData.hp) || 0;
            const maxHP = parseInt(currentPlayerData.hp_max) || 0;
            const heal = Math.floor(maxHP * 0.34);
            let newHP = currentHP + heal;
            if (newHP > maxHP) newHP = maxHP;

            db.ref('campaña/jugadores/' + playerId).update({
                hp: newHP,
                sp: 0,
                stagger_1_active: "1",
                stagger_2_active: "1",
                stagger_3_active: "1"
            });
        }

        if (actName === 'act_long_rest') {
            const maxHP = parseInt(currentPlayerData.hp_max) || 0;
            db.ref('campaña/jugadores/' + playerId).update({
                hp: maxHP,
                sp: 0
            });
        }

        // --- Suerte ---
        if (actName === 'act_luck_up') {
            const current = parseInt(currentPlayerData.luck) || 0;
            const max = parseInt(currentPlayerData.luck_max) || 0;
            if (current < max) {
                db.ref('campaña/jugadores/' + playerId).update({ luck: current + 1 });
            }
        }

        if (actName === 'act_luck_down') {
            const current = parseInt(currentPlayerData.luck) || 0;
            if (current > 0) {
                db.ref('campaña/jugadores/' + playerId).update({ luck: current - 1 });
            }
        }
    });

    // Detectar cambios directos en los inputs y actualizarlos en Firebase (Reemplaza el auto-sync de Roll20)
    document.addEventListener('change', (e) => {
        if (!e.target.name || !e.target.name.startsWith('attr_')) return;

        const attrName = e.target.name.replace('attr_', '');
        const val = e.target.type === 'checkbox' ? (e.target.checked ? e.target.value : '0') : e.target.value;

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
            db.ref('campaña/jugadores/' + playerId + '/modifiers').update({ [matchedStatKey]: val });
        } else if (typeof db !== 'undefined') {
            // Guardar directamente en la raiz
            db.ref('campaña/jugadores/' + playerId).update({ [attrName]: val });
        }
    });
});
