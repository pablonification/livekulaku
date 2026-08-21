import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Badge } from '@astryxdesign/core/Badge';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Divider } from '@astryxdesign/core/Divider';
import { Spinner } from '@astryxdesign/core/Spinner';

const WINDOW_SECONDS = 10;

export default function App() {
  const [source, setSource] = useState('mock');
  const [liveInput, setLiveInput] = useState('');
  const [buffer, setBuffer] = useState([]);
  const [flood, setFlood] = useState([]);
  const [card, setCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWindowing, setIsWindowing] = useState(false);
  const timerRef = useRef(null);
  const floodRef = useRef([]);
  const handleSendNowRef = useRef(null);

  const placeholder =
    source === 'shopee'
      ? '6236215 (session_id)'
      : source === 'tiktok'
        ? '@tokoku'
        : 'leave empty for Mock';

  const inputLabel =
    source === 'mock'
      ? 'Live handle / session_id (mock ignores this)'
      : source === 'shopee'
        ? 'Shopee session_id'
        : 'TikTok @handle';

  // load demo flood
  useEffect(() => {
    async function load() {
      const candidates = ['/demo_comments.jsonl', '/demo.jsonl', './demo_comments.jsonl'];
      for (const url of candidates) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const t = await r.text();
          if (!t.trim()) continue;
          const lines = t
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((l) => {
              try {
                return JSON.parse(l);
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          if (lines.length) {
            setFlood(lines);
            floodRef.current = lines;
            return;
          }
        } catch {
          // try next
        }
      }
      const fallback = [{ user: 'budi_99', text: 'kak harga berapa?', platform: 'tiktok' }];
      setFlood(fallback);
      floodRef.current = fallback;
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function startWindow() {
    if (timerRef.current) return;
    setIsWindowing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsWindowing(false);
      handleSendNowRef.current?.();
    }, WINDOW_SECONDS * 1000);
  }

  async function handleSendNow() {
    const liveVal = liveInput.trim();
    const isLiveRealRequest = buffer.length === 0 && liveVal && source !== 'mock';
    if (buffer.length === 0 && !isLiveRealRequest) return;

    let payload;
    let snapshot = [];
    if (isLiveRealRequest) {
      if (source === 'tiktok') payload = { source: 'tiktok', handle: liveVal, window_seconds: WINDOW_SECONDS, comments: [] };
      else if (source === 'shopee') payload = { source: 'shopee', session_id: liveVal, window_seconds: WINDOW_SECONDS, comments: [] };
      else payload = { source, window_seconds: WINDOW_SECONDS, comments: [] };
    } else {
      snapshot = [...buffer];
      setBuffer([]);
      payload = { source, window_seconds: WINDOW_SECONDS, comments: snapshot.map((c) => ({ user: c.user, text: c.text, platform: c.platform })) };
      if (liveVal && source === 'tiktok') payload.handle = liveVal;
      if (liveVal && source === 'shopee') payload.session_id = liveVal;
    }

    setIsLoading(true);
    setError('');
    setCard(null);
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();
      setCard(data);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      setCard({
        total: 0,
        window_seconds: WINDOW_SECONDS,
        clusters: [],
        top_cluster: null,
        urgency: 0,
        suggested_reply: 'API error - is backend on :8000?',
        why_now: msg,
        source: 'error',
      });
    } finally {
      setIsLoading(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setIsWindowing(false);
      }
    }
  }

  // keep ref fresh so timer always calls latest closure
  useEffect(() => {
    handleSendNowRef.current = handleSendNow;
  });

  function handlePlay() {
    let lines = floodRef.current.length ? floodRef.current : flood;
    if (!lines || lines.length === 0) {
      lines = [{ user: 'budi_99', text: 'kak harga berapa?', platform: 'tiktok' }];
    }
    let i = 0;
    const pump = setInterval(() => {
      if (i >= lines.length) {
        clearInterval(pump);
        return;
      }
      const row = lines[i++];
      const item = { user: row.user, text: row.text, platform: row.platform || 'mock' };
      setBuffer((prev) => [...prev, item]);
      startWindow();
    }, 450);
  }

  function handleInject() {
    const item = {
      user: 'judge',
      text: 'kak mahal amat di sebelah 80k',
      platform: source === 'mock' ? 'tiktok' : source,
    };
    setBuffer((prev) => [...prev, item]);
    startWindow();
  }

  const platformCounts = buffer.reduce((acc, c) => {
    acc[c.platform] = (acc[c.platform] || 0) + 1;
    return acc;
  }, {});

  const hasLiveInput = liveInput.trim().length > 0 && source !== 'mock';
  const sendLabel = hasLiveInput && buffer.length === 0 ? `Go Live Real (${source})` : `POST /analyze now${buffer.length ? ` (${buffer.length})` : ''}`;

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="display-1" as="h1" size="3xl" weight="bold">
          LiveLaku
        </Text>
        <Text type="supporting" color="secondary">
          One input - one Priority Card (Window 10s) - mock works offline. Powered by Astryx.
        </Text>
      </VStack>

      <Card padding={4} elevation="low">
        <VStack gap={3}>
          <Selector
            label="Live Source"
            description="Pick where comments come from. Mock is offline judge-safe."
            value={source}
            onChange={(v) => setSource(v)}
            options={[
              { value: 'mock', label: 'Mock (demo flood - no keys)' },
              { value: 'shopee', label: 'Shopee - session_id' },
              { value: 'tiktok', label: 'TikTok - @handle' },
            ]}
            width="100%"
          />
          <TextInput
            label={inputLabel}
            value={liveInput}
            onChange={(v) => setLiveInput(v)}
            placeholder={placeholder}
            description={
              source === 'mock'
                ? 'Mock ignores this field. For live real, fill it and click Go Live Real.'
                : source === 'shopee'
                  ? 'Shopee session_id, e.g. 6236215. Leave empty to use buffered comments.'
                  : 'TikTok handle, e.g. @tokoku. Leave empty to use buffered comments.'
            }
            hasClear
            width="100%"
          />
          <HStack gap={2} wrap="wrap">
            <Button label="Play Mock Flood (10s Window)" variant="primary" onClick={handlePlay} />
            <Button label="Inject 'kak mahal amat'" variant="secondary" onClick={handleInject} />
            <Button label={sendLabel} variant={hasLiveInput && buffer.length === 0 ? 'primary' : 'secondary'} onClick={handleSendNow} />
          </HStack>
          <Text type="supporting" color="secondary" size="sm">
            FE batches one Window locally, then <Text type="code">POST /analyze {'{'}comments: [...] {'}'}</Text>. BE is sync-only, see <Text type="code">contracts/openapi.yaml</Text>. Mode is <Badge label={source} variant="neutral" /> Window {WINDOW_SECONDS}s.
          </Text>
        </VStack>
      </Card>

      <Card padding={4} elevation="low">
        <VStack gap={3}>
          <HStack gap={2} vAlign="center" hAlign="between">
            <Text type="label" weight="semibold">
              Window buffer <Badge label={`${buffer.length}`} variant="info" /> {buffer.length ? `· ${buffer.length} comments queued` : '· empty'}
            </Text>
            {isWindowing && <Badge label="Window running - 10s" variant="warning" />}
            {!isWindowing && buffer.length > 0 && <Badge label="Idle" variant="neutral" />}
          </HStack>

          {buffer.length === 0 ? (
            <VStack gap={2} padding={2}>
              <Text type="supporting" color="secondary">
                No comments yet - click Play Mock Flood or Inject to fill the window.
              </Text>
            </VStack>
          ) : (
            <VStack gap={1}>
              <div
                style={{
                  maxHeight: 180,
                  overflow: 'auto',
                  border: '1px dashed var(--color-border-default, #ddd)',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {buffer.slice(-20).map((c, idx) => (
                  <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13, display: 'flex', gap: 6 }}>
                    <Badge label={c.platform} variant="neutral" />
                    <span>
                      <strong>{c.user || 'viewer'}</strong> - {c.text}
                    </span>
                  </div>
                ))}
              </div>
            </VStack>
          )}

          <HStack gap={2} wrap="wrap">
            {Object.entries(platformCounts).length === 0 ? (
              <Badge label="no comments yet" variant="neutral" />
            ) : (
              Object.entries(platformCounts).map(([k, v]) => <Badge key={k} label={`${k}: ${v}`} variant="info" />)
            )}
          </HStack>

          {Object.keys(platformCounts).length > 1 && (
            <VStack gap={1}>
              {Object.entries(platformCounts).map(([k, v]) => (
                <ProgressBar key={k} label={k} value={Math.round((v / Math.max(1, buffer.length)) * 100)} max={100} hasValueLabel variant="accent" />
              ))}
            </VStack>
          )}
        </VStack>
      </Card>

      <Card padding={4} elevation="low" variant={card && card.top_cluster ? 'default' : 'muted'}>
        <VStack gap={3}>
          <Text type="label" weight="semibold" size="lg">
            Priority Card {card ? <Badge label={`${card.total} total`} variant="neutral" /> : null} {isLoading ? <Spinner /> : null}
          </Text>
          <Divider />

          {isLoading && (
            <HStack gap={2} vAlign="center">
              <Spinner />
              <Text type="body">Analyzing window...</Text>
            </HStack>
          )}

          {!isLoading && !card && (
            <VStack gap={2}>
              <Text type="supporting" color="secondary">
                No card yet. Fill the window (Play Flood injects 18 demo comments) and it will auto-POST after 10s, or click POST now.
              </Text>
              {error && (
                <Text type="supporting" color="secondary">
                  Last error: {error}
                </Text>
              )}
            </VStack>
          )}

          {!isLoading && card && (
            <VStack gap={3}>
              {card.top_cluster ? (
                <VStack gap={1}>
                  <HStack gap={2} wrap="wrap" vAlign="center">
                    <Badge label={card.top_cluster.label_id || card.top_cluster.label} variant="success" />
                    <Text type="body" weight="semibold">
                      {card.top_cluster.label} - {card.top_cluster.count}/{card.total} ({Math.round((card.top_cluster.share || 0) * 100)}%)
                    </Text>
                    <Badge label={`urgency ${card.urgency}`} variant={card.urgency > 70 ? 'error' : card.urgency > 40 ? 'warning' : 'info'} />
                    <Badge label={card.tone || 'inform'} variant="neutral" />
                    <Badge label={card.source || source} variant="neutral" />
                  </HStack>
                  <ProgressBar label={`${card.top_cluster.label} share`} value={Math.round((card.top_cluster.share || 0) * 100)} max={100} hasValueLabel variant={card.urgency > 70 ? 'error' : 'accent'} />
                  {card.top_cluster.samples && card.top_cluster.samples.length > 0 && (
                    <Text type="supporting" color="secondary">
                      Samples: {card.top_cluster.samples.join(' | ')}
                    </Text>
                  )}
                </VStack>
              ) : (
                <Text type="body">No flood in this Window - {card.suggested_reply}</Text>
              )}

              {card.clusters && card.clusters.length > 0 && (
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">
                    Clusters in window:
                  </Text>
                  <HStack gap={2} wrap="wrap">
                    {card.clusters.map((c) => (
                      <Badge key={c.label} label={`${c.label}: ${c.count} (${Math.round(c.share * 100)}%)`} variant="neutral" />
                    ))}
                  </HStack>
                  <VStack gap={1}>
                    {card.clusters.map((c) => (
                      <ProgressBar key={c.label} label={c.label} value={Math.round(c.share * 100)} max={100} hasValueLabel variant="neutral" />
                    ))}
                  </VStack>
                </VStack>
              )}

              <Divider />

              <VStack gap={1}>
                <Text type="body" weight="semibold" size="lg">
                  {card.suggested_reply}
                </Text>
                <Text type="supporting" color="secondary">
                  {card.why_now}
                </Text>
              </VStack>

              <Text type="supporting" color="secondary" size="sm">
                urgency {card.urgency} - {card.source} - window {card.window_seconds}s
              </Text>
            </VStack>
          )}
        </VStack>
      </Card>

      <Text type="supporting" color="secondary" size="sm">
        <Text type="code">contracts/openapi.yaml</Text> is the contract - see <Text type="code">AGENTS.md</Text> - Astryx theme neutral - single input to single output per Window.
      </Text>
    </VStack>
  );
}
