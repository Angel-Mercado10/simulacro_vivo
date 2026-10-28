import { toMetaError } from './meta-errors.js';
import { withRetry } from './retry-policy.js';

/** Muse Voice Transcribe (P1). WAV mono PCM16 16/24kHz only. */
export class TranscribeClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async transcribeWav(wav: Buffer): Promise<{ transcript: string }> {
    try {
      return await withRetry(async () => {
        const form = new FormData();
        form.append('request', JSON.stringify({
          mode: 'PUSH_TO_TALK', model: this.model, audioEncoding: 'WAV', languageBias: ['Spanish'],
        }));
        form.append('audio', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'profile.wav');
        const response = await fetch(`${this.baseUrl}/asr/transcribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: form,
        });
        if (!response.ok) {
          const text = await response.text();
          const error = new Error(`Transcribe failed (${response.status}): ${text.slice(0, 500)}`) as Error & { status: number };
          error.status = response.status;
          throw error;
        }
        const json = (await response.json()) as { transcript?: string };
        return { transcript: json.transcript ?? '' };
      });
    } catch (error) {
      throw toMetaError(error);
    }
  }
}
