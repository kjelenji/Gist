<script>
  /**
   * Puzzle icon — PNG art or large emoji glyph.
   * Soft-clue `tint` uses a border wash so colorful icons stay visible.
   */
  import { onDestroy } from 'svelte';
  import { iconSrc, iconLabel, iconEmoji, isLineArtIcon } from '$lib/icons.js';

  let { word = '', size = 48, label = false, tint = '', tip = true } = $props();

  const src = $derived(iconSrc(word));
  const emoji = $derived(iconEmoji(word));
  const text = $derived(iconLabel(word));
  const showTip = $derived(tip && !!text && !label);
  const lineArt = $derived(isLineArtIcon(word));

  /** Touch/pen has no hover — show the word while pressed, then briefly after a tap. */
  let pressed = $state(false);
  let startX = 0;
  let startY = 0;
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let linger = 0;
  /** @type {((e: PointerEvent) => void) | null} */
  let endListener = null;

  function clearLinger() {
    if (linger) {
      clearTimeout(linger);
      linger = 0;
    }
  }

  function detachEnd() {
    if (!endListener) return;
    window.removeEventListener('pointerup', endListener);
    window.removeEventListener('pointercancel', endListener);
    endListener = null;
  }

  function onPointerDown(event) {
    if (!showTip || event.pointerType === 'mouse') return;
    clearLinger();
    detachEnd();
    startX = event.clientX;
    startY = event.clientY;
    pressed = true;

    const end = (up) => {
      detachEnd();
      const dx = up.clientX - startX;
      const dy = up.clientY - startY;
      if (dx * dx + dy * dy > 100) {
        pressed = false;
        return;
      }
      linger = setTimeout(() => {
        pressed = false;
        linger = 0;
      }, 900);
    };
    endListener = end;
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  onDestroy(() => {
    clearLinger();
    detachEnd();
  });
</script>

<span
  class="icon"
  class:has-tint={!!tint}
  class:is-emoji={!!emoji}
  class:has-tip={showTip}
  class:line-art={lineArt}
  class:pressed
  style="--size: {size}px; --tint: {tint || 'transparent'}"
  onpointerdown={onPointerDown}
>
  {#if emoji}
    <span class="emoji" aria-hidden="true">{emoji}</span>
  {:else if src}
    <img class="art" src={src} alt="" width={size} height={size} draggable="false" />
  {/if}
  {#if label && text}
    <span class="word">{text}</span>
  {/if}
  {#if showTip}
    <span class="tip-bubble">{text}</span>
  {/if}
</span>

<style>
  .icon {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    position: relative;
    pointer-events: none;
  }

  .icon.has-tip {
    pointer-events: auto;
  }

  .emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size);
    height: var(--size);
    font-size: calc(var(--size) * 0.88);
    line-height: 1;
    user-select: none;
  }

  .icon.is-emoji .emoji {
    font-size: calc(var(--size) * 0.92);
  }

  .art {
    display: block;
    width: var(--size);
    height: var(--size);
    object-fit: contain;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-drag: none;
  }

  :global(html[data-theme='dark']) .icon.line-art .art {
    filter:
      invert(1)
      contrast(1.12)
      drop-shadow(0 0 0.55px #fff)
      drop-shadow(0 0 1.6px rgba(232, 238, 243, 0.65));
  }

  .icon.has-tint .art,
  .icon.has-tint .emoji {
    border-radius: 8px;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--tint) 70%, transparent);
    background: color-mix(in srgb, var(--tint) 14%, var(--gist-tile));
  }

  .word {
    font-size: clamp(0.55rem, 2vw, 0.7rem);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: lowercase;
    color: var(--gist-text-muted, #5e8fb6);
    text-align: center;
    max-width: 5.5rem;
    line-height: 1.2;
  }

  .tip-bubble {
    position: absolute;
    left: 50%;
    bottom: calc(100% - 6px);
    transform: translateX(-50%);
    background: var(--gist-ink);
    color: var(--gist-on-ink);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: lowercase;
    line-height: 1.2;
    white-space: nowrap;
    padding: 0.18rem 0.45rem;
    border-radius: 6px;
    box-shadow: 0 2px 10px var(--gist-shadow);
    z-index: 6;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.12s ease, visibility 0.12s ease;
  }

  .icon.has-tip.pressed .tip-bubble,
  .icon.has-tip:active .tip-bubble {
    opacity: 1;
    visibility: visible;
  }

  @media (hover: hover) and (pointer: fine) {
    .icon.has-tip:hover .tip-bubble {
      opacity: 1;
      visibility: visible;
    }
  }
</style>
