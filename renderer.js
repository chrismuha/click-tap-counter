// Section: DOM element references
const tapArea = document.getElementById("tapArea");
const controls = document.querySelector(".controls");
const resetBtn = document.getElementById("resetBtn");
const resetRecordBtn = document.getElementById("resetRecordBtn");
const deductToggle = document.getElementById("deductToggle");
const lockBtn = document.getElementById("lockBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const clickCountEl = document.getElementById("clickCount");
const timeElapsedEl = document.getElementById("timeElapsed");
const cpmEl = document.getElementById("cpm");
const highRecordEl = document.getElementById("highRecord");
const hintText = document.getElementById("hintText");

// Section: State variables
let clickCount = 0;
let startTime = null;
let timerId = null;
let lockedAtSixty = false;
let finished = false;
let isLight = false;
let isDeductMode = false;
let clickTimes = [];
let ignoreNextTapClick = false;

// Section: Configuration constants
const freeModeMinWindowSec = 5;
const lockedModeWindowMs = 5000;
const lockedModeTotalDurationSec = 60;
const highRecordStorageKey = "clickTapCounterHighRecord";
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
let highRecord = loadHighRecord();

function getFocusableElements() {
    return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
    });
}

function handleTabAndEscapeFocus(event) {
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
        const active = document.activeElement;
        if (active && active !== document.body && active !== document.documentElement && typeof active.blur === "function") {
            active.blur();
        }
        return;
    }

    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;

    const focusable = getFocusableElements();
    const currentIndex = focusable.indexOf(document.activeElement);
    if (currentIndex === -1 || focusable.length < 2) return;

    const target = event.shiftKey && currentIndex === 0
        ? focusable[focusable.length - 1]
        : !event.shiftKey && currentIndex === focusable.length - 1
            ? focusable[0]
            : null;

    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
}

document.addEventListener("keydown", handleTabAndEscapeFocus);

// Section: High record helpers
function loadHighRecord() {
    try {
        const storedValue = Number(localStorage.getItem(highRecordStorageKey));
        return Number.isFinite(storedValue) && storedValue > 0 ? Math.round(storedValue) : 0;
    } catch {
        return 0;
    }
}

function saveHighRecord() {
    try {
        localStorage.setItem(highRecordStorageKey, String(highRecord));
    } catch {
        // Storage can be unavailable in restricted browser contexts.
    }
}

function updateHighRecord(currentCpm) {
    const roundedCpm = Math.round(currentCpm);
    if (roundedCpm <= highRecord) {
        return;
    }

    highRecord = roundedCpm;
    highRecordEl.textContent = String(highRecord);
    saveHighRecord();
}

highRecordEl.textContent = String(highRecord);

// Section: Count direction helpers
function updateDeductModeUi() {
    tapArea.textContent = isDeductMode ? "DEDUCT TAP" : "CLICK/TAP HERE";
    deductToggle.checked = isDeductMode;
}

function getTapDelta() {
    return isDeductMode ? -1 : 1;
}

function applyTapDelta(delta) {
    if (delta < 0 && clickCount === 0) {
        hintText.textContent = "Count is already at zero.";
        return false;
    }

    clickCount = Math.max(0, clickCount + delta);
    clickCountEl.textContent = String(clickCount);
    return true;
}

// Section: Free mode logic
function updateFreeStats(eventTimeMs) {
    if (!startTime) {
        return;
    }

    const elapsedMs = eventTimeMs - startTime;
    const rawSec = elapsedMs / 1000;
    const effectiveSec = Math.max(rawSec, freeModeMinWindowSec);
    const elapsedMin = effectiveSec / 60;
    const cpm = elapsedMin > 0 ? clickCount / elapsedMin : 0;

    timeElapsedEl.textContent = rawSec.toFixed(1);
    cpmEl.textContent = String(Math.round(cpm));
    updateHighRecord(cpm);
}

function tickFreeMode() {
    if (lockedAtSixty || startTime === null) {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        return;
    }

    updateFreeStats(Date.now());
}

function startFreeRunIfNeeded() {
    if (startTime !== null) {
        return;
    }
    startTime = Date.now();
    finished = false;
    hintText.textContent = "Counting. CPM is based on current elapsed time.";

    if (!timerId) {
        timerId = setInterval(tickFreeMode, 100);
    }
}

