// === HTML Imports ===
const root = document.documentElement
const channel = new BroadcastChannel("display-channel")

const blackScreenHandler = document.getElementById("blackScreenHandler")
const cinematicBarsHandler = document.getElementById("cinematicBarsHandler")
const videoGroundHandler = document.getElementById("videoGroundHandler")
const membersHandler = document.getElementById('membersHandler')
const mapHandler = document.getElementById('mapHandler')
const mapArea = mapHandler.querySelector(".map-item")

// === Variaveis Base ===
let cinematicActive = false
let isInCutscene = false
let allCharacters = []
let activeNames = []
const memberInstances = new Map()
let removeTime = null
const EXIT = 350
const MOVE = 500
const TRATIO = 700

let xPos = 0
let yPos = 0
let activeToken = null
let tokenCount = 0

// === Broadcast Response ===
channel.onmessage = (e) => {
    switch (e.data.action) {
        case "cutsceneOn":
            StartCutscene(e.data.type, e.data.path)
            break
        case "cutsceneOff":
            EndCutscene()
            break
        case "updateCharacters":
            activeNames = e.data.activeNames
            localStorage.setItem(
                "activeCharacters",
                JSON.stringify(activeNames)
            )
            InstantiateActivePlayers()
            break
        case "createToken":
            InstantiateTokens(e.data.aCharacter)
            break
        case "deleteToken":
            RemoveToken(e.data.aCharacterId)
            break
        case "updateTokenPosition":
            xPos = e.data.positionX
            yPos = e.data.positionY
            activeToken = e.data.actualToken
            ExecuteToken()
            break
        case "updateStat":
            const character = allCharacters.find(c => c.name === e.data.name)
            if (!character) break

            const old = e.data.stat === "sanity"
                ? character.sanity
                : character[e.data.stat].current

            if (e.data.stat === "sanity") {
                character.sanity = e.data.current
            } else {
                character[e.data.stat].current = e.data.current
                character[e.data.stat].max = e.data.max
            }

            const member = memberInstances.get(e.data.name)
            if (member) UpdateStat(member, e.data.stat, character, e.data.current - old)
            break
    }
}

// === Execuções Base ===

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
            activeNames = JSON.parse(savedState)
        } else {
            activeNames = allCharacters.map(c => c.name)
        }

        InstantiateActivePlayers()

        channel.postMessage({ action: "requestState" })
    })
    .catch((err) => console.error('Erro ao carregar:', err))


// === Funções ===
function InstantiateActivePlayers() {
    UpdateCutsceneLayout()

    const activeCharacters = allCharacters.filter(character => activeNames.includes(character.name))

    const activeSet = new Set(
        activeCharacters.map(character => character.name)
    )

    for (let character of activeCharacters) {
        let member = memberInstances.get(character.name)

        if (!member) {
            member = Instantiate()

            memberInstances.set(character.name, member)

            UpdateInfo(member, character)

            member.classList.add("enter")

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!member.isConnected) return

                    member.classList.remove("enter")
                })
            })
        }
        else {
            member.classList.remove("leave")
            UpdateInfo(member, character)
        }
    }

    for (const [name, member] of memberInstances) {
        if (!activeSet.has(name)) {
            member.classList.add("leave")
        }
    }

    root.style.setProperty("--character-on", activeCharacters.length > 0 ? 1 : 0)

    ScheduleRemove()
}

function ScheduleRemove() {
    clearTimeout(removeTime)

    const hasInactiveMembers = [...memberInstances.values()].some(member => member.classList.contains("leave"))

    if (!hasInactiveMembers) return

    removeTime = setTimeout(() => {
        RemoveInactive()
    }, EXIT)
}

function UpdateStat(member, stat, character, change) {
    const element = member.querySelector(`.${stat}`)

    element.textContent = stat === "sanity"
        ? `${character.sanity}%`
        : `${character[stat].current}/${character[stat].max}`

    AnimateStat(element, change)
}

