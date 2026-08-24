import { useEffect, useMemo, useRef, useState } from 'react';

const WINDOW_SECONDS = 10;
const MIN_COMMENT_DELAY = 180;
const MAX_PRODUCTS = 20;

const SOURCE_LABEL = {
  mock: 'Demo',
  shopee: 'Shopee',
  tiktok: 'TikTok',
};

const SOURCE_SOON = {
  shopee: true,
};

const SOURCE_PLACEHOLDER = {
  mock: 'Mode demo tanpa input',
  shopee: 'ID sesi Shopee',
  tiktok: '@username TikTok',
};

const PLATFORM_LABEL = {
  mock: 'Demo',
  shopee: 'Shopee',
  tiktok: 'TikTok',
};

const LABEL_ID = {
  harga: 'Harga',
  bandingkan_harga: 'Banding harga',
  ongkir: 'Ongkir',
  cod: 'COD',
  garansi: 'Garansi',
  stok: 'Stok',
  checkout: 'Mau checkout',
  browse: 'Lihat-liat',
};

const MANUAL_FIELD_ID = {
  name: 'nama',
  price: 'harga',
  promo: 'promo',
  stock: 'stok',
};

function parseDemo(text) {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((r) => r && typeof r.text === 'string');
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function friendlyError(e) {
  const raw = e instanceof Error ? e.message : String(e);
  const clean = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Terjadi kendala tak terduga.';
  return clean.length > 110 ? `${clean.slice(0, 110)}...` : clean;
}

async function loadDemoRows() {
  const fallback = [{ user: 'viewer', text: 'kak harga berapa?', platform: 'mock', delay_ms: 320 }];
  const res = await fetch('/demo_comments.jsonl').catch(() => null);
  if (!res?.ok) return fallback;
  const t = await res.text().catch(() => '');
  const rows = parseDemo(t);
  return rows.length ? rows : fallback;
}

function buildPayload({ source, identifier, comments, products }) {
  const payload = {
    source,
    window_seconds: WINDOW_SECONDS,
    comments: comments.map(({ user, text, platform, ts }) => ({ user, text, platform, ts })).filter((c) => c.text),
  };
  if (source === 'tiktok' && identifier) payload.handle = identifier;
  if (source === 'shopee' && identifier) payload.session_id = identifier;
  const cleanProducts = products
    .map(({ name, price, promo, stock }) => ({
      name: (name || '').trim(),
      price: price || undefined,
      promo: promo || undefined,
      stock: stock === '' || stock === null ? undefined : Number(stock),
    }))
    .filter((p) => p.name);
  if (cleanProducts.length) payload.products = cleanProducts;
  return payload;
}

async function requestCard(payload) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function parseCatalog(input) {
  const isPureUrl = /^https?:\/\/\S+$/i.test(input);
  const body = isPureUrl ? { url: input } : { text: input };
  const res = await fetch('/api/catalog/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getUrgencyTone(u) {
  if (u >= 70) return 'critical';
  if (u >= 40) return 'amber';
  return 'calm';
}

const TOPIC_COLORS = ['#2fb5a5', '#4a8bd6', '#9b7bd6', '#d6b14a', '#d67a4a', '#6e7a7d'];

const DEFAULT_TIKTOK_HANDLE = '@username';

function TikTokLiveViewer({ open, handle, info, loading, error, onHandleChange, onRefresh, onClose, videoRef, hlsError }) {
  const hlsUrl = info?.streamUrl?.hlsPullUrl || info?.streamUrl?.rawHls || null;
  const isLive = !!info?.isLive;
  const viewerCount = info?.stats?.viewerCount ?? info?.stats?.totalUser ?? null;

  if (!open) return null;
  return (
    <div className="col-live">
      <section className="panel live-viewer" aria-label="TikTok Live Viewer">
        <div className="panel-head live-head">
          <span className="live-title">
            <span className={`live-dot ${isLive ? 'live' : ''}`} aria-hidden />
            Live Viewer
          </span>
          <button className="btn ghost small" onClick={onClose} aria-label="Tutup viewer">Tutup</button>
        </div>

        <div className="live-controls">
          <input
            value={handle}
            onChange={(e) => onHandleChange(e.target.value)}
            placeholder={DEFAULT_TIKTOK_HANDLE}
            className="control-input live-input"
            aria-label="Handle TikTok"
          />
          <button className="btn ghost small" onClick={onRefresh} disabled={loading}>
            {loading ? '...' : 'Segarkan'}
          </button>
        </div>

        <div className="live-status">
          {loading ? <span className="muted">Memeriksa live...</span> : null}
          {!loading && error ? <span className="live-error">{error}</span> : null}
          {!loading && !error && info ? (
            <span className={`live-badge ${isLive ? 'live' : 'offline'}`}>
              {isLive ? 'LIVE' : 'OFFLINE'}
              {viewerCount ? ` · ${viewerCount} penonton` : ''}
              {isLive && info?.title ? ` · ${info.title.slice(0, 36)}` : ''}
            </span>
          ) : null}
        </div>

        <div className="live-video-wrap">
          {isLive && hlsUrl ? (
            <>
              <video ref={videoRef} controls playsInline muted className="live-video" poster={info?.owner?.avatar || undefined} />
              {hlsError ? <span className="live-error small">Gagal memutar HLS, coba buka di TikTok.</span> : null}
            </>
          ) : isLive && !hlsUrl ? (
            <div className="live-fallback">
              <p className="muted small">Live terdeteksi tapi stream HLS tidak tersedia (CORS atau blokir TikTok). Buka langsung di TikTok.</p>
              <a href={info?.webcastUrl || `https://www.tiktok.com/${handle.replace(/^@/, '@')}/live`} target="_blank" rel="noreferrer" className="btn primary small">Buka di TikTok</a>
            </div>
          ) : (
            <div className="live-offline">
              <p className="muted small">
                {handle?.trim() ? `${handle.trim()} sedang offline.` : 'Masukkan handle untuk cek.'}
              </p>
              {handle?.trim() ? (
                <a href={`https://www.tiktok.com/${handle.trim().replace(/^@/, '@')}/live`} target="_blank" rel="noreferrer" className="btn ghost small">Buka profil TikTok</a>
              ) : null}
            </div>
          )}
        </div>

        {info?.owner?.nickname ? (
          <div className="live-foot">
            <span className="muted small">Host: {info.owner.nickname} ({info.handle})</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ClusterDonut({ clusters = [], total = 0 }) {
  if (!clusters.length) {
    return <div className="donut-empty">Menunggu komentar</div>;
  }
  let offset = 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 100 100" className="donut">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#2a2e2a" strokeWidth="12" />
        {clusters.map((cl, i) => {
          const share = cl.share || 0;
          const len = c * share;
          const el = (
            <circle
              key={cl.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={TOPIC_COLORS[i % TOPIC_COLORS.length]}
              strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut-center">
        <span className="donut-total">{total}</span>
        <span className="donut-label">komentar</span>
      </div>
    </div>
  );
}

export default function App() {
  const [source, setSource] = useState('mock');
  const [liveInput, setLiveInput] = useState('');
  const [demoFlood, setDemoFlood] = useState([]);
  const [buffer, setBuffer] = useState([]);
  const [snapshot, setSnapshot] = useState([]);
  const [card, setCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWindowing, setIsWindowing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WINDOW_SECONDS);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [products, setProducts] = useState([]);
  const [catalogInput, setCatalogInput] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMsg, setCatalogMsg] = useState('');
  const [showReply, setShowReply] = useState(false);
  // TikTok Live Viewer (very right side, toggleable)
  const [viewerOpen, setViewerOpen] = useState(() => {
    try { return localStorage.getItem('livelaku_viewer') === '1'; } catch { return false; }
  });
  const [viewerHandle, setViewerHandle] = useState(() => {
    try {
      const v = localStorage.getItem('livelaku_viewer_handle');
      if (!v || v === '@poco_id' || v === DEFAULT_TIKTOK_HANDLE) return '';
      return v;
    } catch { return ''; }
  });
  const [viewerInfo, setViewerInfo] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [viewerHlsError, setViewerHlsError] = useState('');

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const playbackRef = useRef(null);
  const handleSendNowRef = useRef(null);
  const viewerVideoRef = useRef(null);
  const viewerHlsRef = useRef(null);

  const hasLiveInput = source !== 'mock' && liveInput.trim().length > 0;
  const canSend = !isLoading && (buffer.length > 0 || hasLiveInput);
  const isBusy = isWindowing || isLoading;
  const windowProgress = ((WINDOW_SECONDS - secondsLeft) / WINDOW_SECONDS) * 100;

  useEffect(() => {
    let alive = true;
    loadDemoRows().then((rows) => {
      if (alive) setDemoFlood(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      window.clearInterval(progressRef.current);
      window.clearTimeout(playbackRef.current);
      try { viewerHlsRef.current?.destroy(); } catch {}
    };
  }, []);

  // persist viewer toggle/handle
  useEffect(() => {
    try { localStorage.setItem('livelaku_viewer', viewerOpen ? '1' : '0'); } catch {}
  }, [viewerOpen]);
  useEffect(() => {
    try { localStorage.setItem('livelaku_viewer_handle', viewerHandle); } catch {}
  }, [viewerHandle]);

  async function fetchViewerInfo(handle) {
    const h = (handle || viewerHandle || '').trim();
    if (!h) return;
    const clean = h.replace(/^@/, '');
    if (!clean) return;
    setViewerLoading(true);
    setViewerError('');
    setViewerHlsError('');
    try {
      const res = await fetch(`/api/tiktok/live/${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error && !data.isLive) {
        // offline is not fatal, still store isLive:false for UI
        if (data.error === 'offline' || data.error === 'timeout') {
          setViewerInfo({ ...data, handle: clean });
          setViewerError('');
        } else {
          setViewerInfo(data);
          setViewerError(data.detail || data.error);
        }
      } else {
        setViewerInfo(data);
        setViewerError('');
      }
    } catch (e) {
      setViewerError(friendlyError(e));
    } finally {
      setViewerLoading(false);
    }
  }

  // auto-fetch when viewer opens or handle changes (debounced)
  useEffect(() => {
    if (!viewerOpen) return;
    fetchViewerInfo(viewerHandle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen]);

  // HLS attach when stream URL changes
  useEffect(() => {
    const hlsUrl = viewerInfo?.streamUrl?.hlsPullUrl || viewerInfo?.streamUrl?.rawHls;
    const video = viewerVideoRef.current;
    if (!hlsUrl || !video || !viewerOpen || !viewerInfo?.isLive) {
      try { viewerHlsRef.current?.destroy(); } catch {}
      viewerHlsRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const HlsMod = await import('hls.js');
        const Hls = HlsMod.default || HlsMod;
        if (cancelled) return;
        if (Hls.isSupported()) {
          try { viewerHlsRef.current?.destroy(); } catch {}
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          viewerHlsRef.current = hls;
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data?.fatal) setViewerHlsError(data.details || 'hls fatal');
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = hlsUrl;
          video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
        } else {
          setViewerHlsError('Browser tidak mendukung HLS');
        }
      } catch (e) {
        setViewerHlsError(friendlyError(e));
      }
    })();
    return () => {
      cancelled = true;
      try { viewerHlsRef.current?.destroy(); } catch {}
    };
  }, [viewerInfo, viewerOpen]);

  function clearTimers() {
    window.clearTimeout(timerRef.current);
    window.clearInterval(progressRef.current);
    timerRef.current = null;
    progressRef.current = null;
    setIsWindowing(false);
    setIsPlaying(false);
    setSecondsLeft(WINDOW_SECONDS);
  }
  function stopPlayback() {
    window.clearTimeout(playbackRef.current);
    playbackRef.current = null;
    setIsPlaying(false);
  }
  function startWindow() {
    if (isWindowing || isLoading) return;
    setIsWindowing(true);
    setSecondsLeft(WINDOW_SECONDS);
    if (card) setIsStale(true);
    const started = Date.now();
    progressRef.current = window.setInterval(() => {
      const el = Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(Math.max(0, WINDOW_SECONDS - el));
    }, 250);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      handleSendNowRef.current?.();
    }, WINDOW_SECONDS * 1000);
  }
  function handleStop() {
    stopPlayback();
    clearTimers();
  }
  function handleSourceChange(next) {
    if (isBusy) return;
    stopPlayback();
    clearTimers();
    setSource(next);
    setLiveInput('');
    setBuffer([]);
    setSnapshot([]);
    setCard(null);
    setIsStale(false);
    setLastUpdated(null);
    setError('');
    setShowReply(false);
  }
  function queue(comment) {
    const q = {
      user: comment.user || 'viewer',
      text: comment.text,
      platform: comment.platform || 'mock',
      ts: comment.ts,
    };
    setBuffer((cur) => [...cur, q]);
    return q;
  }
  function handlePlay() {
    if (isLoading || isWindowing) return;
    stopPlayback();
    clearTimers();
    setError('');
    setCard(null);
    setIsStale(false);
    setSnapshot([]);
    setBuffer([]);
    setIsPlaying(true);
    const rows = demoFlood.length ? demoFlood : [{ user: 'viewer', text: 'kak harga berapa?', platform: 'mock', delay_ms: 320 }];
    let i = 0;
    function next() {
      if (i >= rows.length) {
        playbackRef.current = null;
        setIsPlaying(false);
        return;
      }
      const r = rows[i++];
      queue(r);
      if (i === 1) startWindow();
      playbackRef.current = window.setTimeout(next, Math.max(MIN_COMMENT_DELAY, Number(r.delay_ms) || 320));
    }
    next();
  }
  function handleInject() {
    if (source !== 'mock' || isLoading) return;
    setError('');
    queue({ user: 'demo', text: 'kak mahal amat di sebelah cuma 80k', platform: 'tiktok' });
    if (!isWindowing) startWindow();
  }
  async function handleSendNow() {
    if (isLoading) return;
    const id = liveInput.trim();
    const wantsLive = source !== 'mock' && id.length > 0;
    const isLiveReq = wantsLive && buffer.length === 0;
    if (buffer.length === 0 && !isLiveReq) return;
    // Auto-open Live Viewer for the same tiktok handle (viewet)
    if (source === 'tiktok' && id) {
      const clean = id.startsWith('@') ? id : `@${id}`;
      setViewerHandle(clean);
      setViewerOpen(true);
      fetchViewerInfo(clean);
    }
    stopPlayback();
    clearTimers();
    const snap = [...buffer];
    setSnapshot(snap);
    setBuffer([]);
    setIsLoading(true);
    setError('');
    setCard(null);
    setIsStale(false);
    // For live sources with a handle and empty buffer, send handle (live fetch inside request).
    // If buffer has items, prefer buffered comments (contract: handle only when comments empty).
    const payload = buildPayload({ source, identifier: isLiveReq ? id : '', comments: snap, products });
    try {
      const next = await requestCard(payload);
      setCard(next);
      setShowReply(false);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    handleSendNowRef.current = handleSendNow;
  });

  function handleRetry() {
    if (snapshot.length) {
      setBuffer(snapshot);
      setError('');
      window.setTimeout(() => handleSendNowRef.current?.(), 0);
      return;
    }
    if (hasLiveInput) handleSendNow();
  }

  async function handleParseCatalog() {
    const v = catalogInput.trim();
    if (!v || catalogBusy || products.length >= MAX_PRODUCTS) return;
    setCatalogBusy(true);
    setCatalogMsg('');
    try {
      const data = await parseCatalog(v);
      setProducts((cur) => [
        ...cur,
        {
          name: data.name || '',
          price: data.price || '',
          promo: data.promo || '',
          stock: data.stock ?? '',
        },
      ]);
      setCatalogInput('');
      if (data.needs_manual?.length) {
        const fields = data.needs_manual.map((f) => MANUAL_FIELD_ID[f] || f).join(', ');
        setCatalogMsg(`Tambahan sendiri: ${fields}`);
      }
    } catch (e) {
      setCatalogMsg(friendlyError(e));
    } finally {
      setCatalogBusy(false);
    }
  }

  function updateProduct(i, key, val) {
    setProducts((cur) => cur.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));
  }

  function removeProduct(i) {
    setProducts((cur) => cur.filter((_, idx) => idx !== i));
  }

  const urgency = card ? clamp(Number(card.urgency) || 0, 0, 100) : 0;
  const tone = getUrgencyTone(urgency);
  const top = card?.top_cluster;
  const isEmptyResult = card && card.total === 0;
  const hasResult = card && card.total > 0;

  const primaryLabel = isWindowing
    ? `Merekam · ${secondsLeft} dtk`
    : isLoading
      ? 'Menganalisis...'
      : buffer.length
        ? `Analisis ${buffer.length} komentar`
        : hasLiveInput
          ? 'Mulai rekam'
          : 'Putar demo';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="brand-name">LiveLaku</span>
            <span className="brand-dot" aria-hidden />
          </div>
          {lastUpdated ? (
            <span className="topbar-meta">
              dianalisis {new Date(lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>

        <div className="topbar-right">
          <div className="source-tabs" role="tablist" aria-label="Sumber komentar">
            {['mock', 'shopee', 'tiktok'].map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={source === s}
                className={`source-tab ${source === s ? 'active' : ''}`}
                onClick={() => handleSourceChange(s)}
                disabled={isBusy || SOURCE_SOON[s]}
                title={SOURCE_SOON[s] ? 'Segera hadir' : undefined}
              >
                {SOURCE_LABEL[s]}
                {SOURCE_SOON[s] ? <span className="soon">segera</span> : null}
              </button>
            ))}
          </div>
          <button
            className={`btn ghost small viewer-toggle ${viewerOpen ? 'active' : ''}`}
            onClick={() => setViewerOpen((v) => !v)}
            aria-pressed={viewerOpen}
            aria-label="Toggle TikTok Live Viewer"
            title={viewerOpen ? 'Sembunyikan Live Viewer' : 'Tampilkan Live Viewer'}
          >
            <span className={`live-dot small ${viewerInfo?.isLive ? 'live' : ''}`} aria-hidden /> Live
          </button>
        </div>
        <div className="topbar-progress" aria-hidden>
          <span style={{ width: `${isWindowing ? windowProgress : 0}%` }} />
        </div>
      </header>

      <div className={`dashboard ${viewerOpen ? 'with-viewer' : ''}`}>

        <div className="col-left">
          <section className="panel" aria-label="Katalog produk">
            <div className="panel-head">
              <span>Katalog produk</span>
            </div>
            <div className="catalog-input-row">
              <input
                value={catalogInput}
                onChange={(e) => setCatalogInput(e.target.value)}
                placeholder="Tempel tautan produk, atau teks bagikannya"
                disabled={catalogBusy || products.length >= MAX_PRODUCTS}
                className="control-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleParseCatalog();
                }}
              />
              <button
                className="btn ghost small"
                onClick={handleParseCatalog}
                disabled={catalogBusy || !catalogInput.trim() || products.length >= MAX_PRODUCTS}
              >
                Tambah
              </button>
            </div>
            {catalogMsg ? <span className="catalog-msg">{catalogMsg}</span> : null}
            {products.map((p, i) => (
              <div key={`${p.name}-${i}`} className="catalog-row">
                <div className="catalog-row-head">
                  <input
                    className="catalog-field catalog-name"
                    value={p.name}
                    placeholder="Nama produk"
                    aria-label={`Nama produk ${i + 1}`}
                    onChange={(e) => updateProduct(i, 'name', e.target.value)}
                  />
                  <button
                    className="catalog-del"
                    type="button"
                    onClick={() => removeProduct(i)}
                    aria-label={`Hapus produk ${i + 1}`}
                    title="Hapus produk"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
                      <path d="M5 7l.4 11.2a2 2 0 0 0 2 1.8h9.2a2 2 0 0 0 2-1.8L19 7" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
                <div className="catalog-fields">
                  <input
                    className="catalog-field"
                    value={p.price}
                    placeholder="Harga"
                    aria-label={`Harga produk ${i + 1}`}
                    onChange={(e) => updateProduct(i, 'price', e.target.value)}
                  />
                  <input
                    className="catalog-field"
                    value={p.promo}
                    placeholder="Promo"
                    aria-label={`Promo produk ${i + 1}`}
                    onChange={(e) => updateProduct(i, 'promo', e.target.value)}
                  />
                  <input
                    className="catalog-field catalog-stock"
                    type="number"
                    min="0"
                    value={p.stock}
                    placeholder="Stok"
                    aria-label={`Stok produk ${i + 1}`}
                    onChange={(e) => updateProduct(i, 'stock', e.target.value)}
                  />
                </div>
              </div>
            ))}
            {!products.length ? (
              <span className="muted">Tanpa katalog, saran jawaban memakai produk contoh.</span>
            ) : null}
          </section>

          <section className="panel" aria-label="Topik pembicaraan">
            <div className="panel-head">
              <span>Topik pembicaraan</span>
            </div>
            <ClusterDonut clusters={card?.clusters || []} total={card?.total ?? buffer.length} />
            <div className="legend">
              {(card?.clusters || []).slice(0, 5).map((cl, i) => (
                <div key={cl.label} className="legend-row">
                  <span className="legend-dot" style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
                  <span className="legend-name">{LABEL_ID[cl.label] || cl.label}</span>
                  <span className="legend-val">{Math.round(cl.share * 100)}%</span>
                </div>
              ))}
            </div>
          </section>

          {(isWindowing || isPlaying || buffer.length > 0) && !isLoading ? (
            <section className="panel" aria-label="Rekaman berjalan">
              <div className="record-note">
                <span className="record-dot" aria-hidden />
                <span>
                  {isWindowing ? `Merekam komentar · ${secondsLeft} dtk lagi` : 'Menyiapkan komentar'}
                </span>
                <button className="btn ghost small" onClick={handleStop}>
                  Berhenti
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="col-center">
          <section className="panel hero">
            {!card && !isLoading && !error && !isWindowing ? (
              <div className="hero-empty">
                <p className="hero-title">{hasLiveInput ? `Pantau live ${liveInput.trim()}` : 'Lihat apa yang ditanyakan penonton'}</p>
                <p className="hero-copy">
                  {hasLiveInput
                    ? 'Rekam komentar 10 detik, LiveLaku menunjukkan topik yang paling perlu kamu jawab.'
                    : 'Putar demo untuk merasakannya, atau hubungkan live TikTok kamu lewat tab di atas.'}
                </p>
                <div className="hero-actions">
                  {hasLiveInput ? (
                    <button className="btn primary" onClick={handleSendNow} disabled={isBusy}>
                      Mulai rekam
                    </button>
                  ) : (
                    <button className="btn primary" onClick={handlePlay} disabled={isBusy}>
                      Putar demo
                    </button>
                  )}
                  {source === 'mock' ? (
                    <button className="btn ghost" onClick={handleInject} disabled={isLoading}>
                      Simulasi komentar
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isWindowing && !isLoading ? (
              <div className="hero-loading">
                <span className="record-dot big" aria-hidden />
                <span>Merekam komentar penonton... {secondsLeft} dtk</span>
                <div className="hero-actions inline">
                  {buffer.length > 0 ? (
                    <button className="btn ghost" onClick={handleSendNow}>
                      Analisis sekarang
                    </button>
                  ) : null}
                  <button className="btn ghost" onClick={handleStop}>
                    Berhenti
                  </button>
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div className="hero-loading">
                <span className="loading-dot" />
                <span>Menganalisis komentar...</span>
              </div>
            ) : null}

            {error ? (
              <div className="hero-error">
                <p className="hero-title">Ada kendala</p>
                <p className="hero-copy">{error}</p>
                <div className="hero-actions">
                  <button className="btn primary" onClick={handleRetry}>
                    Coba lagi
                  </button>
                  {source !== 'mock' ? (
                    <button className="btn ghost" onClick={() => handleSourceChange('mock')}>
                      Beralih ke demo
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isEmptyResult && !isLoading && !error ? (
              <div className="hero-empty">
                <p className="hero-title">{hasLiveInput ? `${liveInput.trim()} belum aktif` : 'Belum ada komentar'}</p>
                <p className="hero-copy">{card.why_now}</p>
                <div className="hero-actions">
                  {source !== 'mock' ? (
                    <>
                      <button className="btn primary" onClick={handleRetry} disabled={isLoading}>
                        Coba lagi
                      </button>
                      <button className="btn ghost" onClick={() => handleSourceChange('mock')}>
                        Beralih ke demo
                      </button>
                    </>
                  ) : (
                    <button className="btn primary" onClick={handlePlay}>
                      Putar demo
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {hasResult && !isLoading && !error ? (
              <>
                <div className="status-line" data-tone={tone}>
                  <span className="status-dot" aria-hidden />
                  {urgency >= 70 ? 'Perlu dijawab sekarang' : urgency >= 40 ? 'Perlu diperhatikan' : 'Masih tenang'}
                </div>

                <h2 className="topic-title">{LABEL_ID[top?.label] || top?.label || '-'}</h2>
                <div className="topic-meta">
                  <span>{top?.count ?? 0} dari {card.total} komentar</span>
                  <span className="topic-sep">·</span>
                  <span>urgensi {urgency}</span>
                </div>

                {card.why_now ? (
                  <p className="why-text">{card.why_now}</p>
                ) : null}

                {top?.samples?.length ? (
                  <div className="hero-samples">
                    {top.samples.slice(0, 3).map((s, i) => (
                      <span key={`${s}-${i}`} className="sample-quote">
                        &ldquo;{s}&rdquo;
                      </span>
                    ))}
                  </div>
                ) : null}

                {card.suggested_reply ? (
                  <div className="hero-reply-box">
                    <button
                      type="button"
                      className="reply-toggle"
                      onClick={() => setShowReply((s) => !s)}
                      aria-expanded={showReply}
                    >
                      <span className="reply-label">Lihat saran jawaban</span>
                      <span className="reply-chevron" aria-hidden>
                        {showReply ? '▾' : '▸'}
                      </span>
                    </button>
                    {showReply ? (
                      <>
                        <div className="reply-head">
                          <span className="reply-hint">Bahan bicara, sisanya terserah kamu</span>
                          <button
                            className="btn ghost small"
                            onClick={() => navigator.clipboard.writeText(card.suggested_reply).catch(() => {})}
                          >
                            Salin
                          </button>
                        </div>
                        <p className="reply-text">&ldquo;{card.suggested_reply}&rdquo;</p>
                        <span className="reply-engine">{card.source === 'muse-spark-1.2-contributor' ? 'disusun AI' : 'disusun templat'}</span>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {isStale ? <span className="stale-note">Hasil sesi sebelumnya</span> : null}
              </>
            ) : null}
          </section>

          <section className="panel" aria-label="Komentar">
            <div className="controls">
              <div className="control-group">
                <input
                  value={liveInput}
                  onChange={(e) => setLiveInput(e.target.value)}
                  placeholder={SOURCE_PLACEHOLDER[source]}
                  disabled={isWindowing || isLoading || source === 'mock'}
                  className="control-input"
                  aria-label="Akun live"
                />
              </div>
              {(!card && !isLoading && !error) || isLoading ? null : (
                <div className="control-actions">
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (isBusy) return;
                      if (buffer.length > 0) return handleSendNow();
                      if (hasLiveInput) return handleSendNow();
                      return handlePlay();
                    }}
                    disabled={isBusy || !canSend}
                  >
                    {primaryLabel}
                  </button>
                </div>
              )}
              {error ? <span className="control-error">{error}</span> : null}
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Penonton</th>
                    <th>Komentar</th>
                    <th>Dari</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const liveFallback = card?.top_cluster?.samples?.map((text) => ({ user: 'penonton', text, platform: source })) || [];
                    const rows = snapshot.length ? snapshot : buffer.length ? buffer : liveFallback;
                    if (!rows.length) {
                      return (
                        <tr>
                          <td colSpan={3} className="empty-row">
                            Belum ada komentar masuk.
                          </td>
                        </tr>
                      );
                    }
                    return rows.slice(-8).map((c, i) => (
                      <tr key={`${c.user}-${c.text}-${i}`}>
                        <td className="cell-user">{c.user}</td>
                        <td className="cell-text">{c.text}</td>
                        <td>
                          <span className="cell-platform">{PLATFORM_LABEL[c.platform] || c.platform}</span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {card?.clusters?.length ? (
              <div className="topic-bar">
                {card.clusters.map((cl) => (
                  <div key={cl.label} className="topic-item">
                    <span className="topic-name">{LABEL_ID[cl.label] || cl.label}</span>
                    <span className="topic-count-sub">{cl.count}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <TikTokLiveViewer
          open={viewerOpen}
          handle={viewerHandle}
          info={viewerInfo}
          loading={viewerLoading}
          error={viewerError}
          hlsError={viewerHlsError}
          videoRef={viewerVideoRef}
          onHandleChange={setViewerHandle}
          onRefresh={() => fetchViewerInfo(viewerHandle)}
          onClose={() => setViewerOpen(false)}
        />

      </div>
    </div>
  );
}
