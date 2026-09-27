/** Copy from the click handler, with a selection-based fallback for restricted browsers. */
export async function copyText(text: string, trigger: HTMLElement): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Some browsers expose the API but reject writes (for example, in embedded views).
  }
  // A dismissed popup must not steal focus or start another copy after a delayed rejection.
  if (!trigger.isConnected) throw new Error('Copy control is no longer active');

  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const field = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused : null;
  const caret = field && field.selectionStart !== null
    ? { start: field.selectionStart, end: field.selectionEnd!, direction: field.selectionDirection ?? 'none' }
    : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  // Keep the selection inside the active dialog, outside the inert app, without opening a keyboard.
  textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
  const host = trigger.closest('.modal-overlay.open') ?? document.body;
  host.appendChild(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) throw new Error('Copy was not permitted');
  } finally {
    textarea.remove();
    if (focused?.isConnected) focused.focus({ preventScroll: true });
    if (field?.isConnected && caret) field.setSelectionRange(caret.start, caret.end, caret.direction);
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) {
        if (range.commonAncestorContainer.isConnected) selection.addRange(range);
      }
    }
  }
}
