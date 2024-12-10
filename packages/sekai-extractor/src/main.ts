import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import fs from "fs";
import crypto from "uncrypto";
import { api, SekaiClientContext } from "./client";
import { BaseSekaiClientData } from "./models";

Effect.runPromise(
  Effect.gen(function* () {
    yield* api.signature.refreshSignature();
    yield* api.api.updateSystemInfo();
    yield* api.api.newUser();

    fs.writeFileSync(
      "data_agreement.json",
      JSON.stringify(yield* api.api.ruleAgreement()),
    );

    yield* api.api.auth();
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeHttpClient.layer),
    Effect.provideServiceEffect(
      SekaiClientContext,
      Effect.gen(function* () {
        return yield* SekaiClientContext.make(
          yield* Schema.decodeUnknown(BaseSekaiClientData)({
            device: {
              platform: "iOS",
              deviceModel: "iPad12,1",
              operatingSystem: "iPadOS 17.0",
              userAgent:
                "ProductName/211 CFNetwork/1568.100.1.2.1 Darwin/24.0.0",
              unityVersion: "2022.3.21f1",
            },
            domains: {
              api: "production-game-api.sekai.colorfulpalette.org",
              assetBundle: "{0}-{1}-assetbundle.sekai.colorfulpalette.org",
              assetBunddleInfo:
                "{0}-{1}-assetbundle-info.sekai.colorfulpalette.org",
              gameVersion: "game-version.sekai.colorfulpalette.org",
              signature: "issue.sekai.colorfulpalette.org",
            },
            versions: {
              appHash: "cbda2f12-c804-4163-5e11-3148631f9ab0",
              appVersion: "4.1.0",
              assetVersion: "4.1.0.30",
              dataVersion: "4.1.0.10",
            },
            installId: crypto.randomUUID() as string,
            kc: crypto.randomUUID() as string,
            key: "",
            iv: "",
            sessionToken: "",
          }),
        );
      }),
    ),
  ),
);
