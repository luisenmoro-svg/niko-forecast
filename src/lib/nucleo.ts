// Frontera de tipos con el núcleo portado.
//
// src/lib/*.js y modelo.js son JavaScript llano, copiado tal cual del tablero
// estático para que ninguna fórmula cambiara al migrar. TypeScript infiere de
// ellos tipos demasiado estrechos (el dato real viene de Supabase y es mucho más
// variable que el juego de ejemplo), así que aquí se reexportan con tipos
// abiertos. Es el único lugar donde se afloja el tipado, y es a propósito.
//
// No conviertas estos módulos a TypeScript: el guardián del modelo compara su
// resultado contra una referencia, y reescribirlos es justo lo que quiere evitar.

import * as pron from './pronostico.js';
import * as cm from './construirModelo.js';

export const pronostico: (M: any, sim: any, opciones?: any) => any = pron.pronostico as any;
export const olas: (M: any, P: any) => any[] = pron.olas as any;
export const fraseOla: (o: any) => string = pron.fraseOla as any;
export const txtRitmo: (e: any, largo?: boolean) => string = pron.txtRitmo as any;
export const notaLotes: (e: any) => string = pron.notaLotes as any;
export const entradaMedida: (M: any) => any = pron.entradaMedida as any;
export const entradaReal: (M: any) => any = pron.entradaReal as any;
export const entradaMeta: (M: any) => any = pron.entradaMeta as any;
export const resolverEsfuerzo: (M: any) => any = pron.resolverEsfuerzo as any;
export const quienesPueden: (M: any) => any = pron.quienesPueden as any;

export const construirModelo: (raw: any, opciones: any) => any = cm.construirModelo as any;
