/**
 * Download a Blob as a file. Works reliably on iOS Safari, Android Chrome,
 * and desktop browsers.
 *
 * Key fixes for mobile:
 * - Anchor element is appended to the DOM (iOS Safari ignores clicks on detached elements)
 * - revokeObjectURL is delayed so Safari has time to start the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Clean up after a short delay so mobile browsers can start the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}
