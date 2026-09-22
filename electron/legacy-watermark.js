/*
 * Khmer Calendar - Electron 22 / Chromium 108 masked-watermark fallback.
 *
 * The normal PWA uses CSS masks for accent-tinted watermarks:
 *
 *   background: var(--accent);
 *   mask: var(--watermark-image) center / contain no-repeat;
 *
 * Chromium 108 can fail to paint these mask layers. Ordinary transparent PNGs
 * still work, which is why the Buddhist lotus was visible while the yearly
 * zodiac animal was missing.
 *
 * This compatibility layer replaces every .tinted-watermark visual layer with
 * an SVG using:
 *
 *   feFlood(current accent) + feComposite(in SourceAlpha)
 *
 * It preserves the original element's non-mask classes:
 *
 *   card-watermark-zodiac
 *   dialog-watermark-animal
 *   dialog-watermark-western
 *
 * Therefore the PWA's own layout and opacity rules remain authoritative.
 * In particular:
 *
 *   light: --zodiac-watermark-opacity: 0.05
 *   dark:  --zodiac-watermark-opacity: 0.03
 *
 * The normal PWA is not modified; this file is injected only by Electron.
 */
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  let nextId = 0;

  function accentColor() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--accent')
      .trim() || '#4564B5';
  }

  function extractUrl(element) {
    const raw =
      element.style.getPropertyValue('--watermark-image').trim() ||
      getComputedStyle(element).getPropertyValue('--watermark-image').trim();

    if (!raw || raw === 'none') return null;

    const match = raw.match(
      /^url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")]+))\s*\)$/i
    );

    if (!match) return null;

    const value = (match[1] || match[2] || match[3] || '').trim();
    if (!value) return null;

    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return null;
    }
  }

  function replacementClasses(sourceElement) {
    const classes = [];

    sourceElement.classList.forEach((name) => {
      // Do not keep the class that activates the broken CSS mask.
      if (name !== 'tinted-watermark') {
        classes.push(name);
      }
    });

    classes.push('electron-zodiac-watermark');
    return classes.join(' ');
  }

  function createReplacement(maskElement) {
    if (!(maskElement instanceof HTMLElement)) return;
    if (!maskElement.isConnected) return;
    if (maskElement.dataset.electronSvgWatermark === 'source') return;

    const sourceUrl = extractUrl(maskElement);
    if (!sourceUrl) return;

    const filterId = `electron-zodiac-tint-${++nextId}`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', replacementClasses(maskElement));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.dataset.sourceUrl = sourceUrl;

    const defs = document.createElementNS(SVG_NS, 'defs');

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const flood = document.createElementNS(SVG_NS, 'feFlood');
    flood.setAttribute('flood-color', accentColor());
    flood.setAttribute('flood-opacity', '1');
    flood.setAttribute('result', 'tintColor');

    const composite = document.createElementNS(SVG_NS, 'feComposite');
    composite.setAttribute('in', 'tintColor');
    composite.setAttribute('in2', 'SourceAlpha');
    composite.setAttribute('operator', 'in');
    composite.setAttribute('result', 'tinted');

    filter.appendChild(flood);
    filter.appendChild(composite);
    defs.appendChild(filter);

    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '100');
    image.setAttribute('height', '100');
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    image.setAttribute('href', sourceUrl);
    image.setAttributeNS(XLINK_NS, 'xlink:href', sourceUrl);
    image.setAttribute('filter', `url(#${filterId})`);

    svg.appendChild(defs);
    svg.appendChild(image);

    // Leave the source node in place for any application assumptions, but stop
    // its broken mask from painting. The SVG immediately after it takes over
    // the same visual role through the copied positioning class.
    maskElement.dataset.electronSvgWatermark = 'source';
    maskElement.style.display = 'none';

    maskElement.insertAdjacentElement('afterend', svg);
  }

  function replaceAll() {
    document
      .querySelectorAll('.tinted-watermark')
      .forEach(createReplacement);
  }

  function updateAccent() {
    const color = accentColor();

    document
      .querySelectorAll('.electron-zodiac-watermark feFlood')
      .forEach((flood) => {
        flood.setAttribute('flood-color', color);
      });
  }

  function handleAddedNode(node) {
    if (!(node instanceof Element)) return;

    if (node.matches('.tinted-watermark')) {
      createReplacement(node);
    }

    node
      .querySelectorAll('.tinted-watermark')
      .forEach(createReplacement);
  }

  function start() {
    replaceAll();
    updateAccent();

    // Calendar navigation and popup opening both create/replace DOM nodes.
    const domObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          handleAddedNode(node);
        }
      }
    });

    domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Appearance settings alter the accent and theme. Existing PWA CSS changes
    // opacity automatically; only the SVG flood color needs refreshing.
    const appearanceObserver = new MutationObserver(() => {
      updateAccent();
      replaceAll();
    });

    appearanceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent']
    });

    console.info(
      '[Khmer Calendar Win7] SVG masked-watermark compatibility layer active.'
    );
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
