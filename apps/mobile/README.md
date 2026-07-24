# Mafundi Mtaani mobile

Expo/React Native client for Android and iOS. It uses the same FastAPI backend and preserves role-sensitive navigation.

```bash
npm install
npm run start
```

Set `expo.extra.apiUrl` in `app.json` for each environment. Authentication tokens belong in Expo SecureStore; push tokens register through `POST /v1/devices`.
