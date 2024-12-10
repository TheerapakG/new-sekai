import { Cookies } from "@effect/platform";
import { Effect, Ref, Schema } from "effect";
import crypto from "uncrypto";

const PlatformBrand = Symbol.for("Platform");
export const Platform = Schema.Union(
  Schema.String.pipe(Schema.brand(PlatformBrand)),
  Schema.Literal("iOS", "Android").pipe(Schema.brand(PlatformBrand)),
);
export type Platform = Schema.Schema.Type<typeof Platform>;

export const Device = Schema.Struct(
  {
    platform: Platform,
    deviceModel: Schema.String,
    operatingSystem: Schema.String,
    userAgent: Schema.String,
    unityVersion: Schema.String,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export const Versions = Schema.Struct({
  appHash: Schema.String,
  appVersion: Schema.String,
  assetVersion: Schema.String,
  dataVersion: Schema.String,
});

const AppVersionStatusBrand = Symbol.for("AppVersionStatus");
export const AppVersionStatus = Schema.Union(
  Schema.String.pipe(Schema.brand(AppVersionStatusBrand)),
  Schema.Literal("not_available", "available", "maintenance").pipe(
    Schema.brand(AppVersionStatusBrand),
  ),
);
export type AppVersionStatus = Schema.Schema.Type<typeof AppVersionStatus>;

export const AppVersion = Schema.Struct(
  {
    systemProfile: Schema.String,
    appVersion: Schema.String,
    multiPlayVersion: Schema.String,
    assetVersion: Schema.String,
    appVersionStatus: AppVersionStatus,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export const SystemInfo = Schema.Struct(
  {
    serverDate: Schema.DateTimeUtcFromNumber,
    timezone: Schema.TimeZone,
    profile: Schema.String,
    maintenanceStatus: Schema.String,
    appVersions: Schema.Array(AppVersion),
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type SystemInfo = Schema.Schema.Type<typeof SystemInfo>;

export const UserRegistration = Schema.Struct(
  {
    userId: Schema.Number,
    signature: Schema.String,
    platform: Schema.String,
    deviceModel: Schema.String,
    operatingSystem: Schema.String,
    registeredAt: Schema.DateTimeUtcFromNumber,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export const UserGameData = Schema.Struct(
  {
    userId: Schema.Number,
    name: Schema.String,
    deck: Schema.Number,
    rank: Schema.Number,
    exp: Schema.Number,
    totalExp: Schema.Number,
    coin: Schema.Number,
    virtualCoin: Schema.Number,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export const UserBoost = Schema.Struct(
  {
    current: Schema.Number,
    recoveryAt: Schema.DateTimeUtcFromNumber,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export const UserTutorial = Schema.Struct(
  {
    tutorialStatus: Schema.Literal(
      "start",
      "opening_1",
      "gameplay",
      "opening_2",
      "unit_select",
      "light_sound_opening",
      "idol_opening",
      "street_opening",
      "theme_park_opening",
      "school_refusal_opening",
      "summary",
      "end",
    ),
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

const UserAreaPlaylistStatusStatusBrand = Symbol.for(
  "UserAreaPlaylistStatusStatus",
);
export const UserAreaPlaylistStatusStatus = Schema.Union(
  Schema.String.pipe(Schema.brand(UserAreaPlaylistStatusStatusBrand)),
  Schema.Literal("released", "unreleased").pipe(
    Schema.brand(UserAreaPlaylistStatusStatusBrand),
  ),
);
export type UserAreaPlaylistStatusStatus = Schema.Schema.Type<
  typeof UserAreaPlaylistStatusStatus
>;

export const UserAreaPlaylistStatus = Schema.Struct(
  {
    areaPlaylistId: Schema.Number,
    status: UserAreaPlaylistStatusStatus,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type UserAreaPlaylistStatus = Schema.Schema.Type<
  typeof UserAreaPlaylistStatus
>;

const UserAreaStatusStatusBrand = Symbol.for("UserAreaStatusStatus");
export const UserAreaStatusStatus = Schema.Union(
  Schema.String.pipe(Schema.brand(UserAreaStatusStatusBrand)),
  Schema.Literal("released", "unreleased").pipe(
    Schema.brand(UserAreaStatusStatusBrand),
  ),
);
export type UserAreaStatusStatus = Schema.Schema.Type<
  typeof UserAreaStatusStatus
>;

export const UserAreaStatus = Schema.Struct(
  {
    areaId: Schema.Number,
    status: UserAreaStatusStatus,
    userAreaPlaylistStatus: Schema.optionalWith(UserAreaPlaylistStatus, {
      as: "Option",
    }),
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type UserAreaStatus = Schema.Schema.Type<typeof UserAreaStatus>;

export const UserArea = Schema.Struct(
  {
    areaId: Schema.Number,
    actionSets: Schema.Array(Schema.Unknown),
    areaItems: Schema.Array(Schema.Unknown),
    userAreaStatus: UserAreaStatus,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

const UserCardSpecialTrainingStatusBrand = Symbol.for(
  "UserCardSpecialTrainingStatus",
);
export const UserCardSpecialTrainingStatus = Schema.Union(
  Schema.String.pipe(Schema.brand(UserCardSpecialTrainingStatusBrand)),
  Schema.Literal("not_doing").pipe(
    Schema.brand(UserCardSpecialTrainingStatusBrand),
  ),
);
export type UserCardSpecialTrainingStatus = Schema.Schema.Type<
  typeof UserCardSpecialTrainingStatus
>;

const UserCardDefaultImageBrand = Symbol.for("UserCardDefaultImage");
export const UserCardDefaultImage = Schema.Union(
  Schema.String.pipe(Schema.brand(UserCardDefaultImageBrand)),
  Schema.Literal("original").pipe(Schema.brand(UserCardDefaultImageBrand)),
);
export type UserCardDefaultImage = Schema.Schema.Type<
  typeof UserCardDefaultImage
>;

const UserCardEpisodeScenarioStatusBrand = Symbol.for(
  "UserCardEpisodeScenarioStatus",
);
export const UserCardEpisodeScenarioStatus = Schema.Union(
  Schema.String.pipe(Schema.brand(UserCardEpisodeScenarioStatusBrand)),
  Schema.Literal("unreleased", "can_not_read").pipe(
    Schema.brand(UserCardEpisodeScenarioStatusBrand),
  ),
);
export type UserCardEpisodeScenarioStatus = Schema.Schema.Type<
  typeof UserCardEpisodeScenarioStatus
>;

const UserCardEpisodeScenarioStatusReasonBrand = Symbol.for(
  "UserCardEpisodeScenarioStatusReason",
);
export const UserCardEpisodeScenarioStatusReason = Schema.Union(
  Schema.String.pipe(Schema.brand(UserCardEpisodeScenarioStatusReasonBrand)),
  Schema.Literal("unread_before_scenario", "not_enough_release_condition").pipe(
    Schema.brand(UserCardEpisodeScenarioStatusReasonBrand),
  ),
);
export type UserCardEpisodeScenarioStatusReason = Schema.Schema.Type<
  typeof UserCardEpisodeScenarioStatusReason
>;

export const UserCardEpisode = Schema.Struct(
  {
    cardEpisodeId: Schema.Number,
    scenarioStatus: UserCardEpisodeScenarioStatus,
    scenarioStatusReasons: Schema.Array(UserCardEpisodeScenarioStatusReason),
    isNotSkipped: Schema.Boolean,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type UserCardEpisode = Schema.Schema.Type<typeof UserCardEpisode>;

export const UserCard = Schema.Struct(
  {
    userId: Schema.Number,
    cardId: Schema.Number,
    level: Schema.Number,
    exp: Schema.Number,
    totalExp: Schema.Number,
    skillLevel: Schema.Number,
    skillExp: Schema.Number,
    totalSkillExp: Schema.Number,
    masterRank: Schema.Number,
    specialTrainingStatus: UserCardSpecialTrainingStatus,
    defaultImage: UserCardDefaultImage,
    duplicateCount: Schema.Number,
    createdAt: Schema.DateTimeUtcFromNumber,
    episodes: Schema.Array(UserCardEpisode),
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type UserCard = Schema.Schema.Type<typeof UserCard>;

export const UserDeck = Schema.Struct(
  {
    userId: Schema.Number,
    deckId: Schema.Number,
    name: Schema.String,
    leader: Schema.Number,
    subLeader: Schema.Number,
    member1: Schema.Number,
    member2: Schema.Number,
    member3: Schema.Number,
    member4: Schema.Number,
    member5: Schema.Number,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type UserDeck = Schema.Schema.Type<typeof UserDeck>;

export const UpdatedResources = Schema.Struct(
  {
    now: Schema.optionalWith(Schema.DateTimeUtcFromNumber, { as: "Option" }),
    refreshableTypes: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userRegistration: Schema.optionalWith(UserRegistration, { as: "Option" }),
    userGameData: Schema.optionalWith(UserGameData, { as: "Option" }),
    userBoost: Schema.optionalWith(UserBoost, { as: "Option" }),
    userTutorial: Schema.optionalWith(UserTutorial, { as: "Option" }),
    userAreas: Schema.optionalWith(Schema.Array(UserArea), {
      as: "Option",
    }),
    userCards: Schema.optionalWith(Schema.Array(UserCard), {
      as: "Option",
    }),
    userDecks: Schema.optionalWith(Schema.Array(UserDeck), {
      as: "Option",
    }),
    // TODO:
    userMusics: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userMusicResults: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userMusicAchievements: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userShops: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userUnitEpisodeStatuses: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userSpecialEpisodeStatuses: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userEventEpisodeStatuses: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userArchiveEventEpisodeStatuses: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userCharacterProfileEpisodeStatuses: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userEventArchiveCompleteReadRewards: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userUnits: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userPresents: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userCostume3dStatuses: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userCostume3dShopItems: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userCharacterCostume3ds: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userReleaseConditions: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    unreadUserTopics: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userHomeBanners: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userStamps: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userMaterialExchanges: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userGachaCeilExchanges: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userCharacters: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userCharacterMissionV2s: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userCharacterMissionV2Statuses: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userBeginnerMissionBehavior: Schema.optionalWith(Schema.Unknown, {
      as: "Option",
    }),
    userMissionStatuses: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userProfile: Schema.optionalWith(Schema.Unknown, {
      as: "Option",
    }),
    userHonorMissions: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userVirtualShops: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userArchiveVirtualLiveReleaseStatuses: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userAvatar: Schema.optionalWith(Schema.Unknown, {
      as: "Option",
    }),
    userAvatarCostumes: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userAvatarMotions: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userAvatarMotionFavorites: Schema.optionalWith(
      Schema.Array(Schema.Unknown),
      {
        as: "Option",
      },
    ),
    userAvatarSkinColors: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userPenlights: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userRankMatchResult: Schema.optionalWith(Schema.Unknown, {
      as: "Option",
    }),
    userLiveCharacterArchiveVoice: Schema.optionalWith(Schema.Unknown, {
      as: "Option",
    }),
    userViewableAppeal: Schema.optionalWith(Schema.Unknown, {
      as: "Option",
    }),
    userBillingRefunds: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userUnprocessedOrders: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
    userInformations: Schema.optionalWith(Schema.Array(Schema.Unknown), {
      as: "Option",
    }),
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export const NewUser = Schema.Struct(
  {
    userRegistration: UserRegistration,
    credential: Schema.String,
    updatedResources: UpdatedResources,
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type NewUser = Schema.Schema.Type<typeof NewUser>;

export const BaseSekaiClientData = Schema.Struct({
  device: Device,
  domains: Schema.Struct({
    api: Schema.String,
    assetBundle: Schema.String,
    assetBunddleInfo: Schema.String,
    gameVersion: Schema.String,
    signature: Schema.String,
  }),
  versions: Versions,
  installId: Schema.String,
  kc: Schema.String,
  key: Schema.transformOrFail(
    Schema.Uint8ArrayFromHex,
    Schema.instanceOf(CryptoKey),
    {
      strict: true,
      decode: (key) =>
        Effect.promise(() =>
          crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, true, [
            "encrypt",
            "decrypt",
          ]),
        ),
      encode: (key) =>
        Effect.promise(() => crypto.subtle.exportKey("raw", key)).pipe(
          Effect.map((key) => new Uint8Array(key)),
        ),
    },
  ),
  iv: Schema.Uint8ArrayFromHex,
  user: Schema.optionalWith(
    Schema.Struct({
      userId: Schema.Number,
      credential: Schema.String,
    }),
    { as: "Option" },
  ),
  sessionToken: Schema.String,
});
export type BaseSekaiClientData = Schema.Schema.Type<
  typeof BaseSekaiClientData
>;

export type SekaiClientData = BaseSekaiClientData & {
  cookies: Ref.Ref<Cookies.Cookies>;
};
