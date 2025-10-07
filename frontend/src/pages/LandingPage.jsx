import React, { useEffect, useRef, useState } from "react";

const slides = [
  {
    image: "/images/LandingPage1.jpg",
    caption: "Enhance your skills in different champions",
  },
  {
    image: "/images/LandingPage2.jpg",
    caption: "Play like a pro by seeing some key indicators",
  },
  {
    image: "/images/LandingPage3.jpg",
    caption: "Perfect you gaming skills!",
  },
];
export default function LandingPage() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SLIDE_INTERVAL = 3000;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white flex items-center justify-center px-6 py-12">
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
              />
              <div className="w-px bg-white/10 h-7" />
              <input
                id="riot-tag"
                placeholder="TAG"
                className="w-24 px-3 py-3 bg-transparent text-white placeholder-gray-400 focus:outline-none text-center"
                aria-label="Riot tag"
                type="text"
              />
            </div>

            <button
              type="button"
              className="mt-4 w-full max-w-md bg-indigo-600 hover:bg-indigo-500 transition-colors py-3 rounded-xl font-semibold"
            >
              Search
            </button>
          </div>

          <div className="flex gap-4 mt-3 flex-wrap">
            <span className="text-sm text-gray-400">Fast lookups</span>
            <span className="text-sm text-gray-400">Privacy-first</span>
            <span className="text-sm text-gray-400">Region-aware</span>
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
                    alt={s.caption}
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

              <div className="absolute left-6 bottom-6 right-6 text-left text-indigo-100">
                <div
                  role="status"
                  aria-live="polite"
                  className="text-lg sm:text-xl font-semibold drop-shadow"
                >
                  {slides[index].caption}
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
