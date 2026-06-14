export async function readStdin(stream: NodeJS.ReadableStream = process.stdin): Promise<string> {
  if ((stream as NodeJS.ReadStream).isTTY) {
    throw new Error(
      "No input detected. Pipe a diff to stdin:\n  git diff | ai-review review\n  git diff HEAD~1 | ai-review review --source 'last commit'"
    );
  }
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: string | Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", (err: Error) => reject(err));
  });
}
