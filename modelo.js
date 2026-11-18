// Modelo de pronóstico del Ticket System.
// Única implementación: la usan index.html (vista) y scripts/sync-hubspot.mjs (guardado).
// No depende del navegador ni de Node: recibe datos planos y devuelve datos planos.
//
// La cadena se modela como colas de capacidad: un sitio sale de una etapa cuando se
// cierra su ticket, así que lo que sale cada semana es lo que el equipo alcanza a cerrar.
// Las etapas que no gobierna un ticket usan los días del Reverse Eng Model.
// Los tiempos por etapa de HubSpot NO se usan: se mueven por lotes.
(function (raiz) {
  'use strict';

  // entrada = {
  //   ritmos: [{id, cod, modo:'cola'|'proceso', ticket, equipo, dias, conversion}],
  //   estado: { etapa_id: {sitios, kwp} },
  //   capSemana: { equipo: horas },
  //   esfuerzo: (tipo) => ({h, fuente}),
  //   nuevos: {sitios, kwpPorSitio} | null,
  //   semanas: n,
  //   ajustes: {multEsfuerzo, diasEtapa},
  // }
  function calcularPronostico(e) {
    const ritmos = e.ritmos || [];
    const semanas = e.semanas || 10;
    const aj = e.ajustes || {};
    const mult = aj.multEsfuerzo || 1;
    const esfuerzoDe = t => {
      const r = e.esfuerzo(t) || {};
      return { h: r.h == null ? null : r.h * mult, fuente: r.fuente || 'sin dato' };
    };

    // Copia del estado para no tocar el de quien llama.
    const estado = {};
    for (const r of ritmos) {
      const s = (e.estado || {})[r.id] || { sitios: 0, kwp: 0 };
      estado[r.id] = { sitios: Number(s.sitios) || 0, kwp: Number(s.kwp) || 0 };
    }

    const salida = [];
    const sinEsfuerzo = new Set();
    const demandaEquipo = {};

    for (let w = 1; w <= semanas; w++) {
      // Colas vivas por equipo: se reparten su capacidad.
      const colas = {};
      for (const r of ritmos) {
        if (r.modo !== 'cola') continue;
        if ((estado[r.id] || {}).sitios > 0) (colas[r.equipo] = colas[r.equipo] || []).push(r);
      }
      const mueve = {};
      for (const r of ritmos) {
        const st = estado[r.id];
        if (!st || st.sitios <= 0) { mueve[r.id] = 0; continue; }
        if (r.modo === 'proceso') {
          const dias = (aj.diasEtapa && aj.diasEtapa[r.cod]) || r.dias || 1;
          mueve[r.id] = st.sitios * Math.min(1, 5 / dias);
          continue;
        }
        const esf = esfuerzoDe(r.ticket);
        // Sin esfuerzo no se inventa un ritmo: la cola queda detenida y se marca.
        if (esf.h == null) { sinEsfuerzo.add(r.cod + ' · ' + r.ticket); mueve[r.id] = 0; continue; }
        const compiten = (colas[r.equipo] || [r]).length;
        const horas = (e.capSemana[r.equipo] || 0) / compiten;
        mueve[r.id] = Math.min(st.sitios, horas / esf.h);
        demandaEquipo[r.equipo] = demandaEquipo[r.equipo] || [];
        demandaEquipo[r.equipo][w - 1] = (demandaEquipo[r.equipo][w - 1] || 0) + st.sitios * esf.h;
      }

      // Mover, aplicando la conversión de cada etapa.
      const entra = {};
      let instalados = { sitios: 0, kwp: 0 };
      ritmos.forEach(function (r, i) {
        const st = estado[r.id];
        if (!st) return;
        const n = Math.min(st.sitios, mueve[r.id] || 0);
        if (n <= 0) return;
        const kps = st.sitios ? st.kwp / st.sitios : 0;
        const pasan = n * (r.conversion == null ? 1 : r.conversion);
        st.sitios -= n; st.kwp -= n * kps;
        const sig = ritmos[i + 1];
        if (!sig) { instalados.sitios += pasan; instalados.kwp += pasan * kps; return; }
        entra[sig.id] = entra[sig.id] || { sitios: 0, kwp: 0 };
        entra[sig.id].sitios += pasan;
        entra[sig.id].kwp += pasan * kps;
      });
      for (const id in entra) { estado[id].sitios += entra[id].sitios; estado[id].kwp += entra[id].kwp; }

      // Demanda nueva en la primera etapa.
      if (e.nuevos && e.nuevos.sitios > 0 && ritmos.length) {
        const p = ritmos[0].id;
        estado[p].sitios += e.nuevos.sitios;
        estado[p].kwp += e.nuevos.sitios * (e.nuevos.kwpPorSitio || 0);
      }

      const porEtapa = {};
      let ts = 0, tk = 0;
      for (const r of ritmos) {
        const st = estado[r.id];
        porEtapa[r.id] = { sitios: Math.round(st.sitios * 10) / 10, kwp: Math.round(st.kwp) };
        ts += st.sitios; tk += st.kwp;
      }
      salida.push({
        etiqueta: w + 'S', pronostico: true, porEtapa: porEtapa,
        instalados: { sitios: Math.round(instalados.sitios * 10) / 10, kwp: Math.round(instalados.kwp) },
        sitios: Math.round(ts), kwp: Math.round(tk),
      });
    }

    // Cuellos de botella: demanda contra capacidad, del mismo recorrido.
    const equipos = [];
    for (const r of ritmos) if (r.modo === 'cola' && equipos.indexOf(r.equipo) < 0) equipos.push(r.equipo);
    const cuellos = equipos.map(function (nombre) {
      const cap = e.capSemana[nombre] || 0;
      const dem = [];
      for (let w = 0; w < semanas; w++) dem.push((demandaEquipo[nombre] || [])[w] || 0);
      const util = dem.map(d => cap > 0 ? d / cap : null);
      let primera = null;
      for (let i = 0; i < util.length; i++) if (util[i] != null && util[i] > 1) { primera = i + 1; break; }
      return {
        nombre: nombre, cap: cap, dem: dem, util: util, primeraSemana: primera,
        colas: ritmos.filter(r => r.equipo === nombre).map(r => r.cod),
        esfuerzo: ritmos.filter(r => r.equipo === nombre)
          .map(r => Object.assign({ ticket: r.ticket }, esfuerzoDe(r.ticket))),
      };
    }).sort((a, b) => (a.primeraSemana == null ? 99 : a.primeraSemana) - (b.primeraSemana == null ? 99 : b.primeraSemana));

    return { semanas: salida, cuellos: cuellos, sinEsfuerzo: Array.from(sinEsfuerzo) };
  }

  raiz.NIKO_MODELO = { calcularPronostico: calcularPronostico };
})(typeof globalThis !== 'undefined' ? globalThis : this);
