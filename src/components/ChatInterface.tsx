"use client";

import { useState, useRef, useEffect } from "react";
import { SUBSCRIPTION_STEPS, StepId, ConversationData } from "@/lib/subscription-flow";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const STEP_DATA_MAP: Record<StepId, keyof ConversationData | null> = {
  welcome: "vehicleType",
  vehicle_type: "vehicleType",
  license_plate: "licensePlate",
  vehicle_usage: "vehicleUsage",
  driver_profile: "driverProfile",
  driving_history: "drivingHistory",
  current_insurance: "currentInsurance",
  coverage_choice: "coverageChoice",
  personal_info: "personalInfo",
  summary: null,
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("welcome");
  const [conversationData, setConversationData] = useState<ConversationData>({});
  const [isStarted, setIsStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const sendToAPI = async (userMessages: { role: "user" | "assistant"; content: string }[]) => {
    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: userMessages }),
    });

    if (!response.ok) throw new Error("Erreur API");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullContent += chunk;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: fullContent } : m
        )
      );
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      )
    );

    return fullContent;
  };

  const handleStart = async () => {
    setIsStarted(true);
    setIsLoading(true);
    try {
      await sendToAPI([
        {
          role: "user",
          content: "Bonjour, je souhaite obtenir un devis d'assurance auto avec Leocare.",
        },
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const dataKey = STEP_DATA_MAP[currentStep];
    if (dataKey) {
      setConversationData((prev) => ({ ...prev, [dataKey]: text }));
    }

    const step = SUBSCRIPTION_STEPS[currentStep];
    if (step.nextStep) {
      const nextStep =
        typeof step.nextStep === "function" ? step.nextStep(text) : step.nextStep;
      setCurrentStep(nextStep);
    }

    try {
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      await sendToAPI(apiMessages);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: "Désolé, une erreur est survenue. Veuillez réessayer.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleChoice = (_value: string, label: string) => {
    handleSendMessage(label);
  };

  const currentStepData = SUBSCRIPTION_STEPS[currentStep];
  const showChoices =
    !isLoading &&
    messages.length > 0 &&
    currentStepData.inputType === "choice" &&
    currentStepData.choices;

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--gradient-dark-bg)" }}
    >
      {/* ── Header ── */}
      <header
        className="px-5 py-3 flex items-center gap-3 flex-shrink-0"
        style={{
          background: "var(--dark-surface)",
          borderBottom: "1px solid var(--dark-border)",
          boxShadow: "var(--shadow-dark)",
        }}
      >
        {/* Avatar avec glow */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-deep) 100%)",
            boxShadow: "var(--shadow-glow)",
            color: "#fff",
          }}
        >
          L
        </div>

        <div>
          <p
            className="font-semibold text-sm leading-tight"
            style={{ color: "var(--dark-text)" }}
          >
            Conseiller Leocare
          </p>
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--color-secondary)" }}>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: "var(--color-secondary)", boxShadow: "0 0 6px var(--color-secondary)" }}
            />
            En ligne
          </p>
        </div>

        <div className="ml-auto">
          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{
              background: "var(--dark-surface-3)",
              color: "var(--color-secondary)",
              border: "1px solid var(--dark-border)",
            }}
          >
            Assurance Auto
          </span>
        </div>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {!isStarted ? (
          /* ── Splash screen ── */
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 px-4">
            {/* Logo avec halo */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{ background: "var(--color-primary)", transform: "scale(1.4)" }}
              />
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center font-bold text-4xl"
                style={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-deep) 100%)",
                  boxShadow: "var(--shadow-glow), var(--shadow-dark)",
                  color: "#fff",
                  fontFamily: "var(--font-display)",
                }}
              >
                L
              </div>
            </div>

            <div className="space-y-3">
              <h2
                className="text-3xl leading-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--dark-text)",
                }}
              >
                Votre assurance auto
                <br />
                <span style={{ color: "var(--color-secondary)" }}>en quelques minutes</span>
              </h2>
              <p className="text-base max-w-sm mx-auto" style={{ color: "var(--dark-text-muted)" }}>
                Notre conseiller IA Leocare vous guide pour trouver la meilleure
                offre adaptée à votre profil.
              </p>
            </div>

            {/* Value props */}
            <div
              className="rounded-2xl px-6 py-4 space-y-3 w-full max-w-xs"
              style={{
                background: "var(--dark-surface)",
                border: "1px solid var(--dark-border)",
                boxShadow: "var(--shadow-dark)",
              }}
            >
              {[
                { icon: "⚡", text: "Devis en moins de 5 minutes" },
                { icon: "✦", text: "100% digital, sans paperasse" },
                { icon: "◈", text: "Attestation immédiate" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                    style={{
                      background: "var(--dark-surface-3)",
                      color: "var(--color-secondary)",
                      border: "1px solid var(--dark-border)",
                    }}
                  >
                    {icon}
                  </span>
                  <span style={{ color: "var(--dark-text)" }}>{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleStart}
              className="px-8 py-3 rounded-full font-semibold text-base"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-alt) 100%)",
                color: "#fff",
                boxShadow: "var(--shadow-glow)",
                transition: "var(--transition-base)",
                border: "none",
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.boxShadow = "0 0 32px rgba(111,67,214,0.6)";
                btn.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.boxShadow = "var(--shadow-glow)";
                btn.style.transform = "translateY(0)";
              }}
            >
              Démarrer mon devis →
            </button>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } items-end gap-2`}
              >
                {/* Assistant avatar */}
                {message.role === "assistant" && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mb-1"
                    style={{
                      background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-deep) 100%)",
                      boxShadow: "0 0 10px rgba(111,67,214,0.4)",
                      color: "#fff",
                    }}
                  >
                    L
                  </div>
                )}

                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={
                    message.role === "user"
                      ? {
                          background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-alt) 100%)",
                          color: "#fff",
                          borderBottomRightRadius: "4px",
                          boxShadow: "0 2px 12px rgba(111,67,214,0.3)",
                        }
                      : {
                          background: "var(--dark-surface)",
                          color: "var(--dark-text)",
                          borderBottomLeftRadius: "4px",
                          border: "1px solid var(--dark-border)",
                          boxShadow: "var(--shadow-dark)",
                        }
                  }
                >
                  {message.content}
                  {message.isStreaming && (
                    <span
                      className="inline-block w-0.5 h-4 ml-1 animate-pulse rounded-full"
                      style={{ background: "var(--color-secondary)" }}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Quick reply choices */}
            {showChoices && (
              <div className="flex flex-wrap gap-2 pl-9">
                {currentStepData.choices!.map((choice) => (
                  <button
                    key={choice.value}
                    onClick={() => handleChoice(choice.value, choice.label)}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{
                      background: "var(--dark-surface-2)",
                      border: "1px solid var(--dark-border)",
                      color: "var(--color-secondary)",
                      transition: "var(--transition-base)",
                    }}
                    onMouseEnter={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      btn.style.background = "var(--color-primary)";
                      btn.style.color = "#fff";
                      btn.style.borderColor = "var(--color-primary)";
                      btn.style.boxShadow = "0 0 12px rgba(111,67,214,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      btn.style.background = "var(--dark-surface-2)";
                      btn.style.color = "var(--color-secondary)";
                      btn.style.borderColor = "var(--dark-border)";
                      btn.style.boxShadow = "none";
                    }}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-end gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-deep) 100%)",
                    color: "#fff",
                  }}
                >
                  L
                </div>
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{
                    background: "var(--dark-surface)",
                    border: "1px solid var(--dark-border)",
                    boxShadow: "var(--shadow-dark)",
                  }}
                >
                  <div className="flex gap-1.5 items-center h-4">
                    {["0s", "0.15s", "0.3s"].map((delay) => (
                      <span
                        key={delay}
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          background: "var(--color-primary)",
                          animationDelay: delay,
                          boxShadow: "0 0 6px rgba(111,67,214,0.5)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input bar ── */}
      {isStarted && (
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{
            background: "var(--dark-surface)",
            borderTop: "1px solid var(--dark-border)",
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex gap-2 items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentStepData.hint || "Tapez votre réponse…"}
              disabled={isLoading}
              className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none disabled:opacity-50"
              style={{
                background: "var(--dark-surface-2)",
                color: "var(--dark-text)",
                border: "1px solid var(--dark-border)",
                transition: "var(--transition-base)",
              }}
              onFocus={(e) => {
                const el = e.currentTarget as HTMLInputElement;
                el.style.borderColor = "var(--color-primary)";
                el.style.boxShadow = "0 0 0 3px rgba(111,67,214,0.2)";
              }}
              onBlur={(e) => {
                const el = e.currentTarget as HTMLInputElement;
                el.style.borderColor = "var(--dark-border)";
                el.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-alt) 100%)",
                color: "#fff",
                boxShadow: "0 0 12px rgba(111,67,214,0.4)",
                transition: "var(--transition-base)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(111,67,214,0.7)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(111,67,214,0.4)";
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path
                  d="M22 2L11 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
          <p className="text-center text-xs mt-2" style={{ color: "var(--dark-text-subtle)" }}>
            Propulsé par Leocare · Vos données sont sécurisées
          </p>
        </div>
      )}
    </div>
  );
}
