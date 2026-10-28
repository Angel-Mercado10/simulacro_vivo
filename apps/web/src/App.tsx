import { useState } from 'react';
import type { HouseholdProfile } from '@simulacro/contracts';
import { clearAll } from './shared/household-store.js';
import { HouseholdSetup } from './features/household/HouseholdSetup.js';
import { ScanPage } from './features/scan/ScanPage.js';
import './index.css';

export function App() {
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);

  return (
    <main>
      <h1>Simulacro Vivo</h1>
      <p>No evalúa la seguridad estructural de tu casa ni sustituye a Protección Civil.</p>
      {!profile ? (
        <HouseholdSetup onDone={setProfile} />
      ) : (
        <>
          <ScanPage profile={profile} />
          <hr />
          <button
            type="button"
            onClick={() => {
              if (window.confirm('¿Borrar todo lo guardado en este teléfono?')) {
                void clearAll().then(() => setProfile(null));
              }
            }}
          >
            Borrar todo
          </button>
        </>
      )}
    </main>
  );
}
