import { useState } from 'react';
import type { HouseholdProfile, Member, Room } from '@simulacro/contracts';
import { loadProfile, newRoom, saveProfile } from '../../shared/household-store.js';

const ROOM_KINDS: Array<Room['kind']> = ['bedroom', 'living', 'kitchen', 'bathroom', 'hallway', 'other'];
const ROOM_LABELS: Record<Room['kind'], string> = {
  bedroom: 'Recámara', living: 'Sala', kitchen: 'Cocina',
  bathroom: 'Baño', hallway: 'Pasillo / escalera', other: 'Otro',
};

export function HouseholdSetup({ onDone }: { onDone: (profile: HouseholdProfile) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomKind, setRoomKind] = useState<Room['kind']>('bedroom');
  const [members, setMembers] = useState<Member[]>([]);
  const [alias, setAlias] = useState('');

  async function finish() {
    const profile: HouseholdProfile = { rooms, members };
    await saveProfile(profile);
    onDone(profile);
  }

  return (
    <section aria-labelledby="hogar-titulo">
      <h2 id="hogar-titulo">Tu hogar</h2>
      <p>Todo se guarda solo en este teléfono. Usa alias, no nombres reales.</p>

      <h3>Cuartos</h3>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>{room.name} — {ROOM_LABELS[room.kind]}</li>
        ))}
      </ul>
      <div className="row">
        <label>
          Nombre del cuarto
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Recámara principal" />
        </label>
        <label>
          Tipo
          <select value={roomKind} onChange={(e) => setRoomKind(e.target.value as Room['kind'])}>
            {ROOM_KINDS.map((kind) => (
              <option key={kind} value={kind}>{ROOM_LABELS[kind]}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={roomName.trim().length === 0}
          onClick={() => {
            setRooms([...rooms, newRoom(roomName.trim(), roomKind)]);
            setRoomName('');
          }}
        >
          Agregar cuarto
        </button>
      </div>

      <h3>Integrantes</h3>
      <ul>
        {members.map((member) => (
          <li key={member.id}>{member.alias} — duerme en {rooms.find((r) => r.id === member.sleepsInRoomId)?.name ?? 'sin cuarto'}</li>
        ))}
      </ul>
      <div className="row">
        <label>
          Alias
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Abuela" />
        </label>
        <button
          type="button"
          disabled={alias.trim().length === 0 || rooms.length === 0}
          onClick={() => {
            const firstRoom = rooms[0];
            if (!firstRoom) return;
            setMembers([...members, {
              id: crypto.randomUUID(), alias: alias.trim(),
              ageBand: 'adult', mobility: 'independent', sleepsInRoomId: firstRoom.id,
            }]);
            setAlias('');
          }}
        >
          Agregar integrante
        </button>
      </div>

      <button type="button" className="primary" disabled={rooms.length === 0} onClick={() => void finish()}>
        Guardar y empezar a escanear
      </button>
      <button type="button" onClick={() => void loadProfile().then((p) => { if (p) onDone(p); })}>
        Ya tengo mi hogar guardado
      </button>
    </section>
  );
}
