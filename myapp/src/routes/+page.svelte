<script lang="ts">
  /**
   * HOME PAGE (/)
   * Weekly puzzle lobby — one play per username per week.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    hasPlayedThisWeek,
    getUsername,
    setUsername,
    generateUsername,
    validateUsername,
    hasSeenHowTo,
    markHowToSeen,
  } from '$lib/player.js';
  import HowToPlay from '$lib/components/HowToPlay.svelte';
  import ScoreboardPanel from '$lib/components/ScoreboardPanel.svelte';
  import { tap } from '$lib/iosTap.js';

  let playedThisWeek = $state(false);
  let username = $state('');
  let usernameDraft = $state('');
  let usernameError = $state('');
  let openPanel = $state<'scoreboard' | null>(null);
  let showHowTo = $state(false);
  /** Ignore leftover iOS click after opening so the popup isn't closed or skipped. */
  let ignoreScoreboardUntil = 0;

  function closeHowTo() {
    markHowToSeen();
    showHowTo = false;
  }

  function scoreboardGestureIsStale() {
    return Date.now() < ignoreScoreboardUntil;
  }

  function toggleScoreboard() {
    if (openPanel === 'scoreboard') {
      if (scoreboardGestureIsStale()) return;
      openPanel = null;
      return;
    }
    openPanel = 'scoreboard';
    ignoreScoreboardUntil = Date.now() + 500;
  }

  function closeScoreboard() {
    if (scoreboardGestureIsStale()) return;
    openPanel = null;
  }

  function openFullScoreboard() {
    if (scoreboardGestureIsStale()) return;
    goto('/leaderboard');
  }

  onMount(() => {
    playedThisWeek = hasPlayedThisWeek();
    username = getUsername();
    usernameDraft = username;

    if (!hasSeenHowTo()) {
      showHowTo = true;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        openPanel = null;
        if (showHowTo) closeHowTo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function saveName() {
    const v = validateUsername(usernameDraft);
    if (!v.ok) {
      usernameError = v.error || 'Invalid username';
      return false;
    }
    username = setUsername(v.username);
    usernameDraft = username;
    usernameError = '';
    return true;
  }

  function randomName() {
    usernameDraft = generateUsername();
    usernameError = '';
  }

  function play() {
    if (playedThisWeek) {
      goto('/result');
      return;
    }
    if (!saveName()) return;
    goto('/puzzle');
  }
</script>

<main>
  <div class="container">
    <div class="border">
      <div class="inner-border">
        <div class="top-controls" class:panel-open={openPanel === 'scoreboard'}>
          <button
            type="button"
            class="icon-btn"
            aria-label="How to play"
            aria-expanded={showHowTo}
            {...tap(() => {
              showHowTo = true;
            })}
          >ⓘ</button>

          <div class="panel-anchor">
            <button
              type="button"
              class="icon-btn"
              aria-label="Scoreboard"
              aria-expanded={openPanel === 'scoreboard'}
              {...tap(toggleScoreboard)}
            >🜲</button>
            {#if openPanel === 'scoreboard'}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="panel-backdrop"
                role="presentation"
                {...tap(closeScoreboard)}
              ></div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="panel panel-right"
                role="dialog"
                aria-label="Scoreboard"
                onclick={(e) => e.stopPropagation()}
                ontouchend={(e) => e.stopPropagation()}
              >
                <div class="panel-header">Scoreboard</div>
                <ScoreboardPanel
                  compact={true}
                  highlightUsername={username}
                  autoLoad={false}
                  open={openPanel === 'scoreboard'}
                />
                <button
                  type="button"
                  class="panel-link"
                  {...tap(openFullScoreboard)}
                >Full scoreboard</button>
              </div>
            {/if}
          </div>
        </div>

        <div class="center">
          <img src="/gistv4.png" width="250" alt="Gist Logo" />
        </div>

        <h3 class="text">Combine icons until <br /> none remain!</h3>

        {#if !playedThisWeek}
          <div class="username-box">
            <label for="username">Username</label>
            <div class="username-row">
              <input
                id="username"
                type="text"
                maxlength="20"
                autocomplete="username"
                placeholder="Choose a name"
                bind:value={usernameDraft}
                oninput={() => (usernameError = '')}
              />
              <button type="button" class="ghost-btn" {...tap(randomName)}>Random</button>
            </div>
            {#if usernameError}
              <p class="field-error">{usernameError}</p>
            {/if}
          </div>
        {/if}

        <div class="center">
          <div class="split">
            <button
              type="button"
              class="btn-group btn-primary"
              disabled={playedThisWeek}
              {...(playedThisWeek ? {} : tap(() => play()))}
            >
              {playedThisWeek ? 'Already played' : 'Play Now'}
            </button>
            <button type="button" class="btn-group btn-secondary" {...tap(() => goto('/result'))}>
              Result
            </button>
            <button type="button" class="btn-group btn-secondary" {...tap(() => goto('/archive'))}>
              Archive
            </button>
          </div>
        </div>

        {#if playedThisWeek}
          <p class="weekly-note">
            You’ve played this week’s puzzle
            {#if username}
              as <strong>{username}</strong>
            {/if}.
            Come back next week!
          </p>
        {:else}
          <p class="weekly-note muted">new puzzle every week</p>
        {/if}
      </div>

      <footer class="footer">
        <p>
          © 2026 Gist | <a href="/terms">Terms</a> |
          <a
            class="footer-icon footer-icon-kofi"
            href="https://ko-fi.com/gistriddles"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support on Ko-fi"
            title="Support on Ko-fi"
          >
            <img src="/kofi.png" alt="" width="22" height="18" />
          </a>
          |
          <a
            class="footer-icon"
            href="https://bsky.app/profile/gistriddles.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Gist on Bluesky"
            title="Gist on Bluesky"
          >
            <svg viewBox="0 0 600 530" aria-hidden="true">
              <path
                d="M135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.708 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.43 125.59-175.91-31.511-189.63-71.85-2.514-7.4-3.61-10.89-3.61-7.94 0-3.95-1.096-.54-3.61 7.94-13.714 40.34-67.198 197.44-189.63 71.85-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.54-7.449-163.25-81.433-5.956-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"
              />
            </svg>
          </a>
        </p>
      </footer>
    </div>
  </div>

  {#if showHowTo}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-backdrop"
      role="presentation"
      {...tap(closeHowTo)}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="modal howto-modal"
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        ontouchend={(e) => e.stopPropagation()}
      >
        <HowToPlay onClose={closeHowTo} />
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .container {
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 2rem 2rem 4.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .border {
    background: var(--gist-page);
    overflow: visible;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .inner-border {
    position: relative;
    padding: 3.5rem 2rem 3rem;
    text-align: center;
    flex: 1;
  }

  .top-controls {
    position: absolute;
    top: 0.85rem;
    left: 0.85rem;
    right: 4.1rem;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    width: auto;
    max-width: none;
    margin: 0;
    z-index: 5;
  }

  .top-controls.panel-open {
    z-index: 50;
  }

  .panel-anchor {
    position: relative;
    flex: 0 0 auto;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    background: var(--gist-bg);
    color: var(--gist-icon-btn-fg);
    border: 1px solid var(--gist-border);
    border-radius: 8px;
    font-size: 1.15rem;
    line-height: 1;
    padding: 0.55rem 0.85rem;
    min-width: 2.85rem;
    min-height: 2.85rem;
    cursor: pointer;
  }

  @media (hover: hover) and (pointer: fine) {
    .icon-btn:hover {
      background: var(--gist-icon-btn-hover);
    }
  }

  .panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
  }

  .panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    z-index: 30;
    width: min(320px, calc(100vw - 2rem));
    padding: 1rem 1.1rem;
    background: var(--gist-surface);
    border: 1.5px solid var(--gist-border);
    border-radius: 12px;
    box-shadow: 0 10px 28px var(--gist-shadow);
    text-align: left;
  }

  .panel-right {
    right: 3.4rem;
  }

  .panel-header {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gist-text);
  }

  .panel-link {
    display: inline-flex;
    margin-top: 0.85rem;
    padding: 0.55rem 0.85rem;
    min-height: 44px;
    align-items: center;
    border: 1px solid var(--gist-border-strong);
    border-radius: 8px;
    background: var(--gist-bg);
    color: var(--gist-text);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  }

  @media (hover: hover) and (pointer: fine) {
    .panel-link:hover {
      background: var(--gist-icon-btn-hover);
    }
  }

  .center {
    margin: 2rem 0;
  }

  .split {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .username-box {
    max-width: 340px;
    margin: 0 auto 0.5rem;
    text-align: left;
  }

  .username-box label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gist-text-muted);
    margin-bottom: 0.4rem;
  }

  .username-row {
    display: flex;
    gap: 0.45rem;
  }

  .username-row input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0.55rem 0.75rem;
    border: 1.5px solid var(--gist-border-strong);
    border-radius: 10px;
    font-size: 1rem;
    color: var(--gist-text);
    background: var(--gist-surface);
  }

  .ghost-btn {
    min-height: 44px;
    padding: 0.55rem 0.75rem;
    border-radius: 10px;
    border: 1.5px solid var(--gist-border);
    background: var(--gist-bg);
    color: var(--gist-text);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .field-error {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: #c45b5b;
    font-weight: 600;
  }

  .text {
    font-size: 1.5rem;
    color: var(--gist-text);
    margin: 1.5rem 0;
    font-weight: 600;
  }

  .weekly-note {
    text-align: center;
    color: var(--gist-text);
    font-weight: 600;
    margin: 0.25rem 0 0;
    line-height: 1.4;
    padding: 0 0.5rem;
  }

  .weekly-note.muted {
    color: var(--gist-text-muted);
    font-weight: 500;
  }

  :global(.btn-group) {
    padding: 0.9rem 2rem;
    min-height: 48px;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    font-size: 1rem;
  }

  :global(.btn-group.btn-primary) {
    background: linear-gradient(135deg, var(--gist-primary-light), var(--gist-primary));
    color: var(--gist-on-primary);
    border: none;
    box-shadow: 0 2px 8px rgba(94, 143, 182, 0.35);
  }

  :global(.btn-group.btn-primary:disabled) {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  :global(.btn-group.btn-secondary) {
    background: var(--gist-surface);
    color: var(--gist-text-muted);
    border: 2px solid var(--gist-border-strong);
  }

  .footer {
    background: var(--gist-surface-alt);
    border-top: 1px solid var(--gist-border);
    padding: 1.5rem;
    text-align: center;
    color: var(--gist-text-muted);
    font-size: 0.9rem;
    margin-top: auto;
  }

  .footer a {
    color: var(--gist-text-muted);
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }

  .footer-icon {
    display: inline-flex;
    align-items: center;
    vertical-align: -0.15em;
  }

  .footer-icon svg {
    width: 1.35em;
    height: 1.35em;
    fill: currentColor;
    overflow: visible;
  }

  .footer-icon-kofi img {
    width: 1.55em;
    height: auto;
    display: block;
  }

  .footer a.footer-icon:hover {
    text-decoration: none;
    color: var(--gist-text);
  }

  .footer a.footer-icon-kofi:hover {
    opacity: 0.85;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--gist-overlay);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
    overflow-y: auto;
    z-index: 60;
  }

  .modal {
    background: var(--gist-surface);
    border-radius: 16px;
    padding: 1.25rem 1.25rem 1.5rem;
    width: min(440px, 100%);
    margin: 1rem 0;
    box-shadow: 0 12px 40px var(--gist-shadow);
  }

  .howto-modal {
    width: min(480px, 100%);
  }

  @media (max-width: 768px) {
    .container {
      padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
        max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
    }

    .inner-border {
      padding: 3.25rem 1rem 2rem;
    }

    .top-controls {
      top: 0.65rem;
      left: 0.65rem;
      right: 3.9rem;
    }

    .text {
      font-size: 1.25rem;
    }

    .center {
      margin: 1.25rem 0;
    }

    .panel {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 4.35rem);
      left: max(0.75rem, env(safe-area-inset-left));
      right: max(0.75rem, env(safe-area-inset-right));
      width: auto;
      max-width: 22rem;
      margin-inline: auto 0;
      max-height: min(70dvh, 28rem);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .panel-right {
      right: max(0.75rem, env(safe-area-inset-right));
    }
  }
</style>
