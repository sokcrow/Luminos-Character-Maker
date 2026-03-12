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
        { id: "alta_cuna", name: "Alta Cuna", funds: "25,000 Ahn", benefit: "+1 Empatía, +1 Negociación, -1 Supervivencia" },
        { id: "aristocracia_mercantil", name: "Aristocracia Mercantil", funds: "30,000 Ahn", benefit: "+2 Negociación, +1 Engaño, -1 Vigor" },
        { id: "nobleza_caida", name: "Nobleza Caída", funds: "5,000 Ahn", benefit: "+1 Presencia, +1 Sigilo" },
        { id: "cuna_de_eruditos", name: "Cuna de Eruditos", funds: "15,000 Ahn", benefit: "+2 Ciencia, +1 Lore, -1 Carisma" },
        { id: "linaje_militar", name: "Linaje Militar", funds: "8,000 Ahn", benefit: "+1 Fortaleza, +1 Manejo" },
        { id: "familia_de_granjeros", name: "Familia de Granjeros", funds: "3,000 Ahn", benefit: "+1 Vigor, +1 Supervivencia" },
        { id: "artesano_independiente", name: "Artesano Independiente", funds: "6,000 Ahn", benefit: "+1 Reflejos, +1 Análisis" },
        { id: "fuerzas_de_seguridad", name: "Fuerzas de Seguridad (Bajas)", funds: "7,000 Ahn", benefit: "+1 Percepción, +1 Voluntad" },
        { id: "burocracia_menor", name: "Burocracia Menor", funds: "4,500 Ahn", benefit: "+1 Memoria, +1 Prudencia" },
        { id: "huerfano_callejero", name: "Huérfano Callejero", funds: "500 Ahn", benefit: "+2 Sigilo, +1 Agilidad, -1 Educación Formal (Lore)" },
        { id: "escoria_criminal", name: "Escoria Criminal", funds: "2,000 Ahn", benefit: "+1 Engaño, +1 Seducción" },
        { id: "exiliado_proscrito", name: "Exiliado / Proscrito", funds: "1,000 Ahn", benefit: "+2 Supervivencia, +1 Instinto, -1 Carisma" },
        { id: "esclavo_liberado", name: "Esclavo Liberado / Fugitivo", funds: "200 Ahn", benefit: "+2 Voluntad, +1 Templanza, -1 Confianza (Empatía)" },
        { id: "experimento_fallido", name: "Experimento Fallido", funds: "0 Ahn", benefit: "+2 Resistencia (Fortaleza), +1 Arcana, -1 Apariencia (Presencia)" },
        { id: "academico_desacreditado", name: "Académico Desacreditado", funds: "1,500 Ahn", benefit: "+2 Investigación, +1 Ciencia, -1 Reputación (Perspicacia)" },
        { id: "siervo_corporativo", name: "Siervo Corporativo (Bajo Rango)", funds: "2,500 Ahn", benefit: "+1 Represión, +1 Negociación" },
        { id: "deudor_vitalicio", name: "Deudor Vitalicio", funds: "-100,000 Ahn", benefit: "+2 Agilidad (huyendo de cobradores), +1 Supervivencia, -1 Tranquilidad (Templanza)" },
        { id: "miembro_culto", name: "Miembro de Culto Menor", funds: "800 Ahn", benefit: "+2 Fe, +1 Lore, -1 Razón (Análisis)" }
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

    const Roll20Shim = (function() {
        const attributes = {};
        const events = {};
        const templates = {};

        function parseNum(v) { return parseFloat(v) || 0; }

        function trigger(eventName, eventInfo) {
            const cbs = events[eventName.toLowerCase()] || [];
            cbs.forEach(cb => cb(eventInfo));
        }

        function updateDOM(attr, val) {
            document.querySelectorAll(`input[name="attr_${attr}"]`).forEach(el => {
                if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = (String(el.value) === String(val) || String(val) === "1");
                    if (el.type === 'checkbox' && String(val) === "1") el.checked = true;
                    if (el.type === 'checkbox' && String(val) === "0") el.checked = false;
                } else {
                    el.value = val;
                    el.setAttribute('value', val); // For CSS wizardry
                }
            });
            document.querySelectorAll(`select[name="attr_${attr}"]`).forEach(el => {
                el.value = val;
            });
            document.querySelectorAll(`textarea[name="attr_${attr}"]`).forEach(el => el.value = val);
            document.querySelectorAll(`span[name="attr_${attr}"], div[name="attr_${attr}"]`).forEach(el => {
                if(!el.classList.contains('sheet-skill-total') && !el.hasAttribute('name')) return;
                // Specific fix for span values to preserve inline styles if any
                el.textContent = val;
            });
            document.querySelectorAll(`img[name="attr_${attr}"]`).forEach(el => {
                if(val) el.src = val;
            });
        }

        function checkRowExists(attrName) {
            const match = attrName.match(/^(repeating_[^_]+)_([^_]+)_(.+)$/);
            if (match) {
                const section = match[1];
                const rowId = match[2];
                let fieldset = document.querySelector(`fieldset.${section}`);
                if(!fieldset) {
                    fieldset = document.createElement('fieldset');
                    fieldset.className = section;
                    const dummyContainer = document.querySelector(`fieldset.repeating_dummy_placeholder`);
                    if(dummyContainer) dummyContainer.parentElement.appendChild(fieldset);
                }

                let repcontainer = fieldset.querySelector('.repcontainer');
                if(!repcontainer) {
                    repcontainer = document.createElement('div');
                    repcontainer.className = 'repcontainer';
                    fieldset.appendChild(repcontainer);
                }

                if (!repcontainer.querySelector(`[data-rowid="${rowId}"]`)) {
                    if(!templates[section]) return;
                    const rowHTML = templates[section].replace(/attr_/g, `attr_${section}_${rowId}_`).replace(/act_/g, `act_${section}_${rowId}_`).replace(/roll_/g, `roll_${section}_${rowId}_`);
                    const rowContainer = document.createElement('div');
                    rowContainer.className = 'reprow';
                    rowContainer.setAttribute('data-rowid', rowId);
                    rowContainer.innerHTML = rowHTML;

                    // Add delete button
                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-danger';
                    delBtn.textContent = 'Del';
                    delBtn.style.marginTop = '10px';
                    delBtn.style.background = '#500';
                    delBtn.style.color = 'white';
                    delBtn.style.border = '1px solid red';
                    delBtn.onclick = () => {
                        rowContainer.remove();
                        // Clean up attributes
                        for(let k in attributes) {
                            if(k.startsWith(`${section}_${rowId}_`)) delete attributes[k];
                        }
                        trigger(`remove:${section}`, { sourceAttribute: attrName });
                    };
                    rowContainer.appendChild(delBtn);

                    repcontainer.appendChild(rowContainer);
                }
            }
        }

        window.getAttrs = function(attrsArray, callback) {
            const result = {};
            attrsArray.forEach(a => result[a] = (attributes[a.toLowerCase()] !== undefined ? attributes[a.toLowerCase()] : ''));
            callback(result);
        };

        window.setAttrs = function(updateObj, callback) {
            const changed = [];
            for (let key in updateObj) {
                let k = key.toLowerCase();
                let val = updateObj[key];
                if (attributes[k] !== val) {
                    checkRowExists(k);
                    attributes[k] = val;
                    changed.push({ key: k, prev: attributes[k], newVal: val });
                    updateDOM(k, val);
                }
            }

            // Save to localStorage
            localStorage.setItem('luminous_charsheet_save', JSON.stringify(attributes));

            changed.forEach(c => {
                trigger(`change:${c.key}`, {
                    sourceAttribute: c.key,
                    previousValue: c.prev,
                    newValue: c.newVal
                });
                const match = c.key.match(/^(repeating_[^_]+)_[^_]+_(.+)$/);
                if (match) {
                    trigger(`change:${match[1]}:${match[2]}`, {
                        sourceAttribute: c.key,
                        previousValue: c.prev,
                        newValue: c.newVal
                    });
                }
            });

            if (callback) callback();
        };

        window.on = function(eventStr, callback) {
            const evts = eventStr.split(' ');
            evts.forEach(e => {
                const ev = e.toLowerCase();
                if (!events[ev]) events[ev] = [];
                events[ev].push(callback);
            });
        };

        window.getSectionIDs = function(section, callback) {
            const fieldset = document.querySelector(`fieldset.${section}`);
            if (!fieldset) return callback([]);
            const rows = Array.from(fieldset.querySelectorAll('.reprow')).map(el => el.getAttribute('data-rowid'));
            callback(rows);
        };

        window.generateRowID = function() {
            return '-M' + Math.random().toString(36).substr(2, 9);
        };

        window.startRoll = function(rollString, callback) {
            const results = { rollId: generateRowID(), results: {} };

            // Very basic parser for 1d100<[[@{sp}+50]]
            let sp = parseInt(attributes['sp'] || 0);
            let chance = 50 + sp;

            for(let i=1; i<=5; i++) {
                let roll = Math.floor(Math.random() * 100) + 1;
                results.results['c'+i] = { result: roll <= chance ? 1 : 0 };
            }

            // Extract base and name if possible
            let nameMatch = rollString.match(/{{name=([^}]+)}}/);
            if(nameMatch) results.name = nameMatch[1];

            let baseMatch = rollString.match(/{{base=([^}]+)}}/);
            if(baseMatch) results.base = baseMatch[1];

            callback(results);
        };

                window.finishRoll = function(rollId, computedObj, resultsData) {
            showRollModal(computedObj.result, resultsData);
        };


        function showRollModal(resultText, resultsData) {
            let modal = document.getElementById('roll-modal');

            // Check if styles exist, if not create
            if(!document.getElementById('roll-modal-style')) {
                const style = document.createElement('style');
                style.id = 'roll-modal-style';
                style.innerHTML = `
                    #roll-modal-close:hover {
                        background: rgba(0, 255, 255, 0.1) !important;
                        box-shadow: 0 0 10px var(--cyan-tech) !important;
                    }
                    .roll-modal-coin {
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        transition: transform 0.3s ease;
                    }
                    .roll-modal-coin.head {
                        filter: drop-shadow(0 0 8px rgba(196, 154, 0, 0.8));
                    }
                    .roll-modal-coin.tail {
                        filter: drop-shadow(0 0 3px rgba(139, 0, 0, 0.8)) grayscale(0.8);
                        opacity: 0.6;
                    }
                `;
                document.head.appendChild(style);
            }

            if(!modal) {
                modal = document.createElement('div');
                modal.id = 'roll-modal';
                modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; justify-content: center; align-items: center; backdrop-filter: blur(3px); transition: opacity 0.2s;';

                modal.innerHTML = `
                    <div id="roll-modal-content" style="background: linear-gradient(135deg, #111 0%, #222 100%); border: 2px solid var(--border-accent); border-radius: 8px; padding: 25px; min-width: 320px; max-width: 90%; box-shadow: 0 0 25px rgba(196, 154, 0, 0.3), inset 0 0 15px rgba(0,0,0,0.8); font-family: 'Share Tech Mono', monospace; text-align: center; position: relative; overflow: hidden;">
                        <!-- Scanline effect overlay -->
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.03) 2px, rgba(0, 255, 255, 0.03) 4px); pointer-events: none; z-index: 1;"></div>

                        <div style="position: relative; z-index: 2;">
                            <h2 id="roll-modal-title" style="color:var(--border-accent); margin-top:0; border-bottom: 1px dashed #555; padding-bottom: 10px; font-size: 1.4em; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 5px rgba(196,154,0,0.5);">Resultado</h2>

                            <div style="display: flex; justify-content: space-between; margin: 15px 0; color: var(--cyan-tech); font-size: 1.1em;">
                                <span id="roll-modal-base" style="background: rgba(0,255,255,0.1); padding: 2px 8px; border-radius: 3px;">Base: 0</span>
                                <span id="roll-modal-sp" style="background: rgba(0,255,255,0.1); padding: 2px 8px; border-radius: 3px;">SP: 0</span>
                            </div>

                            <div id="roll-modal-coins" style="display: flex; justify-content: center; gap: 15px; margin: 25px 0; min-height: 40px;">
                                <!-- Coins will be injected here -->
                            </div>

                            <div style="font-size: 1.1em; color: #888; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px;">Poder Final</div>
                            <div id="roll-modal-result" style="font-size: 4em; font-weight: bold; color: var(--golden-entity); margin: 0 0 25px 0; text-shadow: 0 0 15px rgba(196, 154, 0, 0.8), 2px 2px 0px #000; line-height: 1;"></div>

                            <button id="roll-modal-close" style="background: #1a1a1a; color: var(--cyan-tech); border: 1px solid var(--cyan-tech); padding: 12px 20px; font-family: 'Share Tech Mono'; font-size: 1.2em; cursor: pointer; border-radius: 4px; transition: all 0.2s; width: 100%; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; position: relative; overflow: hidden;">Confirmar</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);
                document.getElementById('roll-modal-close').onclick = () => {
                    modal.style.opacity = '0';
                    setTimeout(() => modal.style.display = 'none', 200);
                };
            }

            // Populate Data
            if(resultsData) {
                document.getElementById('roll-modal-title').textContent = resultsData.name || "Tirada";
                document.getElementById('roll-modal-base').textContent = `Base: ${resultsData.base || 0}`;
                document.getElementById('roll-modal-sp').textContent = `SP: ${attributes['sp'] || 0}`;

                const coinsContainer = document.getElementById('roll-modal-coins');
                coinsContainer.innerHTML = '';

                // Add coins based on result
                for(let i=1; i<=5; i++) {
                    const coinResult = resultsData.results && resultsData.results['c'+i];
                    if(coinResult) {
                        const isHead = coinResult.result === 1;
                        const imgSrc = isHead ? "https://i.imgur.com/yshLPnQ.png" : "https://i.imgur.com/XDx0ICt.png";
                        const coinImg = document.createElement('img');
                        coinImg.src = imgSrc;
                        coinImg.className = `roll-modal-coin ${isHead ? 'head' : 'tail'}`;
                        coinImg.title = isHead ? "Cara (+Poder)" : "Cruz (+0)";
                        coinsContainer.appendChild(coinImg);
                    }
                }
            } else {
                 document.getElementById('roll-modal-title').textContent = "Resultado";
                 document.getElementById('roll-modal-base').textContent = `Base: -`;
                 document.getElementById('roll-modal-sp').textContent = `SP: -`;
                 document.getElementById('roll-modal-coins').innerHTML = '';
            }

            document.getElementById('roll-modal-result').textContent = resultText;

            // Show with tiny fade in
            modal.style.display = 'flex';

            // Force reflow
            void modal.offsetWidth;

            modal.style.opacity = '1';
        }


        document.addEventListener('change', (e) => {
            if (e.target.name && e.target.name.startsWith('attr_')) {
                const attr = e.target.name.replace('attr_', '').toLowerCase();
                let val = e.target.type === 'checkbox' ? (e.target.checked ? e.target.value : '0') : e.target.value;
                const prev = attributes[attr];
                attributes[attr] = val;

                // Save to localStorage immediately on direct UI changes
                localStorage.setItem('luminous_charsheet_save', JSON.stringify(attributes));

                updateDOM(attr, val);

                trigger(`change:${attr}`, {
                    sourceAttribute: attr,
                    previousValue: prev,
                    newValue: val
                });

                const match = attr.match(/^(repeating_[^_]+)_[^_]+_(.+)$/);
                if (match) {
                    trigger(`change:${match[1]}:${match[2]}`, {
                        sourceAttribute: attr,
                        previousValue: prev,
                        newValue: val
                    });
                }
            }
        });

        document.addEventListener('click', (e) => {
            let actionBtn = e.target.closest('button[type="action"]');
            if (actionBtn && actionBtn.name && actionBtn.name.startsWith('act_')) {
                let act = actionBtn.name.replace('act_', '').toLowerCase();

                const rowDiv = actionBtn.closest('.reprow');
                if (rowDiv) {
                    const section = rowDiv.parentElement.parentElement.className.split(' ')[0];
                    const rowId = rowDiv.getAttribute('data-rowid');
                    act = act.replace(`${section}_${rowId}_`, '');
                    trigger(`clicked:${section}:${act}`, {
                        sourceAttribute: `${section}_${rowId}_${act}`
                    });
                } else {
                    trigger(`clicked:${act}`, {
                        sourceAttribute: act
                    });
                }
            }

            let rollBtn = e.target.closest('button[type="roll"]');
            if (rollBtn && rollBtn.name && rollBtn.name.startsWith('roll_')) {
                let roll = rollBtn.name.replace('roll_', '').toLowerCase();

                // Hack for stats/skills clicking directly
                if(roll.startsWith('skill_')) {
                    trigger(`clicked:${roll}`, { sourceAttribute: roll });
                } else if(['cuerpo', 'mente', 'alma'].includes(roll)) {
                    trigger(`clicked:${roll}`, { sourceAttribute: roll });
                } else if(roll === 'perk') {
                    // Check if it's a perk roll inside a repeating section
                    const rowDiv = rollBtn.closest('.reprow');
                    if (rowDiv) {
                        const rowId = rowDiv.getAttribute('data-rowid');
                        const nameAttr = attributes[`repeating_skills_${rowId}_skill_name`] || "Perk";
                        const descAttr = attributes[`repeating_skills_${rowId}_skill_description`] || "";
                        showRollModal(descAttr, { name: nameAttr, base: 0 });
                    }
                } else if(roll === 'speed_check') {
                    let min = parseInt(attributes['minspeed'] || 1);
                    let max = parseInt(attributes['maxspeed'] || 6);
                    let res = Math.floor(Math.random() * (max - min + 1)) + min;
                    showRollModal(res, { name: "SPEED CHECK", base: min });
                } else if(roll === 'clash' || roll === 'damage' || roll === 'defend' || roll === 'counter_damage') {
                    const rowDiv = rollBtn.closest('.reprow');
                    if (rowDiv) {
                        const rowId = rowDiv.getAttribute('data-rowid');
                        const prefix = `repeating_abilities_${rowId}`;
                        const name = attributes[`${prefix}_skill_name`] || "Skill";
                        const base = parseInt(attributes[`${prefix}_skill_base`] || 0);
                        const coinPower = parseInt(attributes[`${prefix}_skill_coin_power`] || 0);
                        const red = parseInt(attributes[`${prefix}_skill_coin_red`] || 0);
                        const normal = parseInt(attributes[`${prefix}_skill_coin_normal`] || 0);

                        let sp = parseInt(attributes['sp'] || 0);
                        let chance = 50 + sp;
                        let heads = 0;
                        let resultsData = { name: name.toUpperCase() + " " + roll.toUpperCase(), base: base, results: {} };

                        for(let i=1; i<= (red+normal); i++) {
                            let r = Math.floor(Math.random() * 100) + 1;
                            let isHead = r <= chance ? 1 : 0;
                            resultsData.results['c'+i] = { result: isHead };
                            heads += isHead;
                        }

                        let total = base + (heads * coinPower);
                        showRollModal(total, resultsData);
                    }
                } else {
                    // Fallback
                    let val = rollBtn.value;
                    if(val) {
                        val = val.replace(/@{([^}]+)}/g, (m, p1) => attributes[p1.toLowerCase()] || 0);
                        showRollModal("Roll Command: " + val);
                    }
                }
            }
        });

        window.addEventListener('DOMContentLoaded', () => {
            // Toggle Phone Logic
            const toggleBtn = document.getElementById('btn-toggle-phone');
            const phoneWrapper = document.querySelector('.sheet-phone-wrapper');
            if (toggleBtn && phoneWrapper) {
                toggleBtn.addEventListener('click', () => {
                    phoneWrapper.classList.toggle('phone-hidden');
                });
            }

            document.querySelectorAll('fieldset[class^="repeating_"]').forEach(fieldset => {
                const section = fieldset.className.split(' ')[0];
                templates[section] = fieldset.innerHTML;
                fieldset.innerHTML = '<div class="repcontainer"></div>';
            });

            const charsheetSaveStr = localStorage.getItem('luminous_charsheet_save');
            let savedAttrs = {};
            if (charsheetSaveStr) {
                try {
                    savedAttrs = JSON.parse(charsheetSaveStr);
                    // Ensure 'tab' is valid so we don't get a blank screen on load
                    const validTabs = ['home', 'stats', 'banco', 'skills', 'abilities', 'parts', 'profile', 'apego', 'vitals', 'settings'];
                    if (!savedAttrs.tab || !validTabs.includes(savedAttrs.tab)) {
                        savedAttrs.tab = 'home';
                    }
                } catch(e) {}
            }

            document.querySelectorAll('input[name^="attr_"], select[name^="attr_"], textarea[name^="attr_"]').forEach(el => {
                const attr = el.name.replace('attr_', '').toLowerCase();
                if (!(attr in attributes)) {
                    if (savedAttrs[attr] !== undefined) {
                        attributes[attr] = savedAttrs[attr];
                    } else {
                        attributes[attr] = el.type === 'checkbox' ? (el.checked ? el.value : '0') : el.value;
                    }
                    // Do not update DOM here yet, just initialize attributes
                }
            });

            // Now apply saved repeating rows if any
            for (let k in savedAttrs) {
                if (k.startsWith('repeating_')) {
                    attributes[k] = savedAttrs[k];
                    checkRowExists(k);
                }
            }

            // Sync DOM
            for (let k in attributes) {
                updateDOM(k, attributes[k]);
            }

            trigger('sheet:opened', { sourceAttribute: 'sheet:opened' });

            // Load character data from creator if present
            setTimeout(() => {
                const savedStateStr = localStorage.getItem('luminousState');
                if (savedStateStr) {
try {
                        const state = JSON.parse(savedStateStr);
                        const update = {};

                        // Apply basic stats
                        if (state.baseStats) {
                            update.cuerpo_base = state.baseStats.cuerpo || 0;
                            update.mente_base = state.baseStats.mente || 0;
                            update.alma_base = state.baseStats.alma || 0;
                        }

                        // Apply modifiers
                        if (state.modifiers) {
                            for (const [skill, val] of Object.entries(state.modifiers)) {
                                let normalized = skill.toLowerCase()
                                    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove accents
                                    .replace(/ñ/g, 'n');
                                update[`skill_${normalized}_mod`] = val;
                            }
                        }

                        // Attempt to fill some profile data
                        let raceName = state.originId;
                        const rData = racesData.find(r => r.id === state.originId);
                        if (rData) {
                            raceName = rData.nombre;
                            if(state.subraceId) {
                                raceName += ` (${state.subraceId.replace(/_/g, ' ')})`;
                            }
                        }

                        let bgName = state.backgroundId;
                        const bData = backgroundsData.find(b => b.id === state.backgroundId);
                        if (bData) bgName = bData.name;

                        let profName = state.professionId;
                        const pData = professionsData.find(p => p.id === state.professionId);
                        if (pData) profName = pData.name;

                        let psychoName = state.psychologicalBackgroundId;
                        const psData = psychoData.find(ps => ps.id === state.psychologicalBackgroundId);
                        if (psData) psychoName = psData.name;

                        update.race = raceName || "Desconocido";
                        update.background = bgName || "Desconocido";
                        update.class = profName || "Desconocido";
                        update.identity = psychoName || "Desconocido";

                        // Also append psycho traits to notes
                        if(state.psychologicalIdeal || state.psychologicalVinculo || state.psychologicalGrieta) {
                            update.identity_notes = `Ideal: ${state.psychologicalIdeal || 'N/A'}\n` +
                                                    `Vínculo: ${state.psychologicalVinculo || 'N/A'}\n` +
                                                    `Grieta: ${state.psychologicalGrieta || 'N/A'}`;
                        }

                        // Also retrieve the character's given name if any
                        if (state.characterName) {
                            update.character_name = state.characterName;
                        }

                        // Give starting Ahn based on background
                        if (bData && bData.funds) {
                            // Extract numeric value from funds
                            const numAhn = bData.funds.replace(/[^0-9-]/g, '');
                            if (numAhn) {
                                update.ahn = parseInt(numAhn);
                            }
                        }

                        setAttrs(update);

                        // Render Human Perks
                        if (state.humanPerks && state.humanPerks.length > 0) {
                            state.humanPerks.forEach(p => {
                                const rowId = generateRowID();
                                setAttrs({
                                    [`repeating_skills_${rowId}_skill_name`]: p.nombre,
                                    [`repeating_skills_${rowId}_skill_description`]: p.desc,
                                    [`repeating_skills_${rowId}_edit_mode`]: "0"
                                });
                            });
                        }

                        // Render Profession Perk
                        if (state.professionId && state.professionPerkId) {
                            const pData = professionsData.find(p => p.id === state.professionId);
                            if (pData && pData.perks) {
                                const perk = pData.perks.find(pk => pk.id === state.professionPerkId);
                                if (perk) {
                                    const rowId = generateRowID();
                                    setAttrs({
                                        [`repeating_skills_${rowId}_skill_name`]: perk.nombre,
                                        [`repeating_skills_${rowId}_skill_description`]: perk.desc,
                                        [`repeating_skills_${rowId}_edit_mode`]: "0"
                                    });
                                }
                            }
                        }

                        // Also add background benefit as a perk
                        if (bData && bData.benefit) {
                            const rowId = generateRowID();
                            setAttrs({
                                [`repeating_skills_${rowId}_skill_name`]: `Beneficio de Trasfondo: ${bData.name}`,
                                [`repeating_skills_${rowId}_skill_description`]: bData.benefit,
                                [`repeating_skills_${rowId}_edit_mode`]: "0"
                            });
                        }

                        // Set HP and other derived stats explicitly so sheet worker calculates
                        trigger('change:hp_base', {sourceAttribute: 'hp_base'});

                        // Fire stats change events
                        trigger('change:cuerpo_base', {sourceAttribute: 'cuerpo_base'});
                        trigger('change:mente_base', {sourceAttribute: 'mente_base'});
                        trigger('change:alma_base', {sourceAttribute: 'alma_base'});

                        // Delete luminousState to prevent overriding manually adjusted values next reload
                        localStorage.removeItem('luminousState');

                    } catch(e) {
                        console.error("Error loading luminousState:", e);
                    }
                }
            }, 500);
        });
    })();

// --- Helpers (K-scaffold inspired) ---
    const parseIntOr0 = (val) => parseInt(val || 0, 10);
    const parseFloatOr0 = (val) => parseFloat(val || 0);

    // --- Global Constants ---
    const partIndices = [1,2,3,4,5,6,7,8];
    const abnoStaggerIndices = [4,5,6,7,8,9,10,11,12];

    // Helper: Resolve Lowercase Row ID from sourceAttribute
    const resolveRowId = (section, lowerId, cb) => {
        getSectionIDs(section, (ids) => {
            const match = ids.find(id => id.toLowerCase() === lowerId);
            cb(match || lowerId);
        });
    };

    const stats = ['cuerpo', 'mente', 'alma'];

    // Stats Calculation
    stats.forEach(stat => {
        on(`change:${stat}_base change:${stat}_mod sheet:opened`, () => {
            getAttrs([`${stat}_base`, `${stat}_mod`], (values) => {
                const base = parseIntOr0(values[`${stat}_base`]);
                const mod = parseIntOr0(values[`${stat}_mod`]);
                setAttrs({
                    [stat]: base + mod
                });
            });
        });
    });

    on('clicked:toggle_perk_creator', () => {
        getAttrs(['show_perk_creator'], (v) => {
            const current = parseIntOr0(v.show_perk_creator);
            const next = current === 1 ? "0" : "1";
            setAttrs({
                show_perk_creator: next
            });
        });
    });

    // Level Calculation
    const updateLevels = () => {
        getAttrs(['level', 'mod_race_off', 'mod_race_def', 'mod_identity_off', 'mod_identity_def',
            'hp_base', 'hp_coefficient', 'equipment_offense_mod', 'equipment_defense_mod'
        ], (values) => {
            const level = parseIntOr0(values.level);
            const raceOff = parseIntOr0(values.mod_race_off);
            const raceDef = parseIntOr0(values.mod_race_def);
            const idOff = parseIntOr0(values.mod_identity_off);
            const idDef = parseIntOr0(values.mod_identity_def);
            const equipOff = parseIntOr0(values.equipment_offense_mod);
            const equipDef = parseIntOr0(values.equipment_defense_mod);

            // New Logic: Total = Level + Race + Identity + Equip
            const totalDef = level + raceDef + idDef + equipDef;

            // New Logic: Total Offense
            const totalOff = level + raceOff + idOff + equipOff;

            // Calculate Max HP: Base + (X * Total Def)
            const hpBase = parseIntOr0(values.hp_base);
            const hpCoef = parseFloatOr0(values.hp_coefficient);
            const maxHP = Math.floor(hpBase + (hpCoef * totalDef));

            setAttrs({
                total_off_level: totalOff,
                total_def_level: totalDef,
                hp_max: maxHP
            });

            // Update Abnormality Parts
            updateAllPartsMaxHP(totalDef);
        });
    };

    on('change:level change:mod_race_off change:mod_race_def change:mod_identity_off change:mod_identity_def change:hp_base change:hp_coefficient change:equipment_offense_mod change:equipment_defense_mod sheet:opened', () => {
        updateLevels();
    });

    // Stagger Threshold & HP Bar Calculation (Main 1-3)
    const staggerIndices = [1,2,3];
    const staggerEvents = staggerIndices.map(i => `change:stagger_${i}_percent change:stagger_${i}_active`).join(" ");

    on(`change:hp change:hp_max change:tremor_burst ${staggerEvents} sheet:opened`, () => {
        const attrsToGet = ['hp', 'hp_max', 'tremor_burst'];
        staggerIndices.forEach(i => {
            attrsToGet.push(`stagger_${i}_percent`);
            attrsToGet.push(`stagger_${i}_active`);
        });

        getAttrs(attrsToGet, (values) => {
            const current = parseIntOr0(values.hp);
            const max = parseIntOr0(values.hp_max);
            const tremor = parseIntOr0(values.tremor_burst);

            let percent = 0;
            if(max > 0) percent = Math.floor((current / max) * 100);
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            const classPercent = Math.floor(percent / 5) * 5;

            const update = {
                hp_bar_class: `sheet-hp-${classPercent}`
            };

            const getPos = (val, max) => {
                if(max <= 0) return 0;
                let p = Math.floor((val / max) * 100);
                if(p < 0) p = 0;
                if(p > 100) p = 100;
                return p;
            };

            let broken = false;

            staggerIndices.forEach(i => {
                const pVal = parseIntOr0(values[`stagger_${i}_percent`]);
                const isActive = values[`stagger_${i}_active`] == "1";

                // Base Threshold
                const tBase = Math.floor(max * (pVal / 100));

                // Effective Threshold (Add Tremor only if active)
                let tEff = tBase;
                if (isActive) tEff += tremor;

                // Update Value & Position
                update[`stagger_${i}_value`] = tEff;
                update[`stagger_${i}_pos`] = getPos(tEff, max);

                // Check Break
                // Only break if active AND current HP drops below effective threshold
                // Also ignore if percent is 0 (assuming 0% means unused/hidden logic via CSS, but safer to check)
                if (isActive && pVal > 0 && current <= tEff) {
                    update[`stagger_${i}_active`] = "0";
                    broken = true;
                }
            });

            if (broken) {
                update['tremor_burst'] = 0;
            }

            setAttrs(update);
        });
    });

    // --- Skill Visuals Logic ---
    const SIN_URLS = {
        "wrath": "https://i.imgur.com/Nn33MJR.png",
        "envy": "https://i.imgur.com/SuNHY9D.png",
        "gloom": "https://i.imgur.com/DCTX5Jy.png",
        "gluttony": "https://i.imgur.com/0KArwDU.png",
        "lust": "https://i.imgur.com/bF7bHHT.png",
        "pride": "https://i.imgur.com/w6z9THA.png",
        "sloth": "https://i.imgur.com/igYFF1I.png"
    };

    const DAMAGE_URLS = {
        "slashing": "https://i.imgur.com/Akf25L5.png",
        "piercing": "https://i.imgur.com/slcQlpc.png",
        "bludgeoning": "https://i.imgur.com/cg8Wh4w.png",
        "acid": "https://i.imgur.com/jaHFSfB.png",
        "fire": "https://i.imgur.com/0br4gK4.png",
        "cold": "https://i.imgur.com/kJY0rBP.png",
        "electric": "https://i.imgur.com/KMQuv3T.png",
        "force": "https://i.imgur.com/qjPIdi6.png",
        "necrotic": "https://i.imgur.com/Xjt7U8a.png",
        "poison": "https://i.imgur.com/adZpZuN.png",
        "psychic": "https://i.imgur.com/7MGMPB0.png",
        "radiant": "https://i.imgur.com/RmU2HGK.png",
        "thunder": "https://i.imgur.com/7VcSDjq.png"
    };

    const DEFENSE_URLS = {
        "Evade": "https://i.imgur.com/YXyy0mS.png",
        "Counter": "https://i.imgur.com/dyayioM.png",
        "Guard": "https://i.imgur.com/c2DI4lM.png"
    };

    const COIN_URL_RED = "https://i.imgur.com/yCxmI84.png";
    const COIN_URL_NORMAL = "https://i.imgur.com/yshLPnQ.png";
    const COIN_URL_EMPTY = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent

    // Helper: Calculate Clash Power Range
    const calculateClashRange = (base, coinPower, red, normal) => {
        const minPower = base;
        const maxPower = base + (coinPower * (red + normal));
        return `${minPower} ~ ${maxPower}`;
    };

    // Helper: Update Single Ability Row
    const updateAbilityRow = (rowId) => {
        const prefix = `repeating_abilities_${rowId}`;
        const attrs = [
            `${prefix}_skill_sin`,
            `${prefix}_skill_damage_type`,
            `${prefix}_skill_coin_red`,
            `${prefix}_skill_coin_normal`,
            `${prefix}_skill_atk_weight`,
            `${prefix}_skill_base`,
            `${prefix}_skill_coin_power`,
            `${prefix}_skill_type`,
            `${prefix}_skill_defense_type`,
            `${prefix}_skill_defense_level`,
            `${prefix}_skill_cost`,
            `${prefix}_skill_cost_type`
        ];

        getAttrs(attrs, (v) => {
            const getVal = (key) => v[key] || v[key.toLowerCase()];

            const sin = (getVal(`${prefix}_skill_sin`) || "wrath").toLowerCase();
            const dmg = (getVal(`${prefix}_skill_damage_type`) || "slashing").toLowerCase();
            const red = parseIntOr0(getVal(`${prefix}_skill_coin_red`));
            const normal = parseIntOr0(getVal(`${prefix}_skill_coin_normal`));
            const weight = parseIntOr0(getVal(`${prefix}_skill_atk_weight`));
            const base = parseIntOr0(getVal(`${prefix}_skill_base`));
            const coinPower = parseIntOr0(getVal(`${prefix}_skill_coin_power`));

            const type = (getVal(`${prefix}_skill_type`) || "attack").toLowerCase();
            const defType = getVal(`${prefix}_skill_defense_type`) || "Guard";
            const defLevel = getVal(`${prefix}_skill_defense_level`) || "Main";

            const update = {};

            // --- Icon Logic ---
            const sinUrl = SIN_URLS[sin] || SIN_URLS['wrath'];
            const defUrl = DEFENSE_URLS[defType] || DEFENSE_URLS['Guard'];

            // 1. Main Icon (Big Left)
            if (type === "defense") {
                update[`${prefix}_skill_main_icon_url`] = defUrl;
            } else {
                update[`${prefix}_skill_main_icon_url`] = sinUrl;
            }

            // 2. Overlay Icon (Always Sin, visibility controlled by CSS)
            update[`${prefix}_skill_sin_url`] = sinUrl;

            // 3. Stats Row Display Icon (Damage Type or Defense Type)
            if (type === "defense" && (defType === "Evade" || defType === "Guard")) {
                update[`${prefix}_skill_damage_display_url`] = defUrl;
            } else {
                // Attack OR Counter (uses Damage Type)
                update[`${prefix}_skill_damage_display_url`] = DAMAGE_URLS[dmg] || DAMAGE_URLS['slashing'];
            }

            // Coins
            for (let i = 1; i <= 5; i++) {
                let url = COIN_URL_EMPTY;
                let show = "0";
                if (i <= red) {
                    url = COIN_URL_RED;
                    show = "1";
                } else if (i <= red + normal) {
                    url = COIN_URL_NORMAL;
                    show = "1";
                }
                update[`${prefix}_coin_${i}_url`] = url;
                update[`${prefix}_coin_${i}_show`] = show;
            }

            // Atk Weight
            let squares = "";
            for(let i=0; i<weight; i++) {
                squares += "■";
            }
            update[`${prefix}_skill_atk_weight_display`] = squares;

            // Clash Power
            update[`${prefix}_skill_clash_power`] = calculateClashRange(base, coinPower, red, normal);

            setAttrs(update);
        });
    };

    on('change:repeating_abilities:skill_sin change:repeating_abilities:skill_damage_type change:repeating_abilities:skill_coin_red change:repeating_abilities:skill_coin_normal change:repeating_abilities:skill_atk_weight change:repeating_abilities:skill_base change:repeating_abilities:skill_coin_power change:repeating_abilities:skill_type change:repeating_abilities:skill_defense_type change:repeating_abilities:skill_defense_level change:repeating_abilities:skill_cost change:repeating_abilities:skill_cost_type', (eventInfo) => {
        const source = eventInfo.sourceAttribute;
        if (!source) return;

        // Extract row ID properly to handle Push IDs with underscores
        const rowId = source.replace('repeating_abilities_', '').replace(/_skill.*/, '');
        if (rowId) {
             updateAbilityRow(rowId);
        }
    });

    // Update all abilities on open to fix missing values
    on('sheet:opened', () => {
        getSectionIDs('repeating_abilities', (ids) => {
            ids.forEach(id => {
                updateAbilityRow(id);
                updateAbilityEffects(id);
            });
        });
    });

    on('clicked:reset_stagger', () => {
        setAttrs({
            stagger_1_active: "1",
            stagger_2_active: "1",
            stagger_3_active: "1"
        });
    });

    // --- Apego (Vínculos) Logic ---
    on('change:repeating_apego:pr', (eventInfo) => {
        if (!eventInfo || !eventInfo.newValue) return;
        const pr = parseIntOr0(eventInfo.newValue);
        let level = 1;
        let title = "Desconocido";
        let behavior = "Trato neutral o puramente funcional.";

        if (pr >= 550) {
            level = 11;
            title = "Vínculo Eterno";
            behavior = "Sacrificio total; unidad absoluta de propósitos y destino.";
        } else if (pr >= 490) {
            level = 10;
            title = "Pareja / Familia";
            behavior = "Lazo profundo y compromiso significativo de vida.";
        } else if (pr >= 420) {
            level = 9;
            title = "Leal / Protector";
            behavior = "Arriesgará su posición o seguridad para ayudarte.";
        } else if (pr >= 340) {
            level = 8;
            title = "Amigo Íntimo";
            behavior = "Vínculo fuerte; el PNJ prioriza tus peticiones sobre las de otros.";
        } else if (pr >= 260) {
            level = 7;
            title = "Confidente";
            behavior = "Confía plenamente en tu juicio y te busca para pedir consejo.";
        } else if (pr >= 190) {
            level = 6;
            title = "Amigo";
            behavior = "Te defenderá socialmente y compartirá secretos personales.";
        } else if (pr >= 130) {
            level = 5;
            title = "Compañero";
            behavior = "Existe una confianza mutua en el ámbito profesional/aventura.";
        } else if (pr >= 80) {
            level = 4;
            title = "Aliado";
            behavior = "Ayuda en asuntos menores y comparte recursos básicos.";
        } else if (pr >= 40) {
            level = 3;
            title = "Colaborador";
            behavior = "Está dispuesto a trabajar contigo en tareas simples.";
        } else if (pr >= 10) {
            level = 2;
            title = "Conocido";
            behavior = "Te reconoce y permite charlas casuales.";
        } else {
            level = 1;
            title = "Desconocido";
            behavior = "Trato neutral o puramente funcional.";
        }


        let nextPR = 10;
        let basePR = 0;
        if (pr >= 550) { nextPR = pr; basePR = 550; }
        else if (pr >= 490) { nextPR = 550; basePR = 490; }
        else if (pr >= 420) { nextPR = 490; basePR = 420; }
        else if (pr >= 340) { nextPR = 420; basePR = 340; }
        else if (pr >= 260) { nextPR = 340; basePR = 260; }
        else if (pr >= 190) { nextPR = 260; basePR = 190; }
        else if (pr >= 130) { nextPR = 190; basePR = 130; }
        else if (pr >= 80) { nextPR = 130; basePR = 80; }
        else if (pr >= 40) { nextPR = 80; basePR = 40; }
        else if (pr >= 10) { nextPR = 40; basePR = 10; }
        else { nextPR = 10; basePR = 0; }

        let missing = nextPR > pr ? nextPR - pr : 0;
        let progressPercent = 0;
        if (nextPR > basePR) {
            progressPercent = Math.min(Math.max(((pr - basePR) / (nextPR - basePR)) * 100, 0), 100);
        } else {
            progressPercent = 100;
        }
        let roundedPercent = Math.round(progressPercent / 5) * 5;

        const source = eventInfo.sourceAttribute || '';
        const rowId = source.replace('repeating_apego_', '').replace(/_pr.*/i, '');
        if (rowId) {
            const prefix = `repeating_apego_${rowId}`;
            const update = {};
            update[`${prefix}_level`] = level;
            update[`${prefix}_title`] = title;
            update[`${prefix}_behavior`] = behavior;
            update[`${prefix}_pr_missing`] = missing;
            update[`${prefix}_pr_bar_class`] = `sheet-xp-${roundedPercent}`;
            setAttrs(update);
        }
    });

    // SP Clamp & Visual State
    on('change:sp sheet:opened', () => {
        getAttrs(['sp'], (values) => {
            let sp = parseIntOr0(values.sp);
            let clamped = Math.min(Math.max(sp, -45), 45);

            let newState = "neutral";
            if (clamped == 45) newState = "max";
            else if (clamped > 0) newState = "positive";
            else if (clamped == 0) newState = "neutral";
            else if (clamped == -45) newState = "min";
            else if (clamped < 0) newState = "negative";

            let update = {
                sp_state: newState,
                coin_chance: 50 + clamped
            };
            if (sp !== clamped) update['sp'] = clamped;

            setAttrs(update);
        });
    });

    // Tab Navigation
    // Dummy strings for regex scanner:
    // clicked:tab_stats
    // clicked:tab_skills
    // clicked:tab_abilities
    // clicked:tab_parts
    // clicked:tab_profile
    // clicked:tab_apego
    // clicked:tab_equipment
    const tabsList = ["stats", "abilities", "skills", "profile", "parts", "apego", "banco"];
    tabsList.forEach(tab => {
        on(`clicked:tab_${tab}`, function() {
            setAttrs({
                tab: tab
            });
        });
    });

    // Config Toggle
    on('clicked:toggle_config', () => {
        getAttrs(['config_toggle'], (values) => {
            const current = values.config_toggle === "1" ? "0" : "1";
            setAttrs({ config_toggle: current });
        });
    });


    // Sub Stats Calculation
    const subStatsList = ['cardio', 'fortaleza', 'vigor', 'instinto', 'percepcion', 'agilidad', 'manejo', 'reflejos', 'sigilo', 'memoria', 'analisis', 'ciencia', 'lore', 'investigacion', 'perspicacia', 'negociacion', 'seduccion', 'engano', 'prudencia', 'carisma', 'empatia', 'voluntad', 'fe', 'represion', 'templanza', 'presencia', 'arcana'];
    subStatsList.forEach(stat => {
        on(`change:skill_${stat}_base change:skill_${stat}_mod sheet:opened`, () => {
            getAttrs([`skill_${stat}_base`, `skill_${stat}_mod`], (values) => {
                const base = parseIntOr0(values[`skill_${stat}_base`]);
                const mod = parseIntOr0(values[`skill_${stat}_mod`]);
                setAttrs({
                    [`skill_${stat}`]: base + mod
                });
            });
        });
    });

    // --- MOTOR DEFINITIVO: HYBRID CUSTOM ROLL PARSING ---

    // 1. Configuración de Atributos y Skills
    const statsList = ['cuerpo', 'mente', 'alma'];
    const skillDataMap = {
        'cardio': 'Cardio', 'fortaleza': 'Fortaleza', 'vigor': 'Vigor', 'instinto': 'Instinto',
        'percepcion': 'Percepción', 'agilidad': 'Agilidad', 'manejo': 'Manejo', 'reflejos': 'Reflejos', 'sigilo': 'Sigilo',
        'memoria': 'Memoria', 'analisis': 'Análisis', 'ciencia': 'Ciencia', 'lore': 'Lore', 'investigacion': 'Investigación',
        'perspicacia': 'Perspicacia', 'negociacion': 'Negociación', 'seduccion': 'Seducción', 'engano': 'Engaño', 'prudencia': 'Prudencia', 'carisma': 'Carisma',
        'empatia': 'Empatía', 'voluntad': 'Voluntad', 'fe': 'Fe', 'represion': 'Represión', 'templanza': 'Templanza', 'presencia': 'Presencia', 'arcana': 'Arcana'
    };

    // 2. Función Maestra de Tirada
    const executeLimbusHybridRoll = (name, baseAttr) => {
        // 1. Poder Base
        const basePower = baseAttr;
        const coinPower = 3;

        // 2. String con tiradas de Roll20 nativas para la animación y parser
        const rollString = `&{template:coin} {{name=${name.toUpperCase()} CHECK}} {{base=${basePower}}} {{c1=[[1d100<[[@{sp}+50]]]]}} {{c2=[[1d100<[[@{sp}+50]]]]}} {{c3=[[1d100<[[@{sp}+50]]]]}} {{c4=[[1d100<[[@{sp}+50]]]]}} {{c5=[[1d100<[[@{sp}+50]]]]}} {{result=[[0]]}}`;

        startRoll(rollString, (results) => {
            let headsCount = 0;

            // 3. Verificamos cada moneda devuelta por el parser de Roll20
            for (let i = 1; i <= 5; i++) {
                const key = 'c' + i;
                if (results.results[key]) {
                    headsCount += (results.results[key].result || 0);
                }
            }

            // 4. Cálculo Final
            const finalValue = (headsCount * coinPower) + basePower;

                        // 5. Sobrescribir {{result}} usando computed::
            finishRoll(results.rollId, {
                result: finalValue
            }, results);
        });
    };

    // 3. Listeners para Atributos
    statsList.forEach(stat => {
        on(`clicked:roll_${stat}`, () => {
            getAttrs([stat], (v) => {
                const statVal = parseIntOr0(v[stat]);
                executeLimbusHybridRoll(stat, statVal);
            });
        });
    });

    // 4. Listeners para Skills
    Object.keys(skillDataMap).forEach(skillId => {
        on(`clicked:roll_skill_${skillId}`, () => {
            getAttrs([`skill_${skillId}`], (v) => {
                const skillVal = parseIntOr0(v[`skill_${skillId}`]);
                executeLimbusHybridRoll(skillDataMap[skillId], skillVal);
            });
        });
    });

    // --- Luck Logic ---
    on('clicked:luck_up', () => {
        getAttrs(['luck', 'luck_max'], (v) => {
            const current = parseIntOr0(v.luck);
            const max = parseIntOr0(v.luck_max);
            let newVal = current + 1;
            if (newVal > max) newVal = max;
            setAttrs({luck: newVal});
        });
    });

    on('clicked:luck_down', () => {
        getAttrs(['luck'], (v) => {
            const current = parseIntOr0(v.luck);
            let newVal = current - 1;
            if (newVal < 0) newVal = 0;
            setAttrs({luck: newVal});
        });
    });

    // Validation
    on('change:luck change:luck_max sheet:opened', () => {
        getAttrs(['luck', 'luck_max'], (v) => {
            let current = parseIntOr0(v.luck);
            let max = parseIntOr0(v.luck_max);
            let update = {};
            let changed = false;

            // Ensure constraints
            if (current < 0) { current = 0; changed = true; }
            if (current > max) { current = max; changed = true; }

            // If Max is less than 0? (Shouldn't happen but defensive)
            if (max < 0) { max = 0; update['luck_max'] = 0; }

            if (changed) {
                update['luck'] = current;
                setAttrs(update);
            }
        });

    });

    // --- XP Logic (Biphasic) ---
    on('change:xp change:character_type sheet:opened', () => {
        getAttrs(['xp', 'character_type'], (values) => {
            const type = values.character_type || 'player';
            // If NPC or Abnormality, do NOT auto-calc level from XP (manual override allowed)
            if (type !== 'player') return;

            const xp = parseIntOr0(values.xp);
            let level = 1;
            let percent = 0;
            let missing = 0;

            const PHASE_1_CAP = 14060;
            const PHASE_1_STEP = 380;
            const PHASE_2_STEP = 5500;
            const MAX_LEVEL = 100;

            let currentLevelStart = 0;
            let nextLevelStart = 0;

            if (xp < PHASE_1_CAP) {
                // Phase 1: 0 to 14060
                level = Math.floor(xp / PHASE_1_STEP) + 1;
                currentLevelStart = (level - 1) * PHASE_1_STEP;
                nextLevelStart = level * PHASE_1_STEP;
            } else {
                // Phase 2: 14060+
                const xpExcess = xp - PHASE_1_CAP;
                const levelsGained = Math.floor(xpExcess / PHASE_2_STEP);
                // Level 38 starts at 14060.
                level = 38 + levelsGained;

                currentLevelStart = PHASE_1_CAP + (levelsGained * PHASE_2_STEP);
                nextLevelStart = currentLevelStart + PHASE_2_STEP;
            }

            // Cap Level Logic handled below, but calculate Missing/Percent first
            if (level < MAX_LEVEL) {
                const range = nextLevelStart - currentLevelStart;
                const progress = xp - currentLevelStart;
                missing = nextLevelStart - xp;

                if (range > 0) {
                    percent = Math.floor((progress / range) * 100);
                }
            }

            // Cap Level
            if (level >= MAX_LEVEL) {
                level = MAX_LEVEL;
                percent = 100;
                missing = 0;
            }

            // Clamp percent
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            // Round to nearest 5 for class buckets
            const classPercent = Math.floor(percent / 5) * 5;

            setAttrs({
                level: level,
                xp_missing: missing,
                xp_bar_class: `sheet-xp-${classPercent}`
            });
        });
    });

    // --- Ahn Logic ---
    on('change:ahn sheet:opened', () => {
        getAttrs(['ahn'], (values) => {
            const ahnVal = parseIntOr0(values.ahn);
            setAttrs({
                ahn_display: ahnVal.toLocaleString('en-US')
            });
        });
    });

    on('clicked:toggle_ahn_edit', () => {
        getAttrs(['show_ahn_edit'], (v) => {
            const current = parseIntOr0(v.show_ahn_edit);
            setAttrs({
                show_ahn_edit: current === 0 ? 1 : 0
            });
        });
    });

    on('clicked:add_ahn', () => {
        getAttrs(['ahn', 'ahn_mod'], (values) => {
            let ahn = parseIntOr0(values.ahn);
            const mod = parseIntOr0(values.ahn_mod);
            setAttrs({
                ahn: ahn + mod,
                ahn_mod: 0
            });
        });
    });

    on('clicked:sub_ahn', () => {
        getAttrs(['ahn', 'ahn_mod'], (values) => {
            let ahn = parseIntOr0(values.ahn);
            const mod = parseIntOr0(values.ahn_mod);
            setAttrs({
                ahn: ahn - mod,
                ahn_mod: 0
            });
        });
    });

    // --- Rest Logic ---
    on('clicked:short_rest', () => {
        getAttrs(['hp', 'hp_max'], (values) => {
            const current = parseIntOr0(values.hp);
            const max = parseIntOr0(values.hp_max);

            // Heal 34% of Max
            const healAmount = Math.floor(max * 0.34);
            let newHP = current + healAmount;
            if (newHP > max) newHP = max;

            setAttrs({
                hp: newHP,
                sp: 0,
                stagger_1_active: "1",
                stagger_2_active: "1",
                stagger_3_active: "1"
            });
        });
    });

    on('clicked:long_rest', () => {
        getAttrs(['hp_max'], (values) => {
            const max = parseIntOr0(values.hp_max);

            // Heal to 100%, SP to 0, Respect Staggers (don't change them)
            setAttrs({
                hp: max,
                sp: 0
            });
        });
    });

    // --- Perk Logic ---

    // 1. Add Perk (Creator)
    on('clicked:add_perk', () => {
        getAttrs(['new_perk_name', 'new_perk_desc'], (v) => {
            const name = v.new_perk_name || "New Perk";
            const desc = v.new_perk_desc || "";

            const newId = generateRowID();
            const update = {};

            const prefix = `repeating_skills_${newId}`;
            update[`${prefix}_skill_name`] = name;
            update[`${prefix}_skill_description`] = desc;
            update[`${prefix}_edit_mode`] = "0"; // View mode by default

            // Clear Creator Inputs
            update['new_perk_name'] = "";
            update['new_perk_desc'] = "";

            setAttrs(update);
        });
    });



    // --- Tag Splitting Utility ---
    const updateTags = (rawTags, prefix = "") => {
        let update = {};
        // clear old tags
        for (let i = 1; i <= 4; i++) {
            update[`${prefix}tag_${i}`] = "";
        }

        if (rawTags && typeof rawTags === 'string') {
            const splitTags = rawTags.split(',').map(s => s.trim()).filter(s => s.length > 0);
            for (let i = 0; i < Math.min(splitTags.length, 4); i++) {
                update[`${prefix}tag_${i+1}`] = splitTags[i];
            }
        }
        return update;
    };

    on('change:repeating_skills:tags', (eventInfo) => {
        const source = eventInfo.sourceAttribute || '';
        const rowId = source.replace('repeating_skills_', '').replace(/_tags.*/i, '');
        if(rowId) {
            getAttrs([`repeating_skills_${rowId}_tags`], (v) => {
                const update = updateTags(v[`repeating_skills_${rowId}_tags`], `repeating_skills_${rowId}_`);
                setAttrs(update);
            });
        }
    });

    on('change:repeating_abilities:tags', (eventInfo) => {
        const source = eventInfo.sourceAttribute || '';
        const rowId = source.replace('repeating_abilities_', '').replace(/_tags.*/i, '');
        if(rowId) {
            getAttrs([`repeating_abilities_${rowId}_tags`], (v) => {
                const update = updateTags(v[`repeating_abilities_${rowId}_tags`], `repeating_abilities_${rowId}_`);
                setAttrs(update);
            });
        }
    });

    on('change:repeating_equipment:weapon_tags', (eventInfo) => {
        const source = eventInfo.sourceAttribute || '';
        const rowId = source.replace('repeating_equipment_', '').replace(/_weapon_tags.*/i, '');
        if(rowId) {
            getAttrs([`repeating_equipment_${rowId}_weapon_tags`], (v) => {
                const update = updateTags(v[`repeating_equipment_${rowId}_weapon_tags`], `repeating_equipment_${rowId}_`);
                setAttrs(update);
            });
        }
    });

    // --- Equipment Creator Logic ---
    on('clicked:toggle_equip_creator', () => {
        getAttrs(['show_equip_creator'], (v) => {
            const current = parseIntOr0(v.show_equip_creator);
            const next = current === 1 ? "0" : "1";
            setAttrs({ show_equip_creator: next });
        });
    });

    on('clicked:add_equipment', () => {
        const fields = ['new_weapon_name', 'new_weapon_tags', 'new_weapon_offense', 'new_weapon_defense'];
        getAttrs(fields, (v) => {
            const rowId = generateRowID();
            const prefix = `repeating_equipment_${rowId}_`;
            let update = {};

            update[`${prefix}equipped`] = "1";
            update[`${prefix}weapon_name`] = v.new_weapon_name || "Arma Desconocida";
            update[`${prefix}weapon_tags`] = v.new_weapon_tags || "";
            update[`${prefix}weapon_offense`] = parseIntOr0(v.new_weapon_offense);
            update[`${prefix}weapon_defense`] = parseIntOr0(v.new_weapon_defense);

            // Add tags
            const tagUpdates = updateTags(v.new_weapon_tags || "", prefix);
            Object.assign(update, tagUpdates);

            // Reset creator
            update['new_weapon_name'] = "";
            update['new_weapon_tags'] = "";
            update['new_weapon_offense'] = 0;
            update['new_weapon_defense'] = 0;
            update['show_equip_creator'] = "0"; // close after adding

            setAttrs(update, () => {
                calculateEquipmentModifiers();
            });
        });
    });

    on('change:repeating_equipment:equipped change:repeating_equipment:weapon_offense change:repeating_equipment:weapon_defense remove:repeating_equipment', () => {
        calculateEquipmentModifiers();
    });

    function calculateEquipmentModifiers() {
        getSectionIDs('repeating_equipment', (ids) => {
            let fieldsToGet = [];
            ids.forEach(id => {
                fieldsToGet.push(`repeating_equipment_${id}_equipped`);
                fieldsToGet.push(`repeating_equipment_${id}_weapon_offense`);
                fieldsToGet.push(`repeating_equipment_${id}_weapon_defense`);
            });

            getAttrs(fieldsToGet, (v) => {
                let totalOffMod = 0;
                let totalDefMod = 0;

                ids.forEach(id => {
                    const equipped = parseIntOr0(v[`repeating_equipment_${id}_equipped`]);
                    if (equipped === 1) {
                        totalOffMod += parseIntOr0(v[`repeating_equipment_${id}_weapon_offense`]);
                        totalDefMod += parseIntOr0(v[`repeating_equipment_${id}_weapon_defense`]);
                    }
                });

                // Update base offense/defense levels with equipment mods
                setAttrs({
                    equipment_offense_mod: totalOffMod,
                    equipment_defense_mod: totalDefMod
                }, () => {
                    // Force update of final level attributes
                    // getAttrs(['level'], (vals) => {
                    //     updateOffenseLevel(parseIntOr0(vals.level));
                    //     updateDefenseLevel(parseIntOr0(vals.level));
                    // });
                    updateTotalLevels();
                });
            });
        });
    }

    // Function to calculate final levels including equipment
    function updateTotalLevels() {
        getAttrs(['level', 'equipment_offense_mod', 'equipment_defense_mod'], (v) => {
            const baseLevel = parseIntOr0(v.level);
            const offMod = parseIntOr0(v.equipment_offense_mod);
            const defMod = parseIntOr0(v.equipment_defense_mod);

            setAttrs({
                offense_level: baseLevel + offMod,
                defense_level: baseLevel + defMod
            });
        });
    }


    // --- Apego Creator Logic ---



    on('clicked:toggle_apego_creator', () => {
        getAttrs(['show_apego_creator'], (v) => {
            const current = parseIntOr0(v.show_apego_creator);
            const next = current === 1 ? "0" : "1";
            setAttrs({
                show_apego_creator: next
            });
        });
    });

    on('clicked:add_apego', () => {
        getAttrs(['new_apego_name', 'new_apego_desc'], (v) => {
            const name = v.new_apego_name || "Nuevo Vínculo";
            const desc = v.new_apego_desc || "";

            const newId = generateRowID();
            const update = {};

            const prefix = `repeating_apego_${newId}`;
            update[`${prefix}_name`] = name;
            update[`${prefix}_description`] = desc;
            update[`${prefix}_pr`] = 0; // Trigger existing event to update Level, Title, Behavior

            // Clear Creator Inputs
            update['new_apego_name'] = "";
            update['new_apego_desc'] = "";

            setAttrs(update);
        });
    });

    // 2. Toggle Edit Mode (Skills/Perks)
    on('clicked:repeating_skills:toggle_edit', (eventInfo) => {
        // Robust ID extraction
        const lowerId = eventInfo.sourceAttribute
            .replace(/^repeating_skills_/, '')
            .replace(/_act_toggle_edit$/, '')
            .replace(/_toggle_edit$/, '');

        getSectionIDs('repeating_skills', (ids) => {
            const realId = ids.find(id => id.toLowerCase() === lowerId);
            if (!realId) return;

            const prefix = `repeating_skills_${realId}`;
            const attr = `${prefix}_edit_mode`;

            getAttrs([attr], (v) => {
                 const val = v[attr] || v[attr.toLowerCase()];
                 const current = parseIntOr0(val);
                 const next = current === 1 ? "0" : "1";
                 setAttrs({
                     [attr]: next
                 });
            });
        });
    });

    // --- Abilities (Combat Skills) Logic ---

    // Toggle Edit Mode (Abilities)
    on('clicked:repeating_abilities:toggle_edit', (eventInfo) => {
        const lowerId = eventInfo.sourceAttribute
            .replace(/^repeating_abilities_/, '')
            .replace(/_act_toggle_edit$/, '')
            .replace(/_toggle_edit$/, '');

        getSectionIDs('repeating_abilities', (ids) => {
            const realId = ids.find(id => id.toLowerCase() === lowerId);
            if (!realId) return;

            const prefix = `repeating_abilities_${realId}`;
            const attr = `${prefix}_edit_mode`;

            getAttrs([attr], (v) => {
                 const val = v[attr] || v[attr.toLowerCase()];
                 const current = parseIntOr0(val);
                 const next = current === 1 ? "0" : "1";
                 setAttrs({
                     [attr]: next
                 });
            });
        });
    });


    // Skill Creator Toggle
    on('clicked:toggle_skill_creator', () => {
        getAttrs(['show_skill_creator'], (v) => {
            const current = parseIntOr0(v.show_skill_creator);
            const next = current === 1 ? "0" : "1";
            setAttrs({
                show_skill_creator: next
            });
        });
    });

    // Skill Type Toggle (Creator)
    on('change:new_skill_type', () => {
        getAttrs(['new_skill_type'], (v) => {
            setAttrs({
                new_skill_type_toggle: v.new_skill_type || 'attack'
            });
        });
    });

    // Add Skill Logic
    on('clicked:add_skill', () => {
        const props = ['new_skill_name', 'new_skill_base', 'new_skill_coin_power', 'new_skill_coin_red', 'new_skill_coin_normal', 'new_skill_sp', 'new_skill_cost_type', 'new_skill_cost', 'new_skill_color', 'new_skill_desc',
            'new_skill_sin', 'new_skill_damage_type', 'new_skill_atk_weight', 'new_skill_type', 'new_skill_defense_type', 'new_skill_defense_level', 'new_skill_tags'];
        for(let i=1; i<=5; i++) {
            props.push(`new_skill_effect_${i}_tag`);
            props.push(`new_skill_effect_${i}_status`);
            props.push(`new_skill_effect_${i}_potency`);
            props.push(`new_skill_effect_${i}_count`);
            props.push(`new_skill_effect_${i}_desc`);
        }

        getAttrs(props, (v) => {
            const newId = generateRowID();
            const update = {};
            const prefix = `repeating_abilities_${newId}`;

            const type = v.new_skill_type || "attack";
            const defType = v.new_skill_defense_type || "Guard";
            const defLevel = v.new_skill_defense_level || "Main";

            update[`${prefix}_skill_name`] = v.new_skill_name || "New Skill";
            update[`${prefix}_skill_base`] = v.new_skill_base || "0";
            update[`${prefix}_skill_coin_power`] = v.new_skill_coin_power || "0";
            update[`${prefix}_skill_coin_red`] = v.new_skill_coin_red || "0";
            update[`${prefix}_skill_coin_normal`] = v.new_skill_coin_normal || "0";
            update[`${prefix}_skill_atk_weight`] = v.new_skill_atk_weight || "1";
            update[`${prefix}_skill_sp`] = v.new_skill_sp || "auto";
            update[`${prefix}_skill_cost_type`] = v.new_skill_cost_type || "Luz";
            update[`${prefix}_skill_cost`] = v.new_skill_cost || "0";
            update[`${prefix}_skill_color`] = v.new_skill_color || "normal";
            update[`${prefix}_skill_desc`] = v.new_skill_desc || "";
            update[`${prefix}_skill_sin`] = v.new_skill_sin || "wrath";
            update[`${prefix}_skill_damage_type`] = v.new_skill_damage_type || "slashing";
            update[`${prefix}_skill_type`] = type;
            update[`${prefix}_skill_defense_type`] = defType;
            update[`${prefix}_skill_defense_level`] = defLevel;
            update[`${prefix}_edit_mode`] = "0"; // View Mode
            update[`${prefix}_tags`] = v.new_skill_tags || "";

            const tagUpdates = updateTags(v.new_skill_tags || "", prefix + "_");
            Object.assign(update, tagUpdates);


            // --- Pre-Calculate Derived Values ---
            const base = parseIntOr0(v.new_skill_base);
            const coinPower = parseIntOr0(v.new_skill_coin_power);
            const red = parseIntOr0(v.new_skill_coin_red);
            const normal = parseIntOr0(v.new_skill_coin_normal);
            const weight = parseIntOr0(v.new_skill_atk_weight);
            const sin = (v.new_skill_sin || "wrath").toLowerCase();
            const dmg = (v.new_skill_damage_type || "slashing").toLowerCase();

            // 1. Clash Power Range
            update[`${prefix}_skill_clash_power`] = calculateClashRange(base, coinPower, red, normal);

            // --- Icon Logic ---
            const sinUrl = SIN_URLS[sin] || SIN_URLS['wrath'];
            const defUrl = DEFENSE_URLS[defType] || DEFENSE_URLS['Guard'];

            // 2. Main Icon (Big Left)
            if (type === "defense") {
                update[`${prefix}_skill_main_icon_url`] = defUrl;
            } else {
                update[`${prefix}_skill_main_icon_url`] = sinUrl;
            }

            // 3. Overlay Icon
            update[`${prefix}_skill_sin_url`] = sinUrl;

            // 4. Stats Row Display Icon
            if (type === "defense" && (defType === "Evade" || defType === "Guard")) {
                update[`${prefix}_skill_damage_display_url`] = defUrl;
            } else {
                update[`${prefix}_skill_damage_display_url`] = DAMAGE_URLS[dmg] || DAMAGE_URLS['slashing'];
            }

            // 5. Coin Images & Visibility
            for (let i = 1; i <= 5; i++) {
                let url = COIN_URL_EMPTY;
                let show = "0";
                if (i <= red) {
                    url = COIN_URL_RED;
                    show = "1";
                } else if (i <= red + normal) {
                    url = COIN_URL_NORMAL;
                    show = "1";
                }
                update[`${prefix}_coin_${i}_url`] = url;
                update[`${prefix}_coin_${i}_show`] = show;
            }

            // 5. Atk Weight Display
            let squares = "";
            for(let i=0; i<weight; i++) {
                squares += "■";
            }
            update[`${prefix}_skill_atk_weight_display`] = squares;
            // ------------------------------------

            // Initialize Effects
            for(let i=1; i<=5; i++) {
                update[`${prefix}_skill_effect_${i}_tag`] = v[`new_skill_effect_${i}_tag`] || "";
                update[`${prefix}_skill_effect_${i}_status`] = v[`new_skill_effect_${i}_status`] || "";
                update[`${prefix}_skill_effect_${i}_potency`] = v[`new_skill_effect_${i}_potency`] || "0";
                update[`${prefix}_skill_effect_${i}_count`] = v[`new_skill_effect_${i}_count`] || "0";
                update[`${prefix}_skill_effect_${i}_desc`] = v[`new_skill_effect_${i}_desc`] || "";
            }

            // Clear inputs
            props.forEach(p => update[p] = (p === 'new_skill_sp' ? 'auto' : (p === 'new_skill_cost_type' ? 'Luz' : (p === 'new_skill_color' ? 'normal' : (p === 'new_skill_sin' ? 'wrath' : (p === 'new_skill_damage_type' ? 'slashing' : ''))))));
            // Reset numbers to 0 explicitly if needed, but empty string usually fine for text inputs. For numbers, maybe "0".
            update['new_skill_base'] = 0;
            update['new_skill_coin_power'] = 0;
            update['new_skill_coin_red'] = 0;
            update['new_skill_coin_normal'] = 0;
            update['new_skill_atk_weight'] = 1;
            update['new_skill_cost'] = 0;

            for(let i=1; i<=5; i++) {
                update[`new_skill_effect_${i}_tag`] = "";
                update[`new_skill_effect_${i}_status`] = "";
                update[`new_skill_effect_${i}_potency`] = 0;
                update[`new_skill_effect_${i}_count`] = 0;
                update[`new_skill_effect_${i}_desc`] = "";
            }

            setAttrs(update, () => {
                updateAbilityEffects(newId);
            });
        });
    });

    // Helper: Update Skill Effects
    const updateAbilityEffects = (rowId) => {
        const prefix = `repeating_abilities_${rowId}`;
        const props = [];
        for(let i=1; i<=5; i++) {
            props.push(`${prefix}_skill_effect_${i}_tag`);
            props.push(`${prefix}_skill_effect_${i}_status`);
            props.push(`${prefix}_skill_effect_${i}_potency`);
            props.push(`${prefix}_skill_effect_${i}_count`);
            props.push(`${prefix}_skill_effect_${i}_desc`);
        }

        getAttrs(props, (v) => {
            const update = {};
            let descParts = [];

            for(let i=1; i<=5; i++) {
                const tag = v[`${prefix}_skill_effect_${i}_tag`] || "";
                const status = v[`${prefix}_skill_effect_${i}_status`] || "";
                const potency = parseIntOr0(v[`${prefix}_skill_effect_${i}_potency`]);
                const count = parseIntOr0(v[`${prefix}_skill_effect_${i}_count`]);
                const desc = v[`${prefix}_skill_effect_${i}_desc`] || "";

                let display = "";
                if (tag) display += `${tag} `;
                if (status) display += `${status} `;
                // Send the exact X/Y format LCM expects
                display += `${potency}/${count} `;
                if (desc) display += `(${desc}) `;

                display = display.trim();
                update[`${prefix}_skill_effect_${i}_display`] = display;

                // Also generate a legacy-compatible hidden version without 0/0 empty formatting if no status exists
                if (tag || status || potency !== 0 || count !== 0 || desc) {
                    descParts.push(display);
                }
            }

            update[`${prefix}_skill_desc`] = descParts.join(' | ');
            setAttrs(update);
        });
    };

    const effectChangeEvents = [];
    for(let i=1; i<=5; i++) {
        effectChangeEvents.push(`change:repeating_abilities:skill_effect_${i}_tag`);
        effectChangeEvents.push(`change:repeating_abilities:skill_effect_${i}_status`);
        effectChangeEvents.push(`change:repeating_abilities:skill_effect_${i}_potency`);
        effectChangeEvents.push(`change:repeating_abilities:skill_effect_${i}_count`);
        effectChangeEvents.push(`change:repeating_abilities:skill_effect_${i}_desc`);
    }

    on(effectChangeEvents.join(' '), (eventInfo) => {
        const source = eventInfo.sourceAttribute || '';
        const rowId = source.replace('repeating_abilities_', '').replace(/_skill_effect.*/, '');
        if (rowId) {
            updateAbilityEffects(rowId);
        }
    });




    // --- Abnormality Parts Logic (Static 1-8) ---

    // 1. Max HP Calculation
    const updatePartMaxHP = (i, totalDef) => {
        const prefix = `part_${i}`;
        getAttrs([`${prefix}_hp_base`, `${prefix}_hp_coefficient`], (v) => {
             const base = parseIntOr0(v[`${prefix}_hp_base`]);
             const coefStr = v[`${prefix}_hp_coefficient`];
             const coef = parseFloat(coefStr === undefined ? 1.0 : coefStr);
             const max = Math.floor(base + (coef * totalDef));
             setAttrs({ [`${prefix}_hp_max`]: max });
        });
    };

    const updateAllPartsMaxHP = (totalDef) => {
        for(let i=1; i<=8; i++) updatePartMaxHP(i, totalDef);
    };

    // Listeners for Base/Coef changes
    const partsChangeEvents = [];
    for(let i=1; i<=8; i++) {
        partsChangeEvents.push(`change:part_${i}_hp_base`);
        partsChangeEvents.push(`change:part_${i}_hp_coefficient`);
    }

    on(partsChangeEvents.join(" "), (eventInfo) => {
        const source = eventInfo.sourceAttribute;
        // Extract number
        const match = source.match(/part_(\d+)_/);
        if (match) {
             const i = match[1];
             getAttrs(['total_def_level'], (v) => {
                 const def = parseIntOr0(v.total_def_level);
                 updatePartMaxHP(i, def);
             });
        }
    });

    // 2. Damage Propagation & Status Check
    const hpChangeEvents = [];
    for(let i=1; i<=8; i++) hpChangeEvents.push(`change:part_${i}_hp`);

    on(hpChangeEvents.join(" "), (eventInfo) => {
        const source = eventInfo.sourceAttribute;
        const prevValStr = eventInfo.previousValue;
        if (prevValStr === undefined || prevValStr === null) return;

        const match = source.match(/part_(\d+)_hp/);
        if (!match) return;
        const i = match[1];
        const prefix = `part_${i}`;

        const attrsToGet = [
            `${prefix}_hp`, `${prefix}_hp_max`, `${prefix}_status`,
            `${prefix}_severable`, `${prefix}_destructible`, `saved_resistances_${i}`,
            'hp',
            `${prefix}_res_slashing`, `${prefix}_res_piercing`, `${prefix}_res_bludgeoning`,
            `${prefix}_res_acid`, `${prefix}_res_fire`, `${prefix}_res_cold`, `${prefix}_res_electric`,
            `${prefix}_res_force`, `${prefix}_res_necrotic`, `${prefix}_res_poison`,
            `${prefix}_res_psychic`, `${prefix}_res_radiant`, `${prefix}_res_thunder`
        ];

        getAttrs(attrsToGet, (v) => {
            const currentHP = parseIntOr0(v[`${prefix}_hp`]);
            const prevHP = parseIntOr0(prevValStr);
            const status = v[`${prefix}_status`] || "active";

            if (currentHP < prevHP) {
                const damage = prevHP - currentHP;
                const coreHP = parseIntOr0(v.hp);
                setAttrs({ hp: coreHP - damage });
            }

            if (currentHP <= 0 && status === "active") {
                const severable = v[`${prefix}_severable`] === "1";
                const destructible = v[`${prefix}_destructible`] === "1";
                const update = {};

                if (severable) {
                    update[`${prefix}_status`] = "severed";
                    update[`${prefix}_active`] = "0"; // Auto-disable severable part
                } else if (destructible) {
                    update[`${prefix}_status`] = "broken";

                    const resKeys = ['slashing', 'piercing', 'bludgeoning', 'acid', 'fire', 'cold', 'electric', 'force', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'];
                    const savedRes = {};

                    resKeys.forEach(key => {
                        const attrKey = `${prefix}_res_${key}`;
                        const val = parseFloat(v[attrKey] || 1.0);
                        savedRes[key] = val;
                        if (val > 0.1) update[attrKey] = 2.0;
                    });

                    update[`saved_resistances_${i}`] = JSON.stringify(savedRes);
                }
                setAttrs(update);
            }
        });
    });

    // 3. Visual Bar Class
    const hpMaxChangeEvents = [];
    for(let i=1; i<=8; i++) {
        hpMaxChangeEvents.push(`change:part_${i}_hp`);
        hpMaxChangeEvents.push(`change:part_${i}_hp_max`);
    }

    on(hpMaxChangeEvents.join(" ") + " sheet:opened", (eventInfo) => {
        // If sheet opened, update all
        if (eventInfo.sourceAttribute === 'sheet:opened') {
            const attrs = [];
            for(let i=1; i<=8; i++) {
                attrs.push(`part_${i}_hp`);
                attrs.push(`part_${i}_hp_max`);
            }
            getAttrs(attrs, (v) => {
                const update = {};
                for(let i=1; i<=8; i++) {
                    const cur = parseIntOr0(v[`part_${i}_hp`]);
                    const max = parseIntOr0(v[`part_${i}_hp_max`]);
                    let percent = 0;
                    if(max > 0) percent = Math.floor((cur / max) * 100);
                    if(percent < 0) percent = 0; if(percent > 100) percent = 100;
                    const classPercent = Math.floor(percent / 5) * 5;
                    update[`part_${i}_bar_class`] = `sheet-bar-p${classPercent}`;
                }
                setAttrs(update);
            });
            return;
        }

        const match = eventInfo.sourceAttribute.match(/part_(\d+)_/);
        if (match) {
            const i = match[1];
            getAttrs([`part_${i}_hp`, `part_${i}_hp_max`], (v) => {
                 const cur = parseIntOr0(v[`part_${i}_hp`]);
                 const max = parseIntOr0(v[`part_${i}_hp_max`]);
                 let percent = 0;
                 if(max > 0) percent = Math.floor((cur / max) * 100);
                 if(percent < 0) percent = 0; if(percent > 100) percent = 100;
                 const classPercent = Math.floor(percent / 5) * 5;
                 setAttrs({ [`part_${i}_bar_class`]: `sheet-bar-p${classPercent}` });
            });
        }
    });

    // 4. Reset Abnormality
    on('clicked:reset_abno', () => {
        getAttrs(['hp_max'], (v) => {
            const max = v.hp_max;
            const update = { hp: max };

            // We need to fetch all parts data to restore resistances
            const attrs = [];
            for(let i=1; i<=8; i++) {
                attrs.push(`part_${i}_hp_max`);
                attrs.push(`saved_resistances_${i}`);
            }

            getAttrs(attrs, (vals) => {
                for(let i=1; i<=8; i++) {
                    update[`part_${i}_hp`] = vals[`part_${i}_hp_max`];
                    update[`part_${i}_status`] = "active";

                    const savedJSON = vals[`saved_resistances_${i}`];
                    if (savedJSON) {
                        try {
                            const saved = JSON.parse(savedJSON);
                            for (const [key, val] of Object.entries(saved)) {
                                update[`part_${i}_res_${key}`] = val;
                            }
                        } catch(e) {}
                        update[`saved_resistances_${i}`] = "";
                    }
                }
                setAttrs(update);
            });
        });
    });

    // XP Reward Update (Static parts count)
    const updateXPReward = () => {
        getAttrs(['level', 'character_type'], (v) => {
            const level = parseIntOr0(v.level);
            const type = v.character_type || 'player';
            if (type === 'player') return;

            if (type === 'npc') {
                setAttrs({ xp_reward: Math.floor(level * 6.25) });
            } else if (type === 'abnormality') {
                // Count active parts
                const activeAttrs = [];
                for(let i=1; i<=8; i++) activeAttrs.push(`part_${i}_active`);

                getAttrs(activeAttrs, (vals) => {
                    let partsCount = 0;
                    for(let i=1; i<=8; i++) {
                        if (vals[`part_${i}_active`] == "1") partsCount++;
                    }
                    const reward = (level * 50) + (partsCount * 25);
                    setAttrs({ xp_reward: reward });
                });
            }
        });
    };

    // Listener for active checkboxes
    const activeChangeEvents = [];
    for(let i=1; i<=8; i++) activeChangeEvents.push(`change:part_${i}_active`);

    on(activeChangeEvents.join(" ") + " change:level change:character_type sheet:opened", () => {
        updateXPReward();
    });

    // --- Mirror Link Attribute ---
    const linkChangeEvents = partIndices.map(i => `change:part_${i}_stagger_link`).join(" ");
    on(linkChangeEvents + " sheet:opened", (eventInfo) => {
        if (eventInfo && eventInfo.sourceAttribute) {
            const source = eventInfo.sourceAttribute;
            const match = source.match(/part_(\d+)_/);
            if(match) {
                const i = match[1];
                const val = eventInfo.newValue;
                setAttrs({ [`part_${i}_stagger_link_view`]: val });
            }
        } else {
            // on sheet:opened, sync all link views
            const attrsToGet = partIndices.map(i => `part_${i}_stagger_link`);
            getAttrs(attrsToGet, (v) => {
                const update = {};
                partIndices.forEach(i => {
                    update[`part_${i}_stagger_link_view`] = v[`part_${i}_stagger_link`] || "";
                });
                setAttrs(update);
            });
        }
    });

    // --- Part Stagger Logic (4-12) ---
    // Listen for changes in Parts (HP, Max, Tremor, Link) and Stagger Configs (4-12)
    const partEvents = [];
    partIndices.forEach(i => {
        partEvents.push(`change:part_${i}_hp`);
        partEvents.push(`change:part_${i}_hp_max`);
        partEvents.push(`change:part_${i}_tremor`);
        partEvents.push(`change:part_${i}_stagger_link`);
    });
    abnoStaggerIndices.forEach(i => {
        partEvents.push(`change:stagger_${i}_percent`);
        partEvents.push(`change:stagger_${i}_active`);
    });

    on(partEvents.join(" ") + " sheet:opened", () => {
        const attrsToGet = [];
        // Parts
        partIndices.forEach(i => {
            attrsToGet.push(`part_${i}_hp`);
            attrsToGet.push(`part_${i}_hp_max`);
            attrsToGet.push(`part_${i}_tremor`);
            attrsToGet.push(`part_${i}_stagger_link`);
        });
        // Staggers
        abnoStaggerIndices.forEach(i => {
            attrsToGet.push(`stagger_${i}_percent`);
            attrsToGet.push(`stagger_${i}_active`);
        });

        getAttrs(attrsToGet, (v) => {
            const update = {};

            // Helper: Find which Part is linked to Stagger Y
            // Map Stagger ID -> Part Index (Allows multiple stagger levels per part)
            const staggerMap = {};
            partIndices.forEach(i => {
                // Now a string input like "4 5 10"
                const linkStr = (v[`part_${i}_stagger_link`] || "").toString();
                // Split by spaces, commas, or other delimiters
                const linkIds = linkStr.split(/[\s,;]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));

                linkIds.forEach(link => {
                     if (link >= 4 && link <= 12) {
                        staggerMap[link] = i;
                    }
                });
            });

            // Calculate Stagger 4-12
            abnoStaggerIndices.forEach(sID => {
                const partID = staggerMap[sID];

                // Defaults if unassigned
                let tBase = 0;
                let tEff = 0;
                let max = 0;
                let hp = 0;

                if (partID) {
                    const percent = parseIntOr0(v[`stagger_${sID}_percent`]);
                    const isActive = v[`stagger_${sID}_active`] == "1";
                    max = parseIntOr0(v[`part_${partID}_hp_max`]);
                    hp = parseIntOr0(v[`part_${partID}_hp`]);
                    const tremor = parseIntOr0(v[`part_${partID}_tremor`]);

                    tBase = Math.floor(max * (percent / 100));
                    tEff = tBase;
                    if (isActive) tEff += tremor;

                    // Update Position (Global input used for CSS left%)
                    let pos = 0;
                    if(max > 0) pos = Math.floor((tEff / max) * 100);
                    if(pos < 0) pos = 0;
                    if(pos > 100) pos = 100;

                    update[`stagger_${sID}_value`] = tEff;
                    update[`stagger_${sID}_pos`] = pos;

                    // Check Break
                    if (isActive && percent > 0 && hp <= tEff) {
                        update[`stagger_${sID}_active`] = "0";
                        update[`part_${partID}_tremor`] = 0; // Reset tremor on break
                    }
                }
            });

            setAttrs(update);
        });
    });

    // Toggle Parts Editor
    on('clicked:toggle_parts_editor', () => {
        getAttrs(['show_parts_editor'], (v) => {
            const current = parseIntOr0(v.show_parts_editor);
            const next = current === 1 ? "0" : "1";
            setAttrs({
                show_parts_editor: next
            });
        });
    });


    // Type URL Change Logic
    const typeChangeEvents = [];
    for(let i=1; i<=8; i++) {
        typeChangeEvents.push(`change:part_${i}_type_url`);
    }

    on(typeChangeEvents.join(" "), (eventInfo) => {
        if (!eventInfo || !eventInfo.sourceAttribute) return;
        const source = eventInfo.sourceAttribute;
        const match = source.match(/part_(\d+)_/);
        if (match) {
            const i = match[1];
            const val = eventInfo.newValue;
            const update = {};
            if (val && val.includes("gvomn3Z")) { // Destructible
                update[`part_${i}_destructible`] = "1";
                update[`part_${i}_severable`] = "0";
            } else if (val && val.includes("CcEEbCw")) { // Severable
                update[`part_${i}_destructible`] = "0";
                update[`part_${i}_severable`] = "1";
            }
            setAttrs(update);
        }
    });

// --- Navigation Tabs ---
const tabs = ['home', 'stats', 'banco', 'skills', 'abilities', 'parts', 'profile', 'apego', 'vitals', 'settings'];
tabs.forEach(tab => {
    on(`clicked:tab_${tab}`, function() {
        setAttrs({
            tab: tab
        });
    });
});

// --- Inventory Modal Logic ---
window.addEventListener('DOMContentLoaded', () => {
    const invBtn = document.getElementById('btn-global-inventory');
    const invModal = document.getElementById('inventory-modal');
    const invClose = document.getElementById('inventory-modal-close');
    const invTabBtns = document.querySelectorAll('.inv-tab-btn');
    const invTabContents = document.querySelectorAll('.inventory-tab-content');

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

    // --- Mock Data & Rendering for Inventory Grids ---
    const mockItems = [
        { id: 1, name: "Balas LCB", tier: "I", cost: 10, tags: ["Consumible", "Munición"], desc: "Balas estándar emitidas por Limbus Company. Son baratas, confiables y matan lo que tengan en frente, la mayoría de las veces.", img: "https://i.imgur.com/yshLPnQ.png", cant: 30 },
        { id: 2, name: "Cuchillo Térmico", tier: "II", cost: 150, tags: ["Arma", "Burn"], desc: "Una hoja que alcanza altas temperaturas. Cauteriza la herida al mismo tiempo que corta. Muy usada en los callejones traseros.", img: "https://i.imgur.com/Akf25L5.png", cant: 1 },
        { id: 3, name: "Inyector de Enkephalina", tier: "III", cost: 500, tags: ["Medicina", "SP", "Peligro"], desc: "Un tubo brillante verde. Restaura cordura al instante, pero el abuso de esta sustancia te dejará babeando en un rincón.", img: "https://i.imgur.com/DCTX5Jy.png", cant: 3 },
        { id: 4, name: "Módulo Cibernético Roto", tier: "I", cost: 25, tags: ["Chatarra", "Crafting"], desc: "Un pedazo de tecnología que fue arrancado de un cíborg menos afortunado. Todavía tiene algo de cobre aprovechable.", img: "https://i.imgur.com/0KArwDU.png", cant: 5 }
    ];

    function renderInventoryGrid(gridId, items) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        grid.innerHTML = '';

        // Fill slots with items
        items.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'item-slot';
            slot.innerHTML = `
                <img src="${item.img}" alt="${item.name}" />
                <div class="item-quantity">x${item.cant}</div>
            `;

            slot.addEventListener('click', () => {
                // Remove active from all slots
                document.querySelectorAll('.item-slot').forEach(s => s.classList.remove('active'));
                slot.classList.add('active');

                // Show detail card
                const detailCard = document.getElementById('item-detail-card');
                detailCard.classList.add('active');

                // Populate data
                document.getElementById('detail-icon').src = item.img;
                document.getElementById('detail-tier-val').innerText = item.tier;
                document.getElementById('detail-cost-val').innerText = item.cost;
                document.getElementById('detail-title').innerText = item.name;
                document.getElementById('detail-desc').innerText = item.desc;

                const tagsContainer = document.getElementById('detail-tags-val');
                tagsContainer.innerHTML = '';
                item.tags.forEach(tag => {
                    const t = document.createElement('span');
                    t.className = 'detail-tag';
                    t.innerText = `[${tag}]`;
                    tagsContainer.appendChild(t);
                });
            });

            grid.appendChild(slot);
        });

        // Fill remaining empty slots up to 25 to make it look like a grid
        const emptySlotsNeeded = Math.max(0, 25 - items.length);
        for(let i = 0; i < emptySlotsNeeded; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'item-slot';
            grid.appendChild(emptySlot);
        }
    }

    renderInventoryGrid('inv-active-grid', mockItems.slice(0, 2)); // Just 2 in active
    renderInventoryGrid('inv-stash-grid', mockItems); // All in stash

    // --- Dynamic Shop System Logic ---
    const shopSelector = document.getElementById('shop-selector');
    const invShopGrid = document.getElementById('inv-shop-grid');
    let currentShopsData = {};

    if (shopSelector && invShopGrid && window.db) {
        // 1. Fetch shops from Firebase
        db.ref('campaña/tiendas').on('value', (snapshot) => {
            currentShopsData = snapshot.val() || {};

            // Re-populate selector keeping the current selection if possible
            const selectedShopId = shopSelector.value;
            shopSelector.innerHTML = '<option value="">Selecciona una tienda...</option>';

            for (const [idTienda, tiendaData] of Object.entries(currentShopsData)) {
                const opt = document.createElement('option');
                opt.value = idTienda;
                opt.innerText = `${tiendaData.nombre} (Restock: ${tiendaData.dia_restock})`;
                if (idTienda === selectedShopId) opt.selected = true;
                shopSelector.appendChild(opt);
            }

            // Force re-render of current shop
            renderShopItems(selectedShopId);
        });

        // 2. Render items on selection change
        shopSelector.addEventListener('change', (e) => {
            renderShopItems(e.target.value);
        });

        function renderShopItems(shopId) {
            invShopGrid.innerHTML = '';
            if (!shopId || !currentShopsData[shopId] || !currentShopsData[shopId].items) {
                invShopGrid.innerHTML = '<div style="color: #666; width: 100%; text-align: center; padding: 20px;">Sin ítems disponibles.</div>';
                return;
            }

            const items = currentShopsData[shopId].items;
            for (const [itemId, itemData] of Object.entries(items)) {
                let stockDisplay = itemData.stock_actual === -1 ? '∞ Ilimitado' : itemData.stock_actual;
                let isAgotado = itemData.stock_actual === 0;

                const itemCard = document.createElement('div');
                itemCard.className = 'inv-shop-item';
                itemCard.innerHTML = `
                    <div class="inv-shop-item-name" style="color: #FFD700; font-size: 1.1em; text-shadow: 0 0 5px rgba(196,154,0,0.5);">${itemData.nombre}</div>
                    <div style="font-size: 0.8em; color: #aaa;">[${itemData.tipo}]</div>
                    <div class="inv-shop-item-price" style="color: #0df; font-weight: bold; margin: 5px 0;">${itemData.costo} Ahn</div>
                    <div style="font-size: 0.85em; color: ${isAgotado ? '#ff4444' : '#fff'}; margin-bottom: 10px;">Stock: ${stockDisplay}</div>
                    <button class="inv-shop-buy-btn" data-shop-id="${shopId}" data-item-id="${itemId}" ${isAgotado ? 'disabled style="background:#555; cursor:not-allowed;"' : 'style="background:var(--green-success); color:#000;"'}>
                        ${isAgotado ? 'AGOTADO' : 'COMPRAR'}
                    </button>
                `;
                invShopGrid.appendChild(itemCard);
            }
        }

        // 3. Purchase Logic via Event Delegation
        invShopGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('inv-shop-buy-btn') && !e.target.disabled) {
                const shopId = e.target.getAttribute('data-shop-id');
                const itemId = e.target.getAttribute('data-item-id');

                const characterNameInput = document.querySelector('input[name="attr_character_name"]');
                const ahnInput = document.querySelector('input[name="attr_ahn"]');

                if (!characterNameInput || !ahnInput) {
                    alert("Error: No se encuentra la hoja de personaje (Falta Nombre o Ahn).");
                    return;
                }

                const playerName = characterNameInput.value.trim();
                const currentAhn = parseInt(ahnInput.value) || 0;

                if (!playerName) {
                    alert("El personaje necesita un nombre para comprar.");
                    return;
                }

                // Verify item exists and check stock locally first to avoid unnecessary writes
                const itemData = currentShopsData[shopId]?.items?.[itemId];
                if (!itemData) {
                    alert("Error: Ítem no encontrado.");
                    return;
                }

                if (itemData.stock_actual === 0) {
                    alert("AGOTADO");
                    return;
                }

                if (currentAhn < itemData.costo) {
                    alert("FONDOS INSUFICIENTES");
                    return;
                }

                // Deduct locally and trigger standard sync
                const newAhn = currentAhn - itemData.costo;
                if (window.setAttrs) {
                    window.setAttrs({ ahn: newAhn });
                } else {
                    ahnInput.value = newAhn;
                    const displays = document.querySelectorAll('span[name="attr_ahn_display"]');
                    displays.forEach(el => el.innerText = newAhn.toLocaleString('en-US'));
                }

                // Update Firebase Stock
                const stockRef = db.ref(`campaña/tiendas/${shopId}/items/${itemId}/stock_actual`);
                if (itemData.stock_actual !== -1) {
                    stockRef.transaction(currentStock => {
                        if (currentStock === null || currentStock <= 0) return 0;
                        return currentStock - 1;
                    });
                }

                // Add to Player's Inventory (Stash)
                db.ref(`campaña/jugadores/${playerName}/inventario_stash`).push(itemData);

                // Add Transaction Log
                db.ref(`campaña/jugadores/${playerName}/transacciones`).push({
                    monto: -itemData.costo,
                    concepto: `Compra - ${itemData.nombre}`,
                    timestamp: Date.now()
                });

                // Small visual feedback on the button
                const originalText = e.target.innerText;
                const originalBg = e.target.style.background;
                e.target.innerText = "¡COMPRADO!";
                e.target.style.background = "#00ffff";
                setTimeout(() => {
                    if(e.target) {
                        e.target.innerText = originalText;
                        e.target.style.background = originalBg;
                    }
                }, 1000);
            }
        });
    }
});
