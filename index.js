const express = require('express');
const cors = require('cors');
const swisseph = require('swisseph-v2');
const path = require('path'); // Adicionado para lidar com caminhos de arquivo

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Caminho correto para a pasta public

// --- Configuração Essencial da Swiss Ephemeris ---
const ephePath = path.join(__dirname, 'ephe');
swisseph.swe_set_ephe_path(ephePath);

// Constantes para os planetas
const PLANETAS = {
  Sol: swisseph.SE_SUN, Lua: swisseph.SE_MOON, Mercurio: swisseph.SE_MERCURY,
  Venus: swisseph.SE_VENUS, Marte: swisseph.SE_MARS, Jupiter: swisseph.SE_JUPITER,
  Saturno: swisseph.SE_SATURN, Urano: swisseph.SE_URANUS, Netuno: swisseph.SE_NEPTUNE,
  Plutao: swisseph.SE_PLUTO, 'Nodo Norte': swisseph.SE_TRUE_NODE,
};

// Função auxiliar para converter data para Dia Juliano UT
function getJulianDayUT(date) {
  return new Promise((resolve, reject) => {
    swisseph.swe_julday(
      date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
      date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600,
      swisseph.SE_GREG_CAL,
      (julianDay) => {
        if (julianDay) resolve(julianDay);
        else reject('Erro ao calcular o Dia Juliano.');
      }
    );
  });
}

// Rota de teste
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- ROTA PARA POSIÇÃO ATUAL DOS PLANETAS ---
app.get('/api/planetas/agora', async (req, res) => {
  try {
    const agora = new Date();
    const julianDayUT = await getJulianDayUT(agora);
    const flags = swisseph.SEFLG_SPEED;
    const posicoes = {};

    const calculos = Object.keys(PLANETAS).map(nomePlaneta => {
      return new Promise((resolve, reject) => {
        swisseph.swe_calc_ut(julianDayUT, PLANETAS[nomePlaneta], flags, (result) => {
          if (result.error) reject(`Erro ao calcular ${nomePlaneta}: ${result.error}`);
          else resolve({ nome: nomePlaneta, posicao: result.longitude, velocidade: result.longitudeSpeed });
        });
      });
    });

    const resultados = await Promise.all(calculos);
    resultados.forEach(p => { posicoes[p.nome] = { posicao: p.posicao, velocidade: p.velocidade }; });

    if (posicoes['Nodo Norte']) {
      posicoes['Nodo Sul'] = { posicao: (posicoes['Nodo Norte'].posicao + 180) % 360, velocidade: posicoes['Nodo Norte'].velocidade };
    }

    res.json({ data: agora.toISOString(), posicoes: posicoes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ocorreu um erro no servidor.' });
  }
});

// --- ROTA PARA MAPA ASTRAL COMPLETO (PLANETAS + CASAS) ---
app.post('/api/mapa-completo', async (req, res) => {
  const { ano, mes, dia, hora, minuto, segundo = 0, lat, lon } = req.body;
  if (!ano || !mes || !dia || !hora || minuto === undefined || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'Dados de nascimento, incluindo lat/lon, são necessários.' });
  }

  try {
    const dataNascimento = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo));
    const julianDayUT = await getJulianDayUT(dataNascimento);
    const flags = swisseph.SEFLG_SPEED;
    const posicoesPlanetas = {};

    const calculosPlanetas = Object.keys(PLANETAS).map(nomePlaneta => {
      return new Promise((resolve, reject) => {
        swisseph.swe_calc_ut(julianDayUT, PLANETAS[nomePlaneta], flags, (result) => {
          if (result.error) reject(`Erro ao calcular ${nomePlaneta}: ${result.error}`);
          else resolve({ nome: nomePlaneta, posicao: result.longitude });
        });
      });
    });

    const resultadosPlanetas = await Promise.all(calculosPlanetas);
    resultadosPlanetas.forEach(p => { posicoesPlanetas[p.nome] = { posicao: p.posicao }; });

    if (posicoesPlanetas['Nodo Norte']) {
      posicoesPlanetas['Nodo Sul'] = { posicao: (posicoesPlanetas['Nodo Norte'].posicao + 180) % 360 };
    }

    const sistemaCasas = 'P'; // Placidus
    const casasInfo = await new Promise((resolve, reject) => {
      swisseph.swe_houses(julianDayUT, lat, lon, sistemaCasas, (result) => {
        if (result.error) reject('Erro ao calcular as casas astrológicas.');
        else resolve({ cusps: result.cusps, ascmc: result.ascmc });
      });
    });

    const posicoesCasas = {};
    for (let i = 1; i <= 12; i++) { posicoesCasas[`Casa ${i}`] = casasInfo.cusps[i]; }

    res.json({
      dadosNascimento: { ano, mes, dia, hora, minuto, lat, lon },
      ascendente: casasInfo.ascmc[0], meioDoCeu: casasInfo.ascmc[1],
      planetas: posicoesPlanetas, casas: posicoesCasas
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ocorreu um erro no servidor ao gerar o mapa completo.' });
  }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}. Acesse pelo painel 'PORTS' do Codespace.`);
});
