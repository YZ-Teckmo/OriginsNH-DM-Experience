// === HTML Imports ===
const root = document.documentElement
const channel = new BroadcastChannel("display-channel")

const blackScreenHandler = document.getElementById("blackScreenHandler")
const cinematicBarsHandler = document.getElementById("cinematicBarsHandler")
const videoGroundHandler = document.getElementById("videoGroundHandler")
const tokens = document.querySelectorAll('.token')
const membersHandler = document.getElementById('membersHandler')

// === Variaveis Base ===
let cinematicActive = false
let allCharacters = []
let activeNames = []
const memberInstances = new Map()
let removeTime = null
const EXIT = 350
const MOVE = 500

// === Broadcast Response ===
channel.onmessage = (e) => {
    switch(e.data.action) {
        case "cutsceneOn":
            StartCutscene("image", "../assets/preLoaded/cutscenes/background.jpg")
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
    }
}

// === Execuções Base ===
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
            activeNames = JSON.parse(savedState)
        } else {
            activeNames = allCharacters.map(c => c.name)
        }

        InstantiateActivePlayers()
    })
    .catch((err) => console.error('Erro ao carregar:', err))


// === Funções ===
function InstantiateActivePlayers() {

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
                    {transform: `translate(${deltaX}px, ${deltaY}px)`},
                    {transform: "translate(0, 0)"}
                ], {
                    duration: MOVE,
                    easing: "cubic-bezier(0.22, 1, 0.36, 1)"
                }
                )
            }
        }
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
        }, 1050)
    }
    else {
        setTimeout(() => {
            CreateImageBackground(source)
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
    }, 1100)

    setTimeout(() => {
        FadeInOut(0, 1.2)
    }, 1300)

    setTimeout(() => {
        root.style.setProperty("--is-cutscene", `0`)
    }, 2400)

}