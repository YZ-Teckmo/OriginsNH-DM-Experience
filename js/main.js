// === HTML Imports ===
const root = document.documentElement
const channel = new BroadcastChannel("display-channel")
const menuHandler = document.getElementById("menuHandler");
const toggleHandler = document.getElementById("toggleHandler");
const membersHandler = document.getElementById("membersHandler")

// === Variaveis Base ===
let activeToken = null
let offsetX = 0
let offsetY = 0
let offsetZ = 1

let allCharacters = []
let activeNames = new Set()

// === Execuções Base ===
/*
tokens.forEach((token) => {
    token.addEventListener('mousedown', (e) => {
        activeToken = token

        offsetZ++
        activeToken.style.zIndex = offsetZ

        offsetX = e.clientX - activeToken.offsetLeft
        offsetY = e.clientY - activeToken.offsetTop
    })
})

document.addEventListener('mousemove', (e) => {
    if (!activeToken) return

    activeToken.style.left = `${e.clientX - offsetX}px`
    activeToken.style.top = `${e.clientY - offsetY}px`
})

document.addEventListener('mouseup', () => {
    activeToken = null;
})
*/

// Saindo do Arquivo Json
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

        activeNames = new Set(
            allCharacters.map(character => character.name)
        )

        let checkbox = member.querySelector(".checked")
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
        channel.postMessage({action: "cutsceneOn"})
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "v") {
        channel.postMessage({action: "cutsceneOff"})
    }
});