// Section: Sixty second mode logic with decaying CPM
function startLockedRunIfNeeded() {
    if (startTime !== null) {
        return;
    }
    startTime = Date.now();
    finished = false;
    clickTimes = [];
    hintText.textContent = "Sixty second mode. CPM uses the last few seconds of clicks/taps.";

    if (!timerId) {
        timerId = setInterval(tickLockedMode, 100);
    }
}

function tickLockedMode() {
    if (!lockedAtSixty || startTime === null) {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        return;
    }

    const now = Date.now();
    let elapsedMs = now - startTime;
    let elapsedSec = elapsedMs / 1000;

    if (elapsedSec >= lockedModeTotalDurationSec) {
        elapsedSec = lockedModeTotalDurationSec;
        finished = true;
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        hintText.textContent = "Sixty seconds reached. CPM is based on recent clicks/taps.";
    }

    while (clickTimes.length > 0 && now - clickTimes[0].time > lockedModeWindowMs) {
        clickTimes.shift();
    }

    const windowClickCount = clickTimes.reduce((total, event) => total + event.delta, 0);
    const windowSec = lockedModeWindowMs / 1000;
    const cpm = Math.max(0, windowClickCount * (60 / windowSec));

    timeElapsedEl.textContent = elapsedSec.toFixed(1);
    cpmEl.textContent = String(Math.round(cpm));
    updateHighRecord(cpm);
}

// Section: Shared reset helpers
function resetAll() {
    clickCount = 0;
    startTime = null;
    finished = false;
    clickTimes = [];

    clickCountEl.textContent = "0";
    timeElapsedEl.textContent = "0.0";
    cpmEl.textContent = "0";
    hintText.textContent = "First click/tap starts the timer. CPM updates live.";

    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

// Section: Click handling
document.addEventListener("pointerdown", (event) => {
    ignoreNextTapClick = controls.contains(event.target);
}, true);

controls.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
});

controls.addEventListener("click", (event) => {
    event.stopPropagation();
});

tapArea.addEventListener("click", (event) => {
    if (ignoreNextTapClick || event.target !== tapArea) {
        ignoreNextTapClick = false;
        return;
    }

    ignoreNextTapClick = false;

    if (lockedAtSixty) {
        if (finished) {
            return;
        }

        const now = Date.now();
        const delta = getTapDelta();
        if (delta < 0 && clickCount === 0) {
            hintText.textContent = "Count is already at zero.";
            return;
        }

        startLockedRunIfNeeded();

        applyTapDelta(delta);

        clickTimes.push({ time: now, delta });
        tickLockedMode();
        return;
    }

    if (finished) {
        resetAll();
    }

    const now = Date.now();
    const delta = getTapDelta();
    if (delta < 0 && clickCount === 0) {
        hintText.textContent = "Count is already at zero.";
        return;
    }

    startFreeRunIfNeeded();

    applyTapDelta(delta);
    updateFreeStats(now);
});

// Section: Reset handling
resetBtn.addEventListener("click", () => {
    resetAll();
});

// Section: High record reset handling
resetRecordBtn.addEventListener("click", () => {
    highRecord = 0;
    highRecordEl.textContent = "0";
    saveHighRecord();
});

// Section: Count direction toggle
deductToggle.addEventListener("change", () => {
    isDeductMode = deductToggle.checked;
    updateDeductModeUi();
    hintText.textContent = isDeductMode
        ? "Deduct mode. Each tap subtracts one from the current count."
        : "Add mode. Each tap adds one to the current count.";
});

// Section: Lock at sixty seconds toggle
lockBtn.addEventListener("click", () => {
    const wasLocked = lockedAtSixty;
    lockedAtSixty = !lockedAtSixty;

    lockBtn.textContent = lockedAtSixty ? "Free mode" : "Lock at 60s";

    if (wasLocked !== lockedAtSixty) {
        resetAll();
        hintText.textContent = lockedAtSixty
            ? "Sixty second mode. Click/Tap to begin. CPM will fall toward zero if you stop clicking."
            : "Free mode. Click/Tap to begin. CPM updates on each click.";
    }
});

// Section: Theme toggle
themeToggleBtn.addEventListener("click", () => {
    isLight = !isLight;
    document.body.classList.toggle("light-theme", isLight);
    themeToggleBtn.textContent = isLight ? "Dark mode" : "Light mode";
});

updateDeductModeUi();
