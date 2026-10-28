import { useEffect, useRef, useState } from 'react';
import type { Hazard, HouseholdProfile } from '@simulacro/contracts';
import { scanRoom } from '../../shared/api-client.js';
import { dismissHazard, loadHazards, saveHazards } from '../../shared/household-store.js';
import { HazardOverlay } from './HazardOverlay.js';

/** Auto-captures while touring a room; each still goes through the full pipeline. */
const RECORRIDO_INTERVAL_MS = 8000;
const RECORRIDO_MAX_CAPTURES = 6;

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
  const [recorrido, setRecorrido] = useState(false);
  const [captures, setCaptures] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyzingRef = useRef(false);
  const analyzeRef = useRef<((file: File) => Promise<void>) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const room = profile.rooms.find((r) => r.id === roomId);

  // Live preview while touring; stills are captured on an interval.
  useEffect(() => {
    if (!recorrido) return;
    let timer: number | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        timer = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || video.videoWidth === 0 || analyzingRef.current) return;
          setCaptures((done) => {
            if (done >= RECORRIDO_MAX_CAPTURES) {
              setRecorrido(false);
              return done;
            }
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) void analyzeRef.current?.(new File([blob], 'recorrido.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.85);
            return done + 1;
          });
        }, RECORRIDO_INTERVAL_MS);
      })
      .catch(() => setState({ status: 'error', message: 'No se pudo abrir la cámara. Revisa el permiso en tu teléfono.' }));
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [recorrido]);

  async function analyze(file: File) {
    if (!room || analyzingRef.current) return;
    analyzingRef.current = true;
    setState({ status: 'working', step: 'Analizando la foto' });
    setQuality(null);
    try {
      const started = Date.now();
      const result = await scanRoom({ photo: file, roomId: room.id, roomKind: room.kind, photoId: crypto.randomUUID() });
      const elapsed = Date.now() - started;
      setPhoto({ dataUrl: result.normalizedImage, width: result.width, height: result.height });
      setQuality(result.imageQuality);
      if (elapsed > 15000) {
        setState({ status: 'error', message: `Tardó ${Math.round(elapsed / 1000)} s, más de lo esperado. Intenta con más luz.` });
      } else {
        setState({ status: 'idle' });
      }
      if (result.imageQuality !== 'ok') return;
      const previous = await loadHazards();
      const roomPrevious = previous.filter((h) => h.roomId === room.id);
      const merged = [...previous.filter((h) => h.roomId !== room.id), ...roomPrevious, ...result.hazards];
      await saveHazards(merged);
      // Hazards accumulate across captures so the tour builds the room map.
      setHazards((current) => [...current, ...result.hazards]);
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      analyzingRef.current = false;
    }
  }
  analyzeRef.current = analyze;

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
          if (file) {
            setHazards([]);
            setPhoto(null);
            void analyze(file);
          }
        }}
      />

      <button
        type="button"
        className="primary"
        onClick={() => {
          if (recorrido) {
            setRecorrido(false);
          } else {
            setHazards([]);
            setPhoto(null);
            setCaptures(0);
            setRecorrido(true);
          }
        }}
      >
        {recorrido ? 'Detener recorrido' : 'Iniciar recorrido del cuarto'}
      </button>
      {recorrido && (
        <>
          <p role="status">
            Recorriendo: gira despacio por el cuarto. Captura {Math.min(captures, RECORRIDO_MAX_CAPTURES)} de {RECORRIDO_MAX_CAPTURES}.
            Cada foto se analiza sola; ve despacio para que no salgan movidas.
          </p>
          <video ref={videoRef} autoPlay playsInline muted className="overlay" aria-label="Vista previa de la cámara" />
        </>
      )}

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
