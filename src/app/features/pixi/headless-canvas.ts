export function isHeadlessCanvas(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const getContextSource = HTMLCanvasElement.prototype.getContext?.toString().toLowerCase() ?? '';

  return userAgent.includes('jsdom') || getContextSource.includes('exports.is(esvalue)');
}
