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
    const esfuerzoDe = (t, esRevision) => {
      const r = e.esfuerzo(t, esRevision) || {};
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
    const sinSla = new Set();
    const sinQuien = new Set();
    const demandaEquipo = {};

    for (let w = 1; w <= semanas; w++) {
      // Colas vivas por equipo: se reparten su capacidad.
      // Filas vivas por equipo: cada paso de cada etapa con sitios esperando.
      const colas = {};
      for (const r of ritmos) {
        if (r.modo !== 'cola') continue;
        if (!((estado[r.id] || {}).sitios > 0)) continue;
        for (const t of (r.tickets || [])) (colas[t.equipo] = colas[t.equipo] || []).push({ etapa: r, tipo: t.tipo });
      }
      if (e.fijarColas) e.fijarColas(colas, estado);
      const mueve = {}, porque = {}, inicio = {};
      for (const r of ritmos) {
        const st = estado[r.id];
        inicio[r.id] = st ? st.sitios : 0;
        if (!st || st.sitios <= 0) { mueve[r.id] = 0; porque[r.id] = { modo: 'vacio' }; continue; }
        if (r.modo === 'proceso') {
          const dias = (aj.diasEtapa && aj.diasEtapa[r.cod]) || r.dias || 1;
          const frac = Math.min(1, 5 / dias);
          mueve[r.id] = st.sitios * frac;
          porque[r.id] = { modo: 'proceso', dias: dias, fraccion: frac, nota: r.nota || '' };
          continue;
        }
        // --- MODO PROMESA: cada ticket se resuelve en su SLA. Secuencial suma, paralelo
        // toma el mayor. No mira capacidad: es lo que el catálogo promete.
        if (e.promesa) {
          let sec = 0, par = 0, falta = false;
          for (const t of (r.tickets || [])) {
            const s = e.sla(t.tipo);
            if (s == null) { falta = true; continue; }
            if (t.orden === 'par') par = Math.max(par, s); else sec += s;
          }
          const dias = sec + par;
          if (falta || dias <= 0) {
            mueve[r.id] = 0; porque[r.id] = { modo: 'sin-sla', tickets: (r.tickets || []).map(t => t.tipo) };
            sinSla.add(r.cod);
            continue;
          }
          const frac = Math.min(1, 5 / dias);
          mueve[r.id] = st.sitios * frac;
          porque[r.id] = { modo: 'promesa', dias: dias, sec: sec, par: par, fraccion: frac };
          continue;
        }
        // --- MODO CAPACIDAD: la etapa va al ritmo de su ticket más lento.
        const pasos = [];
        for (const t of (r.tickets || [])) {
          // Un ticket con revisión son dos pasos: quien lo produce y quien lo revisa.
          const fases = t.revision ? [false, true] : [false];
          for (const esRev of fases) {
            const esf = esfuerzoDe(t.tipo, esRev);
            if (esf.h == null) {
              if (esRev) continue;   // sin horas de revisión cargadas, solo cuenta producción
              pasos.push({ tipo: t.tipo, equipo: t.equipo, sinEsfuerzo: true, caben: 0 }); continue;
            }
            const horas = e.horasPara(t.tipo, t.equipo, r.id, w, esRev);
            // Cero horas = nadie puede tomarlo o el equipo no existe. Se marca, no se calla.
            if (!(horas.h > 0)) sinQuien.add(r.cod + ' · ' + t.tipo + (esRev ? ' (revisión)' : ''));
            pasos.push({ tipo: t.tipo + (esRev ? ' (revisión)' : ''), equipo: t.equipo,
                         esfuerzo: esf.h, fuente: esf.fuente, horas: horas.h, quienes: horas.quienes,
                         sinQuien: !(horas.h > 0),
                         caben: esf.h > 0 ? horas.h / esf.h : 0 });
            demandaEquipo[t.equipo] = demandaEquipo[t.equipo] || [];
            demandaEquipo[t.equipo][w - 1] = (demandaEquipo[t.equipo][w - 1] || 0) + st.sitios * esf.h;
          }
        }
        const sinEsf = pasos.filter(p => p.sinEsfuerzo);
        if (sinEsf.length) {
          for (const p of sinEsf) sinEsfuerzo.add(r.cod + ' · ' + p.tipo);
          mueve[r.id] = 0;
          porque[r.id] = { modo: 'sin-esfuerzo', ticket: sinEsf.map(p => p.tipo).join(', '), pasos: pasos };
          continue;
        }
        // El cuello de la etapa es el paso que menos sitios deja pasar.
        const cuello = pasos.reduce((a, p) => (a == null || p.caben < a.caben) ? p : a, null);
        const caben = cuello ? cuello.caben : 0;
        mueve[r.id] = Math.min(st.sitios, caben);
        porque[r.id] = { modo: 'cola', pasos: pasos, cuello: cuello, caben: caben,
                         topado: caben > st.sitios };
      }

      // Mover, aplicando la conversión de cada etapa.
      const entra = {}, salio = {}, perdio = {};
      let instalados = { sitios: 0, kwp: 0, deCod: null, deEtiqueta: null };
      ritmos.forEach(function (r, i) {
        const st = estado[r.id];
        if (!st) return;
        const n = Math.min(st.sitios, mueve[r.id] || 0);
        salio[r.id] = n;
        if (n <= 0) { perdio[r.id] = 0; return; }
        const kps = st.sitios ? st.kwp / st.sitios : 0;
        const conv = r.conversion == null ? 1 : r.conversion;
        const pasan = n * conv;
        perdio[r.id] = n - pasan;
        st.sitios -= n; st.kwp -= n * kps;
        const sig = ritmos[i + 1];
        if (!sig) {
          instalados.sitios += pasan; instalados.kwp += pasan * kps;
          instalados.deCod = r.cod; instalados.deEtiqueta = r.cod;
          return;
        }
        entra[sig.id] = entra[sig.id] || { sitios: 0, kwp: 0, deCod: r.cod };
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

      const porEtapa = {}, traza = {};
      let ts = 0, tk = 0;
      ritmos.forEach(function (r, i) {
        const st = estado[r.id];
        porEtapa[r.id] = { sitios: Math.round(st.sitios * 10) / 10, kwp: Math.round(st.kwp) };
        const lleg = entra[r.id];
        traza[r.id] = {
          cod: r.cod, inicio: inicio[r.id],
          llegaron: lleg ? lleg.sitios : 0,
          deCod: lleg ? lleg.deCod : null,
          salieron: salio[r.id] || 0,
          porque: porque[r.id] || { modo: 'vacio' },
          perdidos: perdio[r.id] || 0,
          conversion: r.conversion == null ? 1 : r.conversion,
          nuevos: (i === 0 && e.nuevos && e.nuevos.sitios > 0) ? e.nuevos.sitios : 0,
          // Se redondea aquí para que el panel y la celda muestren exactamente lo mismo.
          fin: Math.round(st.sitios * 10) / 10, kwpFin: st.kwp,
        };
        ts += st.sitios; tk += st.kwp;
      });
      salida.push({
        etiqueta: w + 'S', pronostico: true, porEtapa: porEtapa, traza: traza,
        instalados: { sitios: Math.round(instalados.sitios * 10) / 10, kwp: Math.round(instalados.kwp) },
        sitios: Math.round(ts), kwp: Math.round(tk),
      });
    }

    // Cuellos de botella: demanda contra capacidad, del mismo recorrido.
    const equipos = [];
    for (const r of ritmos) for (const t of (r.tickets || []))
      if (equipos.indexOf(t.equipo) < 0) equipos.push(t.equipo);
    const cuellos = equipos.map(function (nombre) {
      const cap = e.capSemana[nombre] || 0;
      const dem = [];
      for (let w = 0; w < semanas; w++) dem.push((demandaEquipo[nombre] || [])[w] || 0);
      const util = dem.map(d => cap > 0 ? d / cap : null);
      let primera = null;
      for (let i = 0; i < util.length; i++) if (util[i] != null && util[i] > 1) { primera = i + 1; break; }
      return {
        nombre: nombre, cap: cap, dem: dem, util: util, primeraSemana: primera,
        colas: ritmos.filter(r => (r.tickets || []).some(t => t.equipo === nombre)).map(r => r.cod),
        esfuerzo: ritmos.flatMap(r => (r.tickets || []).filter(t => t.equipo === nombre)
          .map(t => Object.assign({ ticket: t.tipo, etapa: r.cod }, esfuerzoDe(t.tipo, t.revision)))),
      };
    }).sort((a, b) => (a.primeraSemana == null ? 99 : a.primeraSemana) - (b.primeraSemana == null ? 99 : b.primeraSemana));

    return { semanas: salida, cuellos: cuellos, sinEsfuerzo: Array.from(sinEsfuerzo), sinSla: Array.from(sinSla), sinQuien: Array.from(sinQuien) };
  }

  raiz.NIKO_MODELO = { calcularPronostico: calcularPronostico };
})(typeof globalThis !== 'undefined' ? globalThis : this);
