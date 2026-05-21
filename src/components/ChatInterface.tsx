"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
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

const STEP_SECTION_MAP: Record<StepId, string> = {
  welcome: "vehicule",
  vehicle_type: "vehicule",
  license_plate: "vehicule",
  vehicle_usage: "usage",
  driver_profile: "conducteur",
  driving_history: "conducteur",
  current_insurance: "assurance",
  coverage_choice: "assurance",
  personal_info: "coordonnees",
  summary: "coordonnees",
};

const SUMMARY_SECTIONS: {
  id: string;
  title: string;
  fields: { label: string; key: keyof ConversationData }[];
}[] = [
  {
    id: "vehicule",
    title: "Vehicule",
    fields: [
      { label: "Type", key: "vehicleType" },
      { label: "Immatriculation / Modele", key: "licensePlate" },
    ],
  },
  {
    id: "usage",
    title: "Usage",
    fields: [{ label: "Usage principal", key: "vehicleUsage" }],
  },
  {
    id: "conducteur",
    title: "Conducteur",
    fields: [
      { label: "Profil", key: "driverProfile" },
      { label: "Historique", key: "drivingHistory" },
    ],
  },
  {
    id: "assurance",
    title: "Assurance",
    fields: [
      { label: "Assurance actuelle", key: "currentInsurance" },
      { label: "Couverture", key: "coverageChoice" },
    ],
  },
  {
    id: "coordonnees",
    title: "Coordonnees",
    fields: [{ label: "Contact", key: "personalInfo" }],
  },
];

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

  const formatSummaryValue = (key: keyof ConversationData, value?: string) => {
    if (!value || !value.trim()) return "En attente";
    if (key === "personalInfo") {
      const [firstname, email] = value.split(",").map((item) => item.trim());
      if (firstname && email) return `${firstname} - ${email}`;
    }
    return value;
  };

  const collectedCount = Object.values(conversationData).filter(
    (value) => value && value.trim()
  ).length;
  const progressPercent = Math.round((collectedCount / 8) * 100);
  const activeSection = STEP_SECTION_MAP[currentStep];
  const softBorder = "1px solid rgba(164, 150, 209, 0.24)";
  const sectionDivider = "1px solid rgba(164, 150, 209, 0.18)";

  const getFilledFields = (fields: { label: string; key: keyof ConversationData }[]) =>
    fields
      .map((field) => ({
        ...field,
        value: conversationData[field.key],
      }))
      .filter((field) => field.value && field.value.trim());

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 12% 15%, rgba(112,67,209,0.14) 0%, transparent 35%), linear-gradient(165deg, #121826 0%, #1a2235 52%, #131a2a 100%)",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1540px] flex-col px-3 py-4 sm:px-4 sm:py-5 lg:px-8 lg:py-7">
        <header
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4 sm:px-6 sm:py-5"
          style={{
            background: "rgba(29, 19, 63, 0.88)",
            border: softBorder,
            boxShadow: "var(--shadow-dark)",
          }}
        >
          <p className="font-semibold text-xl leading-none sm:text-2xl lg:text-[1.72rem]" style={{ color: "var(--dark-text)" }}>
            Nouveau devis auto
          </p>
          <button
            type="button"
            className="w-full rounded-full px-5 py-2 text-sm font-semibold sm:w-auto"
            style={{
              background: "rgba(239, 62, 62, 0.16)",
              color: "#ffb5b5",
              border: "1px solid rgba(239, 62, 62, 0.5)",
            }}
          >
            Abandonner le devis
          </button>
        </header>

        <div className="mt-4 grid min-h-0 flex-1 gap-4 sm:mt-5 sm:gap-5 lg:mt-6 lg:gap-6 lg:grid-cols-[350px,1fr]">
          <aside
            className="order-2 overflow-hidden rounded-2xl lg:order-1"
            style={{
              background: "rgba(29, 19, 63, 0.9)",
              border: softBorder,
              boxShadow: "var(--shadow-dark)",
            }}
          >
            <div
              className="px-5 py-5"
              style={{ borderBottom: sectionDivider }}
            >
              <p className="text-[1.1rem] font-semibold leading-tight" style={{ color: "var(--dark-text)" }}>
                Infos collectees
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--dark-text-muted)" }}>
                {collectedCount}/8 champs renseignes
              </p>
              <div
                className="mt-2 h-2 rounded-full"
                style={{ background: "var(--dark-surface-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    background:
                      "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-alt) 100%)",
                    transition: "var(--transition-base)",
                  }}
                />
              </div>
            </div>

            <div>
              {SUMMARY_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;
                const filledFields = getFilledFields(section.fields);
                return (
                  <div
                    key={section.id}
                    className="px-5 py-5"
                    style={{
                      background: isActive ? "rgba(46, 29, 94, 0.55)" : "transparent",
                      border: isActive
                        ? "1px solid var(--dark-border-glow)"
                        : "1px solid transparent",
                      borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                      borderRadius: "0px",
                    }}
                  >
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: isActive
                          ? "var(--color-secondary)"
                          : "var(--dark-text)",
                      }}
                    >
                      {section.title}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {filledFields.length > 0 ? (
                        filledFields.map((field) => (
                          <p
                            key={field.key}
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--dark-text-muted)" }}
                          >
                            • {field.label}: {formatSummaryValue(field.key, field.value)}
                          </p>
                        ))
                      ) : (
                        <p className="text-xs" style={{ color: "var(--dark-text-subtle)" }}>
                          En attente
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section
            className="order-1 flex min-h-[62vh] flex-col overflow-hidden rounded-2xl sm:min-h-[66vh] lg:order-2 lg:min-h-0"
            style={{
              background: "rgba(26, 15, 60, 0.9)",
              border: softBorder,
              boxShadow: "var(--shadow-dark)",
            }}
          >
            <header
              className="flex items-center gap-3 border-b px-4 py-3 sm:px-5 sm:py-4"
              style={{ borderColor: "rgba(164, 150, 209, 0.2)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                <Image src="/logo-icon.png" alt="Leocare" width={40} height={40} className="w-full h-full object-cover" />
              </div>

              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: "var(--dark-text)" }}>
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

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sm:px-5 sm:py-6 lg:px-6 lg:py-7">
              {!isStarted ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 px-2 sm:space-y-8 sm:px-4">
                  <div className="space-y-3">
                    <Image
                      src="/logo-wordmark.png"
                      alt="Leocare Assurances"
                      width={240}
                      height={72}
                      className="mx-auto"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                    <p className="text-base max-w-sm mx-auto" style={{ color: "var(--dark-text-muted)" }}>
                      Notre conseiller IA vous guide pour trouver la meilleure
                      offre adaptee a votre profil.
                    </p>
                  </div>

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
                      { icon: "◈", text: "Attestation immediate" },
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
                    Demarrer mon devis ->
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
                      {message.role === "assistant" && (
                        <div
                          className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 mb-1"
                          style={{ boxShadow: "0 0 10px rgba(111,67,214,0.4)" }}
                        >
                          <Image src="/logo-icon.png" alt="Leocare" width={28} height={28} className="w-full h-full object-cover" />
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

                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex items-end gap-2">
                      <div
                        className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ boxShadow: "0 0 10px rgba(111,67,214,0.4)" }}
                      >
                        <Image src="/logo-icon.png" alt="Leocare" width={28} height={28} className="w-full h-full object-cover" />
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

            {isStarted && (
              <div
                className="px-3 py-2.5 flex-shrink-0 sm:px-4 sm:py-3"
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
                    placeholder={currentStepData.hint || "Tapez votre réponse..."}
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
                  Propulse par Leocare - Vos donnees sont securisees
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
