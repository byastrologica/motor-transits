const API_URL = window.location.origin; // Usa a mesma origem da página

function formatarPosicoesAtuais(dados) {
    let texto = `Data: ${new Date(dados.data).toLocaleString("pt-BR")}\n\n`;
    texto += "Planetas:\n";
    const ordemPlanetas = ["Sol", "Lua", "Mercurio", "Venus", "Marte", "Jupiter", "Saturno", "Urano", "Netuno", "Plutao", "Nodo Norte", "Nodo Sul"];
    ordemPlanetas.forEach(planeta => {
        if (dados.posicoes[planeta]) {
            const p = dados.posicoes[planeta];
            texto += `- ${planeta}: ${p.posicao.toFixed(2)}°\n`;
        }
    });
    return texto;
}

function formatarMapaCompleto(dados) {
    let texto = `Ascendente: ${dados.ascendente.toFixed(2)}°\n`;
    texto += `Meio do Céu: ${dados.meioDoCeu.toFixed(2)}°\n\n`;
    
    texto += "Planetas:\n";
    const ordemPlanetas = ["Sol", "Lua", "Mercurio", "Venus", "Marte", "Jupiter", "Saturno", "Urano", "Netuno", "Plutao", "Nodo Norte", "Nodo Sul"];
    ordemPlanetas.forEach(planeta => {
        if (dados.planetas[planeta]) {
            texto += `- ${planeta}: ${dados.planetas[planeta].posicao.toFixed(2)}°\n`;
        }
    });
    
    texto += "\nCasas (Cúspides):\n";
    for (let i = 1; i <= 12; i++) {
        const nomeCasa = `Casa ${i}`;
        texto += `- ${nomeCasa}: ${dados.casas[nomeCasa].toFixed(2)}°\n`;
    }
    return texto;
}

document.getElementById("btnAtualizarPlanetas").addEventListener("click", async () => {
    const display = document.getElementById("posicoesAtuais");
    display.textContent = "Carregando...";
    try {
        const response = await fetch(`${API_URL}/api/planetas/agora`);
        if (!response.ok) throw new Error("Falha na rede");
        const data = await response.json();
        display.textContent = formatarPosicoesAtuais(data);
    } catch (error) {
        display.textContent = `Erro: ${error.message}`;
    }
});

document.getElementById("mapaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const display = document.getElementById("mapaCompleto");
    display.textContent = "Calculando...";

    const formData = {
        ano: parseInt(document.getElementById("ano").value),
        mes: parseInt(document.getElementById("mes").value),
        dia: parseInt(document.getElementById("dia").value),
        hora: parseInt(document.getElementById("hora").value),
        minuto: parseInt(document.getElementById("minuto").value),
        lat: parseFloat(document.getElementById("lat").value),
        lon: parseFloat(document.getElementById("lon").value),
    };

    try {
        const response = await fetch(`${API_URL}/api/mapa-completo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Falha no cálculo.");
        }
        const data = await response.json();
        display.textContent = formatarMapaCompleto(data);
    } catch (error) {
        display.textContent = `Erro: ${error.message}`;
    }
});
