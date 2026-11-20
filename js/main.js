// === HTML Imports ===
const root = document.documentElement
const channel = new BroadcastChannel("display-channel")

const menuHandler = document.getElementById("menuHandler")
const enemyMenuHandler = document.getElementById("enemyMenuHandler")
const toggleHandler = document.getElementById("toggleHandler")
const secondToggleHandler = document.getElementById("secondToggleHandler")
const membersHandler = document.getElementById("membersHandler")
const enemiesHandler = document.getElementById("enemiesHandler")
const mapHandler = document.getElementById('mapHandler')
const mapArea = mapHandler.querySelector(".map-item")
const selectsContainer = document.getElementById("selectsContainer")
const cameraToggleHandler = document.getElementById("cameraToggleHandler")
const cameraFrameHandler = document.getElementById("cameraFrameHandler")

// === Variaveis Base ===
//Tokens
let activeToken = null
let offsetX = 0
let offsetY = 0
let offsetZ = 1

// Characters
let allCharacters = []
let activeNames = new Set()
const checkboxes = new Map()

// Enemies
let allEnemies = []

//Maps
let allMaps = []

// Camera
const CAMERA_FRAME_RATIO = 0.35
let cameraEnabled = false
let cameraLeft = 0
let cameraTop = 0
let cameraDrag = null

// === Broadcast Response ===
channel.onmessage = (e) => {
    switch (e.data.action) {
        case "requestState":
            SendActiveItems()
            break
        case "updateCharacters":
            activeNames = new Set(e.data.activeNames)
            for (const [name, checkbox] of checkboxes) {
                checkbox.checked = activeNames.has(name)
            }
            break
        case "requestCameraState":
            SendCameraState()
            break
    }
}

// === Execuções Base ===
mapHandler.addEventListener('mousedown', (e) => {
    const token = e.target.closest('.token')
    if (!token) return

    activeToken = token

    offsetZ++
    activeToken.style.zIndex = offsetZ

    offsetX = e.clientX - activeToken.offsetLeft
    offsetY = e.clientY - activeToken.offsetTop
})

document.addEventListener('mousemove', (e) => {
    if (!activeToken) return

    xPos = `${e.clientX - offsetX}px`
    yPos = `${e.clientY - offsetY}px`

    activeToken.style.left = xPos
    activeToken.style.top = yPos
})

document.addEventListener('mouseup', () => {
    if (activeToken) SendToken(activeToken)
    activeToken = null
})

cameraToggleHandler.addEventListener("change", () => {
    cameraEnabled = cameraToggleHandler.checked;
    cameraFrameHandler.hidden = !cameraEnabled;

    if (cameraEnabled) {
        UpdateCameraFrameSize();
    } else {
        cameraLeft = 0
        cameraTop = 0
    }

    SendCameraTransition()
})


cameraFrameHandler.addEventListener("pointerdown", (e) => {
    if (!cameraEnabled) return
    e.preventDefault()
    e.stopPropagation()

    cameraDrag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: cameraLeft,
        startTop: cameraTop
    }

    cameraFrameHandler.setPointerCapture(e.pointerId)
    cameraFrameHandler.classList.add("dragging")
})

cameraFrameHandler.addEventListener("pointermove", (e) => {
    if (!cameraDrag) return
    if (e.pointerId !== cameraDrag.pointerId) return

    const deltaX = e.clientX - cameraDrag.startX
    const deltaY = e.clientY - cameraDrag.startY

    const newLeft = cameraDrag.startLeft + deltaX
    const newTop = cameraDrag.startTop + deltaY

    cameraLeft = newLeft
    cameraTop = newTop

    cameraFrameHandler.style.left = `${cameraLeft}px`
    cameraFrameHandler.style.top = `${cameraTop}px`

    SendCameraState()
})

cameraFrameHandler.addEventListener("pointerup", StopCameraDrag)
cameraFrameHandler.addEventListener("pointercancel", StopCameraDrag)


window.addEventListener("resize", () => {
    if (!cameraEnabled) return

    UpdateCameraFrameSize()
    SendCameraState()
})

