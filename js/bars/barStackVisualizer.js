(() => {
    // === Variaveis Base ===
    const BAR_MOVE = 500   // duração da troca de lugar (ms)
    const BAR_EXIT = 350   // duração do sumiço (ms)
    const EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

    // O container fica com display:none até as barras serem ativadas no controlador;
    // ao ativar, ele ganha display e empurra o mapa para o lado (z-index 9 no CSS)
    const container = document.getElementById("barStackVisualizer")
    if (!container) {
        console.warn('barStackVisualizer: falta <div id="barStackVisualizer"></div> no HTML')
        return
    }

    container.classList.add("bs-container")

    const stack = document.createElement("div")
    stack.className = "bs-stack"
    container.appendChild(stack)

    let isOn = false
    let containerAnimation = null

    const barElements = new Map()   // id da barra -> elemento HTML dela
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Linha da rodada: sempre o último item da pilha, então acompanha a última barra
    stack.insertAdjacentHTML("beforeend", `
        <div class="bs-marker" hidden>
            <span class="bs-marker-line"></span>
            <span class="bs-marker-number">1</span>
        </div>
    `)
    const marker = stack.lastElementChild
    const markerNumber = marker.querySelector(".bs-marker-number")

    // === Broadcast Response ===
    // addEventListener (e não onmessage) para não sobrescrever o handler do visualizer.js
    channel.addEventListener("message", (e) => {
        if (e.data.action === "updateBars") RenderBars(e.data)
    })

    // === Execuções Base ===
    // Pede ao controlador o estado atual (útil quando o display abre ou recarrega)
    channel.postMessage({ action: "requestBars" })

    // === Funções ===
    // Liga/desliga o container: ele ganha "display" e empurra o mapa, com a largura crescendo suavemente
    function SetEnabled(enabled) {
        if (enabled === isOn) return
        isOn = enabled

        if (containerAnimation) containerAnimation.cancel()
        container.style.overflow = ""

        if (enabled) {
            container.classList.add("bs-on")
            if (reduceMotion) return

            const width = container.offsetWidth
            container.style.overflow = "hidden"

            containerAnimation = container.animate([
                { width: "0px", opacity: 0 },
                { width: `${width}px`, opacity: 1 }
            ], {
                duration: BAR_MOVE,
                easing: EASING
            })

            containerAnimation.onfinish = () => { container.style.overflow = "" }
        } else {
            if (reduceMotion) {
                container.classList.remove("bs-on")
                return
            }

            const width = container.offsetWidth
            container.style.overflow = "hidden"

            const animation = container.animate([
                { width: `${width}px`, opacity: 1 },
                { width: "0px", opacity: 0 }
            ], {
                duration: BAR_EXIT,
                easing: EASING,
                fill: "forwards"
            })

            containerAnimation = animation

            animation.onfinish = () => {
                animation.cancel()
                container.style.overflow = ""
                if (!isOn) container.classList.remove("bs-on")
            }
        }
    }

    function RenderBars(state) {
        SetEnabled(state.enabled)

        const ids = new Set(state.bars.map(bar => bar.id))
        const newElements = []

        AnimateLayout(() => {
            // barras que sumiram
            for (const [id, element] of barElements) {
                if (ids.has(id)) continue

                RemoveBar(element)
                barElements.delete(id)
            }

            // barras novas ou atualizadas, já na ordem certa
            state.bars.forEach((bar, index) => {
                let element = barElements.get(bar.id)
                const isNew = !element

                if (isNew) {
                    element = CreateBar()
                    barElements.set(bar.id, element)
                    newElements.push(element)
                }

                UpdateBar(element, bar, isNew)
                stack.appendChild(element)   // reposiciona na ordem do array
                element.classList.toggle("bs-first", index === 0)
            })

            // linha da rodada sempre por último
            stack.appendChild(marker)
            marker.hidden = state.bars.length === 0
            UpdateRound(state.round)
        })

        // entrada: a barra nasce acima e desce para o lugar (mesmo esquema das caixas de personagem)
        for (const element of newElements) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => element.classList.remove("bs-enter"))
            })
        }
    }

    function CreateBar() {
        stack.insertAdjacentHTML("beforeend", `
            <div class="bs-bar bs-enter">
                <img class="bs-portrait empty" alt="">
                <span class="bs-name"></span>
                <span class="bs-initiative"></span>
            </div>
        `)

        return stack.lastElementChild
    }

    function UpdateBar(element, bar, isNew) {
        element.querySelector(".bs-name").textContent = bar.name || "—"

        const initiative = element.querySelector(".bs-initiative")
        const initiativeText = String(bar.initiative)

        if (initiative.textContent !== initiativeText) {
            initiative.textContent = initiativeText
            if (!isNew) Pulse(initiative)
        }

        const portrait = element.querySelector(".bs-portrait")

        if (bar.portrait) {
            if (portrait.getAttribute("src") !== bar.portrait) portrait.src = bar.portrait
            portrait.classList.remove("empty")
        } else {
            portrait.removeAttribute("src")
            portrait.classList.add("empty")
        }
    }

    // Tira a barra do fluxo (os outros ocupam o lugar dela) e a faz sumir
    function RemoveBar(element) {
        element.style.width = `${element.offsetWidth}px`
        element.style.left = `${element.offsetLeft}px`
        element.style.top = `${element.offsetTop}px`
        element.classList.add("bs-leave")

        setTimeout(() => element.remove(), BAR_EXIT)
    }

    function UpdateRound(round) {
        const text = String(round)
        const isFirstRender = !marker.dataset.ready
        marker.dataset.ready = "1"

        if (markerNumber.textContent === text) return

        markerNumber.textContent = text

        // na primeira renderização só mostra o número; nas seguintes, anima
        if (!isFirstRender) Pulse(markerNumber)
    }

    // Anima o número: cresce e brilha por um instante
    function Pulse(element) {
        if (reduceMotion) return

        element.animate([
            { transform: "scale(1)" },
            { transform: "scale(1.5)", color: "#ffd36e", textShadow: "0 0 12px #ffd36e", offset: 0.35 },
            { transform: "scale(1)" }
        ], {
            duration: 500,
            easing: "ease-out"
        })
    }

    // Guarda a posição de tudo, aplica a mudança e faz cada item deslizar do lugar antigo até o novo
    function AnimateLayout(mutate) {
        const oldRects = new Map()

        for (const element of stack.children) {
            oldRects.set(element, element.getBoundingClientRect())
        }

        mutate()

        if (reduceMotion) return

        for (const element of stack.children) {
            if (element.classList.contains("bs-leave")) continue

            const oldRect = oldRects.get(element)
            if (!oldRect) continue   // elemento novo: usa a animação de entrada

            const newRect = element.getBoundingClientRect()
            if (!oldRect.width || !newRect.width) continue   // estava escondido

            const deltaX = oldRect.left - newRect.left
            const deltaY = oldRect.top - newRect.top

            if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                element.animate([
                    { transform: `translate(${deltaX}px, ${deltaY}px)` },
                    { transform: "translate(0, 0)" }
                ], {
                    duration: BAR_MOVE,
                    easing: EASING
                })
            }
        }
    }
})()