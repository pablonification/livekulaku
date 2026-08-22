import { useEffect, useMemo, useRef, useState } from 'react';

const WINDOW_SECONDS = 10;
const MIN_COMMENT_DELAY = 180;

const SOURCE_COPY = {
  mock: {
    label: 'Mock',
    inputLabel: 'Identitas live (opsional)',
    placeholder: 'Mock tidak membutuhkan identitas',
    inputGuidance: 'Mock memutar 18 komentar contoh di browser, lalu mengirim satu Window ke API.',
  },
  shopee: {
    label: 'Shopee Live',
    inputLabel: 'Shopee session_id',
    placeholder: 'Contoh: 6236215',
    inputGuidance: 'Isi session_id untuk mengambil komentar Shopee secara langsung dalam Window ini.',
  },
  tiktok: {
    label: 'TikTok Live',
    inputLabel: 'TikTok @handle',
    placeholder: 'Contoh: @tokoku',
    inputGuidance: 'Isi @handle untuk mengambil komentar TikTok secara langsung dalam Window ini.',
  },
};

function parseDemo(text) {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (parseError) {
        if (parseError instanceof SyntaxError) return null;
        throw parseError;
      }
    })
    .filter((commentRecord) => commentRecord && typeof commentRecord.text === 'string');
}

function clamp(inputValue, min, max) {
  return Math.min(Math.max(inputValue, min), max);
}

async function loadDemoRows() {
  const fallbackRows = [{ user: 'viewer', text: 'kak harga berapa?', platform: 'mock', delay_ms: 320 }];
  const response = await fetch('/demo_comments.jsonl').catch(() => null);
  if (!response?.ok) return fallbackRows;
  const demoText = await response.text().catch(() => '');
  const rows = parseDemo(demoText);
  return rows.length ? rows : fallbackRows;
}

function buildAnalyzePayload({ source, identifier, comments }) {
  const payload = {
    source,
    window_seconds: WINDOW_SECONDS,
    comments: comments
      .map(({ user, text, platform, ts }) => ({ user, text, platform, ts }))
      .filter((comment) => comment.text),
  };
  if (source === 'tiktok' && identifier) payload.handle = identifier;
  if (source === 'shopee' && identifier) payload.session_id = identifier;
  return payload;
}

async function requestAnalyzeCard(payload) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return response.json();
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return 'Belum ada hasil';
  return `Diperbarui ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(timestamp)}`;
}

function getUrgencyTone(urgency) {
  if (urgency >= 70) return 'critical';
  if (urgency >= 40) return 'amber';
  return 'calm';
}

function getWindowStatus({ isWindowing, isLoading, error, card, isStale }) {
  if (isLoading) return { label: 'Menganalisis Window', tone: 'info' };
  if (isWindowing) return { label: 'Window aktif', tone: 'amber' };
  if (error) return { label: 'Tidak terhubung', tone: 'critical' };
  if (card && card.total === 0) return { label: 'Tidak ada flood', tone: 'calm' };
  if (card && isStale) return { label: 'Cue lama', tone: 'info' };
  if (card) return { label: 'Siap diucapkan', tone: 'calm' };
  return { label: 'Siap menerima flood', tone: 'info' };
}

function StatusTag({ tone, children }) {
  return (
    <span className={`status-tag status-tag-${tone}`}>
      <span className="status-tag-mark" aria-hidden="true" />
      {children}
    </span>
  );
}

function SourceTag({ source }) {
  return <span className="source-tag">{SOURCE_COPY[source]?.label || source}</span>;
}

function EmptyCue({ onPlay, disabled }) {
  return (
    <div className="cue-empty">
      <p className="cue-empty-title">Belum ada cue untuk diucapkan.</p>
      <p className="cue-empty-copy">
        Mulai dengan flood demo atau isi identitas live di panel setup. LiveLaku akan menunggu satu Window
        sebelum memilih topik yang perlu dijawab.
      </p>
      <button className="button button-primary" type="button" onClick={onPlay} disabled={disabled}>
        Putar flood demo
      </button>
    </div>
  );
}