// === JSON ===
fetch('../data/data.json')
    .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
    })
    .then((data) => {
        allCharacters = data.characters
        const savedState = localStorage.getItem("activeCharacters")

        if (savedState !== null) {
            activeNames = new Set(JSON.parse(savedState))
        } else {
            activeNames = new Set(allCharacters.map(character => character.name))
        }
        InstantiatePlayersInEditor()
        SendActiveItems()
    })
    .catch((err) => console.error('Erro ao carregar:', err))


fetch('../data/assets.json')
    .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
    })
    .then((data) => {
        Object.entries(data).forEach(([category, list]) => {
            if (!Array.isArray(list)) return

            const selectElement = InstantiateSelect(category)

            CreateImageSelect(
                selectElement,
                list,
                (item) => OnSelected(category, item)
            )
        })
    })
    .catch((err) => console.error('Erro ao carregar:', err))


fetch('../data/enemies.json')
    .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
    })
    .then((data) => {
        allEnemies = data.enemies
        InstantiateEnemiesInEditor()
    })
    .catch((err) => console.error('Erro ao carregar:', err))

// === Funções ===
function InstantiatePlayersInEditor() {
    console.log(allCharacters)
    for (let character of allCharacters) {
        let member = Instantiate()

        let curH = member.querySelector(".curH")
        curH.value = character.health.current
        let maxH = member.querySelector(".maxH")
        maxH.value = character.health.max

        let curV = member.querySelector(".curV")
        curV.value = character.stamina.current
        let maxV = member.querySelector(".maxV")
        maxV.value = character.stamina.max

        let curE = member.querySelector(".curE")
        curE.value = character.energy.current
        let maxE = member.querySelector(".maxE")
        maxE.value = character.energy.max

        let curS = member.querySelector(".curS")
        curS.value = character.sanity

        let name = member.querySelector(".editor-name")
        name.innerHTML = character.name

        let checkbox = member.querySelector(".checked")
        checkbox.checked = activeNames.has(character.name)
        checkboxes.set(character.name, checkbox)

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                activeNames.add(character.name)
            } else {
                activeNames.delete(character.name)
            }

            SendActiveItems()
        })

        let portrait = member.querySelector(".editor-portrait")
        portrait.src = `${character.portrait}`

        portrait.addEventListener("click", (e) => {
            if (e.shiftKey) {
                InstantiateTokens(character)
                channel.postMessage({
                    action: "createToken",
                    aCharacter: character
                })
            }
        })

        portrait.addEventListener("click", (e) => {
            if (e.ctrlKey) {
                RemoveToken(character.tokenInfo.id)
                channel.postMessage({
                    action: "deleteToken",
                    aCharacterId: character.tokenInfo.id
                })
            }
        })

        const statFields = {
            health: [curH, maxH],
            stamina: [curV, maxV],
            energy: [curE, maxE],
            sanity: [curS]
        }

        for (let [stat, inputs] of Object.entries(statFields)) {
            inputs.forEach((input) => {
                input.addEventListener('keydown', (e) => {
                    if (e.key !== "Enter") return
                    if (inputs.some(i => i.value === "")) return

                    const current = Number(inputs[0].value)
                    const max = inputs[1] ? Number(inputs[1].value) : null

                    if (stat === "sanity") {
                        character.sanity = current
                    } else {
                        character[stat].current = current
                        character[stat].max = max
                    }

                    channel.postMessage({
                        action: "updateStat",
                        name: character.name,
                        stat: stat,
                        current: current,
                        max: max
                    })

                    input.blur()
                })
            })
        }
    }
}

