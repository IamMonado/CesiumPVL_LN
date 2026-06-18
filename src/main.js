import {
    Cartesian3,
    Cartographic,
    Math as CesiumMath,
    Terrain,
    Viewer,
    Ion,
    Cesium3DTileset,
    CustomShader,
    LightingModel,
} from "cesium";

import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

// Später eigenen Token verwenden, nicht öffentlich auf GitHub posten
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYzRjN2MyZC02NGIwLTQ0N2UtOTcxNi04OTkyMTUyOWMyZWMiLCJpZCI6NDQzMjM4LCJzdWIiOiJYZW4wIiwiaXNzIjoiaHR0cHM6Ly9hcGkuY2VzaXVtLmNvbSIsImF1ZCI6InRlc3QiLCJpYXQiOjE3ODE3NzQ0Mjd9.xeKWOrdA98eq9U8GxNGT6E2Zb2Ox-15oqXNNssETeQY";

// Viewer starten
const viewer = new Viewer("cesiumContainer", {
    terrain: Terrain.fromWorldTerrain(),
    shouldAnimate: true
});

// Zusätzliche optische Effekte im Viewer aktivieren
viewer.scene.globe.enableLighting = true;
viewer.shadows = true;
viewer.terrainShadows = true;

// Cesium-Ion Asset ID hier eintragen
const assetId = 4957242;

async function applyRoofShader(tileset) {
    const fragmentShaderText = await fetch("redRoof.frag").then((r) => {
        if (!r.ok) {
            throw new Error("Shader konnte nicht geladen werden: " + r.status);
        }
        return r.text();
    });

    tileset.customShader = new CustomShader({
        lightingModel: LightingModel.PBR,
        fragmentShaderText,
    });
}

// Eigenen 3D-Tiles-Datensatz laden
const tileset = await Cesium3DTileset.fromIonAssetId(assetId);
viewer.scene.primitives.add(tileset);

// Shader anwenden
await applyRoofShader(tileset);

// Kamera automatisch zum Datensatz fliegen lassen
await viewer.flyTo(tileset);

// Dem Button "flyHome" eine Funktion zuweisen
// Falls Anwender den Datensatz aus den Augen verloren hat, kann er mittels des Buttons zurückfinden
document.getElementById("flyHome").addEventListener("click", () => {
    viewer.flyTo(tileset);
});

// ===========================================================================
// First-Person-Modus
// ---------------------------------------------------------------------------
// Eine echte First-Person-Ansicht: Augenhöhe über dem Boden, Umsehen mit der
// Maus (Pointer Lock) und Bewegung mit WASD / Leertaste / Shift.
// ===========================================================================

const camera = viewer.camera;
const canvas = viewer.canvas;

let isFirstPerson = false;

// Augenhöhe einer Person über dem Boden (in Metern)
const EYE_HEIGHT = 2.0;
// Bewegungsgeschwindigkeit pro Bild (Meter pro Frame)
const BASE_MOVE_RATE = 0.4;     // normale Startgeschwindigkeit
const MAX_MOVE_RATE = 5.0;      // maximale Geschwindigkeit

const ACCELERATION = 0.06;      // Beschleunigung pro Frame

let currentMoveRate = BASE_MOVE_RATE; //Setzt BASE_MOVE_RATE als Standard fest

// Empfindlichkeit der Maus beim Umsehen
const LOOK_SENSITIVITY = 0.0018;

// Welche Bewegungstasten gerade gedrückt sind
const move = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
};

// Tastencode -> Bewegungsrichtung
function flagForKey(code) {
    switch (code) {
        case "KeyW": case "ArrowUp": return "forward";
        case "KeyS": case "ArrowDown": return "backward";
        case "KeyA": case "ArrowLeft": return "left";
        case "KeyD": case "ArrowRight": return "right";
        case "Space": return "up";
        case "ShiftLeft": case "ShiftRight": return "down";
        default: return undefined;
    }
}

function onKeyDown(event) {
    const flag = flagForKey(event.code);
    if (flag) {
        move[flag] = true;
        event.preventDefault();
    }
}

function onKeyUp(event) {
    const flag = flagForKey(event.code);
    if (flag) {
        move[flag] = false;
    }
}

