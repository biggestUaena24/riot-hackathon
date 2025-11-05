import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import { extractAnalysis } from "../utils/extractAnalysis";

export default function ReportShowcase({ data, onExit }) {
  const parsed = extractAnalysis(data);

  const [ddVersion, setDdVersion] = useState(null);
  const DD_BASE = "https://ddragon.leagueoflegends.com";
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const resp = await fetch(`${DD_BASE}/api/versions.json`);
        const versions = await resp.json();
        if (!ignore && Array.isArray(versions) && versions.length) {
          setDdVersion(versions[0]);
        }
      } catch {
        // skip
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);
  const champIcon = (champ) =>
    ddVersion
      ? `${DD_BASE}/cdn/${ddVersion}/img/champion/${encodeURIComponent(
          champ
        )}.png`
      : null;
  const splashArt = (champ, skin = 0) =>
    `${DD_BASE}/cdn/img/champion/splash/${encodeURIComponent(
      champ
    )}_${skin}.jpg`;

  const meta = parsed?.meta ?? {};
  const overview = parsed?.overview ?? {};
  const mostPlayed = Array.isArray(parsed?.mostPlayedChampions)
    ? parsed.mostPlayedChampions
    : [];
  const highestWR = parsed?.highestWinRateChampion ?? {};
  const sAndW = parsed?.strengthsAndWeaknesses ?? {
    strengths: [],
    weaknesses: [],
  };
  const kpis = Array.isArray(parsed?.keypointsForImprovement)
    ? parsed.keypointsForImprovement
    : [];
  const highlights = Array.isArray(parsed?.highlightMatches)
    ? parsed.highlightMatches
    : [];
  const yearEnd = parsed?.yearEndSummary ?? {
    mostPlayed: [],
    biggestImprovements: [],
    funFacts: [],
  };
  const share = parsed?.shareableMoments ?? {
    tweetLength: [],
    storyLength: [],
    cardIdeas: [],
  };

  const sections = useMemo(() => {
    const heroChamp =
      highestWR?.champion ||
      mostPlayed?.[0]?.champion ||
      highlights[0]?.champion ||
      "Ashe";

    return [
      {
        key: "overview",
        title: "Performance Overview",
        subtitle: `Matches ${meta.fetchedMatches ?? 0}`,
        bgChamp: heroChamp,
        render: () => <OverviewPanel overview={overview} />,
      },
      {
        key: "champions",
        title: "Most Played Champions",
        subtitle: "Core pool performance",
        bgChamp: mostPlayed?.[0]?.champion || heroChamp,
        render: () => (
          <ChampionsPanel mostPlayed={mostPlayed} champIcon={champIcon} />
        ),
      },
      {
        key: "improvements",
        title: "Key Points for Improvement",
        subtitle: "Prioritized, actionable next steps",
        bgChamp: mostPlayed?.[1]?.champion || heroChamp,
        render: () => <ImprovementsPanel kpis={kpis} />,
      },
      {
        key: "strengths-weaknesses",
        title: "Strengths & Weaknesses",
        subtitle: "Lean in / Fix fast",
        bgChamp: mostPlayed?.[2]?.champion || heroChamp,
        render: () => <StrengthsWeaknessesPanel sAndW={sAndW} />,
      },
      {
        key: "highlights",
        title: "Highlight Matches",
        subtitle: "Top performances with score breakdown",
        bgChamp: highlights?.[0]?.champion || heroChamp,
        render: () => (
          <HighlightsPanel highlights={highlights} splashArt={splashArt} />
        ),
      },
      {
        key: "year-end",
        title: "Year-End Summary",
        subtitle: "Fun, shareable highlights",
        bgChamp: mostPlayed?.[3]?.champion || heroChamp,
        render: () => (
          <YearEndPanel
            yearEnd={yearEnd}
            champIcon={champIcon}
            splashArt={splashArt}
          />
        ),
      },
      {
        key: "share",
        title: "Shareable Moments",
        subtitle: "Ready-to-post snippets & cards",
        bgChamp: mostPlayed?.[4]?.champion || heroChamp,
        render: () => <ShareablesPanel share={share} />,
      },
      {
        key: "quality",
        title: "Data Quality",
        subtitle: "Caveats & gaps",
        bgChamp: heroChamp,
        render: () => <QualityPanel warnings={meta?.dataQuality?.warnings} />,
      },
    ];
  }, [JSON.stringify(parsed), ddVersion]);

  const [i, setI] = useState(0);
  const [dir, setDir] = useState(0);
  const cur = sections[i];

  const canPrev = i > 0;
  const canNext = i < sections.length - 1;

  const go = (nextIdx) => {
    if (nextIdx < 0 || nextIdx >= sections.length) return;
    setDir(nextIdx > i ? 1 : -1);
    setI(nextIdx);
  };
  const next = () => canNext && go(i + 1);
  const prev = () => canPrev && go(i - 1);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onSwipe = (e) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - (onSwipe._x || t.clientX);
    if (Math.abs(dx) > 60) {
      dx < 0 ? next() : prev();
    }
  };
  const onTouchStart = (e) => {
    onSwipe._x = e.touches?.[0]?.clientX;
  };

  const bgUrl = cur?.bgChamp ? splashArt(cur.bgChamp) : null;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onSwipe}
    >
      <div className="absolute inset-0 -z-10">
        {bgUrl && (
          <Motion.img
            key={bgUrl}
            src={bgUrl}
            alt="section background"
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.16, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0b1522]/90 to-black" />
        <div className="absolute inset-0 backdrop-blur-[1.5px]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_80%_0%,rgba(200,170,110,.12),transparent_50%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 pt-6 pb-2 flex items-center justify-between">
        <div>
          <div className="text-[#c8aa6e] uppercase tracking-[.22em] text-xs">
            Summoner Report
          </div>
          <div className="text-[13px] text-gray-200 mt-1">
            {meta?.rateLimited && (
              <span className="text-amber-300">Partial (rate-limited)</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm text-white"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <Motion.div
              className="h-full bg-[#c8aa6e]"
              initial={{ width: 0 }}
              animate={{ width: `${((i + 1) / sections.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <div className="text-xs tabular-nums text-gray-200">
            {String(i + 1).padStart(2, "0")}/
            {String(sections.length).padStart(2, "0")}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {sections.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => go(idx)}
              className={`h-1.5 flex-1 rounded-full ${
                idx === i ? "bg-white/70" : "bg-white/20 hover:bg-white/30"
              }`}
              aria-label={`Go to ${s.title}`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6 min-h-[70vh] flex flex-col">
        <Motion.div
          key={cur.key}
          className="flex-1"
          initial={{ opacity: 0, x: dir > 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir > 0 ? -40 : 40 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <header className="mb-4">
            <div className="text-[#c8aa6e] uppercase tracking-[.18em] text-[10px]">
              {cur.subtitle}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {cur.title}
            </h1>
            <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-[#c8aa6e]/40 to-transparent" />
          </header>

          <div className="grid">{cur.render()}</div>
        </Motion.div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={!canPrev}
            className={`px-4 py-2 rounded-lg border text-sm transition text-white ${
              canPrev
                ? "bg-white/10 hover:bg-white/15 border-white/15"
                : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
            }`}
          >
            ← Back
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className={`px-4 py-2 rounded-lg border text-sm transition ${
              canNext
                ? "bg-[#c8aa6e] text-black hover:brightness-110 border-[#c8aa6e]/80"
                : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed text-white"
            }`}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({ overview }) {
  const pct = (n, d = 1) =>
    n == null ? "—" : `${(Number(n) * 100).toFixed(d)}%`;
  const roles = overview?.roleDistribution || [];

  return (
    <div className="grid lg:grid-cols-5 md:grid-cols-3 grid-cols-2 gap-4">
      <KpiCardAnimated
        label="Win Rate"
        value={overview.winRate}
        format="percent"
      />
      <KpiCardAnimated label="Avg KDA" value={overview.avgKDA} />
      <KpiCardAnimated label="CS / min" value={overview.avgCsPerMin} />
      <KpiCardAnimated label="Gold / min" value={overview.avgGoldPerMin} />
      <KpiCardAnimated label="Vision / min" value={overview.avgVisionPerMin} />

      <div className="lg:col-span-5 md:col-span-3 col-span-2 lol-panel p-4 mt-2">
        <div className="text-xs uppercase tracking-widest text-[#c8aa6e] mb-2">
          Role Distribution
        </div>
        <div className="space-y-3">
          {roles.map((r, idx) => (
            <Motion.div
              key={idx}
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.04 }}
            >
              <Motion.div
                className="h-2.5 rounded-full bg-white/50"
                initial={{ width: 0 }}
                whileInView={{
                  width: `${Math.min(100, Math.max(0, (r.share ?? 0) * 100))}%`,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <div className="text-sm text-gray-100 w-28">{r.role}</div>
              <div className="text-sm text-gray-100">
                {r.games} games • {pct(r.winRate)} WR
              </div>
            </Motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChampionsPanel({ mostPlayed, champIcon }) {
  const round = (n, d = 2) => (n == null ? "—" : Number(n).toFixed(d));
  const pct = (n, d = 1) =>
    n == null ? "—" : `${(Number(n) * 100).toFixed(d)}%`;
  return (
    <Motion.div
      className="grid md:grid-cols-2 gap-4"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {mostPlayed.map((c) => (
        <Motion.div
          key={c.champion}
          className="flex items-center gap-4 bg-white/10 rounded-xl p-3 border border-white/20 hover:bg-white/[0.14] transition-colors"
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0 },
          }}
        >
          <ChampIcon icon={champIcon(c.champion)} champ={c.champion} />
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2 text-white">
              {c.champion}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-gray-300">
                {c.games} games
              </span>
            </div>
            <div className="text-xs text-gray-200">{pct(c.winRate)} WR</div>
            <div className="text-xs text-gray-200">
              KDA {round(c.avgKDA)} • CS {round(c.csPerMin)} • G{" "}
              {round(c.goldPerMin)} • V {round(c.visionPerMin)}
            </div>
          </div>
        </Motion.div>
      ))}
    </Motion.div>
  );
}

function ImprovementsPanel({ kpis }) {
  return (
    <Motion.ol
      className="space-y-3"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {kpis
        .slice()
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
        .map((k, i) => (
          <Motion.li
            key={i}
            className="bg-white/10 border border-white/10 rounded-lg p-4"
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
          >
            <div className="flex items-start gap-3">
              <div className="text-[#c8aa6e] font-bold mt-0.5">
                {k.priority ?? i + 1}
              </div>
              <div>
                <div className="font-semibold text-white">{k.what}</div>
                <div className="text-sm text-gray-100">Why: {k.why}</div>
                {k.how && (
                  <div className="text-sm text-gray-100">How: {k.how}</div>
                )}
                {k.expectedImpact && (
                  <div className="text-xs text-gray-200 mt-1">
                    Expected impact: {k.expectedImpact}
                  </div>
                )}
              </div>
            </div>
          </Motion.li>
        ))}
    </Motion.ol>
  );
}

function StrengthsWeaknessesPanel({ sAndW }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Motion.div
        className="lol-panel p-5"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="text-xs uppercase tracking-widest text-[#c8aa6e] mb-2">
          Strengths
        </div>
        <Motion.ul
          className="space-y-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {(sAndW.strengths || []).map((s, i) => (
            <Motion.li
              key={i}
              className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3"
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <div className="text-emerald-300 font-medium">{s.insight}</div>
              <div className="text-xs text-emerald-100/95 mt-1">
                {s.evidence}
              </div>
            </Motion.li>
          ))}
        </Motion.ul>
      </Motion.div>

      <Motion.div
        className="lol-panel p-5"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="text-xs uppercase tracking-widest text-[#c8aa6e] mb-2">
          Weaknesses
        </div>
        <Motion.ul
          className="space-y-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {(sAndW.weaknesses || []).map((w, i) => (
            <Motion.li
              key={i}
              className="bg-rose-900/25 border border-rose-500/20 rounded-lg p-3"
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <div className="text-rose-300 font-medium">{w.insight}</div>
              <div className="text-xs text-rose-100/95 mt-1">{w.evidence}</div>
              {w.suggestion && (
                <div className="text-xs text-rose-50/95 mt-1 italic">
                  Suggestion: {w.suggestion}
                </div>
              )}
            </Motion.li>
          ))}
        </Motion.ul>
      </Motion.div>
    </div>
  );
}

function HighlightsPanel({ highlights, splashArt }) {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return (
      <div className="lol-panel p-5 text-gray-300">
        No highlight matches to show.
      </div>
    );
  }
  return <HighlightCarousel highlights={highlights} splashArt={splashArt} />;
}

function HighlightCarousel({ highlights, splashArt }) {
  const [idx, setIdx] = useState(0);
  const wrap = (n) => (n + highlights.length) % highlights.length;

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") setIdx((i) => wrap(i + 1));
    if (e.key === "ArrowLeft") setIdx((i) => wrap(i - 1));
  };

  const [dir, setDir] = useState(0);
  const go = (next) => {
    const nextIdx = wrap(next);
    setDir(nextIdx > idx ? 1 : -1);
    setIdx(nextIdx);
  };

  const touchX = useRef(null);
  const onTouchStart = (e) => {
    touchX.current = e.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    const start = touchX.current;
    const end = e.changedTouches?.[0]?.clientX ?? null;
    touchX.current = null;
    if (start == null || end == null) return;
    const dx = end - start;
    const threshold = 60;
    if (dx < -threshold) go(idx + 1);
    else if (dx > threshold) go(idx - 1);
  };

  const cur = highlights[idx];
  const round = (n, d = 2) => (n == null ? "—" : Number(n).toFixed(d));
  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative w-full h-[420px] md:h-[520px] rounded-2xl overflow-hidden border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#c8aa6e]/60"
      aria-roledescription="carousel"
      aria-label="Highlight Matches"
    >
      <div className="absolute inset-0 bg-black" />
      <Motion.img
        key={`${cur.champion}-${idx}`}
        src={splashArt(cur.champion)}
        alt={`${cur.champion} splash art`}
        className="absolute inset-0 w-full h-full object-contain"
        initial={{ scale: 1.02, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        draggable={false}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/80" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_15%_0%,rgba(200,170,110,.12),transparent_60%)]" />
      <div className="absolute inset-0 backdrop-blur-[0.5px]" />

      <Motion.div
        key={`content-${idx}`}
        className="relative h-full flex items-end"
        initial={{ x: dir >= 0 ? 44 : -44, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: dir >= 0 ? -44 : 44, opacity: 0 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        <div className="w-full p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-[11px] uppercase tracking-widest rounded bg-white/10 border border-white/15 text-[#c8aa6e]">
                Highlight
              </span>
              <span className="text-xs text-gray-200/90">
                {cur.role || "—"} • {cur.matchId}
              </span>
            </div>
            <div className="text-xs text-gray-200/80">
              {idx + 1}/{highlights.length}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
                {cur.champion}
              </h3>
              {cur.oneLine && (
                <p className="mt-2 max-w-2xl text-sm sm:text-base text-gray-100/95">
                  {cur.oneLine}
                </p>
              )}
            </div>

            <Motion.div
              className="md:mb-1 inline-flex items-center gap-2 rounded-full bg-black/40 border border-white/15 px-3 py-1.5"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.3 }}
              aria-label="KDA summary"
            >
              <span className="text-xs text-gray-300">KDA</span>
              <span className="text-sm font-semibold text-white">
                {cur?.scoreBreakdown?.kda ?? "—"}
              </span>
            </Motion.div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <GlassStat
              label="Score"
              value={round(cur?.scoreBreakdown?.total ?? 0, 2)}
            />
            <GlassStat
              label="Win bonus"
              value={round(cur?.scoreBreakdown?.winBonus ?? 0)}
            />
            <GlassStat
              label="DMG / min"
              value={round(cur?.scoreBreakdown?.dmgDealtPerMin ?? 0)}
            />
            <GlassStat
              label="Objectives"
              value={`Baron ${
                cur?.scoreBreakdown?.objectivesImpact?.baron ?? 0
              } · Dragon ${
                cur?.scoreBreakdown?.objectivesImpact?.dragon ?? 0
              } · Tower ${
                cur?.scoreBreakdown?.objectivesImpact?.tower ?? 0
              } · Herald ${cur?.scoreBreakdown?.objectivesImpact?.herald ?? 0}`}
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[.18em] text-[#c8aa6e]">
              Tap/Swipe on mobile • Use ←/→ • Buttons below
            </div>
            <div className="flex items-center gap-2">
              <CarouselButton
                onClick={() => go(idx - 1)}
                ariaLabel="Previous highlight"
              >
                ←
              </CarouselButton>
              <CarouselButton
                onClick={() => go(idx + 1)}
                ariaLabel="Next highlight"
                primary
              >
                →
              </CarouselButton>
            </div>
          </div>
        </div>
      </Motion.div>

      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
        {highlights.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx
                ? "w-6 bg-[#c8aa6e]"
                : "w-2.5 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to highlight ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function GlassStat({ label, value }) {
  return (
    <Motion.div
      className="rounded-xl px-3 py-2.5 bg-white/10 border border-white/15 text-white"
      initial={{ y: 10, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-[11px] uppercase tracking-widest text-[#c8aa6e] mb-0.5">
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </Motion.div>
  );
}

function CarouselButton({ children, onClick, ariaLabel, primary = false }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`px-3 py-1.5 rounded-lg border text-sm transition ${
        primary
          ? "bg-[#c8aa6e] text-black hover:brightness-110 border-[#c8aa6e]/80"
          : "bg-white/10 hover:bg-white/15 border-white/15 text-white"
      }`}
    >
      {children}
    </button>
  );
}

function YearEndPanel({ yearEnd, champIcon, splashArt }) {
  const mapToDdragonId = (name) => {
    if (!name) return null;
    const n = String(name).trim().toLowerCase();

    const alias = {
      "kai'sa": "Kaisa",
      kaisa: "Kaisa",
      "miss fortune": "MissFortune",
      missfortune: "MissFortune",
      "dr mundo": "DrMundo",
      "dr. mundo": "DrMundo",
      drmundo: "DrMundo",
      wukong: "MonkeyKing",
      "vel'koz": "Velkoz",
      velkoz: "Velkoz",
      "cho'gath": "Chogath",
      chogath: "Chogath",
      "kog'maw": "KogMaw",
      kogmaw: "KogMaw",
      "jarvan iv": "JarvanIV",
      jarvaniv: "JarvanIV",
      "lee sin": "LeeSin",
      leesin: "LeeSin",
      "twisted fate": "TwistedFate",
      twistedfate: "TwistedFate",
      "xin zhao": "XinZhao",
      xinzhao: "XinZhao",
      "renata glasc": "Renata",
      renataglasc: "Renata",
      "nunu & willump": "Nunu",
      "nunu and willump": "Nunu",
      "nunu&willump": "Nunu",
    };

    if (alias[n]) return alias[n];

    const pascalGuess = n
      .split(/[^a-z0-9]/g)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");

    return pascalGuess || null;
  };

  const rawList = Array.isArray(yearEnd.mostPlayed) ? yearEnd.mostPlayed : [];
  const names = rawList
    .map((c) => (typeof c === "string" ? c : c?.champion))
    .filter(Boolean);

  const heroId =
    mapToDdragonId(names[0]).replace(/\d.*$/, "") ||
    mapToDdragonId(names.find(Boolean)).replace(/\d.*$/, "") ||
    "Ashe";
  const heroSplash = splashArt(heroId);

  const chips = names
    .map((n) => {
      const id = mapToDdragonId(n).replace(/\d.*$/, "");
      if (!id) return null;
      const icon = champIcon(id);
      const splash = splashArt(id);
      if (!icon && !splash) return null;
      return { name: n, id, icon, splash };
    })
    .filter(Boolean);

  const improvements = Array.isArray(yearEnd.biggestImprovements)
    ? yearEnd.biggestImprovements
    : [];

  return (
    <div className="lol-panel p-0 overflow-hidden">
      <div className="relative h-56 sm:h-64 md:h-72">
        {heroSplash && (
          <img
            src={heroSplash}
            alt="Year-end hero"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "50% 25%" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/85" />
        <div className="absolute bottom-4 left-5 right-5">
          <div className="text-[#c8aa6e] uppercase tracking-[.22em] text-xs sm:text-[13px]">
            Year in Review
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.65)]">
            Your Highlights & Biggest Gains
          </h2>
        </div>
      </div>

      <div className="p-5 sm:p-6 md:p-7 text-gray-100">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="text-sm text-[#c8aa6e] uppercase tracking-[.18em]">
              Most Played Champions
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {chips.length === 0 ? (
                <span className="text-gray-300">
                  No champion visuals available.
                </span>
              ) : (
                chips.slice(0, 6).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2"
                  >
                    {c.icon ? (
                      <img
                        src={c.icon}
                        alt={`${c.name} icon`}
                        className="w-7 h-7 rounded-md ring-1 ring-[#c8aa6e]/40 object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-white/10 ring-1 ring-white/15" />
                    )}
                    <span className="text-base font-semibold">{c.name}</span>
                  </div>
                ))
              )}
            </div>

            {chips.filter((c) => c.splash).length > 1 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {chips
                  .filter((c) => c.splash)
                  .slice(0, 5)
                  .map((c, i) => (
                    <div
                      key={`${c.id}-${i}`}
                      className="relative rounded-lg overflow-hidden border border-white/20"
                    >
                      <img
                        src={c.splash}
                        alt={`${c.name} splash`}
                        className="w-full h-28 sm:h-24 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-1 left-2 text-sm font-semibold">
                        {c.name}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm text-[#c8aa6e] uppercase tracking-[.18em]">
              Biggest Improvements
            </div>
            <ul className="mt-3 space-y-3">
              {improvements.length === 0 ? (
                <li className="text-gray-300">No improvement data.</li>
              ) : (
                improvements.map((b, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-emerald-400/25 bg-emerald-900/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-semibold text-emerald-200">
                        {String(b.metric || "").toUpperCase()}
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/30">
                        {b.period}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="mt-7">
          <div className="text-sm text-[#c8aa6e] uppercase tracking-[.18em]">
            Fun Facts
          </div>
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {Array.isArray(yearEnd.funFacts) && yearEnd.funFacts.length > 0 ? (
              yearEnd.funFacts.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-white/20 bg-white/10 p-3"
                >
                  <span className="text-xl leading-none">★</span>
                  <p className="text-base">{f}</p>
                </div>
              ))
            ) : (
              <div className="text-gray-300">No fun facts yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareablesPanel({ share }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 text-white">
      <div className="lol-panel p-5">
        <div className="text-xs text-gray-200 mb-1">Achivements!!</div>
        <ul className="space-y-2">
          {(share.tweetLength || []).map((t, i) => (
            <li
              key={i}
              className="bg-white/10 border border-white/20 rounded-md p-2 text-sm"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="lol-panel p-5">
        <div className="text-xs text-gray-400 mb-1">Key Recaps</div>
        <ul className="space-y-2">
          {(share.storyLength || []).map((t, i) => (
            <li
              key={i}
              className="bg-white/10 border border-white/20 rounded-md p-2 text-sm"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>

      {Array.isArray(share.cardIdeas) && share.cardIdeas.length > 0 && (
        <div className="lg:col-span-2 lol-panel p-5">
          <div className="text-xs text-gray-400 mb-1">Stats display</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {share.cardIdeas.map((c, i) => (
              <div
                key={i}
                className="rounded-lg bg-white/10 border border-white/20 p-3"
              >
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-gray-300 mb-2">{c.subtitle}</div>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-200">
                  {(c.metrics || []).map((m, j) => (
                    <div
                      key={j}
                      className="bg-black/30 rounded px-2 py-1 flex items-center justify-between"
                    >
                      <span className="text-gray-200">{m.label}</span>
                      <span className="font-mono text-white">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QualityPanel({ warnings }) {
  if (!Array.isArray(warnings) || !warnings.length) {
    return <div className="text-gray-400 text-sm">No warnings.</div>;
  }
  return (
    <div className="lol-panel p-5">
      <ul className="mt-1 list-disc list-inside text-sm text-amber-100">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function KpiCardAnimated({ label, value, format }) {
  const display = useCountUp(value, { duration: 900, format });
  return (
    <Motion.div
      className="lol-panel p-4 text-center"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-xs uppercase tracking-widest text-[#c8aa6e]">
        {label}
      </div>
      <div className="text-2xl font-extrabold mt-1 tabular-nums text-white">
        {display ?? "—"}
      </div>
    </Motion.div>
  );
}

function ChampIcon({ icon, champ, size = 56 }) {
  return icon ? (
    <img
      src={icon}
      alt={`${champ} icon`}
      width={size}
      height={size}
      className="rounded-md ring-1 ring-[#c8aa6e]/40 object-cover"
      draggable={false}
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-md ring-1 ring-white/20 bg-white/10"
    />
  );
}

function useCountUp(target, { duration = 800, format } = {}) {
  const [v, setV] = useState(null);
  const ref = useRef({ start: 0, from: 0, to: 0 });

  useEffect(() => {
    if (typeof target !== "number" || isNaN(target)) {
      setV(null);
      return;
    }
    const from = 0;
    const to = target;
    const start = performance.now();
    ref.current = { start, from, to };

    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      setV(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  if (v == null) return "—";
  if (format === "percent") return `${(v * 100).toFixed(1)}%`;
  return Number(v).toFixed(2);
}
