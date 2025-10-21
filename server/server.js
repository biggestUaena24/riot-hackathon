require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const RIOT_BASE_URL = "https://americas.api.riotgames.com";
const RIOT_API_KEY = process.env.API_KEY;

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-4-5-20250929-v1:0";

const MAX_MATCHES = 300;
const DETAILS_CONCURRENCY = 8;

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const bedrock = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: fromNodeProviderChain(),
});

async function fetchRiot(url) {
  const resp = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });

  if (resp.status === 429) {
    const retryAfter = Number(resp.headers.get("retry-after") || 0);
    return { rateLimited: true, retryAfter };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { error: { status: resp.status, text } };
  }

  const data = await resp.json();
  return { data, headers: resp.headers };
}

function projectMatches(matches, selfPuuid) {
  return matches.map((m) => {
    const info = m?.info || {};
    const meta = m?.metadata || {};

    const idx = Array.isArray(meta.participants)
      ? meta.participants.findIndex((p) => p === selfPuuid)
      : -1;

    const p =
      (Array.isArray(info.participants) && info.participants[idx]) ||
      (info.participants || [])[0] ||
      {};

    return {
      id: meta.matchId,
      end: info.gameEndTimestamp,
      duration: info.gameDuration,
      queueId: info.queueId,
      version: info.gameVersion,
      champion: p.championName,
      win: p.win,
      k: p.kills,
      d: p.deaths,
      a: p.assists,
      gold: p.goldEarned,
      dmgDealt: p.totalDamageDealtToChampions,
      dmgTaken: p.totalDamageTaken,
      vision: p.visionScore,
      cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
      role: p.teamPosition || p.role || p.lane,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      teamObj: (info.teams || []).map((t) => ({
        teamId: t.teamId,
        win: t.win,
        baron: t.objectives?.baron?.kills,
        dragon: t.objectives?.dragon?.kills,
        herald: t.objectives?.riftHerald?.kills,
        tower: t.objectives?.tower?.kills,
      })),
    };
  });
}

app.get("/api/getPuuid", async (req, res) => {
  try {
    const username = (req.query.username || "").trim();
    const tagline = (req.query.tagline || "").trim();

    if (!username || !tagline) {
      return res
        .status(400)
        .json({ error: "username and tagline are required" });
    }
    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: "Server missing RIOT API key" });
    }

    const url = `${RIOT_BASE_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      username
    )}/${encodeURIComponent(tagline)}`;

    const { data, error, rateLimited } = await fetchRiot(url);

    if (rateLimited) {
      return res
        .status(429)
        .json({ error: "Rate limited by Riot API. Try again shortly." });
    }
    if (error) {
      const status = error.status;
      if (status === 404)
        return res.status(404).json({ error: "Account not found" });
      return res
        .status(status)
        .json({ error: "Failed to fetch from Riot API", details: error.text });
    }

    return res.json({
      puuid: data.puuid,
      gameName: data.gameName,
      tagLine: data.tagLine,
    });
  } catch (err) {
    console.error("getPuuid error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/pullMatchDetail", async (req, res) => {
  try {
    const puuid = (req.query.puuid || "").trim();
    if (!puuid) return res.status(400).json({ error: "puuid is required" });
    if (!RIOT_API_KEY)
      return res.status(500).json({ error: "Missing RIOT API key" });

    const matchIds = [];
    let start = 0;
    let rateLimitedDuringIds = false;

    while (matchIds.length < MAX_MATCHES) {
      const remaining = MAX_MATCHES - matchIds.length;
      const count = Math.min(100, remaining);

      const idsUrl = `${RIOT_BASE_URL}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?start=${start}&count=${count}`;

      const { data, error, rateLimited } = await fetchRiot(idsUrl);

      if (rateLimited) {
        rateLimitedDuringIds = true;
        break;
      }
      if (error) {
        return res
          .status(error.status)
          .json({ error: "Failed to get match IDs", details: error.text });
      }
      if (!data || data.length === 0) break;

      matchIds.push(...data);
      start += data.length;
    }

    const results = new Array(matchIds.length);
    let idx = 0;
    let hitRateLimitDuringDetails = false;

    async function worker() {
      while (true) {
        if (hitRateLimitDuringDetails) return;
        const myIdx = idx++;
        if (myIdx >= matchIds.length) return;

        const id = matchIds[myIdx];
        const url = `${RIOT_BASE_URL}/lol/match/v5/matches/${id}`;
        const { data, rateLimited } = await fetchRiot(url);

        if (rateLimited) {
          hitRateLimitDuringDetails = true;
          return;
        }
        if (data) results[myIdx] = data;
      }
    }

    const workers = Array.from(
      { length: Math.min(DETAILS_CONCURRENCY, matchIds.length) },
      () => worker()
    );
    await Promise.all(workers);

    const matches = results.filter(Boolean);
    const compact = projectMatches(matches, puuid);

    const systemText = `
You are a League of Legends performance analyst.
- Return STRICT JSON only (no commentary).
- Compute overall winRate, avgKDA, topChampions, roleDistribution,
  keyIndicators (vision, early CS/gold if possible, objective impact),
  and 3-5 prioritized recommendations.
- Keep explanations concise and actionable.
`;

    const userPayload = {
      puuid,
      rateLimited: rateLimitedDuringIds || hitRateLimitDuringDetails,
      fetchedMatches: matches.length,
      requestedCap: MAX_MATCHES,
      matches: compact,
    };

    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      temperature: 0.2,
      system: systemText,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: JSON.stringify(userPayload) }],
        },
      ],
    };

    const cmd = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    });

    const bedrockResp = await bedrock.send(cmd);
    const parsed = JSON.parse(new TextDecoder().decode(bedrockResp.body));
    const text = parsed?.content?.[0]?.text || "{}";

    let analysisJson;
    try {
      analysisJson = JSON.parse(text);
    } catch {
      analysisJson = { raw: text };
    }

    return res.json({
      puuid,
      model: MODEL_ID,
      partial: rateLimitedDuringIds || hitRateLimitDuringDetails,
      fetched: matches.length,
      cap: MAX_MATCHES,
      analysis: analysisJson,
    });
  } catch (err) {
    console.error("pullMatchDetail error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`[${NODE_ENV}] Server running on port ${PORT}`);
});