function AnimateStat(element, change) {
    // verde se subiu, vermelho se desceu, amarelo se só mudou o máximo
    const color = change > 0 ? "#4ade80" : change < 0 ? "#f87171" : "#facc15"

    element.animate([
        { transform: "translateX(0)", color: color, textShadow: `0 0 12px ${color}` },
        { transform: "translateX(-6px)", color: color, textShadow: `0 0 12px ${color}`, offset: 0.15 },
        { transform: "translateX(6px)", color: color, textShadow: `0 0 12px ${color}`, offset: 0.30 },
        { transform: "translateX(-5px)", color: color, textShadow: `0 0 12px ${color}`, offset: 0.45 },
        { transform: "translateX(5px)", color: color, textShadow: `0 0 12px ${color}`, offset: 0.60 },
        { transform: "translateX(-2px)", color: color, textShadow: `0 0 12px ${color}`, offset: 0.75 },
        { transform: "translateX(0)" }
    ], {
        duration: 450,
        easing: "ease-out"
    })
}

function UpdateInfo(member, character) {

    member.querySelector(".sanity").textContent = `${character.sanity}%`

    member.querySelector(".energy").textContent = `${character.energy.current}/${character.energy.max}`

    member.querySelector(".stamina").textContent = `${character.stamina.current}/${character.stamina.max}`

    member.querySelector(".health").textContent = `${character.health.current}/${character.health.max}`

    member.querySelector(".name").textContent = `${character.name}`

    const portrait = member.querySelector(".player-portrait")
    portrait.src = `${character.portrait}`

    portrait.style.width = `${character.portraitSize.width}px`
    portrait.style.height = `${character.portraitSize.height}px`
}

function Instantiate() {
    membersHandler.insertAdjacentHTML("beforeend", ` 
        <div class="player-container">
        <div class="rolling"><img src="../assets/preLoaded/roll.png" alt=""></div>
        <div class="side-container">
            <img class="player-portrait" src="" alt="">
            <div class="status-collum">
                <h2 class="status energy">???/???</h2>
                <h2 class="status stamina">???/???</h2>
                <h2 class="status health">???/???</h2>
                <h2 class="name">???</h2>
            </div>
        </div>
        <div class="bottom">
            <h2 class="status sanity">???%</h2>
        </div>
    </div>
    `)

    return membersHandler.lastElementChild
}

function RemoveInactive() {
    const leavingMembers = [...memberInstances.entries()].filter(([name, member]) => member.classList.contains("leave"))

    if (leavingMembers.length === 0) return

    const remainingMember = [...memberInstances.entries()].filter(([name, member]) => !member.classList.contains("leave"))
        .map(([name, member]) => member)

    const oldPosition = new Map()

    for (let member of remainingMember) {
        oldPosition.set(
            member,
            member.getBoundingClientRect()
        )
    }

    for (const [name, member] of leavingMembers) {
        member.remove()
        memberInstances.delete(name)
    }

    requestAnimationFrame(() => {
        for (let member of remainingMember) {
            if (!member.isConnected) continue

            const oldRect = oldPosition.get(member)
            const newPosition = member.getBoundingClientRect()

            const deltaX = oldRect.left - newPosition.left
            const deltaY = oldRect.top - newPosition.top

            if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                member.animate([
                    { transform: `translate(${deltaX}px, ${deltaY}px)` },
                    { transform: "translate(0, 0)" }
                ], {
                    duration: MOVE,
                    easing: "cubic-bezier(0.22, 1, 0.36, 1)"
                }
                )
            }
        }
    })
}

function UpdateCutsceneLayout() {
    const isCurrentlyInCutscene = membersHandler.classList.contains("cutscene");
    if (isCurrentlyInCutscene === isInCutscene) return;

    const members = [...memberInstances.values()]
    const oldPositions = new Map()

    for (const member of members) {
        oldPositions.set(member, member.getBoundingClientRect())
    }

    membersHandler.classList.toggle("cutscene", isInCutscene)

    for (const member of members) {
        const oldRect = oldPositions.get(member)
        const newRect = member.getBoundingClientRect()

        const deltaX = oldRect.left - newRect.left
        const deltaY = oldRect.top - newRect.top

        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
            member.animate([
                { transform: `translate(${deltaX}px, ${deltaY}px)` },
                { transform: "translate(0, 0)" }
            ], {
                duration: MOVE,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)"
            })
            animation.onfinish = () => {
                member.style.transform = "";
            }
        }
    }
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
        token.style.animation = `token-fade-out 0.4s ease`
        setTimeout(() => {
            token.remove()
            token.style.animation = `token-fade-out 0.4s ease`
        }, 400)
    } else {
        console.warn(`Token ${tokenId} não encontrado no mapa.`)
    }
}

