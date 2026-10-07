import { ExpoConfig, ConfigContext } from "expo/config";
import baseConfig from "./app.json";

// Project ID of the NEW Expo account (thakur1122 / dhanraj-enterprises).
const EAS_PROJECT_ID = "46b6869d-c499-4e7e-a7b1-e521b8934605";

export default ({ config }: ConfigContext): ExpoConfig => {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
    (replitDomain ? `https://${replitDomain}` : "https://app.thdhanraj.co.in");

  const origin = replitDomain
    ? `https://${replitDomain}:3001`
    : "https://app.thdhanraj.co.in";

  const androidVersionCode = process.env.ANDROID_VERSION_CODE
    ? parseInt(process.env.ANDROID_VERSION_CODE, 10)
    : baseConfig.expo.android?.versionCode;

  const appVersion = process.env.APP_VERSION_NAME || baseConfig.expo.version;

  return {
    ...baseConfig.expo,
    owner: "thakur1122",
    version: appVersion,
    android: {
      ...baseConfig.expo.android,
      versionCode: androidVersionCode,
    },
    extra: {
      ...baseConfig.expo.extra,
      apiUrl,
      router: {
        origin,
        headOrigin: origin,
      },
      // Replace the old account's project ID (inherited from app.json)
      eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : {},
    },
  };
};
