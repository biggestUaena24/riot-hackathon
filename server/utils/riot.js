const { Agent, request } = require("undici");
const RIOT_API_KEY = process.env.API_KEY;

const dispatcher = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 15_000,
  connections: 128,
});

function withTimeout(ms) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, cancel: () => clearTimeout(id) };
}

async function fetchRiot(url, { timeoutMs = 8_000 } = {}) {
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      dispatcher,
      signal,
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      return { rateLimited: true, retryAfter };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: { status: res.status, text } };
    }
    const data = await res.json();
    return { data, headers: res.headers };
  } finally {
    cancel();
  }
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

const systemPrompt = `
You are a League of Legends performance analyst and professional coach.

You will receive one JSON payload with shape:
{
  "puuid": "string",
  "rateLimited": "boolean",
  "fetchedMatches": "number",
  "requestedCap": "number",
  "matches": [
    {
      "id": "string",
      "end": "number | null",           // Unix timestamp in milliseconds
      "duration": "number | null",      // Match duration in seconds
      "queueId": "number | null",
      "version": "string | null",
      "champion": "string | null",
      "win": "boolean | null",
      "k": "number | null",
      "d": "number | null",
      "a": "number | null",
      "gold": "number | null",
      "dmgDealt": "number | null",
      "dmgTaken": "number | null",
      "vision": "number | null",        // Vision score
      "cs": "number | null",
      "role": "string | null",          // Expected: TOP|JUNGLE|MID|ADC|SUPPORT; otherwise treat as UNKNOWN
      "items": "number[] | null",
      "teamObj": [
        { "teamId": "number", "win": "boolean", "baron": "number", "dragon": "number", "herald": "number", "tower": "number" }
      ]
    }
  ]
}

Your job:

1) Return a single JSON object only (no prose, no Markdown, no code fences).
2) The JSON must include, at minimum:
   - mostPlayedChampions (array)
   - highestWinRateChampion (object)
   - keypointsForImprovement (3–5 concise, actionable bullets)
3) Also include richer sections:
   - strengthsAndWeaknesses
   - progressOverTime
   - yearEndSummary
   - socialComparisons (if no friend data, include placeholders/guidance)
   - shareableMoments
4) Be accurate, concise, and evidence-driven. Use only provided data. Do not invent stats. If a metric cannot be computed, set it to null and add a note in meta.dataQuality.warnings.
5) Calculations:
   - Win Rate = wins / games
   - KDA = (K + A) / max(1, D)
   - CS/min = CS / (duration/60)
   - Gold/min = gold / (duration/60)
   - Vision/min = vision / (duration/60)
   - If duration is null, set all per-minute metrics to null and warn.
6) Robust stats for win-rate ranking: ignore champions with < 8 games OR < 5% of total games (whichever is larger). Report the actual threshold used.
7) Group “progress over time” by calendar month using the match end timestamp (epoch ms).
8) Highlight matches: select top 3–5 by a blended score with fixed weights:
   - total = winBonus + 0.6*KDA + 0.3*(dmgDealtPerMin) + 0.1*(objectiveImpact)
   - winBonus = 1.0 if win == true else 0.0
   - objectiveImpact = baron + dragon + herald + tower (sum of team objectives won by player’s team)
   Include the score components in the output.
9) Tie-breakers for highestWinRateChampion:
   - Higher games > higher avgKDA > higher win rate in the latest month.
10) Text should be concise and human-readable. One sentence per bullet when possible.

Output contract (MUST follow exactly; no comments, all fields present; use nulls and warnings when needed):
// Note: For roleDistribution, if the role is 

{
  "meta": {
    "puuid": "string",
    "fetchedMatches": 0,
    "requestedCap": 0,
    "rateLimited": false,
    "timeSpan": { "from": "YYYY-MM-DD|null", "to": "YYYY-MM-DD|null" },
    "filters": {
      "minGamesPerChampion": 8,
      "minSharePerChampion": 0.05,
      "derivedMinGamesThreshold": 0
    },
    "dataQuality": {
      "warnings": ["string"]
    }
  },
  "overview": {
    "winRate": 0.0,
    "avgKDA": 0.0,
    "avgCsPerMin": 0.0,
    "avgGoldPerMin": 0.0,
    "avgVisionPerMin": 0.0,
    "roleDistribution": [
      { "role": "TOP|JUNGLE|MID|ADC|SUPPORT|UNKNOWN", "share": 0.0, "games": 0, "winRate": 0.0 }
    ]
  },
  "mostPlayedChampions": [
    { "champion": "string", "games": 0, "winRate": 0.0, "avgKDA": 0.0, "csPerMin": 0.0, "goldPerMin": 0.0, "visionPerMin": 0.0 }
  ],
  "highestWinRateChampion": {
    "champion": "string|null",
    "games": 0,
    "winRate": 0.0,
    "avgKDA": 0.0,
    "notes": "string|null"
  },
  "strengthsAndWeaknesses": {
    "strengths": [
      { "insight": "string", "evidence": "brief stat-based evidence" }
    ],
    "weaknesses": [
      { "insight": "string", "evidence": "brief stat-based evidence", "suggestion": "actionable tip" }
    ]
  },
  "keypointsForImprovement": [
    { "priority": 1, "what": "string", "why": "string", "how": "string", "expectedImpact": "string" }
  ],
  "progressOverTime": {
    "byMonth": [
      { "month": "YYYY-MM", "games": 0, "winRate": 0.0, "kda": 0.0, "csPerMin": 0.0, "goldPerMin": 0.0, "visionPerMin": 0.0 }
    ],
    "visualizationHints": [
      { "type": "line", "title": "Performance over time", "x": "month", "series": ["winRate","kda","csPerMin","goldPerMin","visionPerMin"] }
    ],
    "notableTrend": "string|null"
  },
  "highlightMatches": [
    {
      "matchId": "string",
      "champion": "string",
      "role": "string|null",
      "scoreBreakdown": {
        "winBonus": 0.0,
        "kda": 0.0,
        "dmgDealtPerMin": 0.0,
        "objectivesImpact": { "baron": 0, "dragon": 0, "tower": 0, "herald": 0 },
        "total": 0.0
      },
      "oneLine": "string"
    }
  ],
  "yearEndSummary": {
    "mostPlayed": ["string"],
    "biggestImprovements": [
      { "metric": "winRate|kda|csPerMin|visionPerMin|goldPerMin", "from": 0.0, "to": 0.0, "period": "YYYY-MM..YYYY-MM" }
    ],
    "funFacts": ["string"]
  },
  "socialComparisons": {
    "hasFriendData": false,
    "notes": ["string"], 
    "suggestions": ["string"]
  },
  "shareableMoments": {
    "tweetLength": ["string"],
    "storyLength": ["string"],
    "cardIdeas": [
      { "title": "string", "subtitle": "string", "metrics": [{ "label": "string", "value": "string" }] }
    ]
  }
}
Rules & tie-breakers:
- If two champions tie on win rate, prefer the one with more games; if still tied, higher avgKDA; if still tied, higher win rate in the latest month.
- For any division by zero (e.g., D=0), clamp denominator to 1.
- If durations are missing, set per-minute metrics to null and add a dataQuality warning.
- Use 3-5 keypointsForImprovement, each uniquely actionable.
- Remember: Output must be a single JSON object (no extra commentary).
`;

module.exports = {
  fetchRiot,
  projectMatches,
  systemPrompt,
};
