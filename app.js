/* =========================================================
   CALCX PRO 9.0
   COMPLETE CALCULATOR ENGINE
   ========================================================= */

"use strict";

/* =========================================================
   ELEMENTS
   ========================================================= */

const expressionDisplay =
    document.getElementById("expressionDisplay");

const resultDisplay =
    document.getElementById("resultDisplay");

const displayMessage =
    document.getElementById("displayMessage");

const answerLabel =
    document.getElementById("answerLabel");

const displayMode =
    document.getElementById("displayMode");

const memoryIndicator =
    document.getElementById("memoryIndicator");

const themeBtn =
    document.getElementById("themeBtn");

const themeIcon =
    document.getElementById("themeIcon");

const degBtn =
    document.getElementById("degBtn");

const radBtn =
    document.getElementById("radBtn");

const clearHistoryBtn =
    document.getElementById("clearHistoryBtn");

const clearEntryBtn =
    document.getElementById("clearEntryBtn");

const historyList =
    document.getElementById("historyList");

const historyCount =
    document.getElementById("historyCount");

const toast =
    document.getElementById("toast");

const toastText =
    document.getElementById("toastText");


/* =========================================================
   STATE
   ========================================================= */

let expression = "";

let result = 0;

let answer = 0;

let memory = 0;

let angleMode =
    localStorage.getItem("calcx-angle") || "DEG";

let history = [];

let toastTimer = null;


/* =========================================================
   LOAD HISTORY
   ========================================================= */

try {
    history =
        JSON.parse(
            localStorage.getItem("calcx-history") || "[]"
        );

    if (!Array.isArray(history)) {
        history = [];
    }
} catch {
    history = [];
}


/* =========================================================
   THEME
   ========================================================= */

function getSavedTheme() {

    const saved =
        localStorage.getItem("calcx-theme");

    if (saved === "light" || saved === "dark") {
        return saved;
    }

    return "dark";
}


function applyTheme(theme) {

    const html =
        document.documentElement;

    if (theme === "light") {

        html.classList.add("light");

        if (themeIcon) {
            themeIcon.textContent = "☀";
        }

        if (themeBtn) {
            themeBtn.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );

            themeBtn.setAttribute(
                "title",
                "Switch to dark mode"
            );
        }

    } else {

        html.classList.remove("light");

        if (themeIcon) {
            themeIcon.textContent = "☾";
        }

        if (themeBtn) {
            themeBtn.setAttribute(
                "aria-label",
                "Switch to light mode"
            );

            themeBtn.setAttribute(
                "title",
                "Switch to light mode"
            );
        }
    }

    localStorage.setItem(
        "calcx-theme",
        theme
    );
}


function toggleTheme() {

    const isLight =
        document.documentElement.classList.contains("light");

    const nextTheme =
        isLight ? "dark" : "light";

    applyTheme(nextTheme);

    showToast(
        nextTheme === "light"
            ? "Light mode enabled"
            : "Dark mode enabled"
    );
}


if (themeBtn) {
    themeBtn.addEventListener(
        "click",
        toggleTheme
    );
}


applyTheme(getSavedTheme());


/* =========================================================
   ANGLE MODE
   ========================================================= */

function updateAngleMode() {

    if (displayMode) {
        displayMode.textContent =
            angleMode;
    }

    if (degBtn) {
        degBtn.classList.toggle(
            "active",
            angleMode === "DEG"
        );
    }

    if (radBtn) {
        radBtn.classList.toggle(
            "active",
            angleMode === "RAD"
        );
    }

    localStorage.setItem(
        "calcx-angle",
        angleMode
    );
}


degBtn?.addEventListener(
    "click",
    () => {
        angleMode = "DEG";
        updateAngleMode();
        showToast("Degree mode");
    }
);


radBtn?.addEventListener(
    "click",
    () => {
        angleMode = "RAD";
        updateAngleMode();
        showToast("Radian mode");
    }
);


updateAngleMode();


/* =========================================================
   DISPLAY
   ========================================================= */

function updateDisplay() {

    expressionDisplay.textContent =
        expression || "0";

    resultDisplay.textContent =
        formatNumber(result);

    answerLabel.textContent =
        `ANS ${formatNumber(answer)}`;

    if (!expression) {
        displayMessage.textContent =
            "Ready";
    }
}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(value) {

    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        return "Error";
    }

    if (
        Math.abs(value) >= 1e12 ||
        (
            Math.abs(value) > 0 &&
            Math.abs(value) < 1e-8
        )
    ) {
        return value.toExponential(8);
    }

    return Number(
        value.toFixed(12)
    ).toString();
}


