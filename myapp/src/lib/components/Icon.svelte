<script>
  /**
   * Puzzle icon — PNG art or large emoji glyph.
   * Soft-clue `tint` uses a border wash so colorful icons stay visible.
   */
  import { iconSrc, iconLabel, iconEmoji } from '$lib/icons.js';

  let { word = '', size = 48, label = false, tint = '', tip = true } = $props();

  const src = $derived(iconSrc(word));
  const emoji = $derived(iconEmoji(word));
  const text = $derived(iconLabel(word));
  const showTip = $derived(tip && !!text && !label);
</script>

<span
  class="icon"
  class:has-tint={!!tint}
  class:is-emoji={!!emoji}
  class:has-tip={showTip}
  style="--size: {size}px; --tint: {tint || 'transparent'}"
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

  @media (hover: hover) and (pointer: fine) {
    .icon.has-tip:hover .tip-bubble {
      opacity: 1;
      visibility: visible;
    }
  }
</style>
