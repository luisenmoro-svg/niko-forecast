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
            // Nadie modelado para este paso: no se detiene la cadena, porque entonces las
            // etapas de más adelante nunca verían llegar sus olas. Avanza por su SLA (o por
            // los días del Reverse Eng Model) y se marca «sin capacidad modelada».
            if (!(horas.h > 0)) {
              sinQuien.add(r.cod + ' · ' + t.tipo + (esRev ? ' (revisión)' : '') + ' → ' + t.equipo);
              const d = e.sla(t.tipo) || r.diasRef || 5;
              pasos.push({ tipo: t.tipo + (esRev ? ' (revisión)' : ''), equipo: t.equipo,
                           esfuerzo: esf.h, fuente: esf.fuente, horas: 0, quienes: horas.quienes,
                           sinCapacidad: true, dias: d,
                           caben: st.sitios * Math.min(1, 5 / d) });
              continue;
            }
            pasos.push({ tipo: t.tipo + (esRev ? ' (revisión)' : ''), equipo: t.equipo,
                         esfuerzo: esf.h, fuente: esf.fuente, horas: horas.h, quienes: horas.quienes,
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
        // La salida puede bifurcarse: 2.02 manda una parte a 2.03 y otra directo a 2.10.
        const destinos = (r.ramas && r.ramas.length)
          ? r.ramas.map(x => ({ id: x.a, frac: x.frac }))
          : (ritmos[i + 1] ? [{ id: ritmos[i + 1].id, frac: 1 }] : []);
        if (!destinos.length) {
          instalados.sitios += pasan; instalados.kwp += pasan * kps;
          instalados.deCod = r.cod; instalados.deEtiqueta = r.cod;
          return;
        }
        for (const d of destinos) {
          if (!estado[d.id]) continue;   // rama hacia una etapa fuera de la cadena
          // Una etapa puede recibir de varias: se guarda cada procedencia con su
          // cantidad, no solo la ultima, para que el panel las muestre todas.
          entra[d.id] = entra[d.id] || { sitios: 0, kwp: 0, deCod: r.cod, fuentes: [] };
          entra[d.id].sitios += pasan * d.frac;
          entra[d.id].kwp += pasan * d.frac * kps;
          entra[d.id].fuentes.push({ cod: r.cod, sitios: pasan * d.frac });
        }
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
          // Cada parte se redondea a un decimal, igual que la celda, y el sobrante del
          // redondeo se le da a la mayor para que las partes sumen exactamente el total.
          deFuentes: lleg && lleg.fuentes ? (function (fs) {
            const r1 = x => Math.round(x * 10) / 10;
            const out = fs.map(function (f) { return { cod: f.cod, sitios: r1(f.sitios) }; });
            const dif = r1(r1(lleg.sitios) - out.reduce(function (a, x) { return a + x.sitios; }, 0));
            if (dif && out.length) {
              const may = out.reduce(function (a, x) { return x.sitios > a.sitios ? x : a; }, out[0]);
              may.sitios = r1(may.sitios + dif);
            }
            return out;
          })(lleg.fuentes) : [],
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

  // El plan de ensueño: se recorre la cadena HACIA ATRÁS desde la meta de instalaciones.
  // Si cada ticket se cumple en su SLA y sobreviven las tasas del Reverse Eng Model,
  // ¿cuántos sitios deben estar en cada etapa cada semana, y cuántos deben entrar?
  // e = { ritmos, metaSemana, kwpPorSitio, sla(tipo), semanas, esfuerzo(tipo, rev) }
  function calcularMeta(e) {
    const ritmos = e.ritmos || [];
    const semanas = e.semanas || 10;
    // Días que promete cada etapa: secuencial suma, paralelo toma el mayor.
    const diasDe = r => {
      if (r.modo === 'proceso') return r.dias || 1;
      let sec = 0, par = 0;
      for (const t of (r.tickets || [])) {
        const d = e.sla(t.tipo);
        if (d == null) continue;
        if (t.orden === 'par') par = Math.max(par, d); else sec += d;
      }
      return (sec + par) || r.diasRef || 5;
    };
    // Hacia atrás: para que salgan N de la última etapa, deben entrar N / conversión.
    // Si se pasó una tasa de punta a punta medida, manda sobre el producto de las
    // conversiones por etapa, que con bifurcaciones cuenta de más las pérdidas.
    const necesita = [];
    let n = e.metaSemana || 0;
    for (let i = ritmos.length - 1; i >= 0; i--) {
      const r = ritmos[i];
      const conv = r.conversion == null ? 1 : r.conversion;
      const entran = conv > 0 ? n / conv : 0;
      // Sitios parados en la etapa: lo que entra por semana × las semanas que tarda.
      const dias = diasDe(r);
      necesita.unshift({ cod: r.cod, id: r.id, entranSemana: entran, dias: dias,
                         sitios: entran * (dias / 5), conversion: conv });
      n = entran;
    }
    let entradaSemana = n;   // lo que debe entrar a la primera etapa
    let entradaFuente = 'producto de las conversiones por etapa';
    if (e.tasaPuntaAPunta > 0) {
      // La medición de punta a punta no sufre el doble conteo de las ramas.
      entradaSemana = (e.metaSemana || 0) / e.tasaPuntaAPunta;
      entradaFuente = 'tasa medida de punta a punta';
      // Se reescala la cadena para que su entrada coincida con la medida.
      const factor = necesita[0] && necesita[0].entranSemana > 0 ? entradaSemana / necesita[0].entranSemana : 1;
      for (const x of necesita) { x.entranSemana *= factor; x.sitios *= factor; }
    }

    // Horas por semana que ese plan exige a cada equipo y a cada persona.
    const horasEquipo = {}, horasTipo = {};
    ritmos.forEach(function (r, i) {
      if (r.modo !== 'cola') return;
      const flujo = necesita[i].entranSemana;
      for (const t of (r.tickets || [])) {
        const fases = t.revision ? [false, true] : [false];
        for (const esRev of fases) {
          const esf = e.esfuerzo(t.tipo, esRev);
          if (esf.h == null) continue;
          const clave = t.tipo + (esRev ? ' (revisión)' : '');
          horasTipo[clave] = (horasTipo[clave] || 0) + flujo * esf.h;
          horasEquipo[t.equipo] = (horasEquipo[t.equipo] || 0) + flujo * esf.h;
        }
      }
    });

    // La foto semanal del plan: en régimen, cada etapa mantiene sus sitios parados.
    const salida = [];
    for (let w = 1; w <= semanas; w++) {
      const porEtapa = {};
      for (const x of necesita) porEtapa[x.id] = { sitios: Math.round(x.sitios * 10) / 10,
                                                  kwp: Math.round(x.sitios * (e.kwpPorSitio || 0)) };
      salida.push({ etiqueta: w + 'S', meta: true, porEtapa: porEtapa,
                    instalados: { sitios: e.metaSemana || 0, kwp: (e.metaSemana || 0) * (e.kwpPorSitio || 0) },
                    sitios: Math.round(necesita.reduce((a, x) => a + x.sitios, 0)),
                    kwp: Math.round(necesita.reduce((a, x) => a + x.sitios, 0) * (e.kwpPorSitio || 0)) });
    }
    return { semanas: salida, necesita: necesita, entradaSemana: entradaSemana, entradaFuente: entradaFuente,
             horasEquipo: horasEquipo, horasTipo: horasTipo };
  }

  raiz.NIKO_MODELO = { calcularPronostico: calcularPronostico, calcularMeta: calcularMeta };
})(typeof globalThis !== 'undefined' ? globalThis : this);
