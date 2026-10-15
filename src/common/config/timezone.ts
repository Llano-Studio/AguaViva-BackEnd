/**
 * Fija la zona horaria del proceso (Buenos Aires, UTC-3) antes de que se use
 * cualquier Date. Debe ser el PRIMER import de main.ts: así los métodos de
 * hora local (getHours, setHours, getDay, toTimeString...) siempre trabajan en
 * hora de Buenos Aires aunque el contenedor/servidor esté en UTC u otra zona.
 */
process.env.TZ = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires';

export {};