// Umsehen: nur auswerten, wenn der Mauszeiger eingefangen (Pointer Lock) ist
function onMouseMove(event) {
    if (!isFirstPerson || document.pointerLockElement !== canvas) {
        return;
    }
    const heading = camera.heading + event.movementX * LOOK_SENSITIVITY;
    let pitch = camera.pitch - event.movementY * LOOK_SENSITIVITY;
    // Blick nicht komplett nach oben/unten kippen lassen (kein Überschlag)
    const limit = CesiumMath.PI_OVER_TWO - 0.02;
    pitch = CesiumMath.clamp(pitch, -limit, limit);
    // Position beibehalten, nur die Blickrichtung ändern
    camera.setView({ orientation: { heading, pitch, roll: 0.0 } });
}

// Bewegung in jedem Frame anwenden
function onTick() {
    if (!isFirstPerson) {
        return;
    }

    if (move.forward) {
        // Solange W gehalten wird, Geschwindigkeit bis zum Maximum hochfahren
        currentMoveRate = Math.min(
            currentMoveRate + ACCELERATION,
            MAX_MOVE_RATE
        );
        camera.moveForward(currentMoveRate);
    } else {
        // W losgelassen -> wieder bei Grundgeschwindigkeit beginnen
        currentMoveRate = BASE_MOVE_RATE;
    }

    if (move.backward) camera.moveBackward(BASE_MOVE_RATE);
    if (move.left) camera.moveLeft(BASE_MOVE_RATE);
    if (move.right) camera.moveRight(BASE_MOVE_RATE);
    if (move.up) camera.moveUp(BASE_MOVE_RATE);
    if (move.down) camera.moveDown(BASE_MOVE_RATE);
}

viewer.clock.onTick.addEventListener(onTick);

// Pointer Lock anfordern (nur als Reaktion auf einen Klick erlaubt)
function lockPointer() {
    if (isFirstPerson && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    }
}

function enterFirstPerson() {
    // Aktuelle Position der Kamera bestimmen – egal wo man gerade ist
    const carto = Cartographic.fromCartesian(camera.positionWC);

    // Höhe der Oberfläche (3D-Tiles + Gelände) an dieser Stelle ermitteln
    let groundHeight;
    if (viewer.scene.sampleHeightSupported) {
        groundHeight = viewer.scene.sampleHeight(carto);
    }
    if (groundHeight === undefined) {
        groundHeight = viewer.scene.globe.getHeight(carto);
    }
    if (groundHeight === undefined) {
        groundHeight = carto.height;
    }

    const destination = Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        groundHeight + EYE_HEIGHT
    );

    // Standard-Kamerasteuerung deaktivieren, damit sie nicht stört
    viewer.scene.screenSpaceCameraController.enableInputs = false;

    camera.flyTo({
        destination,
        orientation: {
            heading: camera.heading,
            pitch: 0.0, // horizontaler Blick wie eine stehende Person
            roll: 0.0,
        },
        duration: 1.5,
    });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", lockPointer);

    lockPointer();

    isFirstPerson = true;
    document.getElementById("firstPerson").textContent = "Ansicht verlassen";
    hint.style.display = "block";
}

function exitFirstPerson() {
    // Alle gedrückten Tasten zurücksetzen
    for (const key of Object.keys(move)) {
        move[key] = false;
    }

    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("click", lockPointer);
    if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
    }

    // Steuerung wieder aktivieren
    viewer.scene.screenSpaceCameraController.enableInputs = true;

    isFirstPerson = false;
    document.getElementById("firstPerson").textContent = "First Person";
    hint.style.display = "none";

    // An genau der aktuellen Koordinate herausfliegen (nicht zum Datensatz zurück)
    const carto = Cartographic.fromCartesian(camera.positionWC);
    const destination = Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        carto.height + 150 // ein Stück nach oben für den Überblick
    );
    camera.flyTo({
        destination,
        orientation: {
            heading: camera.heading,
            pitch: CesiumMath.toRadians(-45), // von oben auf die Szene blicken
            roll: 0.0,
        },
        duration: 1.5,
    });
}

// Falls der Anwender Pointer Lock mit Esc verlässt, bleibt der Modus aktiv;
// ein Klick auf die Szene fängt die Maus erneut ein.

document.getElementById("firstPerson").addEventListener("click", () => {
    if (isFirstPerson) {
        exitFirstPerson();
    } else {
        enterFirstPerson();
    }
});

// Kleiner Hinweis zur Steuerung, der nur im First-Person-Modus erscheint
const hint = document.createElement("div");
hint.id = "fpHint";
hint.style.display = "none";
hint.innerHTML =
    "<b>First Person</b><br>" +
    "Maus: Umsehen (zum Einfangen in die Szene klicken)<br>" +
    "W/A/S/D: Bewegen &nbsp; Leertaste: Hoch &nbsp; Shift: Runter<br>" +
    "Mit Escape verlässt du den Lock";
document.body.appendChild(hint);