/* =========================================================
   SAFE CALCULATOR ENGINE
   ========================================================= */

function calculateExpression(input) {

    if (!input) {
        return 0;
    }

    let expr =
        input
            .replaceAll("×", "*")
            .replaceAll("÷", "/")
            .replaceAll("−", "-")
            .replaceAll("π", "Math.PI")
            .replaceAll("√", "sqrt");

    expr =
        expr.replace(
            /(\d+(?:\.\d+)?)%/g,
            "($1/100)"
        );

    expr =
        expr.replace(
            /(\d+(?:\.\d+)?)²/g,
            "($1**2)"
        );

    expr =
        expr.replace(
            /(\d+(?:\.\d+)?)!/g,
            "factorial($1)"
        );

    expr =
        expr.replace(
            /\^/g,
            "**"
        );

    expr =
        expr.replace(
            /sqrt\(/g,
            "Math.sqrt("
        );

    expr =
        expr.replace(
            /ln\(/g,
            "Math.log("
        );

    expr =
        expr.replace(
            /log\(/g,
            "Math.log10("
        );

    expr =
        expr.replace(
            /sin\(/g,
            "sin("
        );

    expr =
        expr.replace(
            /cos\(/g,
            "cos("
        );

    expr =
        expr.replace(
            /tan\(/g,
            "tan("
        );

    /*
     * Allow only calculator characters.
     */

    if (
        !/^[0-9+\-*/().,\s%*a-zA-Z_]+$/.test(expr)
    ) {
        throw new Error("Invalid expression");
    }

    const scope = {

        Math,

        factorial,

        sin: angle =>
            Math.sin(
                toRadiansIfNeeded(angle)
            ),

        cos: angle =>
            Math.cos(
                toRadiansIfNeeded(angle)
            ),

        tan: angle =>
            Math.tan(
                toRadiansIfNeeded(angle)
            )
    };

    const names =
        Object.keys(scope);

    const values =
        Object.values(scope);

    const fn =
        new Function(
            ...names,
            `"use strict"; return (${expr});`
        );

    const value =
        fn(...values);

    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        throw new Error("Math error");
    }

    return value;
}


/* =========================================================
   ANGLE
   ========================================================= */

function toRadiansIfNeeded(value) {

    if (angleMode === "RAD") {
        return value;
    }

    return value * Math.PI / 180;
}


/* =========================================================
   FACTORIAL
   ========================================================= */

function factorial(n) {

    if (
        !Number.isInteger(n) ||
        n < 0 ||
        n > 170
    ) {
        throw new Error(
            "Invalid factorial"
        );
    }

    let total = 1;

    for (
        let i = 2;
        i <= n;
        i++
    ) {
        total *= i;
    }

    return total;
}


/* =========================================================
   INPUT
   ========================================================= */

function appendValue(value) {

    if (!value) return;

    expression += value;

    displayMessage.textContent =
        "Editing";

    updateDisplay();
}


function clearAll() {

    expression = "";

    result = 0;

    displayMessage.textContent =
        "Ready";

    updateDisplay();

    showToast("Cleared");
}


function clearEntry() {

    expression = "";

    displayMessage.textContent =
        "Entry cleared";

    updateDisplay();
}


function backspace() {

    if (!expression) {
        return;
    }

    expression =
        expression.slice(
            0,
            -1
        );

    displayMessage.textContent =
        "Editing";

    updateDisplay();
}


function toggleSign() {

    if (!expression) {

        expression = "-";

        updateDisplay();

        return;
    }

    expression =
        `-(${expression})`;

    updateDisplay();
}


/* =========================================================
   CALCULATE
   ========================================================= */

function calculate() {

    if (!expression) {
        return;
    }

    try {

        const oldExpression =
            expression;

        const value =
            calculateExpression(
                expression
            );

        result = value;

        answer = value;

        expression =
            String(value);

        displayMessage.textContent =
            "Calculated";

        addHistory(
            oldExpression,
            value
        );

        updateDisplay();

        showToast(
            "Calculation complete"
        );

    } catch (error) {

        result = 0;

        displayMessage.textContent =
            "Invalid expression";

        resultDisplay.textContent =
            "Error";

        showToast(
            "Unable to calculate"
        );
    }
}


/* =========================================================
   MEMORY
   ========================================================= */

function updateMemoryIndicator() {

    if (!memoryIndicator) {
        return;
    }

    memoryIndicator.classList.toggle(
        "visible",
        memory !== 0
    );
}


function getCurrentValue() {

    if (expression) {

        try {
            return calculateExpression(
                expression
            );
        } catch {
            return result || 0;
        }
    }

    return result || 0;
}


function memoryClear() {

    memory = 0;

    updateMemoryIndicator();

    showToast("Memory cleared");
}


function memoryRecall() {

    expression =
        String(memory);

    result =
        memory;

    updateDisplay();

    showToast("Memory recalled");
}


function memoryAdd() {

    memory +=
        getCurrentValue();

    updateMemoryIndicator();

    showToast("Added to memory");
}


function memorySubtract() {

    memory -=
        getCurrentValue();

    updateMemoryIndicator();

    showToast("Subtracted from memory");
}


function memoryStore() {

    memory =
        getCurrentValue();

    updateMemoryIndicator();

    showToast("Value stored");
}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("button");

        if (!button) {
            return;
        }

        const value =
            button.dataset.value;

        const action =
            button.dataset.action;

        if (value !== undefined) {

            appendValue(value);

            return;
        }

        if (!action) {
            return;
        }

        switch (action) {

            case "clear":
                clearAll();
                break;

            case "backspace":
                backspace();
                break;

            case "calculate":
                calculate();
                break;

            case "toggle-sign":
                toggleSign();
                break;

            case "memory-clear":
                memoryClear();
                break;

            case "memory-recall":
                memoryRecall();
                break;

            case "memory-add":
                memoryAdd();
                break;

            case "memory-subtract":
                memorySubtract();
                break;

            case "memory-store":
                memoryStore();
                break;
        }
    }
);


/* =========================================================
   HISTORY
   ========================================================= */

function addHistory(
    expressionValue,
    resultValue
) {

    history.unshift({

        expression:
            expressionValue,

        result:
            resultValue,

        mode:
            angleMode,

        time:
            new Date().toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )
    });

    history =
        history.slice(0, 100);

    localStorage.setItem(
        "calcx-history",
        JSON.stringify(history)
    );

    renderHistory();
}


function renderHistory() {

    if (!historyList) {
        return;
    }

    historyCount.textContent =
        history.length;

    if (!history.length) {

        historyList.innerHTML = `
            <div class="empty-history">

                <div class="empty-history-icon">
                    ∑
                </div>

                <strong>
                    No calculations yet
                </strong>

                <span>
                    Your recent calculations will appear here.
                </span>

            </div>
        `;

        return;
    }

    historyList.innerHTML =
        history.map(
            item => `
                <div
                    class="history-item"
                    data-expression="${escapeHTML(item.expression)}"
                >

                    <div class="history-expression">
                        ${escapeHTML(item.expression)}
                    </div>

                    <div class="history-result">
                        = ${formatNumber(item.result)}
                    </div>

                    <div class="history-meta">

                        <span class="history-mode">
                            ${item.mode}
                        </span>

                        <span>
                            ${item.time}
                        </span>

                    </div>

                </div>
            `
        ).join("");
}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


clearHistoryBtn?.addEventListener(
    "click",
    () => {

        if (!history.length) {
            showToast(
                "History already empty"
            );

            return;
        }

        history = [];

        localStorage.removeItem(
            "calcx-history"
        );

        renderHistory();

        showToast(
            "History cleared"
        );
    }
);


/* =========================================================
   HISTORY ITEM CLICK
   ========================================================= */

historyList?.addEventListener(
    "click",
    event => {

        const item =
            event.target.closest(
                ".history-item"
            );

        if (!item) {
            return;
        }

        const oldExpression =
            item.dataset.expression;

        if (!oldExpression) {
            return;
        }

        expression =
            oldExpression;

        displayMessage.textContent =
            "Loaded from history";

        updateDisplay();

        showToast(
            "Calculation loaded"
        );
    }
);


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        const key =
            event.key;

        if (
            /^[0-9]$/.test(key) ||
            ["+", "-", "*", "/", ".", "(", ")"].includes(key)
        ) {

            event.preventDefault();

            appendValue(key);

            return;
        }

        if (key === "Enter" || key === "=") {

            event.preventDefault();

            calculate();

            return;
        }

        if (key === "Backspace") {

            event.preventDefault();

            backspace();

            return;
        }

        if (key === "Escape") {

            event.preventDefault();

            clearAll();

            return;
        }

        if (key === "%") {

            event.preventDefault();

            appendValue("%");

            return;
        }
    }
);


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

    if (!toast || !toastText) {
        return;
    }

    toastText.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(
            () => {
                toast.classList.remove(
                    "show"
                );
            },
            1800
        );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

renderHistory();

updateMemoryIndicator();

updateDisplay();

console.log(
    "CalcX Pro 9.0 initialized"
);