function ExecuteToken() {
    const token = mapHandler.querySelector(`.token[data-id="${activeToken}"]`)
    if (!token) return
    MoveTo(token, xPos, yPos)
}

function MoveTo(token, xRatio, yRatio) {
    const mapRect = mapArea.getBoundingClientRect()
    const parent = token.offsetParent
    const parentRect = parent.getBoundingClientRect()

    const screenX = mapRect.left + xRatio * mapRect.width
    const screenY = mapRect.top + yRatio * mapRect.height

    const targetLeft = screenX - parentRect.left - parent.clientLeft + parent.scrollLeft - token.offsetWidth / 2
    const targetTop = screenY - parentRect.top - parent.clientTop + parent.scrollTop - token.offsetHeight / 2

    const startLeft = token.offsetLeft
    const startTop = token.offsetTop

    token.style.left = `${targetLeft}px`
    token.style.top = `${targetTop}px`

    token.animate([
        { left: `${startLeft}px`, top: `${startTop}px` },
        { left: `${targetLeft}px`, top: `${targetTop}px` }
    ], {
        duration: TRATIO,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)"
    })
}

function FadeInOut(type, time) {
    root.style.setProperty("--on-of", type)
    root.style.setProperty("--fade-time", `${time}s`)
}

function ChangeBackground(background) {
    root.style.setProperty('--next-background', `url("${background}")`)
    document.body.classList.add('next')

    time = setTimeout(() => {
        document.body.style.setProperty('--overlay-background', `url("${background}")`)
        document.body.classList.remove('next')
    }, 300)
}

function StartCinemaMode(type) {
    cinematicActive = type
    if (cinematicActive == true) {
        root.style.setProperty('--position-cinematic', `0vh`)
        root.style.setProperty('--zoom-out', `1`)
    }
    else {
        root.style.setProperty('--position-cinematic', `-15vh`)
        root.style.setProperty('--zoom-out', `1.15`)
    }
}

function CreateVideoBackground(video) {
    videoGroundHandler.innerHTML = `
        <video class="videoground">
            <source class="video-source" src="../assets/preLoaded/Denoivo.mp4" loop>
        </video>
    `
    let source = videoGroundHandler.querySelector(".video-source")
    let activeVideo = videoGroundHandler.querySelector(".videoground")
    activeVideo.play()
    source.src = video
}

function CreateImageBackground(image) {
    root.style.setProperty('--image-cutscene', `url("${image}")`)
}

function StartCutscene(type, source) {
    root.style.setProperty("--is-cutscene", `1`)

    FadeInOut(1, 1)

    if (type == "video") {
        setTimeout(() => {
            CreateVideoBackground(source)
            isInCutscene = true
            UpdateCutsceneLayout()
        }, 1050)
    }
    else {
        setTimeout(() => {
            CreateImageBackground(source)
            isInCutscene = true
            UpdateCutsceneLayout()
        }, 1050)
    }
    setTimeout(() => {
        FadeInOut(0, 1.2)
    }, 1300)

    setTimeout(() => {
        StartCinemaMode(true)
    }, 1800)
}

function EndCutscene() {
    FadeInOut(1, 1)

    setTimeout(() => {
        StartCinemaMode(false)
        videoGroundHandler.innerHTML = ""
        root.style.setProperty('--image-cutscene', `url("")`)
        isInCutscene = false
        UpdateCutsceneLayout()
    }, 1100)

    setTimeout(() => {
        FadeInOut(0, 1.2)

    }, 1300)

    setTimeout(() => {
        root.style.setProperty("--is-cutscene", `0`)
    }, 2400)

}