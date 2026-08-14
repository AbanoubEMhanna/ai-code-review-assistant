export function validateHostUrl(host: string): void {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    throw new Error(
      `Invalid --host URL "${host}". Expected a full URL, e.g. http://localhost:11434.`
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid --host URL "${host}": protocol must be http or https.`);
  }
  if (url.username || url.password) {
    throw new Error(
      `Invalid --host URL "${host}": embedded credentials (user:pass@) are not supported.`
    );
  }
}
