// ====== CONFIG ======
const TIMEZONE_NAME = "Europe/Madrid";

const SCHEDULE = [
    { dow: 2, hour: 17, minute: 30, label: "Martes 17:30"  }, // Mar
    { dow: 4, hour: 17, minute: 30, label: "Jueves 17:30"  }, // Jue
    { dow: 0, hour: 18, minute:  0, label: "Domingo 18:00" }  // Dom
];

// Duración del directo (ventana activa) en minutos
const LIVE_WINDOW_MINUTES = 150;

// ====== UTILS ======
function pad(n){ return n.toString().padStart(2, "0"); }

function formatTime(distanceMs){
    if (distanceMs < 0) distanceMs = 0;
    const total = Math.floor(distanceMs / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (d) parts.push(`${d}d`);
    parts.push(`${pad(h)}h`, `${pad(m)}m`, `${pad(s)}s`);
    return parts.join(" ");
}

// --- Helpers de zona horaria robustos (sin librerías externas) ---

// Devuelve partes (año/mes/día/hora/minuto/segundo) de un instante UTC,
// **mostradas en la zona** tz.
function getTzParts(utcMs, tz){
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const map = {};
    for (const p of parts){
        if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
    }
    return {
        year: map.year, month: map.month, day: map.day,
        hour: map.hour, minute: map.minute, second: map.second
    };
}

// Calcula el offset (minutos) de la zona tz para un instante UTC dado.
function getOffsetMinutes(tz, utcMs){
    const p = getTzParts(utcMs, tz);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    // Diferencia entre "lo que sería UTC con esos números" y el UTC real = offset
    return (asUTC - utcMs) / 60000;
}

// Convierte una hora de pared (y/m/d h:m) en zona tz -> Date (instante UTC real)
function wallTimeToUTC(tz, y, m, d, h, mi){
    const guess = Date.UTC(y, m - 1, d, h, mi, 0, 0);
    const offsetMin = getOffsetMinutes(tz, guess);
    return new Date(guess - offsetMin * 60000);
}

// Día de la semana **en la zona tz** para una fecha (y/m/d) de esa zona
// (0=Dom .. 6=Sáb)
function getDowInTz(tz, y, m, d){
    // Tomamos mediodía local para evitar problemas de DST a medianoche
    const noonUTC = wallTimeToUTC(tz, y, m, d, 12, 0);
    return noonUTC.getUTCDay(); // usar UTC evita depender de la zona local del navegador
}

function toReadable(dt){
    return new Intl.DateTimeFormat("es-ES", {
        timeZone: TIMEZONE_NAME,
        weekday: "long", day: "2-digit", month: "long",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    }).format(dt);
}

// Calcula la próxima fecha programada (instante UTC) para (dow, hour, minute) en tz.
function nextDateForDowTZ(nowUtcMs, targetDow, hour, minute, tz){
    // "Ahora" expresado en la zona tz
    const p = getTzParts(nowUtcMs, tz);
    const todayDow = getDowInTz(tz, p.year, p.month, p.day);

    let deltaDays = (targetDow - todayDow + 7) % 7;

    // Candidato "hoy a la hora X" en tz -> UTC real:
    let candidate = wallTimeToUTC(tz, p.year, p.month, p.day, hour, minute);

    // Si es hoy pero ya pasó, saltamos 7 días:
    if (deltaDays === 0 && candidate.getTime() <= nowUtcMs){
        deltaDays = 7;
    }

    // Sumamos deltaDays a la fecha de "hoy en tz" y construimos la hora objetivo:
    if (deltaDays > 0){
        // Creamos la fecha de 'hoy + deltaDays' en tz (sumando días en el dominio de pared)
        // Date.UTC gestiona overflow de días/meses correctamente
        const wallAfter = new Date(Date.UTC(p.year, p.month - 1, p.day + deltaDays, 0, 0, 0));
        const nextParts = getTzParts(wallAfter.getTime(), tz);
        candidate = wallTimeToUTC(tz, nextParts.year, nextParts.month, nextParts.day, hour, minute);
    }

    return candidate; // Date (instante UTC)
}

// Recorre SCHEDULE y devuelve el próximo directo como Date (UTC)
function getNextStreamUTC(fromUtcMs = Date.now()){
    let best = null;
    for (const s of SCHEDULE){
        const d = nextDateForDowTZ(fromUtcMs, s.dow, s.hour, s.minute, TIMEZONE_NAME);
        if (best === null || d < best) best = d;
    }
    return best;
}

function isWithinLiveWindow(nowUtcMs, startUtcDate, windowMinutes){
    const end = new Date(startUtcDate.getTime() + windowMinutes * 60 * 1000);
    return nowUtcMs >= startUtcDate.getTime() && nowUtcMs <= end.getTime();
}

// ====== MAIN ======
(function init(){
    const elCountdown = document.getElementById("countdown");   // div
    const elReadable  = document.getElementById("live-date");   // p
    const elCTA       = document.getElementById("live-cta");    // a

    if(!elCountdown || !elReadable || !elCTA){
        console.warn("Faltan #countdown, #live-date o #live-cta en el HTML.");
        return;
    }

    elCountdown.setAttribute("aria-live", "polite");
    elReadable.setAttribute("aria-live", "polite");

    let nextStream = getNextStreamUTC(); // <-- ahora es un instante absoluto en UTC

    let intervalId;
    function tick(){
        const nowUtcMs = Date.now();

        // ¿Está dentro de la ventana del directo?
        if (isWithinLiveWindow(nowUtcMs, nextStream, LIVE_WINDOW_MINUTES)){
            elCountdown.textContent = "🔴 ¡EN DIRECTO!";
            elCountdown.classList.add("live-now");
            elReadable.textContent  = `Comenzó: ${toReadable(nextStream)}`; // mostrado en hora de Madrid
            elCTA.hidden = false; // muestra el botón "Entrar al directo"
            return;
        }

        // Si la ventana acabó, calcular el siguiente directo en UTC (en Madrid)
        const windowEnd = new Date(nextStream.getTime() + LIVE_WINDOW_MINUTES * 60 * 1000);
        if (nowUtcMs > windowEnd.getTime()){
            nextStream = getNextStreamUTC(nowUtcMs);
        }

        // Cuenta atrás al próximo directo
        const distance = nextStream.getTime() - nowUtcMs;
        elCountdown.textContent = `⏳ ${formatTime(distance)}`;
        elReadable.textContent  = toReadable(nextStream); // siempre mostrado en Europe/Madrid
        elCTA.hidden = true; // oculta el CTA hasta que comience
    }

    tick();
    intervalId = setInterval(tick, 1000);
})();





















