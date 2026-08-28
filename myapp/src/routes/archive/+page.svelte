<script lang="ts">
  /**
   * ARCHIVE (/archive)
   * Past weekly puzzles, playable in the current pop-on-board format.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { archivePuzzles } from '$lib/puzzles.js';
  import { getArchivePlays, getLocalCollectibles } from '$lib/player.js';
  import { tap } from '$lib/iosTap.js';

  const puzzles = archivePuzzles();

  let completed = $state<Record<string, boolean>>({});
  let owned = $state<Record<string, boolean>>({});

  onMount(() => {
    const plays = getArchivePlays();
    /** @type {Record<string, boolean>} */
    const next = {};
    for (const entry of plays) {
      if (entry.puzzleId && entry.won) next[entry.puzzleId] = true;
    }
    completed = next;

    const cards = getLocalCollectibles();
    /** @type {Record<string, boolean>} */
    const have = {};
    for (const card of cards) {
      if (card.number) have[card.number] = true;
    }
    owned = have;
  });

  function play(id) {
    goto(`/puzzle?id=${encodeURIComponent(id)}`);
  }
</script>

<main class="page">
  <div class="archive">
    <header class="header">
      <h1>Archive</h1>
      <p class="subtitle">Past puzzles, same rules — combine until none remain.</p>
    </header>

    <ul class="cards">
      {#each puzzles as puzzle}
        {@const done = !!completed[puzzle.id] || !!owned[puzzle.COLLECTIBLE.number]}
        <li class="card">
          <p class="card-num">#{puzzle.COLLECTIBLE.number}</p>
          <div class="card-art" class:mystery={!done}>
            {#if done}
              <Icon word={puzzle.COLLECTIBLE.word} size={72} label={false} />
            {:else}
              <span class="mystery-mark" aria-hidden="true">?</span>
            {/if}
          </div>
          <h2 class="card-title">{done ? puzzle.THEME.word : puzzle.title}</h2>
          <p class="card-status">{done ? 'Cleared' : 'Unplayed'}</p>
          <button
            type="button"
            class="btn-primary"
            {...tap(() => play(puzzle.id))}
          >
            {done ? 'Play again' : 'Play'}
          </button>
        </li>
      {/each}
    </ul>

    <div class="actions">
      <button type="button" class="btn-secondary" {...tap(() => goto('/'))}>Home</button>
    </div>
  </div>
</main>

<style>
  .archive {
    max-width: 720px;
    margin: 0 auto;
    padding: 1rem 0.5rem 2rem;
  }

  .header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .header h1 {
    margin: 0 0 0.35rem;
    font-size: clamp(1.6rem, 5vw, 2rem);
    color: var(--gist-text);
  }

  .subtitle {
    margin: 0;
    color: var(--gist-text-muted);
    font-weight: 600;
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    padding: 1.15rem 0.9rem 1rem;
    background: var(--gist-tile);
    border: 1.5px solid var(--gist-tile-border);
    border-radius: 4px;
    text-align: center;
  }

  .card-num {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gist-text);
  }

  .card-art {
    width: 5.5rem;
    height: 5.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-art.mystery {
    border-radius: 12px;
    border: 1.5px dashed var(--gist-border-strong);
    background: var(--gist-surface-alt);
  }

  .mystery-mark {
    font-size: 2rem;
    font-weight: 800;
    color: var(--gist-text-muted);
  }

  .card-title {
    margin: 0.15rem 0 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--gist-text);
    text-transform: lowercase;
  }

  .card-status {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 650;
    color: var(--gist-text-muted);
  }

  .card :global(.btn-primary) {
    width: 100%;
    margin-top: 0.15rem;
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
  }

  @media (max-width: 480px) {
    .cards {
      grid-template-columns: 1fr;
      max-width: 280px;
      margin-inline: auto;
    }
  }
</style>
