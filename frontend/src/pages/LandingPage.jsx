import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import LoadingPage from "./LoadingPage"
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const DD_BASE = "https://ddragon.leagueoflegends.com";
  const ddSplash = (champ, skin = 0) =>
  `${DD_BASE}/cdn/img/champion/splash/${encodeURIComponent(champ)}_${skin}.jpg`;

  function makeDDragonSlides() {
  return [
    {
      image: ddSplash("Zeri", 0),
      kicker: "High-Voltage Mechanics",
      title: "Snap your micro",
      subtitle:
        "Last-hits, animation cancels, and fast trades—turn Zeri-speed decisions into muscle memory.",
      alt: "Zeri splash art",
    },
    {
      image: ddSplash("LeeSin", 0),
      kicker: "Tempo & Vision",
      title: "See the map like a pro",
      subtitle:
        "Track timers, sweep vision, and chain objective pressure to force winning fights on your terms.",
      alt: "Lee Sin splash art",
    },
    {
      image: ddSplash("Kaisa", 0),
      kicker: "Consistent Climb",
      title: "Perfect your win conditions",
      subtitle:
        "Draft to your strengths, spike on evolutions, and turn small leads into snowballs.",
      alt: "Kai’Sa splash art",
    },
  ];
}

  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("");
  const [tagline, setTagline] = useState("");
  const [loading, setLoading] = useState(false);
  const [ddVersion, setDdVersion] = useState(null);
  const [slides, _] = useState(makeDDragonSlides());
  
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await resp.json();
        if (Array.isArray(versions) && versions.length > 0) setDdVersion(versions[0]);
      } catch { /* empty */ }
    })();
  }, []);
  const SLIDE_INTERVAL = 5000;
  const intervalRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (isPaused) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [isPaused, prefersReducedMotion]);

  const goTo = (i) => setIndex(i % slides.length);
  const next = () => goTo((index + 1) % slides.length);
  const prev = () => goTo((index - 1 + slides.length) % slides.length);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index]);

  const onSearch = async (rawUser, rawTag) => {
    setLoading(true);
    const u = (rawUser || "").trim();
    const t = (rawTag || "").trim();

    if (!u || !t) {
      setError("Username and tag are required (e.g., Player#NA1).");
      setLoading(false);
      return;
    }

    try {
      const resp = await api.get("/getPuuid", { params: { username: u, tagline: t } });
      const { puuid } = resp.data || {};
      const matchDetails = await api.get("/pullMatchDetail", { params: { puuid } });
      const analysis = matchDetails.data?.analysis;

      try {
        sessionStorage.setItem("riot:analysis", JSON.stringify(analysis));
      } catch {
        // skip
      }

      navigate("/report", { state: { analysis } });
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        status === 404 ? "Account not found. Double-check username and tag."
        : status === 429 ? "Rate limited by Riot API. Please try again shortly."
        : err?.response?.data?.error || "Something went wrong fetching the account.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white flex items-center justify-center px-6 py-12">
      {loading && <LoadingPage ddVersion={ddVersion} />}
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="space-y-6 animate-fadeInUp">
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-indigo-300 drop-shadow-lg">
            Riot Stats Tracker
          </h1>
          <p className="text-gray-300 max-w-xl">
            Search any Riot account to view game stats, recent performance, and
            personalized insights. Enter username and tag (e.g.{" "}
            <span className="text-white">PlayerName#NA1</span>).
          </p>

          <div className="w-full max-w-md">
            <div
              className="flex items-center bg-white/6 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 focus-within:ring-2 focus-within:ring-indigo-500"
              tabIndex={-1}
            >
              <input
                id="riot-username"
                placeholder="Username"
                className="flex-1 px-4 py-3 bg-transparent text-white placeholder-gray-400 focus:outline-none"
                aria-label="Riot username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
              />
              <div className="w-px bg-white/10 h-7" />
              <input
                id="riot-tag"
                placeholder="TAG"
                className="w-24 px-3 py-3 bg-transparent text-white placeholder-gray-400 focus:outline-none text-center"
                aria-label="Riot tag"
                type="text"
                value={tagline}
                onChange={(e) => {
                  setTagline(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                maxLength={5}
              />
            </div>

            <button
              type="button"
              className="mt-4 w-full max-w-md bg-indigo-600 hover:bg-indigo-500 transition-colors py-3 rounded-xl font-semibold disabled:opacity-50"
              onClick={() => onSearch(username, tagline)}
              disabled={!username.trim() || !tagline.trim()}
            >
              Search
            </button>
            {error && (
              <div className="mt-3 rounded-md border border-red-500/40 bg-red-900/30 text-red-200 px-3 py-2 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        <div
          className="relative z-10 w-full max-w-3xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/6">
            <div className="relative w-full h-[22rem] sm:h-[26rem] md:h-[34rem]">
              {slides.map((s, i) => {
                const isActive = i === index;
                return (
                  <img
                    key={s.image}
                    src={s.image}
                    alt={s.alt || s.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-800 ease-in-out ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                    style={
                      isActive && !prefersReducedMotion
                        ? {
                            animation: `kenburns ${
                              SLIDE_INTERVAL * 1.2
                            }ms linear forwards`,
                          }
                        : {}
                    }
                    draggable={false}
                  />
                );
              })}

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

              <div className="absolute left-6 right-6 bottom-6">
                <div className="max-w-xl bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="text-xs uppercase tracking-widest text-indigo-300">
                    {slides[index].kicker}
                  </div>
                  <h3 className="mt-1 text-2xl sm:text-3xl font-bold text-white">
                    {slides[index].title}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-200 leading-relaxed">
                    {slides[index].subtitle}
                  </p>
                </div>
              </div>

              <button
                onClick={prev}
                aria-label="Previous slide"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 p-2 rounded-md hover:bg-black/50 transition"
              >
                ‹
              </button>
              <button
                onClick={next}
                aria-label="Next slide"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 p-2 rounded-md hover:bg-black/50 transition"
              >
                ›
              </button>
            </div>

            <div className="px-4 py-3 bg-black/40 flex items-center gap-3 justify-start">
              {slides.map((s, i) => (
                <button
                  key={s.image}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="focus:outline-none"
                >
                  <img
                    src={s.image}
                    alt={s.caption}
                    className={`carousel-thumb ${
                      i === index ? "carousel-thumb-active" : ""
                    }`}
                    loading="lazy"
                  />
                </button>
              ))}
            </div> 
          </div>
        </div>
      </div>
    </div>
  );
}
