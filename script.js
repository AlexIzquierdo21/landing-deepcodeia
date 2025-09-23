const LIVE_ISO = "2025-09-25T17:30:00+02:00";

const targetDate = new Date(LIVE_ISO);
const targetMs = targetDate.getTime();

function formatTime(distance){
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 *60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 *60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    return `${days}d ${hours}h${minutes}m ${seconds}s`;
}

function setReadableDate(){
    const el = document.getElementById("live-date");
    if(!el) return;
    const opts = {weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" };
    const txt = targetDate.toLocaleString("es-ES", opts);
    el.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
}

function updateCountdown(){
    const el = document.getElementById("countdown");
    const cta = document.getElementById("live-cta");
    if(!el) return;

    const now = Date.now();
    const distance = targetMS - now;

    if (distance < 0) {
        el.textContent = "¡Estamos en Directo!";
        if (cta) cta.hidden = false;
        return;
    }

    if(distance <= 5 * 60 * 1000) {
        el.classList.add("soon");
    } else {
        el.classList.remove("soon");
    }

    el.textContent = formatTime(distance);
}

setReadableDate();
updateCountdown();
setInterval(updateCountdown, 1000);





º















