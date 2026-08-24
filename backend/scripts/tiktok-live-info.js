import { TikTokLiveConnection } from "tiktok-live-connector";

const handle = process.argv[2] || "";
const timeoutMs = Math.max(3, Math.min(parseInt(process.argv[3] || "8", 10), 15)) * 1000;

if (!handle) {
  console.log(JSON.stringify({ handle: "", isLive: false, error: "no handle" }));
  process.exit(0);
}

const cleanHandle = handle.replace(/^@/, "").trim();
if (!cleanHandle) {
  console.log(JSON.stringify({ handle, isLive: false, error: "empty handle" }));
  process.exit(0);
}

const connection = new TikTokLiveConnection(cleanHandle, {
  fetchRoomInfoOnConnect: true,
  processInitialData: false,
  enableExtendedGiftInfo: false,
});

let settled = false;
function finish(payload, code = 0) {
  if (settled) return;
  settled = true;
  try { connection.disconnect(); } catch {}
  console.log(JSON.stringify(payload));
  setTimeout(() => process.exit(code), 80);
}

// Safety overall timeout
const guard = setTimeout(() => {
  finish({ handle: cleanHandle, handleRaw: handle, isLive: false, error: "timeout", timeoutMs });
}, timeoutMs + 2000);

connection.connect().then((state) => {
  clearTimeout(guard);
  let roomInfo = state?.roomInfo || state || {};
  if (roomInfo?.data && typeof roomInfo.data === 'object') roomInfo = roomInfo.data;
  if (roomInfo?.user && !roomInfo.owner) roomInfo.owner = roomInfo.user;
  const streamUrl = roomInfo?.streamUrl || roomInfo?.stream_url || roomInfo?.streamUrlV2 || roomInfo?.stream_url_v2 || {};
  // HLS variants: hlsPullUrl, hlsPullUrlMap, flvPullUrl, rtmpPullUrl (support snake_case)
  const hlsPullUrl = streamUrl.hlsPullUrl || streamUrl.hls_pull_url || streamUrl.hlsPullUrlMap?.FULL_HD || null;
  const hlsPullUrlMap = streamUrl.hlsPullUrlMap || streamUrl.hls_pull_url_map || null;
  const flvPullUrl = streamUrl.flvPullUrl || streamUrl.flv_pull_url || null;
  const rtmpPullUrl = streamUrl.rtmpPullUrl || streamUrl.rtmp_pull_url || null;

  // Pick best HLS url
  let bestHls = hlsPullUrl || null;
  if (!bestHls && hlsPullUrlMap && typeof hlsPullUrlMap === "object") {
    const keys = Object.keys(hlsPullUrlMap);
    if (keys.length) bestHls = hlsPullUrlMap[keys[0]] || hlsPullUrlMap["FULL_HD"] || hlsPullUrlMap["SD1"] || hlsPullUrlMap[keys[0]];
  }
  // flv map: { FULL_HD: url, HD: url, SD1: url, SD2: url, LD1: url }
  let flvMap = null;
  if (flvPullUrl && typeof flvPullUrl === "object") flvMap = flvPullUrl;

  const owner = roomInfo.owner || {};
  const stats = roomInfo.stats || {};

  finish({
    handle: cleanHandle,
    handleRaw: handle,
    isLive: true,
    roomId: String(state?.roomId || roomInfo.roomId || roomInfo.id_str || ""),
    title: roomInfo.title || "",
    owner: {
      nickname: owner.nickname || "",
      uniqueId: owner.uniqueId || owner.unique_id || cleanHandle,
      avatar: owner.avatarMedium?.urlList?.[0] || owner.avatarThumb?.urlList?.[0] || null,
      followerCount: owner.followInfo?.followerCount ?? null,
    },
    stats: {
      viewerCount: roomInfo.userCount ?? stats.totalUser ?? null,
      likeCount: stats.likeCount ?? roomInfo.likeCount ?? null,
      totalUser: stats.totalUser ?? null,
    },
    status: roomInfo.status ?? null,
    streamUrl: {
      hlsPullUrl: bestHls,
      hlsPullUrlMap,
      flvPullUrl: flvMap,
      rtmpPullUrl,
      rawHls: hlsPullUrl,
    },
    shareUrl: roomInfo.shareUrl || `https://www.tiktok.com/@${cleanHandle}/live`,
    webcastUrl: `https://www.tiktok.com/@${cleanHandle}/live`,
  });
}).catch((err) => {
  clearTimeout(guard);
  const msg = String(err?.message || err || "");
  const lower = msg.toLowerCase();
  const isOffline = lower.includes("not live") || lower.includes("offline") || lower.includes("useroffline") || lower.includes("lives of this user can not be found") || lower.includes("no room");
  // Unconnected offline is not an error for viewer, just isLive false
  if (isOffline) {
    finish({ handle: cleanHandle, handleRaw: handle, isLive: false, error: "offline", detail: msg.slice(0, 300) });
  } else {
    finish({ handle: cleanHandle, handleRaw: handle, isLive: false, error: "connect_failed", detail: msg.slice(0, 400) });
  }
});