function Instantiate() {
    membersHandler.insertAdjacentHTML("beforeend", ` 
        <div class="playerMenu-container">
        <h1 class="editor-name">Mingshe</h1>
        <div class="resto">
            <img class="editor-portrait" src="../assets/preLoaded/portraits/mingshe.png" alt="">
            <input class="checked" type="checkbox" name="" id="">
        </div>
        <div class="inputs">
            <div class="info">
                <h1>Vida</h1><input class="curH" type="number" name="" id=""><input class="maxH" type="number" name="" id="">
            </div>
            <div class="info">
                <h1>Vigor</h1><input class="curV" type="number" name="" id=""><input class="maxV" type="number" name="" id="">
            </div>
            <div class="info">
            <h1>Energia</h1><input class="curE" type="number" name="" id=""><input class="maxE" type="number" name="" id="">
            </div>
            <div class="info">
                <h1>Sanidade</h1><input class="curS" type="number" name="" id="">
            </div>
            <div class="info">
                <h1>Dado</h1><input class="lastDice" type="number" name="" id="">
            </div>
        </div>
    </div>
    `)

    return membersHandler.lastElementChild
}

function SendActiveItems() {

    const names = [...activeNames]

    localStorage.setItem(
        "activeCharacters",
        JSON.stringify(names)
    )

    channel.postMessage({
        action: "updateCharacters",
        activeNames: names
    })
}

function InstantiateTokens(character) {
    const token = document.createElement("div")
    token.className = "token"
    token.dataset.id = `token-${character.tokenInfo.id}`
    token.style.width = `${character.tokenInfo.width}px`
    token.style.height = `${character.tokenInfo.height}px`

    const img = document.createElement("img")
    img.className = "token-img"
    img.src = character.token
    img.alt = ""
    img.draggable = false

    token.appendChild(img)
    mapHandler.appendChild(token)

    return token
}

function RemoveToken(tokenId) {
    const token = mapHandler.querySelector(`.token[data-id="token-${tokenId}"]`)

    if (token) {
        token.remove()
    } else {
        console.warn(`Token ${tokenId} não encontrado no mapa.`)
    }
}

function SendToken(token) {
    const mapRect = mapArea.getBoundingClientRect()
    const tokenRect = token.getBoundingClientRect()

    const x = (tokenRect.left + tokenRect.width / 2 - mapRect.left) / mapRect.width
    const y = (tokenRect.top + tokenRect.height / 2 - mapRect.top) / mapRect.height

    channel.postMessage({
        action: "updateTokenPosition",
        positionX: Math.min(Math.max(x, 0), 1),
        positionY: Math.min(Math.max(y, 0), 1),
        actualToken: token.dataset.id
    })
}

function OnSelected(category, item) {
    console.log(category, item)

    switch (category) {
        case "maps":
            channel.postMessage({
            })
            break
        case "backgrounds":
            document.getElementById("result").textContent = `Fundo: ${item.name}`
            break
        case "cutscenes":
            channel.postMessage({
                action: "cutsceneOn",
                path: item.path,
                type: item.type
            })
            break
        default:
            document.getElementById("result").textContent = `${category}: ${item.name}`
    }
}

function InstantiateSelect(category) {
    selectsContainer.insertAdjacentHTML("beforeend", `
            <div class="img-select">
                <span class="img-select-title"></span>
                <button class="img-select-button" type="button">
                    <img class="selected-img" src="" alt="">
                    <span class="selected-label"></span>
                    <span class="arrow">▾</span>
                </button>
                <div class="img-select-options"></div>
            </div>
        `)

    const selectElement = selectsContainer.lastElementChild

    const title = category.charAt(0).toUpperCase() + category.slice(1)
    selectElement.querySelector(".img-select-title").textContent = title

    selectElement.querySelector(".selected-label").textContent = title

    return selectElement
}

function CreateImageSelect(selectElement, items, onSelect) {
    const button = selectElement.querySelector(".img-select-button")
    const selectedImg = selectElement.querySelector(".selected-img")
    const selectedLabel = selectElement.querySelector(".selected-label")
    const optionsBox = selectElement.querySelector(".img-select-options")

    function Select(item, option) {
        optionsBox.querySelectorAll(".img-option").forEach(o => o.classList.remove("selected"))
        option.classList.add("selected")

        selectedImg.src = item.path
        selectedLabel.textContent = item.name

        selectElement.classList.remove("open")
        onSelect(item)
    }

    items.forEach((item) => {
        const option = document.createElement("button")
        option.type = "button"
        option.className = "img-option"
        option.title = item.name

        const img = document.createElement("img")
        img.src = item.path
        img.alt = item.name

        option.appendChild(img)
        option.addEventListener("click", () => Select(item, option))
        optionsBox.appendChild(option)
    })

    button.addEventListener("click", () => {
        selectElement.classList.toggle("open")
    })

    document.addEventListener("click", (e) => {
        if (!selectElement.contains(e.target)) selectElement.classList.remove("open")
    })
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") selectElement.classList.remove("open")
    })

    const first = optionsBox.querySelector(".img-option")
    if (first) {
        first.classList.add("selected")
        selectedImg.src = items[0].path
        selectedLabel.textContent = items[0].name
    }
}

