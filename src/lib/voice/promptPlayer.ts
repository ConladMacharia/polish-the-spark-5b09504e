/**
 * Voice prompt player for the live session.
 *
 * - Plays recorded mp3s from public/voice/<lang>/<CODE>.mp3
 * - Falls back to the built-in English speech voice when no recording exists
 * - Never overlaps: one prompt at a time, queued by priority
 * - Fires 1–2 s after the trigger, respects per-prompt cooldown and TTL
 */

import { PROMPTS_BY_CODE, fillVars, type VoicePromptDef } from "./prompts";

const TRIGGER_DELAY_MS = 1400; // 1–2 s after the trigger
const MAX_QUEUE = 4;

interface QueueItem {
  def: VoicePromptDef;
  vars?: Record<string, string | number>;
  /** Time after which the item is stale and dropped. */
  expiresAt: number;
  banner?: (text: string, ms: number) => void;
}

type LangResolver = () => string;

class PromptPlayer {
  private audio: HTMLAudioElement | null = null;
  private queue: QueueItem[] = [];
  private playing = false;
  private lastPlayed = new Map<string, number>();
  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private getLang: LangResolver = () => "en";
  private unlocked = false;
  private missing = new Set<string>(); // "lang/CODE" known to have no recording
  private enabled = true;

  setLanguageResolver(fn: LangResolver) {
    this.getLang = fn;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
  }

  /** Call from a user gesture (e.g. "Begin session") so mobile allows audio. */
  unlock() {
    if (this.unlocked || typeof window === "undefined") return;
    this.unlocked = true;
    try {
      const a = new Audio();
      a.muted = true;
      void a.play().catch(() => {});
      this.audio = a;
    } catch {
      /* ignore */
    }
  }

  /** Queue a prompt; it starts ~1.5 s later if nothing else is speaking. */
  play(
    code: string,
    opts?: {
      vars?: Record<string, string | number>;
      banner?: (text: string, ms: number) => void;
    },
  ) {
    if (!this.enabled || typeof window === "undefined") return;
    const def = PROMPTS_BY_CODE[code];
    if (!def) return;

    const now = Date.now();
    const last = this.lastPlayed.get(code) ?? 0;
    if (now - last < def.cooldownMs) return;
    if (this.queue.some((q) => q.def.code === code)) return;

    const item: QueueItem = {
      def,
      vars: opts?.vars,
      expiresAt: now + TRIGGER_DELAY_MS + def.ttlMs,
      banner: opts?.banner,
    };

    this.queue.push(item);
    this.queue.sort((a, b) => b.def.priority - a.def.priority);
    if (this.queue.length > MAX_QUEUE) this.queue.length = MAX_QUEUE;

    this.schedule();
  }

  private schedule() {
    if (this.playing || this.delayTimer) return;
    this.delayTimer = setTimeout(() => {
      this.delayTimer = null;
      void this.next();
    }, TRIGGER_DELAY_MS);
  }

  private async next() {
    const now = Date.now();
    this.queue = this.queue.filter((q) => q.expiresAt > now);
    const item = this.queue.shift();
    if (!item) return;

    this.playing = true;
    this.lastPlayed.set(item.def.code, Date.now());

    const text = fillVars(item.def.en, item.vars);
    item.banner?.(text, item.def.bannerMs);

    try {
      const played = await this.playRecording(item.def.code);
      if (!played) await this.speakEnglish(text);
    } catch {
      /* ignore playback errors */
    } finally {
      this.playing = false;
      if (this.queue.length) this.schedule();
    }
  }

  private playRecording(code: string): Promise<boolean> {
    const lang = this.getLang() || "en";
    const key = `${lang}/${code}`;
    if (this.missing.has(key)) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const audio = this.audio ?? new Audio();
      this.audio = audio;
      audio.muted = false;
      audio.onended = () => finish(true);
      audio.onerror = () => {
        this.missing.add(key);
        finish(false);
      };
      audio.src = `/voice/${lang}/${code}.mp3`;
      void audio.play().catch(() => {
        this.missing.add(key);
        finish(false);
      });

      // Safety net: never hang the queue.
      setTimeout(() => finish(true), 12000);
    });
  }

  private speakEnglish(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 0.92;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
        setTimeout(resolve, 12000);
      } catch {
        resolve();
      }
    });
  }

  stopAll() {
    this.queue = [];
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    this.playing = false;
    try {
      this.audio?.pause();
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }
}

export const promptPlayer = new PromptPlayer();
