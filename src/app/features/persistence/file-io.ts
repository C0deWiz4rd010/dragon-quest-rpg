/** Offers `text` to the user as a downloaded file. Returns false if the browser blocks it. */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return true;
  } catch {
    return false;
  }
}

/** Friendly file name such as `dragon-quest-slot-2-2026-10-28.json`. */
export function saveFilename(slot: number, date = new Date()): string {
  return `dragon-quest-slot-${slot}-${date.toISOString().slice(0, 10)}.json`;
}
