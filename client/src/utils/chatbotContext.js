const CHATBOT_CONTEXT_STORAGE_KEY = "placement-chatbot-context";


export const readChatbotContext = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CHATBOT_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};


export const saveChatbotContext = (value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CHATBOT_CONTEXT_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch {
    // Ignore storage failures and keep chat usable.
  }
};
