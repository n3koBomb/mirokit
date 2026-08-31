/*
 * Canonical MIRoKIT news data.
 *
 * featured: 1, 2, 3 ... manually orders an item within the current hero collage.
 * featured: false lets the publication date decide its position.
 * Future publishedAt dates stay out of the public feed until they are current.
 */
const MIRoKIT_NEWS = [
   {
      id: "online-drawing-competition",
      publishedAt: "2026-08-01",
      category: "event",
      accent: "blue",
      image: "./public/assets/images/news/online-course_painting_01-08-26.png",
      featured: 1,
      alt: {
         ru: "Афиша международного онлайн-конкурса рисунков МИРоКИТ",
         en: "Poster for the international MIRoKIT online drawing competition",
         de: "Plakat des internationalen Online-Zeichenwettbewerbs MIRoKIT",
      },
      categoryLabel: {
         ru: "События",
         en: "Events",
         de: "Veranstaltungen",
      },
      title: {
         ru: "Онлайн-конкурс рисунков Международной Лиги «МИРоКИТ»",
         en: "Online drawing competition of the International MIRoKIT League",
         de: "Online-Zeichenwettbewerb der Internationalen MIRoKIT-Liga",
      },
      summary: {
         ru: "С 1 августа 2026 года Международная Лига «МИРоКИТ» объявляет о старте Международного онлайн-конкурса рисунков!",
         en: "The International MIRoKIT League launches its international online drawing competition on 1 August 2026.",
         de: "Am 1. August 2026 startet die Internationale MIRoKIT-Liga ihren internationalen Online-Zeichenwettbewerb.",
      },
      content: {
         ru: [
            "В конкурсе примут участие представители Беларуси, Германии, Ганы, Испании, России, Финляндии, Франции и Японии. Мы уверены, что география проекта будет расширяться, а число участников — расти с каждым годом.",
            "Конкурс проводится в онлайн-формате, поэтому принять участие можно из любой точки мира. Для этого достаточно оформить заявку и направить электронную копию конкурсной работы в соответствии с Положением о конкурсе.",
            "По итогам конкурса международное жюри определит победителей в различных возрастных категориях. Работы будут опубликованы на официальном сайте и в социальных сетях Международной Лиги «МИРоКИТ», а их авторы получат дипломы, сертификаты и памятные награды.",
            "Мы верим, что творчество объединяет людей, а детские рисунки способны говорить на языке, понятном во всем мире. «МИРоКИТ» — рисуем мир вместе!",
         ],
         en: [
            "Participants from Belarus, Germany, Ghana, Spain, Russia, Finland, France and Japan will take part. We expect the project's geography and the number of participants to grow every year.",
            "The competition is online, so people can join from anywhere in the world. Participants only need to submit an application and send a digital copy of their work according to the competition rules.",
            "An international jury will select winners in several age categories. Works will be published on the International MIRoKIT League website and social channels, while authors will receive diplomas, certificates and commemorative awards.",
            "We believe creativity brings people together and that children's drawings can speak a language understood around the world. MIRoKIT — drawing the world together!",
         ],
         de: [
            "Teilnehmende aus Belarus, Deutschland, Ghana, Spanien, Russland, Finnland, Frankreich und Japan werden dabei sein. Wir erwarten, dass die Geografie des Projekts und die Zahl der Teilnehmenden jedes Jahr wachsen.",
            "Der Wettbewerb findet online statt, sodass eine Teilnahme von überall auf der Welt möglich ist. Dafür reicht es, eine Anmeldung einzureichen und eine digitale Kopie der Arbeit gemäß den Wettbewerbsregeln zu senden.",
            "Eine internationale Jury bestimmt die Gewinnerinnen und Gewinner in mehreren Altersgruppen. Die Arbeiten werden auf der Website und in den sozialen Netzwerken der Internationalen MIRoKIT-Liga veröffentlicht; die Autorinnen und Autoren erhalten Diplome, Zertifikate und Erinnerungspräsente.",
            "Wir glauben, dass Kreativität Menschen verbindet und Kinderzeichnungen eine weltweit verständliche Sprache sprechen können. MIRoKIT — wir zeichnen die Welt gemeinsam!",
         ],
      },
   },
   {
      id: "dusseldorf-game",
      publishedAt: "2026-07-10",
      category: "event",
      accent: "blue",
      image: "./public/assets/images/news/turnir_dus_10-07-26.png",
      featured: 2,
      alt: {
         ru: "Игра МИРоКИТ в Дюссельдорфе",
         en: "MIRoKIT game in Düsseldorf",
         de: "MIRoKIT-Spiel in Düsseldorf",
      },
      categoryLabel: {
         ru: "События",
         en: "Events",
         de: "Veranstaltungen",
      },
      title: {
         ru: "В Дюссельдорфе состоялась игра «МИРоКИТ»",
         en: "A MIRoKIT game took place in Düsseldorf",
         de: "In Düsseldorf fand ein MIRoKIT-Spiel statt",
      },
      summary: {
         ru: "10 июля 2026 года в Дюссельдорфе (Германия) прошла игра и шахматный турнир Международного культурно-игрового триатлона «МИРоКИТ».",
         en: "On 10 July 2026, a MIRoKIT game and chess tournament took place in Düsseldorf, Germany.",
         de: "Am 10. Juli 2026 fanden in Düsseldorf ein MIRoKIT-Spiel und ein Schachturnier statt.",
      },
      content: {
         ru: [
            "10 июля 2026 года в Дюссельдорфе (Германия) прошла игра и шахматный турнир Международного культурно-игрового триатлона «МИРоКИТ». Мероприятие собрало юных любителей шахмат, их родителей и гостей.",
            "Турнир проходил в атмосфере дружбы и честного соперничества. За шахматными досками участники демонстрировали знания, игровые навыки, спокойствие и умение принимать взвешенные решения. Каждая партия была по-своему интересной, а борьба продолжалась до последнего тура.",
            "Лучшие игроки получили кубки, дипломы и памятные подарки, а все участники были отмечены за старание и спортивный настрой. Такие встречи помогают находить новых друзей и открывать для себя Мир через игру.",
            "До новых встреч на турнирах и мероприятиях «МИРоКИТ»! Вместе мы доказываем, что игра объединяет людей, а дружба не знает границ.",
         ],
         en: [
            "On 10 July 2026, a game and chess tournament of the International Cultural-Game Triathlon «MIRoKIT» took place in Düsseldorf, Germany. The event brought together young chess enthusiasts, their parents and guests.",
            "The tournament was filled with friendship and fair competition. At the chessboards, participants showed knowledge, patience and the ability to make thoughtful decisions. Every game had its own story, with the competition lasting until the final round.",
            "The best players received cups, diplomas and commemorative gifts, while every participant was recognised for effort and sporting spirit. Meetings like this help young people make friends and discover the world through play.",
            "We look forward to meeting again at MIRoKIT tournaments and events. Together we show that play brings people together and friendship knows no borders.",
         ],
         de: [
            "Am 10. Juli 2026 fanden in Düsseldorf ein Spiel und ein Schachturnier des Internationalen Kultur-Spiel-Triathlons «MIRoKIT» statt. Die Veranstaltung brachte junge Schachbegeisterte, ihre Eltern und Gäste zusammen.",
            "Das Turnier war von Freundschaft und fairem Wettbewerb geprägt. An den Schachbrettern zeigten die Teilnehmenden Wissen, Ruhe und die Fähigkeit, überlegte Entscheidungen zu treffen. Jede Partie war auf ihre eigene Weise spannend, und der Wettbewerb dauerte bis zur letzten Runde.",
            "Die besten Spielerinnen und Spieler erhielten Pokale, Diplome und Erinnerungspräsente. Alle Teilnehmenden wurden für ihren Einsatz und ihre sportliche Haltung gewürdigt. Solche Treffen helfen, neue Freundschaften zu schließen und die Welt durch das Spiel zu entdecken.",
            "Wir freuen uns auf weitere MIRoKIT-Turniere und Veranstaltungen. Gemeinsam zeigen wir, dass Spiel Menschen verbindet und Freundschaft keine Grenzen kennt.",
         ],
      },
   },
   {
      id: "summer-camp-report",
      publishedAt: "2025-05-18",
      category: "photo",
      accent: "green",
      image: "./public/assets/gallery/example.png",
      featured: 3,
      alt: {
         ru: "Фоторепортаж о летнем лагере МИРоКИТ в Германии",
         en: "Photo report from the MIRoKIT summer camp in Germany",
         de: "Fotoreportage aus dem MIRoKIT-Sommercamp in Deutschland",
      },
      categoryLabel: {
         ru: "Фоторепортаж",
         en: "Photo report",
         de: "Fotoreportage",
      },
      title: {
         ru: "Фоторепортаж с летнего лагеря в Германии",
         en: "Photo report from the summer camp in Germany",
         de: "Fotoreportage aus dem Sommercamp in Deutschland",
      },
      summary: {
         ru: "Десять дней у озера: командные игры, вечерние костры и первый совместный спектакль лагерной смены.",
         en: "Ten days by the lake: team games, evening campfires and the first shared camp performance.",
         de: "Zehn Tage am See: Teamspiele, Lagerfeuer am Abend und die erste gemeinsame Aufführung.",
      },
      content: {
         ru: [
            "Летний лагерь собрал участников из трёх стран на десять дней у озера: утро начиналось с разминки и языковых игр, день — с командных заданий, а вечер — с общего костра.",
            "Кульминацией смены стал спектакль, который дети поставили сами — на трёх языках сразу, с переводом жестами и минимумом декораций, но максимумом эмоций.",
         ],
         en: [
            "The summer camp brought participants from three countries together for ten days by the lake. Mornings began with warm-ups and language games, days continued with team challenges and evenings ended around a shared campfire.",
            "The highlight was a performance created by the children themselves — in three languages, with sign-based translation and very few props, but a great deal of emotion.",
         ],
         de: [
            "Das Sommercamp brachte Teilnehmende aus drei Ländern zehn Tage lang an einem See zusammen. Der Morgen begann mit Aufwärmübungen und Sprachspielen, der Tag mit Teamaufgaben und der Abend am gemeinsamen Lagerfeuer.",
            "Der Höhepunkt war eine Aufführung, die die Kinder selbst entwickelten — gleichzeitig in drei Sprachen, mit Übersetzung durch Gesten und wenigen Requisiten, aber mit umso mehr Emotionen.",
         ],
      },
   },
   {
      id: "winter-cup-announcement",
      publishedAt: "2025-05-10",
      category: "announce",
      accent: "violet",
      image: "./public/assets/gallery/example.png",
      featured: false,
      alt: {
         ru: "Анонс зимнего кубка МИРоКИТ",
         en: "Announcement for the MIRoKIT Winter Cup",
         de: "Ankündigung des MIRoKIT-Winterpokals",
      },
      categoryLabel: {
         ru: "Анонсы",
         en: "Announcements",
         de: "Ankündigungen",
      },
      title: {
         ru: "Анонс: зимний кубок МИРоКИТ пройдёт в январе",
         en: "Announcement: the MIRoKIT Winter Cup takes place in January",
         de: "Ankündigung: Der MIRoKIT-Winterpokal findet im Januar statt",
      },
      summary: {
         ru: "Регистрация команд уже открыта — расскажем, что нового в правилах и почему в этот раз будет сложнее.",
         en: "Team registration is open. We will share what is new in the rules and why this edition will be more challenging.",
         de: "Die Teamregistrierung ist geöffnet. Wir berichten über neue Regeln und warum diese Ausgabe anspruchsvoller wird.",
      },
      content: {
         ru: [
            "Зимний кубок МИРоКИТ пройдёт в январе — уже третий год подряд. В этот раз организаторы добавили новый этап: командную викторину по культурному коду разных стран.",
            "Регистрация открыта до конца ноября, количество мест в каждой возрастной группе ограничено. Подробности можно узнать в разделе «Контакты» или через форму на сайте.",
         ],
         en: [
            "The MIRoKIT Winter Cup will take place in January for the third year in a row. This time, the organisers have added a new stage: a team quiz about the cultural codes of different countries.",
            "Registration is open until the end of November, with a limited number of places in each age group. More information is available in the Contact section or through the website form.",
         ],
         de: [
            "Der MIRoKIT-Winterpokal findet im Januar bereits zum dritten Mal in Folge statt. Dieses Mal haben die Organisatoren eine neue Etappe ergänzt: ein Team-Quiz über die kulturellen Codes verschiedener Länder.",
            "Die Anmeldung ist bis Ende November geöffnet, die Plätze in jeder Altersgruppe sind begrenzt. Weitere Informationen gibt es im Bereich «Kontakt» oder über das Formular auf der Website.",
         ],
      },
   },
   {
      id: "tunisia-project-interview",
      publishedAt: "2025-05-03",
      category: "interview",
      accent: "red",
      image: "./public/assets/gallery/example.png",
      featured: false,
      alt: {
         ru: "Участники проекта МИРоКИТ в Тунисе",
         en: "MIRoKIT project participants in Tunisia",
         de: "Teilnehmende des MIRoKIT-Projekts in Tunesien",
      },
      categoryLabel: {
         ru: "Интервью",
         en: "Interview",
         de: "Interview",
      },
      title: {
         ru: "Участники поделились впечатлениями после проекта в Тунисе",
         en: "Participants share impressions after the project in Tunisia",
         de: "Teilnehmende berichten vom Projekt in Tunesien",
      },
      summary: {
         ru: "«Я думал, что еду просто в лагерь, а нашёл друзей на всю жизнь» — говорят подростки из первой тунисской смены.",
         en: "“I thought I was simply going to a camp, but I found friends for life,” say teenagers from the first Tunisian session.",
         de: "„Ich dachte, ich fahre einfach in ein Camp, aber ich habe Freunde fürs Leben gefunden“, sagen Jugendliche der ersten tunesischen Gruppe.",
      },
      content: {
         ru: [
            "Первая смена на новой тунисской площадке завершилась в апреле — мы спросили самих участников, что запомнилось больше всего.",
            "Почти все называют одно и то же: неожиданно быстро исчезающий языковой барьер, общие игры допоздна и желание вернуться уже в следующем сезоне.",
         ],
         en: [
            "The first session at the new Tunisian venue ended in April, so we asked the participants what they remembered most.",
            "Almost everyone mentioned the same things: the language barrier disappearing surprisingly quickly, shared games lasting late into the evening and the wish to return next season.",
         ],
         de: [
            "Die erste Gruppe am neuen tunesischen Standort endete im April. Wir haben die Teilnehmenden gefragt, was ihnen besonders in Erinnerung geblieben ist.",
            "Fast alle nannten dasselbe: Die Sprachbarriere verschwand überraschend schnell, gemeinsame Spiele dauerten bis spät am Abend und alle möchten in der nächsten Saison wiederkommen.",
         ],
      },
   },
   {
      id: "russia-cultural-exchange",
      publishedAt: "2025-04-20",
      category: "event",
      accent: "blue",
      image: "./public/assets/gallery/example.png",
      featured: false,
      alt: {
         ru: "Культурный обмен МИРоКИТ в России",
         en: "MIRoKIT cultural exchange in Russia",
         de: "Kulturaustausch von MIRoKIT in Russland",
      },
      categoryLabel: {
         ru: "События",
         en: "Events",
         de: "Veranstaltungen",
      },
      title: {
         ru: "Дружба народов: как прошёл культурный обмен в России",
         en: "Friendship between peoples: cultural exchange in Russia",
         de: "Freundschaft zwischen Völkern: Kulturaustausch in Russland",
      },
      summary: {
         ru: "Неделя встреч, мастер-классов и совместных проектов между российской и немецкой площадками.",
         en: "A week of meetings, workshops and shared projects between Russian and German venues.",
         de: "Eine Woche mit Treffen, Workshops und gemeinsamen Projekten zwischen russischen und deutschen Standorten.",
      },
      content: {
         ru: [
            "В апреле российская площадка МИРоКИТ принимала гостей из Германии — неделя была построена вокруг совместных мастер-классов и небольших командных проектов.",
            "Итогом обмена стала общая выставка работ участников и договорённость о постоянном партнёрстве между площадками на следующий учебный год.",
         ],
         en: [
            "In April, the Russian MIRoKIT venue welcomed guests from Germany. The week was built around shared workshops and small team projects.",
            "The exchange ended with a joint exhibition of the participants' work and an agreement to continue the partnership between the venues during the next school year.",
         ],
         de: [
            "Im April empfing der russische MIRoKIT-Standort Gäste aus Deutschland. Die Woche stand im Zeichen gemeinsamer Workshops und kleiner Teamprojekte.",
            "Den Abschluss bildete eine gemeinsame Ausstellung der Arbeiten sowie die Vereinbarung, die Partnerschaft zwischen den Standorten im nächsten Schuljahr fortzusetzen.",
         ],
      },
   },
];
