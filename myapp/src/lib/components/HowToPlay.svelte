<script>
  /**
   * How to Play — shared directions with demos.
   */
  import { tap } from '$lib/iosTap.js';

  let { onClose = undefined } = $props();

  const linkParts = [
    { src: '/howto/grass.png', label: 'grass' },
    { src: '/howto/moss.png', label: 'moss' },
    { src: '/howto/vines.png', label: 'vines' },
  ];
  const linkResult = { src: '/howto/green-plants.png', label: 'green plants' };

  const rebusParts = [
    { src: '/howto/car.png', label: 'car' },
    { src: '/howto/tea.png', label: 'tea' },
    { src: '/howto/gun.png', label: 'gun' },
  ];
  const rebusResult = { src: '/howto/cardigan.png', label: 'cardigan' };

  const wordplayParts = [
    { src: '/howto/letter-i.png', label: 'I' },
    { src: '/howto/scream.png', label: 'scream' },
  ];
  const wordplayResult = { src: '/howto/ice-cream.png', label: 'ice cream' };

  /**
   * 3×3 schematic matching a real board layout:
   *   rebus | link-a | fill
   *   link-b | fill  | link-a
   *   link-b | link-b | rebus
   */
  const boardCells = [
    { group: 'rebus' },
    { group: 'link-a' },
    { group: 'fill' },
    { group: 'link-b' },
    { group: 'fill' },
    { group: 'link-a' },
    { group: 'link-b' },
    { group: 'link-b' },
    { group: 'rebus' },
  ];

  const SLIDE_COUNT = 4;
  let slide = $state(0);

  function go(delta) {
    slide = Math.max(0, Math.min(SLIDE_COUNT - 1, slide + delta));
  }
</script>

