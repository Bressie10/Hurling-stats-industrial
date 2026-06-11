<script>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { loadMatches, saveMatch } from './db.js'
  import { scheduleAutoSync } from './sync.js'
  import { user } from './auth-store.js'
  import { settingsStore } from './settings-store.js'
  import { showToast } from './toast.js'
  import { analyzeMatch, formatMatchScore, summarizeSeason } from './match-insights.js'

  const TARGETS_KEY = 'doora-team-targets'

  let matches = $state([])
  let selectedMatchId = $state(null)
  let targetConfig = $state({ targets: {}, customStats: [] })
  let loading = $state(true)
  let saving = $state(false)
  let saved = $state(false)
  let coachSummary = $state('')
  let workOnsText = $state('')
  let reviewMatchKey = $state(null)

  onMount(async () => {
    targetConfig = readTargetConfig()
    const loaded = await loadMatches()
    matches = loaded.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    const requested = page.url.searchParams.get('match')
    selectedMatchId = requested || (matches[0] ? String(matches[0].id) : null)
    loading = false
  })

  $effect(() => {
    const requested = page.url.searchParams.get('match')
    if (requested && requested !== selectedMatchId) selectedMatchId = requested
  })

  $effect(() => {
    if (!matches.length) return
    if (!selectedMatchId || !matches.some(match => String(match.id) === String(selectedMatchId))) {
      selectedMatchId = String(matches[0].id)
    }
  })

  let selectedMatch = $derived(
    matches.find(match => String(match.id) === String(selectedMatchId)) || null
  )
  let insights = $derived(selectedMatch ? analyzeMatch(selectedMatch, matches, targetConfig) : null)
  let season = $derived(summarizeSeason(matches))

  $effect(() => {
    if (!selectedMatch || !insights) return
    const key = String(selectedMatch.id)
    if (reviewMatchKey === key) return
    reviewMatchKey = key
    coachSummary = selectedMatch.coachSummary || insights.defaultCoachSummary
    workOnsText = Array.isArray(selectedMatch.workOns) && selectedMatch.workOns.length
      ? selectedMatch.workOns.join('\n')
      : insights.workOns.join('\n')
    saved = false
  })

  function readTargetConfig() {
    if (typeof localStorage === 'undefined') return { targets: {}, customStats: [] }
    try {
      const raw = localStorage.getItem(TARGETS_KEY)
      if (!raw) return { targets: {}, customStats: [] }
      const parsed = JSON.parse(raw)
      return {
        targets: parsed.targets || {},
        customStats: parsed.customStats || []
      }
    } catch (_) {
      return { targets: {}, customStats: [] }
    }
  }

  function formatResult(outcome) {
    if (!outcome) return '-'
    if (outcome.result === 'D') return 'Draw'
    return outcome.result === 'W' ? `Win +${outcome.margin}` : `Loss -${outcome.margin}`
  }

  function formatTrend(row) {
    if (row.direction === 'stable') return 'Stable'
    return row.direction === 'improving' ? 'Improving' : 'Needs attention'
  }

  function formatSigned(value) {
    if (value > 0) return `+${value}`
    return String(value)
  }

  function formatTime(seconds) {
    if (seconds == null || seconds === 999999) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  function splitWorkOns() {
    return workOnsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 10)
  }

  async function saveReview() {
    if (!selectedMatch || saving) return
    saving = true
    saved = false
    const updated = {
      ...selectedMatch,
      coachSummary: coachSummary.trim(),
      workOns: splitWorkOns(),
      updated_at: Date.now()
    }
    try {
      await saveMatch(updated)
      matches = matches.map(match => String(match.id) === String(updated.id) ? updated : match)
      scheduleAutoSync($user?.id)
      saved = true
      showToast('Review saved', 'success')
      setTimeout(() => saved = false, 2500)
    } catch (e) {
      showToast('Review save failed: ' + (e?.message || String(e)), 'error')
    } finally {
      saving = false
    }
  }

  function resetGeneratedReview() {
    if (!insights) return
    coachSummary = insights.defaultCoachSummary
    workOnsText = insights.workOns.join('\n')
    saved = false
  }
</script>

