import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import swisseph from 'swisseph';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURAÇÃO DO SWISSEPH ---
swisseph.swe_set_ephe_path('./ephe'); // ajuste se sua pasta de efemérides for diferente

// --- PLANETAS QUE VAMOS CALCULAR ---
const PLANETAS = {
  'Sol': swisseph.SE_SUN,
  'Lua': swisseph.SE_MOON,
  'Mercurio': swisseph.SE_MERCURY,
  'Venus': swisseph.SE_VENUS,
  'Marte': swisseph.SE_MARS,
  'Jupiter': swisseph.SE_JUPITER,
  'Saturno': swisseph.SE_SATURN,
  'Urano': swisseph.SE_URANUS,
  'Netuno': swisseph.SE_NEPTUNE,
  'Plutao': swisseph.SE_PLUTO,
  'Nodo Norte': swisseph.SE_TRUE_NODE
};

// --- FUNÇÃO AUXILIAR: JULIAN DAY ---
function getJulianDayUT(dateUTC) {
  return new Promise((resolve, reject) => {
    swisseph.swe_julday(
      dateUTC.getUTCFullYear(),
      dateUTC.getUTCMonth() + 1,
      dateUTC.getUTCDate(),
      dateUTC.getUTCHours() + dateUTC.getUTCMinutes() / 60 + dateUTC.getUTCSeconds() / 3600,
      swisseph.SE_GREG_CAL,
      (jd) => {
        if (!jd) return reject(new Error('Falha ao calcular Julian Day.'));
        resolve(jd);
      }
    );
  });
}

// --- ROTA: POSIÇÃO ATUAL DOS PLANETAS ---
app.get('/api/planetas/agora', async (req, res) => {
  try {
    const agora = new Date();
    const tjd_ut = await getJulianDayUT(agora);
    const flags = swisseph.SEFLG_SPEED;

    const posicoes = {};
    const calculos = Object.keys(PLANETAS).map(nomePlaneta => {
      return new Promise((resolve, reject) => {
        swisseph.swe_calc_ut(tjd_ut, PLANETAS[nomePlaneta], flags, (result) => {
          if (result.error) return reject(result.error);
          resolve({ nome: nomePlaneta, posicao: result.longitude });
        });
      });
    });

    const resultados = await Promise.all(calculos);
    resultados.forEach(p => posicoes[p.nome] = p.posicao);
    posicoes['Nodo Sul'] = (posicoes['Nodo Norte'] + 180) % 360;

    res.json({
      data: agora.toISOString(),
      planetas: posicoes
    });
  } catch (error) {
    console.error('[planetas/agora] Erro:', error);
    res.status(500).json({ error: 'Erro ao calcular posição dos planetas.' });
  }
});

// --- ROTA: CALCULAR MAPA COMPLETO ---
app.post('/api/mapa-completo', async (req, res) => {
  const { ano, mes, dia, hora, minuto, segundo = 0, lat, lon } = req.body;
  if ([ano, mes, dia, hora, minuto, lat, lon].some(v => v === undefined || v === null || v === '')) {
    return res.status(400).json({ error: 'Dados de nascimento, incluindo lat/lon, são necessários.' });
  }

  try {
    const dataNascimento = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo)));
    const julianDayUT = await getJulianDayUT(dataNascimento);
    console.log('[mapa-completo] dataNascimento UTC:', dataNascimento.toISOString(), 'tjd_ut:', julianDayUT);

    const flags = swisseph.SEFLG_SPEED;
    const posicoesPlanetas = {};

    const calculosPlanetas = Object.keys(PLANETAS).map(nomePlaneta => {
      return new Promise((resolve, reject) => {
        swisseph.swe_calc_ut(julianDayUT, PLANETAS[nomePlaneta], flags, (result) => {
          if (result && result.error) return reject(new Error(`Erro ao calcular ${nomePlaneta}: ${result.er