<div class="howto">
  <div class="howto-top">
    <h2>How to Play</h2>
    {#if onClose}
      <button type="button" class="close" aria-label="Close" {...tap(onClose)}>×</button>
    {/if}
  </div>

  <div class="slides">
  <section class="step" hidden={slide !== 0}>
    <h3>1. How do you move?</h3>
    <p>
      Swipe across tiles <strong>orthogonally</strong> — only horizontal or vertical moves along
      shared edges. Diagonals do not count.
    </p>
    <p>
      Once a group is solved, those three tiles are <strong>replaced by one result</strong>.
      The other two cells go empty. You can still swipe over empty space to reach icons
      that are no longer next to each other.
    </p>

    <div class="ortho" aria-hidden="true">
      <div class="ortho-grid">
        <span class="cell ghost"></span>
        <span class="cell ok">↑</span>
        <span class="cell ghost"></span>
        <span class="cell ok">←</span>
        <span class="cell center">●</span>
        <span class="cell ok">→</span>
        <span class="cell ghost"></span>
        <span class="cell ok">↓</span>
        <span class="cell ghost"></span>
      </div>
      <p class="caption muted">Valid moves from any tile</p>
    </div>

    <div class="swipe-demo" aria-hidden="true">
      <p class="caption">Example swipe on the board</p>
      <div class="swipe-pair">
        <div class="swipe-col">
          <div class="mini-board">
            {#each Array(9) as _, i}
              {@const row = Math.floor(i / 3)}
              {@const col = i % 3}
              {@const onPath =
                (row === 2 && col === 0) || (row === 2 && col === 1) || (row === 1 && col === 1)}
              {@const order =
                row === 2 && col === 0 ? 1 : row === 2 && col === 1 ? 2 : row === 1 && col === 1 ? 3 : 0}
              <span class="mini-tile" class:on-path={onPath}>
                {#if order}<span class="swipe-num">{order}</span>{/if}
              </span>
            {/each}
          </div>
          <p class="caption muted good">✓ Orthogonal</p>
        </div>
        <div class="swipe-col">
          <div class="mini-board">
            {#each Array(9) as _, i}
              {@const row = Math.floor(i / 3)}
              {@const col = i % 3}
              {@const onPath = row === col}
              <span class="mini-tile" class:on-path={onPath} class:bad-path={onPath}></span>
            {/each}
          </div>
          <p class="caption muted bad">✗ No diagonals</p>
        </div>
      </div>

      <p class="caption">Swipe through an eliminated tile</p>
      <div class="mini-board">
        {#each Array(9) as _, i}
          {@const order = i === 0 ? 1 : i === 2 ? 2 : i === 5 ? 3 : 0}
          {@const cleared = i === 1}
          <span
            class="mini-tile"
            class:on-path={order > 0}
            class:cleared
            class:through={cleared}
          >
            {#if order}<span class="swipe-num">{order}</span>{/if}
          </span>
        {/each}
      </div>
      <p class="caption muted">The faded tile is empty — path through it to connect 1 → 2 → 3</p>
    </div>
  </section>

  <section class="step" hidden={slide !== 1}>
    <h3>2. The puzzle board</h3>
    <p>
      Every week has <strong>2 rebuses</strong>, <strong>2 links</strong>, and
      <strong>2 fill-ins</strong> on the <strong>3×3 board</strong>. Group three icons —
      their answer pops onto the board. Keep combining leftover tiles until none remain.
    </p>

    <div class="board-diagram" aria-hidden="true">
      <p class="caption">3×3 board</p>
      <div class="diagram-board">
        {#each boardCells as cell}
          <div
            class="diagram-tile"
            class:is-fill={cell.group === 'fill'}
            class:group-rebus={cell.group === 'rebus'}
            class:group-link-a={cell.group === 'link-a'}
            class:group-link-b={cell.group === 'link-b'}
          ></div>
        {/each}
      </div>

      <ul class="board-legend">
        <li><span class="swatch rebus"></span> 2 rebus</li>
        <li><span class="swatch link-a"></span> 2 link</li>
        <li><span class="swatch fill"></span> 2 fill-in</li>
      </ul>
    </div>
  </section>

  <section class="step" hidden={slide !== 2}>
    <h3>3. Puzzle pieces</h3>

    <div class="piece">
      <h4>Fill-ins</h4>
      <p>
        Tap one to select it, tap again to deselect.
      </p>
      <div class="demo demo-fill">
        <div class="demo-split" aria-hidden="true">
          <span class="demo-wedge w0">
            <span class="demo-chip"><img src="/howto/mushroom.png" alt="" /></span>
          </span>
          <span class="demo-wedge w1">
            <span class="demo-chip"><img src="/howto/yeast.png" alt="" /></span>
          </span>
          <span class="demo-wedge w2 picked">
            <span class="demo-chip"><img src="/howto/grass.png" alt="" /></span>
          </span>
          <svg class="demo-lines" viewBox="0 0 100 100">
            <line x1="50" y1="50" x2="0" y2="0" />
            <line x1="50" y1="50" x2="100" y2="0" />
            <line x1="50" y1="50" x2="50" y2="100" />
          </svg>
        </div>
      </div>
    </div>

    <div class="piece">
      <h4>Rebus</h4>
      <p>
        Combine icons into a new word by stacking sounds, math, symbols, or a play on words.
      </p>
      <div class="example">
        <p class="caption">Sound stack</p>
        <div class="example-row">
          {#each rebusParts as part, i}
            {#if i > 0}<span class="plus">+</span>{/if}
            <span class="ex-icon">
              <img src={part.src} alt="" />
              <span class="ex-label">{part.label}</span>
            </span>
          {/each}
          <span class="eq">=</span>
          <span class="ex-icon">
            <img src={rebusResult.src} alt="" />
            <span class="ex-label">{rebusResult.label}</span>
          </span>
        </div>
        <p class="example-note">car + tea + gun → cardigan</p>
      </div>
      <div class="example">
        <p class="caption">Play on words</p>
        <div class="example-row">
          {#each wordplayParts as part, i}
            {#if i > 0}<span class="plus">+</span>{/if}
            <span class="ex-icon">
              <img src={part.src} alt="" />
              <span class="ex-label">{part.label}</span>
            </span>
          {/each}
          <span class="eq">=</span>
          <span class="ex-icon">
            <img src={wordplayResult.src} alt="" />
            <span class="ex-label">{wordplayResult.label}</span>
          </span>
        </div>
        <p class="example-note">I + scream → ice cream</p>
      </div>
    </div>

    <div class="piece">
      <h4>Links</h4>
      <p>Group icons that share one idea, category, or theme.</p>
      <div class="example">
        <div class="example-row">
          {#each linkParts as part, i}
            {#if i > 0}<span class="plus">+</span>{/if}
            <span class="ex-icon">
              <img src={part.src} alt="" />
              <span class="ex-label">{part.label}</span>
            </span>
          {/each}
          <span class="eq">=</span>
          <span class="ex-icon">
            <img src={linkResult.src} alt="" />
            <span class="ex-label">{linkResult.label}</span>
          </span>
        </div>
        <p class="example-note">grass + moss + vines → green plants</p>
      </div>
    </div>
  </section>

  <section class="step" hidden={slide !== 3}>
    <h3>4. One play per week</h3>
    <p>
      Finish to earn a collectible and climb the weekly scoreboard. Score is based on number
      of hints used and lives lost. Clear the board to win.
    </p>
  </section>
  </div>

  <div class="slide-nav">
    <button
      type="button"
      class="nav-btn"
      disabled={slide === 0}
      {...(slide === 0 ? {} : tap(() => go(-1)))}
    >Back</button>
    <div class="dots" aria-label="Slides">
      {#each Array(SLIDE_COUNT) as _, i}
        <button
          type="button"
          class="dot"
          class:on={slide === i}
          aria-label={`Slide ${i + 1}`}
          aria-current={slide === i ? 'step' : undefined}
          {...tap(() => {
            slide = i;
          })}
        ></button>
      {/each}
    </div>
    {#if slide < SLIDE_COUNT - 1}
      <button type="button" class="nav-btn primary" {...tap(() => go(1))}>Next</button>
    {:else if onClose}
      <button type="button" class="nav-btn primary" {...tap(onClose)}>Got it</button>
    {:else}
      <button type="button" class="nav-btn primary" disabled>Done</button>
    {/if}
  </div>
</div>

<style>
  .howto {
    text-align: left;
    color: var(--gist-text);
  }

  .howto-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    letter-spacing: 0.02em;
  }

  .close {
    background: var(--gist-bg);
    border: 1px solid var(--gist-border);
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 8px;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--gist-text);
    cursor: pointer;
  }

  .step {
    padding: 0;
    border: none;
    min-width: 0;
  }

  .step[hidden] {
    display: none;
  }

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.95rem;
  }

  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.88rem;
    color: var(--gist-text);
  }

  p {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--gist-text-muted);
  }

  .caption {
    margin: 0 0 0.45rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gist-text);
  }

  .caption.muted {
    color: var(--gist-text-muted);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    margin-top: 0.35rem;
    margin-bottom: 0;
    font-size: 0.78rem;
  }

  .caption.muted.good {
    color: #3d7a5c;
  }

  .caption.muted.bad {
    color: #b85c5c;
  }

  .ortho {
    background: var(--gist-surface-alt, #f4f9fc);
    border: 1px solid var(--gist-border);
    border-radius: 12px;
    padding: 0.75rem;
    margin-bottom: 0.85rem;
  }

  .ortho-grid {
    display: grid;
    grid-template-columns: repeat(3, 36px);
    gap: 0.3rem;
    justify-content: center;
  }

  .ortho-grid .cell {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .ortho-grid .ok {
    background: var(--gist-tile);
    border: 1.5px solid var(--gist-primary);
    color: var(--gist-primary-dark);
  }

  .ortho-grid .center {
    background: var(--gist-ink);
    color: var(--gist-on-ink);
    border: 1.5px solid var(--gist-ink);
  }

  .ortho-grid .ghost {
    background: transparent;
    border: 1.5px dashed var(--gist-border);
    color: transparent;
  }

  .swipe-demo {
    margin-top: 0.5rem;
  }

  .swipe-demo .swipe-pair + .caption {
    margin-top: 0.85rem;
  }

  .swipe-pair {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .swipe-col {
    text-align: center;
  }

  .mini-board {
    display: grid;
    grid-template-columns: repeat(3, 42px);
    gap: 0;
    justify-content: center;
    width: fit-content;
    margin: 0 auto 0.65rem;
    border: 1.5px solid var(--gist-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .mini-tile {
    width: 42px;
    height: 42px;
    border-right: 1px solid var(--gist-border);
    border-bottom: 1px solid var(--gist-border);
    background: var(--gist-slot);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .mini-tile:nth-child(3n) {
    border-right: none;
  }

  .mini-tile:nth-child(n + 7) {
    border-bottom: none;
  }

  .mini-tile.on-path {
    background: var(--gist-fill-pick);
    box-shadow: inset 0 0 0 2px var(--gist-primary);
  }

  .mini-tile.bad-path {
    background: #fdf0f0;
    box-shadow: inset 0 0 0 2px #c45b5b;
  }

  .mini-tile.cleared {
    background: var(--gist-surface-alt, #eef3f6);
    opacity: 0.45;
  }

  .mini-tile.cleared.through {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--gist-primary) 50%, transparent);
  }

  .swipe-num {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--gist-ink);
    color: var(--gist-on-ink);
    font-size: 0.65rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .board-diagram {
    background: var(--gist-surface-alt, #f4f9fc);
    border: 1px solid var(--gist-border);
    border-radius: 12px;
    padding: 0.85rem;
    margin-top: 0.25rem;
  }

  .diagram-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    max-width: 180px;
    margin: 0 auto 0.75rem;
    border: 1.5px solid var(--gist-muted-line);
    border-radius: 10px;
    overflow: hidden;
  }

  .diagram-tile {
    min-height: 44px;
    border-right: 1px solid var(--gist-muted-line);
    border-bottom: 1px solid var(--gist-muted-line);
    border-radius: 0;
  }

  .diagram-tile:nth-child(3n) {
    border-right: none;
  }

  .diagram-tile:nth-child(n + 7) {
    border-bottom: none;
  }

  .diagram-tile.group-rebus {
    background: var(--gist-rebus-tint);
  }

  .diagram-tile.group-link-a {
    background: var(--gist-link-a-tint);
  }

  .diagram-tile.group-link-b {
    background: var(--gist-link-b-tint);
  }

  .diagram-tile.is-fill {
    background: var(--gist-tile-muted);
    box-shadow: inset 0 0 0 1.5px var(--gist-muted-line);
  }

  .board-legend {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.65rem 1rem;
    font-size: 0.78rem;
    color: var(--gist-text-muted);
  }

  .board-legend li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .swatch {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    flex-shrink: 0;
  }

  .swatch.rebus {
    background: var(--gist-rebus-tint);
  }

  .swatch.link-a {
    background: var(--gist-link-a-tint);
  }

  .swatch.link-b {
    background: var(--gist-link-b-tint);
  }

  .swatch.fill {
    background: var(--gist-tile-muted);
    border-style: dashed;
    border-color: var(--gist-muted-line);
  }

  .piece {
    margin-bottom: 1rem;
  }

  .piece:last-child {
    margin-bottom: 0;
  }

  .demo-fill {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .demo-split {
    position: relative;
    width: 120px;
    height: 120px;
    border: 2.5px solid var(--gist-tile-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--gist-tile);
  }

  .demo-wedge {
    position: absolute;
    inset: 0;
    display: flex;
  }

  .demo-wedge.w0 {
    clip-path: polygon(0 0, 100% 0, 50% 50%);
    align-items: flex-start;
    justify-content: center;
    padding-top: 8%;
    opacity: 0.45;
  }

  .demo-wedge.w1 {
    clip-path: polygon(0 0, 50% 50%, 50% 100%, 0 100%);
    align-items: center;
    justify-content: flex-start;
    padding-left: 8%;
    padding-top: 18%;
    opacity: 0.45;
  }

  .demo-wedge.w2 {
    clip-path: polygon(100% 0, 100% 100%, 50% 100%, 50% 50%);
    align-items: center;
    justify-content: flex-end;
    padding-right: 8%;
    padding-top: 18%;
    background: var(--gist-link-b-tint);
  }

  .demo-chip {
    width: 36px;
    height: 36px;
    border: 1.5px solid var(--gist-tile-border);
    border-radius: 8px;
    background: var(--gist-tile);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .demo-wedge.w2 .demo-chip {
    border-width: 2px;
  }

  .demo-split img,
  .ex-icon img {
    width: 26px;
    height: 26px;
    object-fit: contain;
    display: block;
  }

  .ex-icon img {
    width: 36px;
    height: 36px;
  }

  .demo-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .demo-lines line {
    stroke: var(--gist-tile-border);
    stroke-width: 1;
  }

  .example {
    border: 1px solid var(--gist-border);
    border-radius: 12px;
    padding: 0.7rem 0.75rem;
    background: var(--gist-surface);
    margin-bottom: 0.55rem;
  }

  .example-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .ex-icon {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    min-width: 3.2rem;
  }

  .ex-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--gist-text-muted);
    text-align: center;
    line-height: 1.15;
  }

  .plus,
  .eq {
    color: var(--gist-muted-line);
    font-weight: 700;
  }

  .example-note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--gist-text-muted);
  }

  .slide-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--gist-border);
  }

  .nav-btn {
    min-height: 40px;
    min-width: 4.5rem;
    padding: 0.4rem 0.85rem;
    border-radius: 10px;
    border: 1.5px solid var(--gist-border-strong);
    background: var(--gist-surface);
    color: var(--gist-text);
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
  }

  .nav-btn.primary {
    background: var(--gist-primary);
    border-color: var(--gist-primary);
    color: var(--gist-on-primary);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dots {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--gist-primary);
    background: transparent;
    cursor: pointer;
  }

  .dot.on {
    background: var(--gist-primary);
  }
</style>
