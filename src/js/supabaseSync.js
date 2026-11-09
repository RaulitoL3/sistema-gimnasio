/**
 * MOTOR DE SINCRONIZACIÓN EN TIEMPO REAL MULTIDISPOSITIVO (SUPABASE CLOUD)
 * Permite que el Papá (Admin) y los Recepcionistas (PC / Celular) compartan
 * todos los recibos, alumnos, membresías y caja en vivo desde el link web.
 */
(function (global) {
  let syncTimeout = null;
  let lastCloudTimestamp = null;
  let isPulling = false;

  function obtenerCredenciales(store) {
    const cloudCfg = global.GYM_CLOUD_CONFIG || {};
    const localCfg = store?.state?.configuracion || {};
    return {
      url: (cloudCfg.SUPABASE_URL || localCfg.supabase_url || '').trim().replace(/\/+$/, ''),
      anonKey: (cloudCfg.SUPABASE_ANON_KEY || localCfg.supabase_anon_key || '').trim()
    };
  }

  function getHeaders(anonKey) {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    };
  }

  function actualizarIndicadorCloud(estado, texto) {
    const badge = document.getElementById('cloud-sync-indicator');
    if (!badge) return;
    const estilos = {
      online: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      syncing: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      local: 'bg-slate-800 text-slate-400 border-slate-700',
      error: 'bg-red-500/15 text-red-400 border-red-500/30'
    };
    badge.className = `hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
      estilos[estado] || estilos.local
    }`;
    badge.innerHTML = `<span class="w-2 h-2 rounded-full ${
      estado === 'online'
        ? 'bg-emerald-400'
        : estado === 'syncing'
        ? 'bg-sky-400 animate-ping'
        : estado === 'error'
        ? 'bg-red-400'
        : 'bg-slate-400'
    }"></span><span>${texto}</span>`;
  }

  async function probarConexionSupabase(url, anonKey) {
    if (!url || !anonKey) {
      throw new Error('Ingresa el Project URL y el Anon Key de tu proyecto Supabase.');
    }
    const cleanUrl = url.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/gym_cloud_state?select=id,updated_at&limit=1`, {
      method: 'GET',
      headers: getHeaders(anonKey)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(
        `Error de conexión (${res.status}): Asegúrate de haber ejecutado supabase/schema.sql en el SQL Editor de Supabase. Detalle: ${txt}`
      );
    }
    return true;
  }

  /**
   * Sube el estado actual del gimnasio a la nube para que todos los celulares/PCs lo vean al instante
   */
  async function subirDatosASupabase(store) {
    const { url, anonKey } = obtenerCredenciales(store);
    if (!url || !anonKey) {
      actualizarIndicadorCloud('local', 'Modo Local');
      return false;
    }

    try {
      actualizarIndicadorCloud('syncing', 'Sincronizando...');
      const nowISO = new Date().toISOString();

      // No sobrescribir el rol individual de cada dispositivo ni las llaves locales
      const stateToSync = {
        ...store.state,
        configuracion: {
          ...store.state.configuracion,
          rol_actual: undefined
        },
        _updated_at: nowISO
      };

      const res = await fetch(`${url}/rest/v1/gym_cloud_state`, {
        method: 'POST',
        headers: getHeaders(anonKey),
        body: JSON.stringify([
          {
            id: 'main_gym',
            state_json: stateToSync,
            updated_at: nowISO
          }
        ])
      });

      if (res.ok) {
        lastCloudTimestamp = nowISO;
        actualizarIndicadorCloud('online', 'Nube Conectada');
        return true;
      } else {
        actualizarIndicadorCloud('error', 'Error Cloud');
        return false;
      }
    } catch (err) {
      console.warn('Error al sincronizar con Supabase:', err);
      actualizarIndicadorCloud('error', 'Sin Red Cloud');
      return false;
    }
  }

  /**
   * Descarga cambios realizados por las recepcionistas o por el papá desde otros dispositivos
   */
  async function descargarDesdeSupabase(store, forzar = false) {
    if (isPulling) return false;
    const { url, anonKey } = obtenerCredenciales(store);
    if (!url || !anonKey) {
      actualizarIndicadorCloud('local', 'Modo Local');
      return false;
    }

    isPulling = true;
    try {
      const res = await fetch(`${url}/rest/v1/gym_cloud_state?id=eq.main_gym&select=state_json,updated_at`, {
        method: 'GET',
        headers: getHeaders(anonKey)
      });

      if (!res.ok) {
        isPulling = false;
        return false;
      }

      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        // Si la nube está vacía por primera vez, subimos el estado actual
        await subirDatosASupabase(store);
        isPulling = false;
        return true;
      }

      const remoteRow = rows[0];
      const remoteTime = remoteRow.updated_at;
      const remoteState = remoteRow.state_json;

      if (forzar || !lastCloudTimestamp || (remoteTime && remoteTime > lastCloudTimestamp)) {
        if (remoteState && Array.isArray(remoteState.alumnos) && Array.isArray(remoteState.recibos)) {
          lastCloudTimestamp = remoteTime;
          // Conservar el rol del dispositivo actual (Admin en celular del papá, Recepción en PC de recepción)
          const rolDispositivo = store.getRolDispositivoActual();
          const mergedState = {
            ...remoteState,
            configuracion: {
              ...store.state.configuracion,
              ...(remoteState.configuracion || {}),
              supabase_url: url,
              supabase_anon_key: anonKey,
              rol_actual: rolDispositivo
            }
          };
          store.aplicarEstadoRemotoSinRebote(mergedState);
        }
      }
      actualizarIndicadorCloud('online', 'Nube en Vivo');
      isPulling = false;
      return true;
    } catch (err) {
      isPulling = false;
      return false;
    }
  }

  function programarSubidaAutomatica(store) {
    const { url, anonKey } = obtenerCredenciales(store);
    if (!url || !anonKey) return;
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      subirDatosASupabase(store);
    }, 350);
  }

  function iniciarSincronizacionTiempoReal(store) {
    const { url, anonKey } = obtenerCredenciales(store);
    if (!url || !anonKey) {
      actualizarIndicadorCloud('local', 'Modo Local');
      return;
    }

    // Descarga inicial al abrir el link
    descargarDesdeSupabase(store, true);

    // Actualizar cada 6 segundos para ver recibos registrados en otros celulares/PCs
    setInterval(() => {
      descargarDesdeSupabase(store, false);
    }, 6000);

    // Actualizar inmediatamente al volver a la pestaña en el celular o PC
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        descargarDesdeSupabase(store, false);
      }
    });
  }

  global.SupabaseSync = {
    obtenerCredenciales,
    probarConexionSupabase,
    subirDatosASupabase,
    descargarDesdeSupabase,
    programarSubidaAutomatica,
    iniciarSincronizacionTiempoReal
  };
})(window);
