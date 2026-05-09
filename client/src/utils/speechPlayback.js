const DEFAULT_LANG = "en-IN";

const pickVoice = (voices = [], preferredLang = DEFAULT_LANG) => {
  const normalizedPreferred = String(preferredLang || DEFAULT_LANG).toLowerCase();
  const normalizedBase = normalizedPreferred.split("-")[0];

  return (
    voices.find((voice) => String(voice.lang || "").toLowerCase() === normalizedPreferred) ||
    voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith(normalizedBase)) ||
    voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("en-")) ||
    voices[0] ||
    null
  );
};

const getVoices = (timeoutMs = 1200) =>
  new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    const existingVoices = synth.getVoices();
    if (existingVoices.length) {
      resolve(existingVoices);
      return;
    }

    let settled = false;
    const finish = (voices = []) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      synth.removeEventListener?.("voiceschanged", onVoicesChanged);
      resolve(voices);
    };

    const onVoicesChanged = () => finish(synth.getVoices());
    const timer = window.setTimeout(() => finish(synth.getVoices()), timeoutMs);

    synth.addEventListener?.("voiceschanged", onVoicesChanged);
    synth.getVoices();
  });

export const cancelSpeech = () => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
};

export const speakText = async (
  text,
  {
    lang = DEFAULT_LANG,
    rate = 1,
    pitch = 1,
    volume = 1,
  } = {},
) => {
  if (typeof window === "undefined" || !window.speechSynthesis || !text?.trim()) {
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    const voices = await getVoices();
    const utterance = new SpeechSynthesisUtterance(text.trim());

    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const voice = pickVoice(voices, lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || lang;
    }

    synth.cancel();
    synth.resume?.();
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
};
