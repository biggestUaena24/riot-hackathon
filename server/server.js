require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
const riot = require("./utils/riot");

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const RIOT_BASE_URL = "https://americas.api.riotgames.com";
const RIOT_API_KEY = process.env.API_KEY;

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-4-5-20250929-v1:0";

const MAX_MATCHES = 300;
const BATCH_PER_SECOND = 15;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 950 + Math.floor(Math.random() * 150);

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5174",
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const bedrock = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: fromNodeProviderChain(),
});

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

    const { data, error, rateLimited } = await riot.fetchRiot(url);

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

      const { data, error, rateLimited } = await riot.fetchRiot(idsUrl);

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

    const results = [];
    let hitRateLimitDuringDetails = false;

    for (
      let i = 0;
      i < matchIds.length && !hitRateLimitDuringDetails;
      i += BATCH_PER_SECOND
    ) {
      const batchIds = matchIds.slice(i, i + BATCH_PER_SECOND);

      const batchResults = await Promise.all(
        batchIds.map(async (id) => {
          const url = `${RIOT_BASE_URL}/lol/match/v5/matches/${id}`;
          const { data, rateLimited, error } = await riot.fetchRiot(url);

          if (rateLimited) {
            hitRateLimitDuringDetails = true;
            return null;
          }
          if (error) {
            if (NODE_ENV !== "production") {
              console.warn(
                `[match ${id}] ${error.status}: ${
                  error.text?.slice(0, 180) || ""
                }`
              );
            }
            return null;
          }
          return data || null;
        })
      );

      for (const r of batchResults) if (r) results.push(r);

      if (
        !hitRateLimitDuringDetails &&
        i + BATCH_PER_SECOND < matchIds.length
      ) {
        await sleep(jitter());
      }
    }

    if (NODE_ENV !== "production") {
      console.log(
        `Fetched ${results.length} detailed matches (out of ${matchIds.length})`
      );
    }

    const compact = riot.projectMatches(results, puuid);
    const userPayload = {
      puuid,
      rateLimited: rateLimitedDuringIds || hitRateLimitDuringDetails,
      fetchedMatches: results.length,
      requestedCap: MAX_MATCHES,
      matches: compact,
    };

    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 5000,
      temperature: 0.2,
      system: riot.systemPrompt,
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
      fetched: results.length,
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
