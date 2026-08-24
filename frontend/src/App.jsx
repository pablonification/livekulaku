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

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const playbackRef = useRef(null);
  const handleSendNowRef = useRef(null);

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
    };
  }, []);

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
        </div>
        <div className="topbar-progress" aria-hidden>
          <span style={{ width: `${isWindowing ? windowProgress : 0}%` }} />
        </div>
      </header>

      <div className="dashboard">

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
                <input
                  className="catalog-field catalog-name"
                  value={p.name}
                  placeholder="Nama produk"
                  aria-label={`Nama produk ${i + 1}`}
                  onChange={(e) => updateProduct(i, 'name', e.target.value)}
                />
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
                  <button className="catalog-del" onClick={() => removeProduct(i)} aria-label={`Hapus produk ${i + 1}`}>
                    ×
                  </button>
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

      </div>
    </div>
  );
}
