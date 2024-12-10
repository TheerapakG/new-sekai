import {
  Cookies,
  HttpBody,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { Decoder, Encoder } from "@msgpack/msgpack";
import {
  Context,
  Effect,
  Option,
  Ref,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import crypto from "uncrypto";
import {
  BaseSekaiClientData,
  NewUser,
  SekaiClientData,
  SystemInfo,
} from "./models";

export class SekaiClientContext extends Context.Tag("SekaiClientContext")<
  SekaiClientContext,
  SubscriptionRef.SubscriptionRef<SekaiClientData>
>() {
  static make = (
    data: BaseSekaiClientData,
  ): Effect.Effect<SubscriptionRef.SubscriptionRef<SekaiClientData>> =>
    Effect.gen(function* () {
      return yield* SubscriptionRef.make({
        ...data,
        cookies: yield* Ref.make(Cookies.empty),
      });
    });
}

const encoder = new Encoder();
const decoder = new Decoder();

const encrypt = (client: SekaiClientData, buffer: Uint8Array) =>
  Effect.gen(function* () {
    const ciphertext = yield* Effect.tryPromise(() =>
      crypto.subtle.encrypt(
        { name: "AES-CBC", iv: client.iv },
        client.key,
        buffer,
      ),
    );
    return new Uint8Array(ciphertext);
  });

const decrypt = (client: SekaiClientData, buffer: Uint8Array) =>
  Effect.gen(function* () {
    const plaintext = yield* Effect.tryPromise(() =>
      crypto.subtle.decrypt(
        { name: "AES-CBC", iv: client.iv },
        client.key,
        buffer,
      ),
    );
    return new Uint8Array(plaintext);
  });

export const makeRequest = (
  client: SekaiClientData,
  request: HttpClientRequest.HttpClientRequest,
  body?: unknown,
) =>
  Effect.gen(function* () {
    if (request.url.includes("agreement") || request.url.includes("auth")) {
      console.log(request.method, request.url, body);
    }
    return request.pipe(
      body
        ? HttpClientRequest.setBody(
            HttpBody.uint8Array(yield* encrypt(client, encoder.encode(body))),
          )
        : HttpClientRequest.setBody(HttpBody.empty),
      HttpClientRequest.setHeaders({
        "User-Agent": "ProductName/211 CFNetwork/1568.100.1.2.1 Darwin/24.0.0",
        Accept: "application/octet-stream",
        "Content-Type": "application/octet-stream",
        "X-Ai": "",
        "X-Ga": "",
        "X-Ma": "",
        "X-Kc": client.kc,
        "X-If": "",
        "X-Devicemodel": client.device.deviceModel,
        "X-Operatingsystem": client.device.operatingSystem,
        "X-Platform": client.device.platform,
        "X-Unity-Version": client.device.unityVersion,
        "X-App-Hash": client.versions.appHash,
        "X-App-Version": client.versions.appVersion,
        "X-Asset-Version": client.versions.assetVersion,
        "X-Data-Version": client.versions.dataVersion,
        "X-Install-Id": client.installId,
        "X-Request-Id": crypto.randomUUID(),
      }),
      client.sessionToken
        ? HttpClientRequest.setHeaders({
            "X-Session-Token": client.sessionToken,
          })
        : HttpClientRequest.setHeaders({}),
    );
  });

export const executeRequest = (
  client: SekaiClientData,
  request: HttpClientRequest.HttpClientRequest,
) =>
  Effect.gen(function* () {
    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.withCookiesRef(client.cookies),
    );
    const response = yield* HttpClient.withTracerPropagation(false)(
      httpClient.execute(request),
    );
    yield* Ref.update(client.cookies, (cookies) =>
      Cookies.merge(
        cookies,
        Cookies.fromSetCookie(response.headers["set-cookie"]?.split(";") ?? []),
      ),
    );
    if (request.url.includes("agreement") || request.url.includes("auth")) {
      console.log(response.status, response.headers);
    }
    if (
      response.headers["content-type"] === "application/json; charset=utf-8"
    ) {
      return {
        headers: response.headers,
        body: yield* response.json,
      };
    }

    const buffer = new Uint8Array(yield* response.arrayBuffer);

    return {
      headers: response.headers,
      body:
        buffer.length > 0
          ? decoder.decode(yield* decrypt(client, buffer))
          : undefined,
    };
  });

export const getBaseSignatureApiUrl = (client: SekaiClientData) =>
  Effect.succeed(`https://${client.domains.signature}`);

export const getBaseApiApiUrl = (client: SekaiClientData) =>
  Effect.succeed(`https://${client.domains.api}`);

export const makeRequestUnsynchronized = (
  request: HttpClientRequest.HttpClientRequest,
  body?: unknown,
) =>
  Effect.gen(function* () {
    const clientRef = yield* SekaiClientContext;
    return yield* makeRequest(
      yield* SubscriptionRef.get(clientRef),
      request,
      body,
    );
  });

export const executeRequestUnsynchronized = (
  request: HttpClientRequest.HttpClientRequest,
) =>
  Effect.gen(function* () {
    const clientRef = yield* SekaiClientContext;
    return yield* executeRequest(
      yield* SubscriptionRef.get(clientRef),
      request,
    );
  });

export const api = {
  signature: {
    refreshSignature: () =>
      Effect.gen(function* () {
        const clientRef = yield* SekaiClientContext;

        yield* SubscriptionRef.updateEffect(clientRef, (client) =>
          Effect.gen(function* () {
            yield* executeRequest(
              client,
              yield* makeRequest(
                client,
                HttpClientRequest.post(
                  `${yield* getBaseSignatureApiUrl(client)}/api/signature`,
                ),
              ),
            );

            return client;
          }),
        );
      }),
  },
  api: {
    updateSystemInfo: () =>
      Effect.gen(function* () {
        const clientRef = yield* SekaiClientContext;

        const result = yield* Ref.make<Option.Option<SystemInfo>>(
          Option.none(),
        );

        yield* SubscriptionRef.updateEffect(clientRef, (client) =>
          Effect.gen(function* () {
            const { body } = yield* executeRequestUnsynchronized(
              yield* makeRequestUnsynchronized(
                HttpClientRequest.get(
                  `${yield* getBaseApiApiUrl(client)}/api/system`,
                ),
              ),
            );

            const decodedBody = yield* Schema.decodeUnknown(SystemInfo)(body);
            yield* Ref.set(result, Option.some(decodedBody));

            return Option.match(
              yield* Stream.runHead(
                Stream.fromIterable(decodedBody.appVersions).pipe(
                  Stream.filter((av) => {
                    if (
                      av.appVersionStatus === "available" &&
                      av.appVersion === client.versions.appVersion
                    ) {
                      return true;
                    }
                    return false;
                  }),
                ),
              ),
              {
                onSome: (av) => {
                  return {
                    ...client,
                    versions: {
                      ...client.versions,
                      appVersion: av.appVersion,
                      assetVersion: av.assetVersion,
                    },
                  };
                },
                onNone: () => client,
              },
            );
          }),
        );

        return yield* (yield* Ref.get(result)).pipe(
          Effect.catchAll((error) => Effect.die(error)),
        );
      }),
    newUser: () =>
      Effect.gen(function* () {
        const clientRef = yield* SekaiClientContext;

        const result = yield* Ref.make<Option.Option<NewUser>>(Option.none());

        yield* SubscriptionRef.updateEffect(clientRef, (client) =>
          Effect.gen(function* () {
            const { body } = yield* executeRequestUnsynchronized(
              yield* makeRequestUnsynchronized(
                HttpClientRequest.post(
                  `${yield* getBaseApiApiUrl(client)}/api/user`,
                ),
                {
                  platform: client.device.platform,
                  deviceModel: client.device.deviceModel,
                  operatingSystem: client.device.operatingSystem,
                },
              ),
            );

            const decodedBody = yield* Schema.decodeUnknown(NewUser)(body);
            yield* Ref.set(result, Option.some(decodedBody));

            return {
              ...client,
              user: Option.some({
                userId: decodedBody.userRegistration.userId,
                credential: decodedBody.credential,
              }),
            };
          }),
        );

        return yield* (yield* Ref.get(result)).pipe(
          Effect.catchAll((error) => Effect.die(error)),
        );
      }),
    auth: () =>
      Effect.gen(function* () {
        const clientRef = yield* SekaiClientContext;

        const result = yield* Ref.make<Option.Option<unknown>>(Option.none());

        yield* SubscriptionRef.updateEffect(clientRef, (client) =>
          Effect.gen(function* () {
            const user = yield* client.user;
            const { body } = yield* executeRequestUnsynchronized(
              yield* makeRequestUnsynchronized(
                HttpClientRequest.put(
                  `${yield* getBaseApiApiUrl(client)}/api/user/${user.userId}/auth`,
                ),
                {
                  credential: user.credential,
                },
              ),
            );

            const decodedBody = body;

            yield* Ref.set(result, Option.some(decodedBody));

            return client;
          }),
        );

        return yield* (yield* Ref.get(result)).pipe(
          Effect.catchAll((error) => Effect.die(error)),
        );
      }),
    ruleAgreement: () =>
      Effect.gen(function* () {
        const clientRef = yield* SekaiClientContext;

        const result = yield* Ref.make<Option.Option<unknown>>(Option.none());

        yield* SubscriptionRef.updateEffect(clientRef, (client) =>
          Effect.gen(function* () {
            const user = yield* client.user;
            const { body } = yield* executeRequestUnsynchronized(
              yield* makeRequestUnsynchronized(
                HttpClientRequest.post(
                  `${yield* getBaseApiApiUrl(client)}/api/user/${user.userId}/rule-agreement`,
                ),
                {
                  credential: user.credential,
                  userId: 0,
                },
              ),
            );

            const decodedBody = body;

            yield* Ref.set(result, Option.some(decodedBody));

            return client;
          }),
        );

        return yield* (yield* Ref.get(result)).pipe(
          Effect.catchAll((error) => Effect.die(error)),
        );
      }),
  },
};
