import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Autocomplete } from '../components/Autocomplete'
import { trackEvent } from '../scripts/analytics'
import { BLOCKED_COUNTRIES_KEY, COUNTRY_FLAGS, HIGHLIGHT_FLAGS_KEY, HIGHLIGHT_KEYWORDS_KEY, REGION_FLAGS, SHOW_LOCATION_IN_FEED_KEY } from '../scripts/countries'
import css from './options.module.css'

const ALL_FLAGS: Record<string, string> = { ...COUNTRY_FLAGS, ...REGION_FLAGS }
const ALL_LOCATIONS = Object.keys(ALL_FLAGS).sort()

const KEYWORD_SUGGESTIONS = [
  'NAFO', 'Free Palestine', '🏳️‍🌈', '🏳️‍⚧️', '🇵🇸', '🇺🇦', '🇷🇺', '🇮🇳', 'he/him', 'she/her', 'he/them', 'she/them', 'they/them', 'crypto', 'nft', 'trading', 'forex', 'airdrop', 'web3', 'defi',
  'giveaway', 'investment', 'onlyfans',
].sort((a, b) => a.localeCompare(b))

function Options() {
  const [blocked, setBlocked] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [flagsEnabled, setFlagsEnabled] = useState(false)
  const [flagsThreshold, setFlagsThreshold] = useState(2)
  const [flagsUniqueOnly, setFlagsUniqueOnly] = useState(true)
  const [showLocationInFeed, setShowLocationInFeed] = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)

  async function handleClearCache() {
    await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' })
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2000)
  }

  useEffect(() => {
    chrome.storage.local.get([BLOCKED_COUNTRIES_KEY, HIGHLIGHT_KEYWORDS_KEY, HIGHLIGHT_FLAGS_KEY, SHOW_LOCATION_IN_FEED_KEY]).then((result) => {
      setBlocked((result[BLOCKED_COUNTRIES_KEY] as string[] | undefined) ?? [])
      setKeywords((result[HIGHLIGHT_KEYWORDS_KEY] as string[] | undefined) ?? [])
      const flags = result[HIGHLIGHT_FLAGS_KEY] as { enabled?: boolean; threshold?: number; uniqueOnly?: boolean } | undefined
      setFlagsEnabled(flags?.enabled ?? false)
      setFlagsThreshold(flags?.threshold ?? 2)
      setFlagsUniqueOnly(flags?.uniqueOnly ?? true)
      setShowLocationInFeed(Boolean(result[SHOW_LOCATION_IN_FEED_KEY]))
    })
  }, [])

  function addBlocked(country: string) {
    if (blocked.includes(country)) return
    const next = [...blocked, country]
    setBlocked(next)
    chrome.storage.local.set({ [BLOCKED_COUNTRIES_KEY]: next })
    trackEvent('country_blocked', { country })
  }

  function removeBlocked(country: string) {
    const next = blocked.filter((c) => c !== country)
    setBlocked(next)
    chrome.storage.local.set({ [BLOCKED_COUNTRIES_KEY]: next })
    trackEvent('country_unblocked', { country })
  }

  function addKeyword(kw: string) {
    const trimmed = kw.trim().toLowerCase()
    if (!trimmed || keywords.includes(trimmed)) return
    const next = [...keywords, trimmed].sort()
    setKeywords(next)
    chrome.storage.local.set({ [HIGHLIGHT_KEYWORDS_KEY]: next })
  }

  function removeKeyword(kw: string) {
    const next = keywords.filter((k) => k !== kw.trim().toLowerCase())
    setKeywords(next)
    chrome.storage.local.set({ [HIGHLIGHT_KEYWORDS_KEY]: next })
  }

  function updateFlags(enabled: boolean, threshold: number, uniqueOnly: boolean) {
    setFlagsEnabled(enabled)
    setFlagsThreshold(threshold)
    setFlagsUniqueOnly(uniqueOnly)
    chrome.storage.local.set({ [HIGHLIGHT_FLAGS_KEY]: { enabled, threshold, uniqueOnly } })
  }

  return (
    <div class={css.container}>
      <h1 class={css.title}>Options</h1>

      <details class={css.accordion} open>
        <summary class={css.accordionSummary}>
          <span>Highlight tweets by keyword 🔍</span>
          <span class={css.accordionArrow}>▾</span>
        </summary>
        <div class={css.accordionContent}>
          <p class={css.subtitle}>
            Highlight tweets from users whose nickname or bio contains any of these keywords.
          </p>

          {keywords.length > 0 && (
            <div class={css.chips}>
              {keywords.map((kw) => (
                <span key={kw} class={`${css.chip} ${css.chipKeyword}`}>
                  {kw}
                  <button class={css.chipRemove} onClick={() => removeKeyword(kw)} title={`Remove ${kw}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <Autocomplete
            id="keyword"
            selected={keywords}
            allOptions={KEYWORD_SUGGESTIONS}
            onSelect={addKeyword}
            placeholder="Type a keyword or pick a suggestion..."
            allowFreeInput
            closeOnSelect={false}
          />

          {keywords.length === 0 && (
            <p class={css.empty}>No keywords set — all comments shown normally.</p>
          )}
        </div>
      </details>

      <details class={css.accordion}>
        <summary class={css.accordionSummary}>
          <span>Highlight tweets by flags 🏴</span>
          <span class={css.accordionArrow}>▾</span>
        </summary>
        <div class={css.accordionContent}>
          <p class={css.subtitle}>Highlight tweets from users whose bio contains many flags.</p>
          <label class={css.controlRow}>
            <input
              type="checkbox"
              checked={flagsEnabled}
              onChange={(e) => updateFlags((e.target as HTMLInputElement).checked, flagsThreshold, flagsUniqueOnly)}
            />
            <span>Highlight if bio has more than</span>
            <input
              type="number"
              class={css.numberInput}
              value={flagsThreshold}
              min={0}
              max={20}
              disabled={!flagsEnabled}
              onInput={(e) => updateFlags(flagsEnabled, Math.max(0, Number((e.target as HTMLInputElement).value)), flagsUniqueOnly)}
            />
            <span>flags</span>
          </label>
          <label class={css.controlRow}>
            <input
              type="checkbox"
              checked={flagsUniqueOnly}
              disabled={!flagsEnabled}
              onChange={(e) => updateFlags(flagsEnabled, flagsThreshold, (e.target as HTMLInputElement).checked)}
            />
            <span>Count only unique flags</span>
          </label>
        </div>
      </details>

      <label class={css.inlineOption}>
        <input
          type="checkbox"
          checked={showLocationInFeed}
          onChange={(e) => {
            const next = (e.target as HTMLInputElement).checked
            setShowLocationInFeed(next)
            chrome.storage.local.set({ [SHOW_LOCATION_IN_FEED_KEY]: next })
          }}
        />
        <span>Show location in feed 📍</span>
      </label>

      <details class={css.accordion}>
        <summary class={css.accordionSummary}>
          <span>Replace flags with ⚠️</span>
          <span class={css.accordionArrow}>▾</span>
        </summary>
        <div class={css.accordionContent}>
          <p class={css.subtitle}>Profiles from selected countries will show ⚠️ instead of their flag.</p>

          {blocked.length > 0 && (
            <div class={css.chips}>
              {blocked.map((country) => (
                <span key={country} class={css.chip}>
                  <span class={css.chipFlag}>{ALL_FLAGS[country] ?? '🌐'}</span>
                  {country}
                  <button class={css.chipRemove} onClick={() => removeBlocked(country)} title={`Remove ${country}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <Autocomplete
            id="country"
            selected={blocked}
            allOptions={ALL_LOCATIONS}
            onSelect={addBlocked}
            placeholder="Search countries..."
            renderOption={(c) => (
              <>
                <span class={css.dropdownFlag}>{ALL_FLAGS[c] ?? '🌐'}</span>
                <span>{c}</span>
              </>
            )}
          />

          {blocked.length === 0 && (
            <p class={css.empty}>No countries selected — all flags shown as-is.</p>
          )}
        </div>
      </details>

      <div class={css.cacheSection}>
        <button class={css.clearCacheBtn} onClick={handleClearCache} disabled={cacheCleared}>
          {cacheCleared ? 'Cache cleared!' : 'Clear location cache'}
        </button>
      </div>
    </div>
  )
}

render(<Options />, document.body)
