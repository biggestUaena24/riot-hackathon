require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
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

const S3_BUCKET = process.env.S3_BUCKET;
const S3_PREFIX = process.env.S3_PREFIX || "riot-matches";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: fromNodeProviderChain(),
});

async function s3GetJSON(bucket, key) {
  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const text = await out.Body.transformToString();
    return JSON.parse(text);
  } catch (err) {
    if (
      err?.$metadata?.httpStatusCode === 404 ||
      err?.name === "NoSuchKey" ||
      err?.Code === "NoSuchKey"
    ) {
      return null;
    }
    throw err;
  }
}

async function s3PutJSON(bucket, key, obj) {
  const body = JSON.stringify(obj);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      CacheControl: "no-cache",
    })
  );
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
    if (!S3_BUCKET)
      return res.status(500).json({ error: "Missing S3_BUCKET env" });

    const key = `${S3_PREFIX}/${puuid}.json`;
    const SPACING_MS = Math.floor(1000 / BATCH_PER_SECOND);

    let cache = await s3GetJSON(S3_BUCKET, key);

    const getIdsPage = async (start, count) => {
      const idsUrl = `${RIOT_BASE_URL}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?start=${start}&count=${count}`;
      return riot.fetchRiot(idsUrl);
    };

    const fetchDetailsBatch = async (ids) => {
      const batchPromises = [];
      let hitRateLimitDuringDetails = false;

      for (const id of ids) {
        batchPromises.push(
          (async () => {
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
          })()
        );
        await sleep(SPACING_MS);
      }
      const results = await Promise.all(batchPromises);
      return { results: results.filter(Boolean), hitRateLimitDuringDetails };
    };

    if (cache?.matches && Array.isArray(cache.matches) && cache.latestMatchId) {
      const {
        data: newestIds,
        error: newestErr,
        rateLimited: newestRL,
      } = await getIdsPage(0, 1);
      if (newestRL) {
        return res.json({
          puuid,
          model: cache.model || MODEL_ID,
          partial: false,
          fetched: cache.matches.length,
          cap: MAX_MATCHES,
          analysis: cache.analysis || {},
          fromCache: true,
          cacheUpdatedAt: cache.updatedAt || null,
        });
      }
      if (newestErr) {
        return res
          .status(newestErr.status)
          .json({
            error: "Failed to check freshness",
            details: newestErr.text,
          });
      }

      const newestId = (newestIds && newestIds[0]) || null;

      if (!newestId || newestId === cache.latestMatchId) {
        return res.json({
          puuid,
          model: cache.model || MODEL_ID,
          partial: false,
          fetched: cache.matches.length,
          cap: MAX_MATCHES,
          analysis: cache.analysis || {},
          fromCache: true,
          cacheUpdatedAt: cache.updatedAt || null,
        });
      }

      const newIds = [];
      let start = 0;
      let stop = false;

      while (!stop && newIds.length < MAX_MATCHES) {
        const remaining = MAX_MATCHES - newIds.length;
        const count = Math.min(100, remaining);
        const { data, error, rateLimited } = await getIdsPage(start, count);
        if (rateLimited) break;
        if (error) {
          return res
            .status(error.status)
            .json({
              error: "Failed to get new match IDs",
              details: error.text,
            });
        }
        if (!data || data.length === 0) break;

        for (const id of data) {
          if (id === cache.latestMatchId) {
            stop = true;
            break;
          }
          newIds.push(id);
        }
        start += data.length;

        if (stop || data.length < count) break;
      }
      const idsToFetch = newIds;

      const { results: newDetails, hitRateLimitDuringDetails } =
        await fetchDetailsBatch(idsToFetch);

      const newCompact = riot.projectMatches(newDetails, puuid);
      const merged = [...newCompact, ...cache.matches].slice(0, MAX_MATCHES);

      const latestMatchId = newestId || cache.latestMatchId;
      const updatedCache = {
        puuid,
        model: MODEL_ID,
        updatedAt: new Date().toISOString(),
        latestMatchId,
        fetchedMatches: merged.length,
        requestedCap: MAX_MATCHES,
        matches: merged,
        analysis: cache.analysis || {},
      };

      await s3PutJSON(S3_BUCKET, key, updatedCache);

      return res.json({
        puuid,
        model: MODEL_ID,
        partial: hitRateLimitDuringDetails,
        fetched: merged.length,
        cap: MAX_MATCHES,
        analysis: updatedCache.analysis,
        fromCache: false,
        cacheUpdatedAt: updatedCache.updatedAt,
      });
    }

    const matchIds = [];
    let start = 0;
    let rateLimitedDuringIds = false;

    while (matchIds.length < MAX_MATCHES) {
      const remaining = MAX_MATCHES - matchIds.length;
      const count = Math.min(100, remaining);
      const { data, error, rateLimited } = await getIdsPage(start, count);

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
      const { results: batchResults, hitRateLimitDuringDetails: rl } =
        await fetchDetailsBatch(batchIds);
      results.push(...batchResults);
      hitRateLimitDuringDetails = rl;

      if (
        !hitRateLimitDuringDetails &&
        i + BATCH_PER_SECOND < matchIds.length
      ) {
        await sleep(250);
      }
    }

    results.sort((a, b) => {
      const ta = a?.info?.gameEndTimestamp ?? a?.info?.gameCreation ?? 0;
      const tb = b?.info?.gameEndTimestamp ?? b?.info?.gameCreation ?? 0;
      return tb - ta;
    });

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
      max_tokens: 8000,
      temperature: 0,
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

    const latestMatchId = matchIds[0] || null;
    const newCache = {
      puuid,
      model: MODEL_ID,
      updatedAt: new Date().toISOString(),
      latestMatchId,
      fetchedMatches: compact.length,
      requestedCap: MAX_MATCHES,
      matches: compact,
      analysis: analysisJson,
    };
    await s3PutJSON(S3_BUCKET, key, newCache);

    return res.json({
      puuid,
      model: MODEL_ID,
      partial: rateLimitedDuringIds || hitRateLimitDuringDetails,
      fetched: compact.length,
      cap: MAX_MATCHES,
      analysis: analysisJson,
      fromCache: false,
      cacheUpdatedAt: newCache.updatedAt,
    });
  } catch (err) {
    console.error("pullMatchDetail error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`[${NODE_ENV}] Server running on port ${PORT}`);
});
