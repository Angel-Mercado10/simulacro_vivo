import { get, set, del } from 'idb-keyval';
import type { Hazard, HouseholdProfile, Room } from '@simulacro/contracts';

const PROFILE_KEY = 'sv-profile';
const HAZARDS_KEY = 'sv-hazards';

export async function loadProfile(): Promise<HouseholdProfile | null> {
  return (await get<HouseholdProfile>(PROFILE_KEY)) ?? null;
}

export async function saveProfile(profile: HouseholdProfile): Promise<void> {
  await set(PROFILE_KEY, profile);
}

export async function loadHazards(): Promise<Hazard[]> {
  return (await get<Hazard[]>(HAZARDS_KEY)) ?? [];
}

export async function saveHazards(hazards: Hazard[]): Promise<void> {
  await set(HAZARDS_KEY, hazards);
}

export async function dismissHazard(id: string): Promise<Hazard[]> {
  const hazards = await loadHazards();
  const updated = hazards.map((h) => (h.id === id ? { ...h, status: 'dismissed_by_user' as const } : h));
  await saveHazards(updated);
  return updated;
}

export async function clearAll(): Promise<void> {
  await del(PROFILE_KEY);
  await del(HAZARDS_KEY);
}

export function newRoom(name: string, kind: Room['kind']): Room {
  return { id: crypto.randomUUID(), name, kind };
}
