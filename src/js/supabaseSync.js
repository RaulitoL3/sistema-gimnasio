/**
 * MOTOR DE SINCRONIZACIÓN EN TIEMPO REAL MULTIDISPOSITIVO (SUPABASE CLOUD)
 * Permite que Administración (Admin) y Recepción (PC / Celular) compartan
 * todos los recibos, alumnos, membresías y caja en vivo desde el link web.
 */
(function (global) {
  let syncTimeout = null;
  let lastCloudTimestamp = null;
  let isPulling = false;
  let pendingLocalChanges = false;
  const PENDING_SYNC_KEY = 'dojo_gym_pending_sync';

  function marcarPendienteSync(pendiente) {
    pendingLocalChanges = Boolean(pendiente);
    try {
      if (pendingLocalChanges) {
        localStorage.setItem(PENDING_SYNC_KEY, '1');
      } else {
        localStorage.removeItem(PENDING_SYNC_KEY);
      }
    } catch (e) {}
  }

  function tienePendienteSync() {
    if (pendingLocalChanges) return true;
    try {
      return localStorage.getItem(PENDING_SYNC_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function limpiarSupabaseUrl(rawUrl) {
    return (rawUrl || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/rest\/v1$/i, '');
  }

  function obtenerCredenciales(store) {
    const cloudCfg = global.GYM_CLOUD_CONFIG || {};
    const localCfg = store?.state?.configuracion || {};
    return {
      url: limpiarSupabaseUrl(cloudCfg.SUPABASE_URL || localCfg.supabase_url || ''),
      anonKey: (cloudCfg.SUPABASE_ANON_KEY || localCfg.supabase_anon_key || '').trim()
    };
  }

  function getHeaders(anonKey, includeBearer = true) {
    const headers = {
      apikey: anonKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    };
    if (includeBearer) {
      headers.Authorization = `Bearer ${anonKey}`;
    }
    return headers;
  }

  async function supabaseFetch(url, anonKey, options = {}) {
    let res = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(anonKey, true),
        ...(options.headers || {})
      }
    });
    // Si la llave es formato nuevo sb_publishable_ y PostgREST rechaza el header Authorization no-JWT, reintentar solo con apikey
    if (!res.ok && (res.status === 401 || res.status === 400) && String(anonKey).startsWith('sb_')) {
      res = await fetch(url, {
        ...options,
        headers: {
          ...getHeaders(anonKey, false),
          ...(options.headers || {})
        }
      });
    }
    return res;
  }

  function actualizarIndicadorCloud(estado, texto) {
    const ids = ['badge-cloud-sync', 'badge-cloud-sync-mobile', 'cloud-sync-indicator'];
    const estilos = {
      online: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      syncing: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      local: 'bg-slate-800 text-slate-300 border-slate-700',
      error: 'bg-red-500/20 text-red-300 border-red-500/30'
    };
    ids.forEach((id) => {
      const badge = document.getElementById(id);
      if (!badge) return;
      const extraClass = id === 'badge-cloud-sync-mobile' ? 'lg:hidden ' : '';
      badge.className = `${extraClass}inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
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
    });
  }

  function fusionarColeccionPorId(localArr = [], remoteArr = [], preferLocal = true, sortDescKey = null) {
    const map = new Map();
    const baseArr = preferLocal ? remoteArr : localArr;
    const overrideArr = preferLocal ? localArr : remoteArr;

    (Array.isArray(baseArr) ? baseArr : []).forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    (Array.isArray(overrideArr) ? overrideArr : []).forEach((item) => {
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      map.set(item.id, existing ? { ...existing, ...item } : item);
    });

    const result = Array.from(map.values());
    if (sortDescKey) {
      result.sort((a, b) => {
        const va = String(a[sortDescKey] || a.created_at || '');
        const vb = String(b[sortDescKey] || b.created_at || '');
        return vb.localeCompare(va);
      });
    }
    return result;
  }

  function fusionarEstados(localState, remoteState, rolDispositivo, url, anonKey, preferLocal = false) {
    if (!remoteState || typeof remoteState !== 'object') {
      return localState;
    }
    const localCfg = localState?.configuracion || {};
    const remoteCfg = remoteState?.configuracion || {};
    const cfgMerged = preferLocal
      ? { ...remoteCfg, ...localCfg }
      : { ...localCfg, ...remoteCfg };

    const proxLocal = Number(localCfg.proximo_nro_recibo || 1);
    const proxRemoto = Number(remoteCfg.proximo_nro_recibo || 1);

    const actividadesCombinadas = fusionarColeccionPorId(
      localState?.actividades || [],
      remoteState?.actividades || [],
      preferLocal,
      'fecha'
    ).slice(0, 150);

    return {
      ...remoteState,
      ...(preferLocal ? localState : {}),
      alumnos: fusionarColeccionPorId(localState?.alumnos || [], remoteState?.alumnos || [], preferLocal, null),
      membresias: fusionarColeccionPorId(localState?.membresias || [], remoteState?.membresias || [], preferLocal, 'created_at'),
      recibos: fusionarColeccionPorId(localState?.recibos || [], remoteState?.recibos || [], preferLocal, 'fecha_pago'),
      planes: fusionarColeccionPorId(localState?.planes || [], remoteState?.planes || [], preferLocal, null),
      horarios: fusionarColeccionPorId(localState?.horarios || [], remoteState?.horarios || [], preferLocal, null),
      actividades: actividadesCombinadas,
      configuracion: {
        ...cfgMerged,
        proximo_nro_recibo: Math.max(proxLocal, proxRemoto),
        supabase_url: url || cfgMerged.supabase_url || '',
        supabase_anon_key: anonKey || cfgMerged.supabase_anon_key || '',
        rol_actual: rolDispositivo || localCfg.rol_actual || 'RECEPCION'
      }
    };
  }

  async function probarConexionSupabase(url, anonKey) {
    if (!url || !anonKey) {
      throw new Error('Ingresa el Project URL y el Anon Key de tu proyecto Supabase.');
    }
    const cleanUrl = limpiarSupabaseUrl(url);
    const res = await supabaseFetch(`${cleanUrl}/rest/v1/gym_cloud_state?select=id,updated_at&limit=1`, anonKey, {
      method: 'GET'
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
      const rolDispositivo = store.getRolDispositivoActual();
      let estadoParaSubir = store.state;

      // Combinar primero con el snapshot remoto más reciente para no perder cobros hechos desde otro equipo
      try {
        const prevRes = await supabaseFetch(`${url}/rest/v1/gym_cloud_state?id=eq.main_gym&select=state_json,updated_at`, anonKey, {
          method: 'GET'
        });
        if (prevRes.ok) {
          const prevRows = await prevRes.json();
          if (Array.isArray(prevRows) && prevRows.length > 0 && prevRows[0]?.state_json) {
            estadoParaSubir = fusionarEstados(store.state, prevRows[0].state_json, rolDispositivo, url, anonKey, true);
          }
        }
      } catch (mergeErr) {
        console.warn('No se pudo pre-fusionar con nube antes de subir:', mergeErr);
      }

      const nowISO = new Date().toISOString();

      // No sobrescribir el rol individual de cada dispositivo ni las llaves locales
      const stateToSync = {
        ...estadoParaSubir,
        configuracion: {
          ...estadoParaSubir.configuracion,
          rol_actual: undefined
        },
        _updated_at: nowISO
      };

      const res = await supabaseFetch(`${url}/rest/v1/gym_cloud_state`, anonKey, {
        method: 'POST',
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
        marcarPendienteSync(false);
        if (estadoParaSubir !== store.state) {
          store.aplicarEstadoRemotoSinRebote({
            ...estadoParaSubir,
            configuracion: {
              ...estadoParaSubir.configuracion,
              rol_actual: rolDispositivo
            }
          });
        }
        actualizarIndicadorCloud('online', 'Nube Conectada');
        return true;
      } else {
        marcarPendienteSync(true);
        actualizarIndicadorCloud('error', 'Error Cloud');
        return false;
      }
    } catch (err) {
      console.warn('Error al sincronizar con Supabase:', err);
      marcarPendienteSync(true);
      actualizarIndicadorCloud('error', 'Sin Red Cloud');
      return false;
    }
  }

  /**
   * Descarga cambios realizados por el personal de recepción o administración desde otros dispositivos
   */
  async function descargarDesdeSupabase(store, forzar = false) {
    if (isPulling) return false;
    const { url, anonKey } = obtenerCredenciales(store);
    if (!url || !anonKey) {
      actualizarIndicadorCloud('local', 'Modo Local');
      return false;
    }

    const hayPendienteLocal = tienePendienteSync();
    if (hayPendienteLocal && !forzar) {
      return await subirDatosASupabase(store);
    }

    isPulling = true;
    try {
      const res = await supabaseFetch(`${url}/rest/v1/gym_cloud_state?id=eq.main_gym&select=state_json,updated_at`, anonKey, {
        method: 'GET'
      });

      if (!res.ok) {
        actualizarIndicadorCloud('error', 'Error Cloud');
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
          const rolDispositivo = store.getRolDispositivoActual();
          const baseLocal =
            store.isFreshInitialState && !hayPendienteLocal
              ? { alumnos: [], membresias: [], recibos: [], planes: [], horarios: [], actividades: [], configuracion: {} }
              : store.state;
          const mergedState = fusionarEstados(baseLocal, remoteState, rolDispositivo, url, anonKey, hayPendienteLocal);
          store.aplicarEstadoRemotoSinRebote(mergedState);
          if (hayPendienteLocal) {
            isPulling = false;
            await subirDatosASupabase(store);
            return true;
          }
        }
      }
      actualizarIndicadorCloud('online', 'Nube en Vivo');
      isPulling = false;
      return true;
    } catch (err) {
      actualizarIndicadorCloud('error', 'Sin Red Cloud');
      isPulling = false;
      return false;
    }
  }

  function programarSubidaAutomatica(store) {
    const { url, anonKey } = obtenerCredenciales(store);
    if (!url || !anonKey) return;
    marcarPendienteSync(true);
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
