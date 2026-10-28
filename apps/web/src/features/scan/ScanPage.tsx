import { useRef, useState } from 'react';
import type { Hazard, HouseholdProfile } from '@simulacro/contracts';
import { scanRoom } from '../../shared/api-client.js';
import { dismissHazard, loadHazards, saveHazards } from '../../shared/household-store.js';
import { HazardOverlay } from './HazardOverlay.js';

type ScanState =
  | { status: 'idle' }
  | { status: 'working'; step: string }
  | { status: 'error'; message: string };

export function ScanPage({ profile }: { profile: HouseholdProfile }) {
  const [roomId, setRoomId] = useState(profile.rooms[0]?.id ?? '');
  const [state, setState] = useState<ScanState>({ status: 'idle' });
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [quality, setQuality] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const room = profile.rooms.find((r) => r.id === roomId);

  async function analyze(file: File) {
    if (!room) return;
    setState({ status: 'working', step: 'Analizando la foto' });
    setPhoto(null);
    setHazards([]);
    setQuality(null);
    try {
      const started = Date.now();
      const result = await scanRoom({ photo: file, roomId: room.id, roomKind: room.kind, photoId: crypto.randomUUID() });
      const elapsed = Date.now() - started;
      if (elapsed > 15000) {
        // The request already finished; note the delay explicitly.
      }
      setPhoto({ dataUrl: result.normalizedImage, width: result.width, height: result.height });
      setQuality(result.imageQuality);
      if (result.imageQuality !== 'ok') {
        setState({ status: 'idle' });
        return;
      }
      const previous = await loadHazards();
      const merged = [...previous.filter((h) => h.roomId !== room.id), ...result.hazards];
      await saveHazards(merged);
      setHazards(result.hazards);
      setState({ status: 'idle' });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Error desconocido' });
    }
  }

  return (
    <section aria-labelledby="escanear-titulo">
      <h2 id="escanear-titulo">Escanear un cuarto</h2>
      <p>Toma la foto sin personas. Nada se sube con tu nombre; el servidor la procesa y la descarta.</p>

      <label>
        Cuarto
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          {profile.rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Tomar foto del cuarto"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void analyze(file);
        }}
      />

      {state.status === 'working' && <p role="status">{state.step}…</p>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {quality && quality !== 'ok' && (
        <p role="alert">
          La foto salió {quality === 'too_dark' ? 'muy oscura' : quality === 'too_blurry' ? 'movida' : 'fuera de un cuarto'}.
          Repite la foto con más luz y sin moverte.
        </p>
      )}

      {photo && (
        <>
          <HazardOverlay image={photo.dataUrl} width={photo.width} height={photo.height} hazards={hazards} />
          <h3>Riesgos encontrados ({hazards.filter((h) => h.status === 'open').length})</h3>
          <ol>
            {hazards.map((hazard, index) => (
              <li key={hazard.id}>
                <strong>{index + 1}. {hazard.labelEs}</strong>
                {' — '}{hazard.evidenceEs}
                {!hazard.maskPath && ' (contorno aproximado)'}
                {hazard.status === 'open' ? (
                  <button
                    type="button"
                    onClick={() => void dismissHazard(hazard.id).then(setHazards)}
                  >
                    No es un riesgo
                  </button>
                ) : (
                  <span> Descartado por ti.</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