function PushMenu() {
    menuHandler.classList.toggle("active");

    if (menuHandler.classList.contains("active")) {
        toggleHandler.innerHTML = "❮";
    } else {
        toggleHandler.innerHTML = "❯";
    }

}

function PushEnemyMenu() {
    enemyMenuHandler.classList.toggle("active");

    if (enemyMenuHandler.classList.contains("active")) {
        secondToggleHandler.innerHTML = "❯";
    } else {
        secondToggleHandler.innerHTML = "❮";
    }

}

function InstantiateEnemiesInEditor() {
    for (let enemy of allEnemies) {
        let member = InstantiateEnemy()

        let curH = member.querySelector(".curH")
        curH.value = enemy.health.current
        let maxH = member.querySelector(".maxH")
        maxH.value = enemy.health.max

        let curV = member.querySelector(".curV")
        curV.value = enemy.shield.current
        let maxV = member.querySelector(".maxV")
        maxV.value = enemy.shield.max

        let curS = member.querySelector(".curS")
        curS.value = enemy.sanity

        let name = member.querySelector(".editor-name")
        name.innerHTML = enemy.name

        let portrait = member.querySelector(".editor-portrait")
        portrait.src = `${enemy.token}`

        portrait.addEventListener("click", (e) => {
            if (e.shiftKey) {
                InstantiateTokens(enemy)
                channel.postMessage({
                    action: "createToken",
                    aCharacter: enemy
                })
            }
        })

        portrait.addEventListener("click", (e) => {
            if (e.ctrlKey) {
                RemoveToken(enemy.tokenInfo.id)
                channel.postMessage({
                    action: "deleteToken",
                    aCharacterId: enemy.tokenInfo.id
                })
            }
        })
    }
}

function InstantiateEnemy() {
    enemiesHandler.insertAdjacentHTML("beforeend", ` 
            <div class="playerMenu-container">
                <h1 class="editor-name">???</h1>
                <div class="resto">
                    <img class="editor-portrait" src="../assets/preLoaded/portraits/mingshe.png" alt="">
                </div>
                <div class="inputs">
                    <div class="info">
                        <h1>Vida</h1><input class="curH" type="number" name="" id=""><input class="maxH"
                            type="number" name="" id="">
                    </div>
                    <div class="info">
                        <h1>Escudo</h1><input class="curV" type="number" name="" id=""><input class="maxV"
                            type="number" name="" id="">
                    </div>
                    <div class="info">
                        <h1>Sanidade</h1><input class="curS" type="number" name="" id="">
                    </div>
                    <div class="info">
                        <h1>RD</h1><input class="lastDice" type="number" name="" id="">
                    </div>
                </div>
            </div>
        </div>
    `)

    return enemiesHandler.lastElementChild
}

function GetCameraMapBounds() {
    const boxWidth = mapHandler.clientWidth
    const boxHeight = mapHandler.clientHeight
    if (
        !mapArea ||
        !mapArea.naturalWidth ||
        !mapArea.naturalHeight ||
        !boxWidth ||
        !boxHeight
    ) {
        return {
            left: 0,
            top: 0,
            width: boxWidth,
            height: boxHeight
        }
    }

    const scale = Math.min(boxWidth / mapArea.naturalWidth, boxHeight / mapArea.naturalHeight)
    const width = mapArea.naturalWidth * scale
    const height = mapArea.naturalHeight * scale

    return {
        left: (boxWidth - width) / 2,
        top: (boxHeight - height) / 2,
        width,
        height
    }
}

