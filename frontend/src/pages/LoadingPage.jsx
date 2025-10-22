import React, { useEffect, useMemo, useState } from "react";

const FUN_FACTS = [
  {
    champ: "Teemo",
    text: "Teemo’s mushrooms grant vision and zone control—track placements like mini-wards.",
  },
  {
    champ: "Thresh",
    text: "Thresh souls scale your armor/AP—roam for picks to farm souls faster.",
  },
  {
    champ: "Blitzcrank",
    text: "Blitz hook threat alone changes pathing—stand fog-side to ‘own’ corridors.",
  },
  {
    champ: "Braum",
    text: "Braum’s shield angles matter—tilt toward AoE casters to block full damage cones.",
  },
  {
    champ: "Vi",
    text: "Vi’s Q buffer lets you start ganks from fog—cancel if vision spots you to save cooldown.",
  },
  {
    champ: "Orianna",
    text: "Ori ball placement is tempo—park it on your diver to ‘pre-arm’ Shockwave.",
  },
  {
    champ: "Ashe",
    text: "Ashe E scouts dragons/Baron for free—time it ~10–15s before spawn for pathing reads.",
  },
  {
    champ: "Shen",
    text: "Shen’s R turns side-lanes into pressure—hover wave 2 before objectives to force TP trade.",
  },
];

function ddIconUrl(version, champName) {
  if (!version || !champName) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${encodeURIComponent(
    champName
  )}.png`;
}

export default function LoadingPage({ ddVersion }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % FUN_FACTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const fact = FUN_FACTS[i];
  const icon = useMemo(
    () => ddIconUrl(ddVersion, fact.champ),
    [ddVersion, fact.champ]
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#0b1522] via-[#0a0f19] to-black/95">
      <div className="relative w-[min(680px,92vw)] rounded-2xl border border-[#c8aa6e]/60 shadow-[0_0_60px_rgba(200,170,110,0.15)] bg-[linear-gradient(180deg,rgba(10,16,26,.9),rgba(7,11,19,.92))] p-6 overflow-hidden lol-brass">
        <span className="pointer-events-none absolute -inset-[1px] rounded-2xl lol-brass-glow" />

        <div className="flex items-center gap-4">
          <div className="rune-ring" aria-hidden />
          <div>
            <div className="text-[#c8aa6e] tracking-[.22em] text-xs uppercase">
              Analyzing match history
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Forging your Summoner’s Chronicle…
            </div>
          </div>
        </div>

        <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-[#c8aa6e]/40 to-transparent" />

        <div className="flex items-center gap-4">
          {icon ? (
            <img
              src={icon}
              alt={`${fact.champ} icon`}
              className="h-12 w-12 rounded-md ring-1 ring-[#c8aa6e]/40"
              draggable={false}
            />
          ) : (
            <div className="h-12 w-12 rounded-md ring-1 ring-[#c8aa6e]/25 bg-white/5" />
          )}
          <div className="flex-1">
            <div className="text-sm text-[#c8aa6e]/85 mb-1">
              Champion Insight
            </div>
            <div className="text-base text-gray-200 leading-relaxed typewriter">
              {fact.text}
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-400/90">
          Tip: we fetch matches in bursts to respect Riot rate limits. This can
          pause briefly if the API responds with
          <span className="text-[#c8aa6e]"> 429</span>.
        </div>
      </div>
    </div>
  );
}
