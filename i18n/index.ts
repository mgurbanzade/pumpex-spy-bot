import i18next from "i18next";
import en from "./translations/en.json";
import ru from "./translations/ru.json";
import ua from "./translations/ua.json";

i18next.init({
  resources: {
    en: {
      translation: en,
    },
    ru: {
      translation: ru,
    },
    ua: {
      translation: ua,
    },
  },
  lng: "en",
  fallbackLng: "en",
  debug: false,
  keySeparator: "true",
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