function UpdateCameraFrameSize() {
    const oldBounds = GetCameraMapBounds()

    const oldFrameWidth = cameraFrameHandler.offsetWidth || parseFloat(cameraFrameHandler.style.width) || 0
    const oldFrameHeight = cameraFrameHandler.offsetHeight || parseFloat(cameraFrameHandler.style.height) || 0

    const xRatio = oldFrameWidth > 0 && oldBounds.width > 0
        ? (cameraLeft + oldFrameWidth / 2 - oldBounds.left) / oldBounds.width
        : 0.5

    const yRatio = oldFrameHeight > 0 && oldBounds.height > 0
        ? (cameraTop + oldFrameHeight / 2 - oldBounds.top) / oldBounds.height
        : 0.5

    const newBounds = GetCameraMapBounds()

    const frameWidth = newBounds.width * CAMERA_FRAME_RATIO
    const frameHeight = newBounds.height * CAMERA_FRAME_RATIO

    cameraFrameHandler.style.width = `${frameWidth}px`
    cameraFrameHandler.style.height = `${frameHeight}px`

    cameraLeft = newBounds.left + xRatio * newBounds.width - frameWidth / 2
    cameraTop = newBounds.top + yRatio * newBounds.height - frameHeight / 2

    cameraFrameHandler.style.left = `${cameraLeft}px`
    cameraFrameHandler.style.top = `${cameraTop}px`

    SendCameraState()
}

function SendCameraState() {
    const bounds = GetCameraMapBounds()

    const frameWidth =
        cameraFrameHandler.offsetWidth ||
        parseFloat(cameraFrameHandler.style.width) ||
        bounds.width * CAMERA_FRAME_RATIO;

    const frameHeight =
        cameraFrameHandler.offsetHeight ||
        parseFloat(cameraFrameHandler.style.height) ||
        bounds.height * CAMERA_FRAME_RATIO

    const x = bounds.width > 0
        ? (cameraLeft + frameWidth / 2 - bounds.left) / bounds.width
        : 0.5

    const y = bounds.height > 0
        ? (cameraTop + frameHeight / 2 - bounds.top) / bounds.height
        : 0.5

    const zoom = cameraEnabled && frameWidth > 0
        ? bounds.width / frameWidth
        : 1

    channel.postMessage({
        action: "cameraState",
        enabled: cameraEnabled,
        x,
        y,
        zoom
    })
}

function StopCameraDrag() {
    cameraDrag = null
    cameraFrameHandler.classList.remove("dragging")
    SendCameraState()
}

function SendCameraTransition() {
    const bounds = GetCameraMapBounds();

    const frameWidth = cameraFrameHandler.offsetWidth;
    const frameHeight = cameraFrameHandler.offsetHeight;

    const x = bounds.width > 0
        ? (cameraLeft + frameWidth / 2 - bounds.left) / bounds.width
        : 0.5

    const y = bounds.height > 0
        ? (cameraTop + frameHeight / 2 - bounds.top) / bounds.height
        : 0.5

    const zoom = cameraEnabled && frameWidth > 0
        ? bounds.width / frameWidth
        : 1

    channel.postMessage({
        action: "cameraTransition",
        enabled: cameraEnabled,
        x,
        y,
        zoom
    })
}

// === Debug ===
document.addEventListener("keydown", function (event) {
    if (event.key === "c") {
        channel.postMessage({ action: "cutsceneOn" })
    }
})

document.addEventListener("keydown", function (event) {
    if (event.key === "v") {
        channel.postMessage({ action: "cutsceneOff" })
    }
})

// :P
cameraEnabled = false;
cameraToggleHandler.checked = false;
cameraFrameHandler.hidden = true;
cameraLeft = 0;
cameraTop = 0;
SendCameraState();

if (mapArea.complete) {
    UpdateCameraFrameSize();
} else {
    mapArea.addEventListener("load", UpdateCameraFrameSize, { once: true });
}