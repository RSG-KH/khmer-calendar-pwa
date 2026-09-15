import { Icons } from './Icons';

export function setupCopyButton(
  button: HTMLButtonElement,
  status: HTMLElement,
  text: string,
  messages: { copied: string; failed: string }
): () => void {
  const icon = button.querySelector('span')!;
  let active = true;
  let copying = false;
  let feedbackTimeout: number | undefined;
  const resetFeedback = () => {
    icon.innerHTML = Icons.copy;
    button.classList.remove('copied');
    status.classList.remove('copy-error');
    status.textContent = '';
  };
  const onCopy = async () => {
    if (!active || copying) return;
    copying = true;
    window.clearTimeout(feedbackTimeout);
    resetFeedback();
    button.setAttribute('aria-busy', 'true');
    try {
      // Keep the write directly in the tap/click gesture for Safari and installed PWAs.
      await navigator.clipboard.writeText(text);
      if (!active) return;
      icon.innerHTML = Icons.check;
      button.classList.add('copied');
      status.textContent = messages.copied;
      feedbackTimeout = window.setTimeout(resetFeedback, 2000);
    } catch {
      if (!active) return;
      status.classList.add('copy-error');
      status.textContent = messages.failed;
    } finally {
      copying = false;
      if (active) button.removeAttribute('aria-busy');
    }
  };
  button.addEventListener('click', onCopy);
  return () => {
    active = false;
    window.clearTimeout(feedbackTimeout);
    button.removeEventListener('click', onCopy);
  };
}
