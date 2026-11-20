(() => {
    // === Variaveis Base ===
    const STORAGE_KEY = "barStackState"

    const root = document.getElementById("barStackController")
    if (!root) {
        console.warn('barStackControler: falta <div id="barStackController"></div> no HTML')
        return
    }

    let characters = []        // vindo do data.json
    let bars = []              // ordem da pilha: índice 0 = barra de cima
    let round = 1
    let roundStartId = null    // barra que abre a rodada; quando ela volta ao topo, a rodada sobe
    let barsEnabled = false
    const rows = new Map()     // id da barra -> elemento HTML dela

    // === Menu (checkbox + botões) ===
    root.classList.add("bs-panel")
    root.innerHTML = `
        <div class="bs-toolbar">
            <label class="bs-toggle-label">
                <input class="bs-toggle" type="checkbox">
                Ativar barras
            </label>
            <button class="bs-btn bs-next" type="button">Passar tempo</button>
            <button class="bs-btn bs-sort" type="button">Ordenar</button>
            <button class="bs-btn bs-new" type="button">Nova barra</button>
            <button class="bs-btn bs-reset" type="button">Zerar rodadas</button>
            <span class="bs-round">Rodada 1</span>
        </div>
    `

    const toggle = root.querySelector(".bs-toggle")
    const roundLabel = root.querySelector(".bs-round")

    // === Lista de barras ===
    // Fica no container ao lado do mapa. Se ele não existir no HTML, a lista aparece dentro do menu.
    const listContainer = document.getElementById("barStackList")

    const list = document.createElement("div")
    list.className = "bs-stack bs-editor bs-list"

    if (listContainer) {
        listContainer.classList.add("bs-container")   // display:none até ativar; ao ativar empurra o mapa
        listContainer.appendChild(list)
    } else {
        console.warn('barStackControler: sem <div id="barStackList"></div>; a lista ficará dentro do menu')
        root.appendChild(list)
    }

    toggle.addEventListener("change", () => {
        barsEnabled = toggle.checked
        Commit()
    })
    root.querySelector(".bs-next").addEventListener("click", NextTurn)
    root.querySelector(".bs-sort").addEventListener("click", SortBars)
    root.querySelector(".bs-new").addEventListener("click", () => AddBar())
    root.querySelector(".bs-reset").addEventListener("click", ResetRound)

    // === Broadcast Response ===
    // addEventListener (e não onmessage) para não sobrescrever o handler do main.js
    channel.addEventListener("message", (e) => {
        if (e.data.action === "requestBars") SendBars()
    })

    // === Execuções Base ===
    LoadState()

    // Saindo do Arquivo Json (para achar o portrait pelo nome)
    fetch('../data/data.json')
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
        })
        .then((data) => {
            characters = data.characters

            for (const bar of bars) {
                bar.portrait = PortraitFor(bar.name)
                RefreshPortrait(rows.get(bar.id), bar)
            }
            Commit()
        })
        .catch((err) => console.error('Erro ao carregar:', err))

    // === Funções ===
    function NewId() {
        return `bar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    // Compara o nome digitado com o nome do personagem no json
    function PortraitFor(name) {
        const key = name.trim().toLowerCase()
        if (!key) return ""

        const character = characters.find(c => c.name.trim().toLowerCase() === key)
        return character ? character.portrait : ""
    }

    function RefreshPortrait(row, bar) {
        const img = row.querySelector(".bs-portrait")

        if (bar.portrait) {
            img.src = bar.portrait
            img.classList.remove("empty")
        } else {
            img.removeAttribute("src")
            img.classList.add("empty")
        }
    }

    function CreateRow(bar) {
        const row = document.createElement("div")
        row.className = "bs-bar"
        row.innerHTML = `
            <img class="bs-portrait empty" alt="">
            <input class="bs-name" type="text" placeholder="Nome">
            <input class="bs-initiative" type="number" placeholder="0">
            <button class="bs-add" type="button" title="Adicionar barra abaixo">+</button>
            <button class="bs-remove" type="button" title="Remover barra">×</button>
        `

        const nameInput = row.querySelector(".bs-name")
        const initiativeInput = row.querySelector(".bs-initiative")

        nameInput.value = bar.name
        initiativeInput.value = bar.initiative
        RefreshPortrait(row, bar)

        // digitar atualiza o portrait na hora; o envio ao display é ao confirmar (Enter ou sair do campo)
        nameInput.addEventListener("input", () => {
            bar.name = nameInput.value
            bar.portrait = PortraitFor(bar.name)
            RefreshPortrait(row, bar)
        })

        // digitar a iniciativa NÃO muda a ordem; só o botão "Ordenar" faz isso
        initiativeInput.addEventListener("input", () => {
            bar.initiative = initiativeInput.value
        })

        for (const input of [nameInput, initiativeInput]) {
            input.addEventListener("change", Commit)
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") input.blur()
            })
        }

        row.querySelector(".bs-add").addEventListener("click", () => AddBar(bar.id))
        row.querySelector(".bs-remove").addEventListener("click", () => RemoveBar(bar.id))

        rows.set(bar.id, row)
        return row
    }

    // Põe os elementos na mesma ordem do array
    function RenderOrder() {
        bars.forEach((bar, index) => {
            const row = rows.get(bar.id)
            list.appendChild(row)
            row.classList.toggle("bs-first", index === 0)
        })
    }

    // Adiciona uma barra logo abaixo da barra "afterId" (ou no final, se não passar nada)
    function AddBar(afterId = null) {
        const bar = { id: NewId(), name: "", initiative: "", portrait: "" }
        const index = afterId ? bars.findIndex(b => b.id === afterId) + 1 : bars.length

        bars.splice(index, 0, bar)
        CreateRow(bar)
        RenderOrder()
        Commit()

        rows.get(bar.id).querySelector(".bs-name").focus()
    }

    function RemoveBar(id) {
        bars = bars.filter(bar => bar.id !== id)

        rows.get(id).remove()
        rows.delete(id)

        RenderOrder()
        Commit()
    }

    // A barra de cima vai para baixo e todas as outras sobem
    function NextTurn() {
        if (bars.length === 0) return

        bars.push(bars.shift())

        // a barra que abriu a rodada voltou ao topo: rodada completa
        if (bars[0].id === roundStartId) round++

        RenderOrder()
        Commit()
    }

    // Maior iniciativa em cima, menor embaixo (barras sem número ficam no fim)
    function SortBars() {
        const value = (bar) => {
            const number = Number(bar.initiative)
            return bar.initiative === "" || isNaN(number) ? -Infinity : number
        }

        bars.sort((a, b) => {
            const valueA = value(a)
            const valueB = value(b)
            return valueA === valueB ? 0 : valueB > valueA ? 1 : -1
        })

        // a nova ordem abre uma nova rodada
        roundStartId = bars.length > 0 ? bars[0].id : null

        RenderOrder()
        Commit()
    }

    // Volta a contagem para a rodada 1; a barra que está no topo agora passa a abrir a rodada
    function ResetRound() {
        round = 1
        roundStartId = bars.length > 0 ? bars[0].id : null

        Commit()
    }

    // Se a barra que abre a rodada não existe mais, a de cima assume
    function EnsureRoundStart() {
        if (!bars.some(bar => bar.id === roundStartId)) {
            roundStartId = bars.length > 0 ? bars[0].id : null
        }
    }

    function UpdateToolbar() {
        root.classList.toggle("off", !barsEnabled)
        if (listContainer) listContainer.classList.toggle("bs-on", barsEnabled)
        toggle.checked = barsEnabled
        roundLabel.textContent = `Rodada ${round}`
    }

    // Tudo que muda o estado passa por aqui: atualiza a UI, salva e envia ao display
    function Commit() {
        EnsureRoundStart()
        UpdateToolbar()
        SaveState()
        SendBars()
    }

    // Só dados simples vão pelo channel (nada de elementos do DOM)
    function BuildState() {
        return {
            enabled: barsEnabled,
            round: round,
            roundStartId: roundStartId,
            bars: bars.map(bar => ({
                id: bar.id,
                name: bar.name,
                initiative: bar.initiative,
                portrait: bar.portrait
            }))
        }
    }

    function SendBars() {
        channel.postMessage({
            action: "updateBars",
            ...BuildState()
        })
    }

    function SaveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(BuildState()))
    }

    function LoadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
            if (!saved || !Array.isArray(saved.bars)) return

            barsEnabled = Boolean(saved.enabled)
            round = Number(saved.round) || 1
            roundStartId = saved.roundStartId || null
            bars = saved.bars

            for (const bar of bars) CreateRow(bar)
            RenderOrder()
        } catch (err) {
            console.error("Erro ao ler o estado das barras:", err)
        }

        EnsureRoundStart()
        UpdateToolbar()
    }
})()