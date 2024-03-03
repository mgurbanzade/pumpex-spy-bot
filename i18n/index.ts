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
  // Set the default language
  lng: "en",
  fallbackLng: "en",
  debug: false,
  keySeparator: "true", // Set to true if using keys in form 'message.key'
  nsSeparator: false, // Set to true if using namespaces
  interpolation: {
    escapeValue: false, // Not needed for React
  },
});

export default i18next;
