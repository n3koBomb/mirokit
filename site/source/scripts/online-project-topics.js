// Stable topic IDs shared by the public gallery, admin editor and Worker.
export const ONLINE_PROJECT_TOPICS = [
  {
    "id": "drawing",
    "icon": "fa-palette",
    "label": "Zeichnen"
  },
  {
    "id": "photo",
    "icon": "fa-camera",
    "label": "Künstlerische Fotografie"
  },
  {
    "id": "video",
    "icon": "fa-video",
    "label": "Videobeiträge"
  },
  {
    "id": "reading",
    "icon": "fa-book-open-reader",
    "label": "Künstlerisches Lesen"
  },
  {
    "id": "essay",
    "icon": "fa-pen-nib",
    "label": "Essay und literarisches Schaffen"
  },
  {
    "id": "poetry",
    "icon": "fa-feather-pointed",
    "label": "Eigene Gedichte"
  },
  {
    "id": "stories",
    "icon": "fa-book",
    "label": "Geschichten und Märchen"
  },
  {
    "id": "crafts",
    "icon": "fa-shapes",
    "label": "Dekorative und angewandte Kunst"
  },
  {
    "id": "music",
    "icon": "fa-music",
    "label": "Musik und Vokalkunst"
  },
  {
    "id": "theatre",
    "icon": "fa-masks-theater",
    "label": "Theatralische Mini-Inszenierungen"
  }
];

export const isOnlineProjectTopic = (value) => ONLINE_PROJECT_TOPICS.some((topic) => topic.id === value);
