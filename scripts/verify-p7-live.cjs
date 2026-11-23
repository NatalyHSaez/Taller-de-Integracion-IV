#!/usr/bin/env node
'use strict';
/** P7: smoke test REAL contra el Gateway. No crea registros ni cambia permisos. */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function envUrl() {
  if (process.env.P7_BASE_URL) return process.env.P7_BASE_URL;
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .find(row => /^\s*EXPO_PUBLIC_API_URL\s*=/.test(row));
  return line ? line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '') : '';
}
function getBaseUrl() {
  const raw = envUrl().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('Define P7_BASE_URL o EXPO_PUBLIC_API_URL (URL del Gateway).'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('La URL debe ser solo el origen del Gateway, sin credenciales, rutas ni query.');
  }
  return url.origin;
}
function fail(message) { throw new Error(message); }
async function main() {
  const base = getBaseUrl();
  let token;
  let refreshToken;
  let failed = false;
  let incomplete = false;
  async function request(method, route, body, auth = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${base}/api/v1${route}`, {
        method, signal: controller.signal,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Correlation-ID': randomUUID() },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      return { status: response.status, payload };
    } finally { clearTimeout(timeout); }
  }
  function check(condition, message) { if (!condition) fail(message); console.log('OK', message); }
  try {
    console.log('P7 — Verificación real del API Gateway (no muestra credenciales ni tokens).');
    const health = await request('GET', '/health', undefined, false);
    check(health.status === 200 && health.payload?.status === 'ok' &&
      health.payload?.servicios && Object.values(health.payload.servicios).every(v => v === 'ok'),
      'Gateway y siete microservicios disponibles.');
    if (!process.env.P7_EMAIL || !process.env.P7_PASSWORD) {
      incomplete = true;
      console.log('PENDIENTE: define P7_EMAIL y P7_PASSWORD para probar sesión y paciente real.');
      return;
    }
    const login = await request('POST', '/auth/login', {
      email: process.env.P7_EMAIL, password: process.env.P7_PASSWORD,
    }, false);
    // Para diagnosticar el login, mostrar únicamente HTTP y errorCode, nunca tokens ni credenciales.
    if (login.status !== 200) {
      const code = typeof login.payload?.errorCode === 'string' ? `, errorCode=${login.payload.errorCode}` : '';
      const guidance = login.status === 401
        ? 'Credenciales rechazadas. Comprueba la contraseña actual de la cuenta; las cuentas demo existentes no se reescriben al reconstruir Docker.'
        : login.status === 422
          ? 'Solicitud rechazada por validación. Comprueba email/password y la versión del backend.'
          : login.status === 503
            ? 'Identidad no está respondiendo correctamente al Gateway. Revisa docker compose logs identidad.'
            : login.status >= 500
              ? 'Error interno del backend. Revisa docker compose logs identidad y gateway.'
              : 'Revisa la respuesta del servicio Identidad y los registros del backend.';
      fail(`Login real: HTTP ${login.status}${code}. ${guidance}`);
    }
    check(typeof login.payload?.accessToken === 'string' &&
      typeof login.payload?.refreshToken === 'string',
      'Login real con accessToken y refreshToken.');
    token = login.payload.accessToken;
    refreshToken = login.payload.refreshToken;
    const me = await request('GET', '/me');
    check(me.status === 200 && typeof me.payload?.id === 'string' && Array.isArray(me.payload.roles),
      'GET /me responde con usuario autenticado.');
    const role = me.payload.roles.includes('PATIENT') ? 'PATIENT' :
      me.payload.roles.includes('CAREGIVER') ? 'CAREGIVER' : null;
    check(Boolean(role), 'Rol móvil PATIENT o CAREGIVER reconocido.');
    let patientId = role === 'PATIENT' ? me.payload.id : null;
    let permissions = ['MEASUREMENT_VIEW', 'PATIENT_PROFILE_VIEW'];
    if (role === 'CAREGIVER') {
      const linked = await request('GET', '/me/patients');
      check(linked.status === 200 && Array.isArray(linked.payload), 'GET /me/patients devuelve relaciones reales.');
      if (!linked.payload.length) {
        incomplete = true;
        console.log('PENDIENTE: cuidador sin pacientes vinculados; vincúlalo antes de S1.');
      } else {
        const relation = linked.payload[0];
        check(typeof relation.patientId === 'string' && Array.isArray(relation.permissions),
          'Relación vinculada incluye UUID y permisos.');
        patientId = relation.patientId;
        permissions = relation.permissions;
      }
    }
    if (patientId) {
      if (permissions.includes('PATIENT_PROFILE_VIEW')) {
        const profile = await request('GET', `/patients/${encodeURIComponent(patientId)}`);
        check(profile.status === 200 && profile.payload?.id === patientId,
          'GET ficha de paciente autorizado coincide con el UUID.');
      } else { console.log('PENDIENTE: el cuidador no posee PATIENT_PROFILE_VIEW.'); incomplete = true; }
      if (permissions.includes('MEASUREMENT_VIEW')) {
        const readings = await request('GET', `/patients/${encodeURIComponent(patientId)}/readings?page=1&size=1`);
        check(readings.status === 200 && Number.isInteger(readings.payload?.total) &&
          Array.isArray(readings.payload?.items), 'GET historial paginado responde desde Seguimiento.');
        if (readings.payload.total === 0) {
          incomplete = true;
          console.log('PENDIENTE: no existen lecturas reales para probar S1/S2.');
        } else { console.log('OK Lecturas reales existentes para validar S1/S2.'); }
      } else { incomplete = true; console.log('PENDIENTE: sin permiso MEASUREMENT_VIEW.'); }
    }
    // Un UUID sintético no representa ningún paciente creado; valida que el Gateway falle cerrado.
    const other = process.env.P7_FORBIDDEN_PATIENT_ID || randomUUID();
    if (other.toLowerCase() !== patientId?.toLowerCase()) {
      const forbidden = await request('GET', `/patients/${encodeURIComponent(other)}/readings?page=1&size=1`);
      check(forbidden.status === 403 && forbidden.payload?.errorCode === 'FORBIDDEN',
        'Solicitud de paciente no autorizado denegada por el Gateway (403).');
      if (!process.env.P7_FORBIDDEN_PATIENT_ID) {
        console.log('NOTA: prueba de rechazo con UUID sintético; para un paciente existente ajeno, usa P7_FORBIDDEN_PATIENT_ID.');
      }
    }
  } catch (error) {
    failed = true;
    console.error('ERROR P7:', error?.message || String(error));
  } finally {
    if (refreshToken) {
      try {
        const logout = await request('POST', '/auth/logout', { refreshToken }, false);
        if (logout.status === 204) console.log('OK Logout remoto (204).');
        else { failed = true; console.error('ERROR P7: logout respondió HTTP', logout.status); }
      } catch { failed = true; console.error('ERROR P7: no se pudo cerrar la sesión remota.'); }
    }
    console.log(failed ? 'P7: FALLO' : incomplete ? 'P7: VERIFICACIÓN PARCIAL' : 'P7: PRUEBAS REALES COMPLETAS');
    if (failed) process.exitCode = 1;
    else if (incomplete) process.exitCode = 2;
  }
}
main().catch(error => { console.error('ERROR P7:', error?.message || String(error)); process.exitCode = 1; });
