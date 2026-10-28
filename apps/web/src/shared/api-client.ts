import type { Evidence, Hazard, RoomKind } from '@simulacro/contracts';

export interface ScanResult {
  photoId: string;
  normalizedImage: string;
  width: number;
  height: number;
  imageQuality: 'ok' | 'too_dark' | 'too_blurry' | 'not_indoor_room';
  hazards: Hazard[];
  evidence: Evidence;
}

function sessionId(): string {
  let id = localStorage.getItem('sv-session-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('sv-session-id', id);
  }
  return id;
}

export async function scanRoom(args: {
  photo: Blob; roomId: string; roomKind: RoomKind; photoId: string;
}): Promise<ScanResult> {
  const form = new FormData();
  form.append('photo', args.photo, 'photo.jpg');
  form.append('roomId', args.roomId);
  form.append('roomKind', args.roomKind);
  form.append('photoId', args.photoId);
  const response = await fetch('/api/rooms/scan', {
    method: 'POST',
    headers: { 'X-Session-Id': sessionId() },
    body: form,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code: string; messageEs: string; retryable: boolean };
    } | null;
    throw new Error(body?.error?.messageEs ?? `Error del servidor (${response.status})`);
  }
  return (await response.json()) as ScanResult;
}
