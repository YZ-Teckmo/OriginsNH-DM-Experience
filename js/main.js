// === HTML Imports ===
const root = document.documentElement
const channel = new BroadcastChannel("display-channel")
const menuHandler = document.getElementById("menuHandler");
const toggleHandler = document.getElementById("toggleHandler");
const membersHandler = document.getElementById("membersHandler")
const mapHandler = document.getElementById('mapHandler')
const mapArea = mapHandler.querySelector(".map-item")

// === Variaveis Base ===
let activeToken = null
let tokenCount = 0
let offsetX = 0
let offsetY = 0
let offsetZ = 1

let allCharacters = []
let activeNames = new Set()
const checkboxes = new Map()

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
                InstantiateTokens(`${character.token}`)
                channel.postMessage({
                    action: "createToken",
                    aCharacter: character.token
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
    token.dataset.id = `token-${++tokenCount}`

    const img = document.createElement("img")
    img.className = "token-img"
    img.src = character
    img.alt = ""
    img.draggable = false

    token.appendChild(img)
    mapHandler.appendChild(token)

    return token
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

function PushMenu() {
    menuHandler.classList.toggle("active");

    if (menuHandler.classList.contains("active")) {
        toggleHandler.innerHTML = "❮";
    } else {
        toggleHandler.innerHTML = "❯";
    }

}

// === Debug ===
document.addEventListener("keydown", function (event) {
    if (event.key === "c") {
        channel.postMessage({ action: "cutsceneOn" })
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "v") {
        channel.postMessage({ action: "cutsceneOff" })
    }
});