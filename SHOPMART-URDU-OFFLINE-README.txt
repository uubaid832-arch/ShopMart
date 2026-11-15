ShopMart offline Urdu language files
====================================

What this changes
- The web and Expo mobile apps use bundled English-to-Urdu phrase dictionaries.
- The dictionaries are checked into the apps and work without an Internet request.
- The Google Translate backend endpoint and its API-key configuration are disabled.
- No Azure account, translation key, paid subscription, backend secret, or database
  migration is needed for this language toggle.

Install
1. Extract this ZIP into the root of your ShopMart project and allow files to merge.
   The ZIP keeps the original apps/... and backend/... paths.
2. Rebuild/deploy the web app and backend as usual. Rebuild the Expo app to include
   the bundled mobile dictionary.
3. No Render or Neon translation setting is required. If GOOGLE_TRANSLATE_API_KEY
   was added only for ShopMart translations, it is no longer used and can be removed.

Web checks
  cd apps/web
  npm install
  npm run lint
  npm run build

Mobile start (after dependencies are installed)
  cd apps/mobile
  npm install
  npx expo start -c

Backend package (Windows PowerShell)
  cd backend/shopmart-api
  .\mvnw.cmd -DskipTests package

Scope and limitations
- The bundle contains 2,053 UI phrases gathered from the current ShopMart web and
  mobile source, plus hand-edited common ShopMart labels.
- Product titles, customer-written reviews, names, and other new/custom text that
  is not in the dictionary remains in English. Add a key and Urdu value to both
  apps/web/src/i18n/urduTranslations.json and
  apps/mobile/src/i18n/urduTranslations.json to translate newly added UI text.
- The machine-generated phrases are approximate Urdu. Review them with a fluent
  Urdu speaker before production use. Common storefront/admin terms were manually
  corrected in the included dictionary.

Attribution
- The offline phrase translations were generated with the English-to-Urdu
  OPUS-MT model packaged by Argos Translate. The model documentation identifies
  the original OPUS model as CC BY 4.0. The model itself is not shipped in this
  ZIP; only the generated phrase dictionary is included.
- OPUS model information: https://community.libretranslate.com/t/opus-mt-language-models-port-thread/757/
