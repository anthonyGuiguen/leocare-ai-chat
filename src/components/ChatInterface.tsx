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
          content:
            "Bonjour, je souhaite obtenir un devis d'assurance auto avec Leocare.",
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

  const handleChoice = (value: string, label: string) => {
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
      style={{ background: "var(--color-bg-light)" }}
    >
      {/* Header */}
      <header
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: "var(--color-white)",
          borderBottom: "1px solid #e8e2f5",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: "var(--color-primary)" }}
        >
          L
        </div>

        <div>
          <h1
            className="font-semibold text-sm"
            style={{ color: "#1a1033" }}
          >
            Conseiller Leocare
          </h1>
          <p className="text-xs flex items-center gap-1" style={{ color: "#22c55e" }}>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: "#22c55e" }}
            />
            En ligne
          </p>
        </div>

        <div className="ml-auto">
          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{
              background: "var(--color-primary-light)",
              color: "var(--color-primary)",
            }}
          >
            Assurance Auto
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!isStarted ? (
          /* ── Splash screen ── */
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            {/* Logo avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
              style={{
                background: "var(--color-primary)",
                boxShadow: "var(--shadow-hover)",
              }}
            >
              L
            </div>

            <div>
              <h2
                className="text-2xl mb-2"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-primary-deep)",
                }}
              >
                Votre assurance auto en quelques minutes
              </h2>
              <p className="max-w-sm text-sm" style={{ color: "var(--color-text)" }}>
                Notre conseiller IA Leocare vous guide pour trouver la meilleure
                offre adaptée à votre profil.
              </p>
            </div>

            {/* Value props */}
            <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--color-text)" }}>
              {[
                "Devis en moins de 5 minutes",
                "100% digital, sans paperasse",
                "Attestation immédiate",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: "var(--color-secondary)",
                      color: "var(--color-primary-deep)",
                    }}
                  >
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleStart}
              className="px-8 py-3 rounded-full font-semibold text-white"
              style={{
                background: "var(--color-primary)",
                transition: "var(--transition-base)",
                boxShadow: "var(--shadow-hover)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-primary-dark)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-primary)")
              }
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
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
                    style={{ background: "var(--color-primary)" }}
                  >
                    L
                  </div>
                )}

                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={
                    message.role === "user"
                      ? {
                          background: "var(--color-primary)",
                          color: "var(--color-white)",
                          borderBottomRightRadius: "4px",
                        }
                      : {
                          background: "var(--color-white)",
                          color: "var(--color-text)",
                          borderBottomLeftRadius: "4px",
                          boxShadow: "var(--shadow-card)",
                          border: "1px solid #ede8f9",
                        }
                  }
                >
                  {message.content}
                  {message.isStreaming && (
                    <span
                      className="inline-block w-1 h-4 ml-1 animate-pulse rounded-full"
                      style={{ background: "var(--color-primary-alt)" }}
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
                      background: "var(--color-white)",
                      border: "1.5px solid var(--color-primary)",
                      color: "var(--color-primary)",
                      boxShadow: "var(--shadow-card)",
                      transition: "var(--transition-base)",
                    }}
                    onMouseEnter={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      btn.style.background = "var(--color-primary)";
                      btn.style.color = "var(--color-white)";
                    }}
                    onMouseLeave={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      btn.style.background = "var(--color-white)";
                      btn.style.color = "var(--color-primary)";
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
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--color-primary)" }}
                >
                  L
                </div>
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{
                    background: "var(--color-white)",
                    boxShadow: "var(--shadow-card)",
                    border: "1px solid #ede8f9",
                  }}
                >
                  <div className="flex gap-1 items-center h-4">
                    {["-0.3s", "-0.15s", "0s"].map((delay) => (
                      <span
                        key={delay}
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          background: "var(--color-primary-alt)",
                          animationDelay: delay,
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

      {/* Input bar */}
      {isStarted && (
        <div
          className="px-4 py-3"
          style={{
            background: "var(--color-white)",
            borderTop: "1px solid #e8e2f5",
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
                background: "var(--color-primary-light)",
                color: "var(--color-text)",
                border: "1.5px solid transparent",
                transition: "var(--transition-base)",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor =
                  "var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor =
                  "transparent";
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40"
              style={{
                background: "var(--color-primary)",
                transition: "var(--transition-base)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-primary-dark)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-primary)")
              }
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
          <p
            className="text-center text-xs mt-2"
            style={{ color: "#a99ec7" }}
          >
            Propulsé par Leocare · Vos données sont sécurisées
          </p>
        </div>
      )}
    </div>
  );
}
