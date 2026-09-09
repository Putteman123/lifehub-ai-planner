/** Delad OwnTracks-konfiguration – används både av .otrc-filen och inline-länken. */
export type LocatorMode = "move" | "significant";

export function buildOwnTracksConfig(ingestUrl: string, mode: LocatorMode) {
  return {
    _type: "configuration",
    mode: 3, // HTTP
    url: ingestUrl,
    auth: false,
    username: "lifehub",
    deviceId: "iphone",
    tid: "LH",
    encryptionKey: "",
    monitoring: mode === "move" ? 2 : 1,
    locatorDisplacement: mode === "move" ? 50 : 200,
    locatorInterval: mode === "move" ? 60 : 300,
    ignoreStaleLocations: 0,
    pubExtendedData: true,
    allowRemoteLocation: true,
    cmd: true,
    ws: false,
    tls: true,
  };
}

/** Bygger en självbärande importlänk som inte kräver fjärrhämtning. */
export function buildInlineLink(ingestUrl: string, mode: LocatorMode) {
  const json = JSON.stringify(buildOwnTracksConfig(ingestUrl, mode));
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return `owntracks:///config?inline=${encodeURIComponent(base64)}`;
}
