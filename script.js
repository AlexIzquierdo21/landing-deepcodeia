// ====== CONFIG ======
const TIMEZONE_NAME = "Europe/Madrid";

// Programa (0=Dom, 1=Lun, ..., 6=Sáb)
const SCHEDULE = [
    { dow: 2, hour: 17, minute: 30, label: "Martes 17:30"  }, // Mar
    { dow: 4, hour: 17, minute: 30, label: "Jueves 17:30"  }, // Jue
    { dow: 0, hour: 18, minute:  0, label: "Domingo 18:00" }  // Dom
];

// Duración del directo (ventana activa) en minutos
const LIVE_WINDOW_MINUTES = 150; // 2h30 por si te alargas ;)

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

function toReadable(dt){
    return dt.toLocaleString("es-ES", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TIMEZONE_NAME,
        timeZoneName: "short"
    });
}

function nextDateForDow(base, targetDow, hour, minute){
    const now = new Date(base.getTime());
    const currentDow = now.getDay();

    // Candidato para "hoy" a la hora objetivo
    const candidate = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        hour, minute, 0, 0
    );

    // Días hasta el target
    let deltaDays = (targetDow - currentDow + 7) % 7;

    // Si es hoy y ya pasó la hora, empuja 7 días
    if (deltaDays === 0 && candidate <= now) deltaDays = 7;

    const result = new Date(candidate.getTime());
    result.setDate(candidate.getDate() + deltaDays);
    return result;
}

function getNextStream(fromDate = new Date()){
    let best = null;
    for (const s of SCHEDULE){
        const d = nextDateForDow(fromDate, s.dow, s.hour, s.minute);
        if (best === null || d < best) best = d;
    }
    return best;
}

function isWithinLiveWindow(now, start, windowMinutes){
    const end = new Date(start.getTime() + windowMinutes * 60 * 1000);
    return now >= start && now <= end;
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

    // Accesibilidad
    elCountdown.setAttribute("aria-live", "polite");
    elReadable.setAttribute("aria-live", "polite");

    let nextStream = getNextStream();

    function tick(){
        const now = new Date();

        // ¿Estamos dentro del directo?
        if (isWithinLiveWindow(now, nextStream, LIVE_WINDOW_MINUTES)){
            elCountdown.textContent = "🔴 ¡EN DIRECTO!";
            elReadable.textContent  = `Comenzó: ${toReadable(nextStream)}`;
            elCTA.hidden = false; // muestra el botón "Entrar al directo"
            return;
        }

        // Si ya terminó esa ventana, calcula el siguiente
        const windowEnd = new Date(nextStream.getTime() + LIVE_WINDOW_MINUTES * 60 * 1000);
        if (now > windowEnd){
            nextStream = getNextStream(now);
        }

        // Render cuenta atrás
        const distance = nextStream.getTime() - now.getTime();
        elCountdown.textContent = `⏳ ${formatTime(distance)}`;
        elReadable.textContent  = toReadable(nextStream);
        elCTA.hidden = true; // oculta el CTA hasta que comience
    }

    tick();
    setInterval(tick, 1000);
})();






