function LoadingCue() {
  return (
    <div className="cue-state cue-state-loading" aria-live="polite">
      <div className="loading-line">
        <span className="loading-dot" aria-hidden="true" />
        <span>Menganalisis Window</span>
      </div>
      <p>Menentukan satu cluster yang paling layak dijawab. Cue akan muncul di sini.</p>
    </div>
  );
}

function ErrorCue({ message, onRetry, disabled }) {
  return (
    <div className="cue-state cue-state-error" role="alert">
      <p className="cue-state-title">Window belum menghasilkan cue.</p>
      <p>{message}</p>
      <button className="button button-secondary" type="button" onClick={onRetry} disabled={disabled}>
        Coba kirim lagi
      </button>
    </div>
  );
}

function NoFloodCue({ card }) {
  return (
    <div className="cue-state cue-state-empty" aria-live="polite">
      <p className="cue-state-title">Tidak ada cluster yang perlu dikejar.</p>
      <p>{card.suggested_reply || 'Belum ada komentar yang perlu dijawab di Window ini.'}</p>
      <p className="cue-state-note">{card.why_now || 'Window kosong, tidak ada cluster.'}</p>
    </div>
  );
}

function CueContent({ card, isStale }) {
  const urgency = clamp(Number(card.urgency) || 0, 0, 100);
  const urgencyTone = getUrgencyTone(urgency);
  const topCluster = card.top_cluster;

  return (
    <div className="cue-content">
      <div className="cue-heading-row">
        <div>
          <p className="section-kicker">Priority Card</p>
          <h2 id="cue-title">{topCluster?.label || 'Cue untuk Window ini'}</h2>
        </div>
        {isStale ? <StatusTag tone="info">Cue lama</StatusTag> : <StatusTag tone="calm">Siap diucapkan</StatusTag>}
      </div>

      <blockquote className="suggested-reply">“{card.suggested_reply}”</blockquote>

      <div className="cue-support-grid">
        <div className={`urgency-block urgency-${urgencyTone}`}>
          <div className="support-label-row">
            <span className="support-label">Urgensi</span>
            <strong>{urgency}/100</strong>
          </div>
          <div className="urgency-track" aria-hidden="true">
            <span style={{ width: `${urgency}%` }} />
          </div>
          <span className="urgency-caption">
            {urgency >= 70 ? 'Perlu respons sekarang' : urgency >= 40 ? 'Perlu diperhatikan' : 'Bisa menunggu'}
          </span>
        </div>

        <div className="why-block">
          <span className="support-label">Kenapa sekarang</span>
          <p>{card.why_now}</p>
        </div>
      </div>

      <details className="evidence-disclosure">
        <summary>Lihat bukti cluster dan komentar</summary>
        <div className="evidence-body">
          <div className="evidence-meta">
            <span>{card.total} komentar di Window</span>
            {card.tone ? <span>nada {card.tone}</span> : null}
            {card.source ? <SourceTag source={card.source === 'mock' ? 'mock' : card.source} /> : null}
          </div>
          {topCluster ? (
            <div className="cluster-summary">
              <div>
                <span className="support-label">Top cluster</span>
                <strong>{topCluster.label_id || topCluster.label}</strong>
              </div>
              <span className="mono-value">
                {topCluster.count} komentar, {Math.round((topCluster.share || 0) * 100)}%
              </span>
            </div>
          ) : null}
          {topCluster?.samples?.length ? (
            <ul className="sample-list">
              {topCluster.samples.map((sample, index) => (
                <li key={`${sample}-${index}`}>“{sample}”</li>
              ))}
            </ul>
          ) : null}
          {card.clusters?.length ? (
            <div className="cluster-list">
              {card.clusters.map((cluster) => (
                <div className="cluster-row" key={cluster.label}>
                  <span>{cluster.label}</span>
                  <span className="cluster-count">
                    {cluster.count} · {Math.round((cluster.share || 0) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function CueSheet({ card, isWindowing, isLoading, error, isStale, onPlay, onRetry, disabled }) {
  const status = getWindowStatus({ isWindowing, isLoading, error, card, isStale });
  const classes = ['cue-sheet'];
  if (card && card.total > 0) classes.push('cue-sheet-success');
  if (isStale) classes.push('cue-sheet-stale');

  return (
    <section
      id="cue"
      className={classes.join(' ')}
      aria-labelledby={card?.total > 0 ? 'cue-title' : undefined}
      aria-label={card?.total > 0 ? undefined : 'Priority Card'}
      aria-busy={isLoading}
    >
      <div className="cue-status-line">
        <StatusTag tone={status.tone}>{status.label}</StatusTag>
        {card?.window_seconds ? <span className="mono-value">Window {card.window_seconds}s</span> : null}
      </div>
      {isLoading ? <LoadingCue /> : null}
      {!isLoading && error ? <ErrorCue message={error} onRetry={onRetry} disabled={disabled} /> : null}
      {!isLoading && !error && card?.total === 0 ? <NoFloodCue card={card} /> : null}
      {!isLoading && !error && card?.total > 0 ? <CueContent card={card} isStale={isStale} /> : null}
      {!isLoading && !error && !card ? <EmptyCue onPlay={onPlay} disabled={disabled} /> : null}
    </section>
  );
}

export default function App() {
  const [source, setSource] = useState('mock');
  const [liveInput, setLiveInput] = useState('');
  const [demoFlood, setDemoFlood] = useState([]);
  const [buffer, setBuffer] = useState([]);
  const [windowSnapshot, setWindowSnapshot] = useState([]);
  const [card, setCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWindowing, setIsWindowing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WINDOW_SECONDS);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const playbackRef = useRef(null);
  const handleSendNowRef = useRef(null);

  const sourceDetails = SOURCE_COPY[source];
  const status = getWindowStatus({ isWindowing, isLoading, error, card, isStale });
  const hasLiveInput = source !== 'mock' && liveInput.trim().length > 0;
  const canSend = !isLoading && (buffer.length > 0 || hasLiveInput);
  const windowProgress = ((WINDOW_SECONDS - secondsLeft) / WINDOW_SECONDS) * 100;

  const platformCounts = useMemo(
    () =>
      buffer.reduce((counts, comment) => {
        const platform = comment.platform || source;
        counts[platform] = (counts[platform] || 0) + 1;
        return counts;
      }, {}),
    [buffer, source],
  );

  useEffect(() => {
    let active = true;

    async function loadDemoFlood() {
      const rows = await loadDemoRows();
      if (active) setDemoFlood(rows);
    }

    loadDemoFlood();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      window.clearInterval(progressRef.current);
      window.clearTimeout(playbackRef.current);
    };
  }, []);

  function clearWindowTimers() {
    window.clearTimeout(timerRef.current);
    window.clearInterval(progressRef.current);
    timerRef.current = null;
    progressRef.current = null;
    setIsWindowing(false);
    setSecondsLeft(WINDOW_SECONDS);
  }

  function stopPlayback() {
    window.clearTimeout(playbackRef.current);
    playbackRef.current = null;
  }

  function startWindow() {
    if (isWindowing || isLoading) return;

    setIsWindowing(true);
    setSecondsLeft(WINDOW_SECONDS);
    if (card) setIsStale(true);

    const startedAt = Date.now();
    progressRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSecondsLeft(Math.max(0, WINDOW_SECONDS - elapsed));
    }, 250);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      handleSendNowRef.current?.();
    }, WINDOW_SECONDS * 1000);
  }

  function handleSourceChange(nextSource) {
    if (isWindowing || isLoading) return;
    stopPlayback();
    clearWindowTimers();
    setSource(nextSource);
    setLiveInput('');
    setBuffer([]);
    setWindowSnapshot([]);
    setCard(null);
    setIsStale(false);
    setLastUpdated(null);
    setError('');
  }

  function queueComment(commentRecord) {
    const queuedComment = {
      user: commentRecord.user || 'viewer',
      text: commentRecord.text,
      platform: commentRecord.platform || 'mock',
      ts: commentRecord.ts,
    };
    setBuffer((current) => [...current, queuedComment]);
    return queuedComment;
  }

  function handlePlay() {
    if (isLoading || isWindowing) return;
    stopPlayback();
    clearWindowTimers();
    setError('');
    setCard(null);
    setIsStale(false);
    setWindowSnapshot([]);
    setBuffer([]);

    const rows = demoFlood.length
      ? demoFlood
      : [{ user: 'viewer', text: 'kak harga berapa?', platform: 'mock', delay_ms: 320 }];
    let index = 0;

    function playNext() {
      if (index >= rows.length) {
        playbackRef.current = null;
        return;
      }
      const commentRecord = rows[index];
      index += 1;
      queueComment(commentRecord);
      if (index === 1) startWindow();
      playbackRef.current = window.setTimeout(playNext, Math.max(MIN_COMMENT_DELAY, Number(commentRecord.delay_ms) || 320));
    }

    playNext();
  }

  function handleInject() {
    if (source !== 'mock' || isLoading) return;
    setError('');
    queueComment({ user: 'demo', text: 'kak mahal amat di sebelah 80k', platform: 'tiktok' });
    if (!isWindowing) startWindow();
  }

  async function handleSendNow() {
    if (isLoading) return;

    const identifier = liveInput.trim();
    const isLiveRequest = source !== 'mock' && identifier.length > 0 && buffer.length === 0;
    if (buffer.length === 0 && !isLiveRequest) return;

    stopPlayback();
    clearWindowTimers();
    const snapshot = [...buffer];
    setWindowSnapshot(snapshot);
    setBuffer([]);
    setIsLoading(true);
    setError('');
    setCard(null);
    setIsStale(false);

    const payload = buildAnalyzePayload({ source, identifier: isLiveRequest ? identifier : '', comments: snapshot });

    try {
      const nextCard = await requestAnalyzeCard(payload);
      setCard(nextCard);
      setLastUpdated(Date.now());
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Permintaan tidak berhasil.';
      setError(`Tidak bisa terhubung ke API. ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    handleSendNowRef.current = handleSendNow;
  });

  function handleRetry() {
    if (windowSnapshot.length > 0) {
      setBuffer(windowSnapshot);
      setError('');
      window.setTimeout(() => handleSendNowRef.current?.(), 0);
      return;
    }
    if (hasLiveInput) handleSendNow();
  }

  const actionLabel = isWindowing
    ? `Window berjalan, ${secondsLeft} detik`
    : hasLiveInput && buffer.length === 0
      ? `Jalankan live ${SOURCE_COPY[source].label}`
      : buffer.length > 0
        ? `Kirim Window (${buffer.length})`
        : 'Kirim Window';

  return (
    <main className="app-shell">
      <a className="skip-link" href="#cue">
        Langsung ke cue
      </a>
      <header className="status-strip">
        <div className="brand-lockup">
          <h1 className="brand-wordmark">LiveLaku</h1>
          <span className="brand-caption">cue sheet untuk host</span>
        </div>
        <div className="status-context" aria-label="Status LiveLaku">
          <StatusTag tone={status.tone}>{status.label}</StatusTag>
          <span className="status-context-item">
            <span className="context-label">Sumber</span>
            <SourceTag source={source} />
          </span>
          <span className="status-context-item status-freshness">{formatUpdatedAt(lastUpdated)}</span>
        </div>
      </header>

      <CueSheet
        card={card}
        isWindowing={isWindowing}
        isLoading={isLoading}
        error={error}
        isStale={isStale}
        onPlay={handlePlay}
        onRetry={handleRetry}
        disabled={isLoading || isWindowing}
      />

      <section id="setup" className="workbench-grid" aria-label="Setup dan Window">
        <form
          className="workbench-panel setup-panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (source === 'mock' && buffer.length === 0) handlePlay();
            else handleSendNow();
          }}
        >
          <div className="panel-heading">
            <div>
              <p className="section-kicker section-kicker-on-dark">Setup Window</p>
              <h2>Siapkan sumber komentar</h2>
            </div>
            <span className="mono-value">10 detik</span>
          </div>

          <div className="field-grid">
            <label className="field-label" htmlFor="source-select">
              <span>Sumber komentar</span>
              <select
                id="source-select"
                value={source}
                onChange={(event) => handleSourceChange(event.target.value)}
                disabled={isWindowing || isLoading}
              >
                <option value="mock">Mock</option>
                <option value="shopee">Shopee Live</option>
                <option value="tiktok">TikTok Live</option>
              </select>
            </label>

            <label className="field-label" htmlFor="live-identifier">
              <span>{sourceDetails.inputLabel}</span>
              <input
                id="live-identifier"
                type="text"
                value={liveInput}
                onChange={(event) => setLiveInput(event.target.value)}
                placeholder={sourceDetails.placeholder}
                autoComplete="off"
                disabled={isWindowing || isLoading}
              />
            </label>
          </div>
          <p className="field-helper">{sourceDetails.inputGuidance}</p>

          <div className="action-row">
            <button className="button button-primary" type="submit" disabled={isLoading || isWindowing || (source !== 'mock' && !canSend)}>
              {source === 'mock' && buffer.length === 0 ? 'Putar flood demo' : actionLabel}
            </button>
            {source === 'mock' ? (
              <button className="button button-quiet" type="button" onClick={handleInject} disabled={isLoading}>
                Suntikkan satu komentar
              </button>
            ) : null}
            {buffer.length > 0 ? (
              <button className="button button-outline" type="button" onClick={handleSendNow} disabled={isLoading}>
                Kirim sekarang
              </button>
            ) : null}
          </div>
          {error ? <p className="form-error" role="status">{error}</p> : null}
        </form>

        <section className="workbench-panel window-panel" aria-labelledby="window-heading">
          <div className="panel-heading">
            <div>
              <p className="section-kicker section-kicker-on-dark">Window monitor</p>
              <h2 id="window-heading">Komentar yang sedang dikumpulkan</h2>
            </div>
            <span className="window-count mono-value">{buffer.length} tersimpan</span>
          </div>

          <div className="window-status-row">
            <span>{isWindowing ? 'Menunggu Window selesai' : isLoading ? 'Menganalisis Window' : 'Belum mengumpulkan'}</span>
            <strong className="window-clock">{isWindowing ? `${secondsLeft}s` : `${WINDOW_SECONDS}s`}</strong>
          </div>
          <div className="window-track" aria-label={`Progress Window ${Math.round(windowProgress)} persen`} role="progressbar" aria-valuenow={Math.round(windowProgress)} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${isWindowing ? windowProgress : 0}%` }} />
          </div>

          {buffer.length === 0 ? (
            <p className="window-empty">Belum ada flood. Putar flood demo atau isi sumber live.</p>
          ) : (
            <>
              <div className="buffer-meta">
                {Object.entries(platformCounts).map(([platform, count]) => (
                  <span className="buffer-chip" key={platform}>
                    {platform} {count}
                  </span>
                ))}
              </div>
              <ul className="buffer-list" aria-label="Komentar terbaru">
                {buffer.slice(-6).map((comment, index) => (
                  <li key={`${comment.user}-${comment.text}-${index}`}>
                    <span className="buffer-user">{comment.user}</span>
                    <span className="buffer-text">{comment.text}</span>
                  </li>
                ))}
              </ul>
              {buffer.length > 6 ? <p className="buffer-overflow">Menampilkan 6 komentar terbaru dari {buffer.length}.</p> : null}
            </>
          )}

          {windowSnapshot.length > 0 && !buffer.length && !isWindowing ? (
            <details className="snapshot-disclosure">
              <summary>Lihat Window terakhir</summary>
              <ul className="snapshot-list">
                {windowSnapshot.slice(-6).map((comment, index) => (
                  <li key={`${comment.user}-${comment.text}-${index}`}>
                    <span className="buffer-user">{comment.user}</span>
                    <span>{comment.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </section>

      <footer className="app-footer">
        <span>LiveLaku menyatukan satu flood menjadi satu cue untuk setiap Window.</span>
        <span className="mono-value">POST /analyze · source: {source}</span>
      </footer>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading ? 'Window sedang dianalisis.' : card ? 'Cue baru tersedia.' : ''}
      </div>
    </main>
  );
}
