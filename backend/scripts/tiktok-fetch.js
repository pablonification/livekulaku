import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";

const handle = process.argv[2] || "";
const windowSeconds = Math.max(2, Math.min(parseInt(process.argv[3] || "8", 10), 12));

if (!handle) {
  console.log(JSON.stringify([]));
  process.exit(0);
}

const cleanHandle = handle.replace(/^@/, "");
const connection = new TikTokLiveConnection(cleanHandle, {
  enableExtendedGiftInfo: false,
  fetchRoomInfoOnConnect: true,
  processInitialData: false,
});

const collected = [];

connection.on(WebcastEvent.CHAT, (data) => {
  try {
    const user = data?.user?.nickname || data?.user?.uniqueId || "viewer";
    const text = data?.comment || "";
    if (text) collected.push({ user, text, platform: "tiktok" });
  } catch {}
});

connection.on(WebcastEvent.CONNECTED, () => {
  // connected, start collecting
});

let settled = false;
function finish(code = 0) {
  if (settled) return;
  settled = true;
  try { connection.disconnect(); } catch {}
  console.log(JSON.stringify(collected));
  process.exit(code);
}

// timeout after windowSeconds
setTimeout(() => finish(0), windowSeconds * 1000);

// handle not live or error -> return empty quickly
connection.connect().catch((err) => {
  const msg = String(err?.message || err);
  if (msg.toLowerCase().includes("not live") || msg.toLowerCase().includes("offline") || msg.toLowerCase().includes("useroffline")) {
    // not live is not an error for our sync Window, just empty
    finish(0);
  } else {
    // other error, still return what we have
    finish(0);
  }
});

// safety: if no connect within 5s, exit
setTimeout(() => {
  if (collected.length === 0 && !settled) {
    // still no data, but keep waiting until windowSeconds
  }
}, 5000);
