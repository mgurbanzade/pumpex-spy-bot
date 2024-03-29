import i18next from "i18next";
import en from "./translations/en.json";
import ru from "./translations/ru.json";
import ua from "./translations/ua.json";
import { Language } from "@prisma/client";

i18next.init({
  resources: {
    EN: {
      translation: en,
    },
    RU: {
      translation: ru,
    },
    UA: {
      translation: ua,
    },
  },
  lng: Language.EN,
  fallbackLng: Language.EN,
  debug: false,
  keySeparator: "true",
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
