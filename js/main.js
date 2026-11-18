// === HTML Imports ===
const root = document.documentElement
const blackScreenHandler = document.getElementById("blackScreenHandler")
const cinematicBarsHandler = document.getElementById("cinematicBarsHandler")
const videoGroundHandler = document.getElementById("videoGroundHandler")
const tokens = document.querySelectorAll('.token')
const membersHandler = document.getElementById('membersHandler')

// === Classes ===
class Character {
    constructor(name, portrait, current, max, width, height) {
        this.name = name
        this.health = {
            current: current,
            max: max
        }
        this.stamina = {
            current: current,
            max: max
        }
        this.energy = {
            current: current,
            max: max
        }
        this.sanity = current
        this.portrait = portrait
        this.portraitSize = {
            width: width,
            height: height
        }
        this.transformation = new Transformation()
    }
}

class Transformation {
    constructor(color, token, portrait, size) {
        this.color = color
        this.token = token
        this.portrait = portrait
        this.size = size
    }
}

// === Variaveis Base ===
let cinematicActive = false
let activeToken = null
let offsetX = 0
let offsetY = 0
let offsetZ = 1
let allCharacters = []

// === Execuções Base ===
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

// Saindo do Arquivo Json
fetch('../data/data.json')
    .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
    })
    .then((data) => {
        allCharacters = data.characters
        InstantiateActivePlayers()
    })
    .catch((err) => console.error('Erro ao carregar:', err))

// === Funções ===

function InstantiateActivePlayers() {
    console.log(allCharacters)
    for (let character of allCharacters) {
        let member = Instantiate()
        let sanity = member.querySelector(".sanity")
        sanity.innerHTML = `${character.sanity}%`
        let energy = member.querySelector(".energy")
        energy.innerHTML = `${character.energy.current}/${character.energy.max}`
        let stamina = member.querySelector(".stamina")
        stamina.innerHTML = `${character.stamina.current}/${character.stamina.max}`
        let health = member.querySelector(".health")
        health.innerHTML = `${character.health.current}/${character.health.max}`
        let name = member.querySelector(".name")
        name.innerHTML = `${character.name}`
        let portrait = member.querySelector(".player-portrait")
        portrait.src = `${character.portrait}`
        portrait.style.width = `${character.portraitSize.width}px`
        portrait.style.height = `${character.portraitSize.height}px`
    }
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

// === Debug ===
document.addEventListener("keydown", function (event) {
    if (event.key === "c") {
        StartCutscene("image", "../assets/preLoaded/background.jpg")
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "v") {
        EndCutscene()
    }
});