<div class="screen insights-screen">
  <div class="insights-header">
    <div>
      <h2>Coaching Insights</h2>
      <p>{season.played} match{season.played === 1 ? '' : 'es'} analysed for {$settingsStore.teamName || 'GAAstat'}</p>
    </div>
    {#if selectedMatch}
      <button class="save-review-btn" class:saved disabled={saving} onclick={saveReview}>
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Review'}
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="empty-state">
      <div class="empty-title">Loading insights</div>
    </div>
  {:else if !selectedMatch || !insights}
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
          <line x1="2" y1="20" x2="22" y2="20"/>
        </svg>
      </div>
      <div class="empty-title">No saved matches yet</div>
      <div class="empty-sub">Save a match to unlock review insights.</div>
    </div>
  {:else}
    <div class="selector-card">
      <div class="field-group">
        <label>Match</label>
        <select bind:value={selectedMatchId}>
          {#each matches as match}
            <option value={String(match.id)}>vs {match.opposition} - {match.date}</option>
          {/each}
        </select>
      </div>
      <div class="fixture-summary">
        <span>{formatMatchScore(selectedMatch.score?.home)}</span>
        <strong>{formatResult(insights.outcome)}</strong>
        <span>{formatMatchScore(selectedMatch.score?.away)}</span>
      </div>
    </div>

    <div class="overview-grid">
      <div class="metric-card">
        <span class="metric-label">Result</span>
        <strong class:win={insights.outcome.result === 'W'} class:loss={insights.outcome.result === 'L'}>{formatResult(insights.outcome)}</strong>
        <span>{formatMatchScore(selectedMatch.score?.home)} to {formatMatchScore(selectedMatch.score?.away)}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Shooting</span>
        <strong>{insights.shots.accuracy === null ? '-' : insights.shots.accuracy + '%'}</strong>
        <span>{insights.shots.scores} scores / {insights.shots.attempts} attempts</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Puckouts</span>
        <strong>{insights.puckouts.winPct === null ? '-' : insights.puckouts.winPct + '%'}</strong>
        <span>{insights.puckouts.won} won / {insights.puckouts.total} total</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Targets</span>
        <strong>{insights.targets.filter(t => t.status === 'met').length}/{insights.targets.length || 0}</strong>
        <span>met this match</span>
      </div>
    </div>

    <div class="card story-card">
      <div class="section-label">Match story</div>
      <h3>{insights.story.headline}</h3>
      {#if insights.story.bullets.length > 0}
        <div class="story-list">
          {#each insights.story.bullets as bullet}
            <div class="story-row">
              <span class="story-dot"></span>
              <p>{bullet}</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="review-grid">
      <div class="card review-card">
        <div class="review-card-head">
          <div class="section-label">Coach summary</div>
          <button class="ghost-small" onclick={resetGeneratedReview}>Regenerate</button>
        </div>
        <textarea bind:value={coachSummary} rows="5" placeholder="Add review summary"></textarea>
      </div>

      <div class="card review-card">
        <div class="section-label">Work-ons</div>
        <textarea bind:value={workOnsText} rows="5" placeholder="Add one focus per line"></textarea>
      </div>
    </div>

    {#if insights.periods.length > 0 || insights.scoringRun.bestHomeRun || insights.scoringRun.bestAwayRun}
      <div class="card">
        <div class="section-label">Momentum</div>
        {#if insights.scoringRun.bestHomeRun || insights.scoringRun.bestAwayRun}
          <div class="run-grid">
            {#if insights.scoringRun.bestHomeRun}
              <div class="run-card">
                <span>Best scoring run</span>
                <strong>{insights.scoringRun.bestHomeRun.points} unanswered</strong>
                <small>{formatTime(insights.scoringRun.bestHomeRun.start?.time)} to {formatTime(insights.scoringRun.bestHomeRun.end?.time)}</small>
              </div>
            {/if}
            {#if insights.scoringRun.bestAwayRun}
              <div class="run-card danger">
                <span>Opposition run</span>
                <strong>{insights.scoringRun.bestAwayRun.points} unanswered</strong>
                <small>{formatTime(insights.scoringRun.bestAwayRun.start?.time)} to {formatTime(insights.scoringRun.bestAwayRun.end?.time)}</small>
              </div>
            {/if}
          </div>
        {/if}

        {#if insights.periods.length > 0}
          <div class="period-table">
            <div class="period-head">
              <span>Period</span>
              <span>For</span>
              <span>Against</span>
              <span>Margin</span>
              <span>Shots</span>
            </div>
            {#each insights.periods as row}
              <div class="period-row">
                <span>{row.period}</span>
                <span>{row.home}</span>
                <span>{row.away}</span>
                <strong class:good={row.margin > 0} class:bad={row.margin < 0}>{formatSigned(row.margin)}</strong>
                <span>{row.points + row.goals + row.wides}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="card">
      <div class="section-label">Player impact</div>
      {#if insights.players.length === 0}
        <p class="muted-text">No player events were logged for this match.</p>
      {:else}
        <div class="impact-table">
          <div class="impact-head">
            <span>Player</span>
            <span>Score</span>
            <span>Positive</span>
            <span>Errors</span>
            <span>Impact</span>
          </div>
          {#each insights.players.slice(0, 12) as row}
            <div class="impact-row">
              <span class="player-cell"><span class="num-badge">#{row.number}</span>{row.name}</span>
              <span>{row.score}</span>
              <span>{row.positive}</span>
              <span>{row.negative}</span>
              <strong class:good={row.impact > 0} class:bad={row.impact < 0}>{formatSigned(row.impact)}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="analysis-grid">
      <div class="card">
        <div class="section-label">Target consistency</div>
        {#if insights.targets.length === 0}
          <p class="muted-text">No team targets are set.</p>
        {:else}
          <div class="target-list">
            {#each insights.targets as target}
              <div class="target-row">
                <div>
                  <strong>{target.label}</strong>
                  <span>{target.seasonMet}/{target.seasonTotal} matches met - avg {target.avg}</span>
                </div>
                <div class="target-status" class:met={target.status === 'met'}>
                  <strong>{target.matchValue}</strong>
                  <span>target {target.target}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="card">
        <div class="section-label">Season trend</div>
        {#if season.trends.length === 0}
          <p class="muted-text">Trend data appears after multiple saved matches.</p>
        {:else}
          <div class="trend-list">
            {#each season.trends.slice(0, 6) as row}
              <div class="trend-row">
                <span>{row.label}</span>
                <strong class:good={row.direction === 'improving'} class:bad={row.direction === 'slipping'}>{formatTrend(row)}</strong>
                <span>{row.previousAvg} -> {row.recentAvg}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if insights.pitch.locatedEvents.length > 0}
      <div class="card">
        <div class="pitch-head">
          <div class="section-label">Pitch locations</div>
          <span>{insights.pitch.locatedEvents.length} located event{insights.pitch.locatedEvents.length === 1 ? '' : 's'}</span>
        </div>
        <div class="insight-pitch-wrap">
          <svg class="insight-pitch" viewBox="0 0 300 200">
            <rect width="300" height="200" fill="#2d7a2d" rx="5"/>
            <rect x="4" y="4" width="292" height="192" fill="none" stroke="white" stroke-width="1.4" opacity="0.75"/>
            <line x1="150" y1="4" x2="150" y2="196" stroke="white" stroke-width="1.3" opacity="0.7"/>
            <circle cx="150" cy="100" r="30" fill="none" stroke="white" stroke-width="1" opacity="0.5"/>
            <rect x="4" y="60" width="40" height="80" fill="none" stroke="white" stroke-width="1" opacity="0.55"/>
            <rect x="256" y="60" width="40" height="80" fill="none" stroke="white" stroke-width="1" opacity="0.55"/>
            <line x1="99" y1="4" x2="99" y2="196" stroke="white" stroke-width="0.6" opacity="0.24"/>
            <line x1="201" y1="4" x2="201" y2="196" stroke="white" stroke-width="0.6" opacity="0.24"/>
            <line x1="4" y1="66" x2="296" y2="66" stroke="white" stroke-width="0.6" opacity="0.24"/>
            <line x1="4" y1="132" x2="296" y2="132" stroke="white" stroke-width="0.6" opacity="0.24"/>
            {#each insights.pitch.locatedEvents as event}
              <circle cx={event.x * 3} cy={event.y * 2} r={event.stat === 'Goal' ? 5 : 4} fill={event.color} stroke="white" stroke-width="1" opacity="0.92">
                <title>{event.playerName} - {event.stat}</title>
              </circle>
            {/each}
          </svg>
        </div>

        {#if insights.pitch.shotZones.length > 0}
          <div class="shot-zone-list">
            {#each insights.pitch.shotZones.slice(0, 6) as zone}
              <div class="shot-zone-row">
                <span>{zone.zone}</span>
                <strong>{zone.accuracy}%</strong>
                <span>{zone.goals}G {zone.points}P {zone.wides}W</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .insights-screen {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .insights-header,
  .selector-card,
  .review-card-head,
  .pitch-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .insights-header h2 {
    font-size: 1.45rem;
    line-height: 1.1;
    margin: 0 0 4px;
  }

  .insights-header p {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .save-review-btn,
  .ghost-small {
    border-radius: 7px;
    border: 1.5px solid var(--primary);
    background: var(--primary);
    color: var(--primary-text);
    font-size: 0.84rem;
    font-weight: 800;
    padding: 9px 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  .save-review-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .save-review-btn.saved {
    background: #2d7a2d;
    border-color: #2d7a2d;
    color: white;
  }

  .ghost-small {
    background: transparent;
    color: var(--primary);
    padding: 6px 9px;
    font-size: 0.75rem;
  }

  .selector-card,
  .card,
  .metric-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
  }

  .selector-card {
    padding: 12px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  label,
  .section-label,
  .metric-label {
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--text);
    border-radius: 7px;
    font: inherit;
  }

  select {
    height: 42px;
    padding: 0 10px;
  }

  textarea {
    min-height: 132px;
    resize: vertical;
    padding: 10px;
    line-height: 1.45;
  }

  .fixture-summary {
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: center;
    gap: 9px;
    color: var(--text-2);
    font-weight: 800;
    white-space: nowrap;
  }

  .fixture-summary strong {
    color: var(--primary);
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  .overview-grid,
  .review-grid,
  .analysis-grid,
  .run-grid {
    display: grid;
    gap: 10px;
  }

  .overview-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .review-grid,
  .analysis-grid,
  .run-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card,
  .card {
    padding: 14px;
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .metric-card strong {
    font-size: 1.4rem;
    line-height: 1;
  }

  .metric-card span:last-child {
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .win,
  .good {
    color: var(--primary) !important;
  }

  .loss,
  .bad {
    color: #e53935 !important;
  }

  .story-card h3 {
    margin: 8px 0 10px;
    font-size: 1.05rem;
    line-height: 1.25;
  }

  .story-list {
    display: grid;
    gap: 8px;
  }

  .story-row {
    display: grid;
    grid-template-columns: 8px 1fr;
    gap: 9px;
    align-items: start;
  }

  .story-row p {
    color: var(--text-2);
    font-size: 0.92rem;
    line-height: 1.35;
    margin: 0;
  }

  .story-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--primary);
    margin-top: 6px;
  }

  .run-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .run-card span,
  .run-card small {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .run-card strong {
    font-size: 1.15rem;
  }

  .run-card.danger strong {
    color: #ff8a80;
  }

  .period-table,
  .impact-table,
  .target-list,
  .trend-list,
  .shot-zone-list {
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }

  .period-head,
  .period-row,
  .impact-head,
  .impact-row {
    display: grid;
    align-items: center;
    gap: 8px;
  }

  .period-head,
  .period-row {
    grid-template-columns: 1.3fr 0.6fr 0.7fr 0.7fr 0.7fr;
  }

  .impact-head,
  .impact-row {
    grid-template-columns: minmax(150px, 1.7fr) 0.7fr 0.8fr 0.7fr 0.7fr;
  }

  .period-head,
  .impact-head {
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .period-row,
  .impact-row,
  .target-row,
  .trend-row,
  .shot-zone-row {
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--surface-2);
    padding: 9px;
    font-size: 0.88rem;
  }

  .player-cell {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .num-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: rgba(var(--primary-rgb), 0.12);
    color: var(--primary);
    font-size: 0.72rem;
    font-weight: 800;
  }

  .target-row,
  .trend-row,
  .shot-zone-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .target-row div:first-child,
  .trend-row span:first-child,
  .shot-zone-row span:first-child {
    min-width: 0;
  }

  .target-row strong,
  .target-row span {
    display: block;
  }

  .target-row span,
  .trend-row span,
  .shot-zone-row span {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .target-status {
    min-width: 74px;
    border-radius: 7px;
    background: rgba(229,57,53,0.1);
    color: #ff8a80;
    padding: 7px;
    text-align: center;
  }

  .target-status.met {
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary);
  }

  .target-status strong {
    font-size: 1rem;
  }

  .pitch-head span,
  .muted-text {
    color: var(--text-muted);
    font-size: 0.86rem;
  }

  .insight-pitch-wrap {
    margin-top: 12px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: #0e280e;
  }

  .insight-pitch {
    width: 100%;
    display: block;
    aspect-ratio: 3 / 2;
  }

  .empty-state {
    text-align: center;
    padding: 48px 16px;
    color: var(--text-muted);
  }

  .empty-icon svg {
    width: 44px;
    height: 44px;
    margin-bottom: 12px;
    color: var(--text-faint);
  }

  .empty-title {
    color: var(--text);
    font-weight: 800;
    margin-bottom: 5px;
  }

  .empty-sub {
    font-size: 0.9rem;
  }

  @media (max-width: 760px) {
    .insights-header,
    .selector-card {
      align-items: stretch;
      flex-direction: column;
    }

    .overview-grid,
    .review-grid,
    .analysis-grid,
    .run-grid {
      grid-template-columns: 1fr;
    }

    .fixture-summary {
      width: 100%;
      justify-content: space-between;
    }

    .impact-table,
    .period-table {
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .period-head,
    .period-row {
      min-width: 520px;
    }

    .impact-head,
    .impact-row {
      min-width: 620px;
    }
  }
</style>
