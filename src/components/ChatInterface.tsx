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
      const step = SUBSCRIPTION_STEPS["welcome"];
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

    // Save data for current step
    const dataKey = STEP_DATA_MAP[currentStep];
    if (dataKey) {
      setConversationData((prev) => ({ ...prev, [dataKey]: text }));
    }

    // Advance step
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-[#FF5A1F] flex items-center justify-center text-white font-bold text-sm">
          L
        </div>
        <div>
          <h1 className="font-semibold text-gray-900 text-sm">Conseiller Leocare</h1>
          <p className="text-xs text-green-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
            En ligne
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            Assurance Auto
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!isStarted ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#FF5A1F] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              L
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Votre assurance auto en quelques minutes
              </h2>
              <p className="text-gray-500 max-w-sm">
                Notre conseiller IA Leocare vous guide pour trouver la meilleure offre adaptée à votre profil.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-[#FF5A1F]">✓</span> Devis en moins de 5 minutes
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#FF5A1F]">✓</span> 100% digital, sans paperasse
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#FF5A1F]">✓</span> Attestation immédiate
              </div>
            </div>
            <button
              onClick={handleStart}
              className="bg-[#FF5A1F] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#e64d1a] transition-colors shadow-md"
            >
              Démarrer mon devis →
            </button>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
              >
                {message.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-[#FF5A1F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">
                    L
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-[#FF5A1F] text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                  }`}
                >
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-1 h-4 bg-gray-400 ml-1 animate-pulse rounded-full" />
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
                    className="bg-white border border-[#FF5A1F] text-[#FF5A1F] px-4 py-2 rounded-full text-sm hover:bg-[#FF5A1F] hover:text-white transition-colors shadow-sm"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            )}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-[#FF5A1F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  L
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {isStarted && (
        <div className="bg-white border-t border-gray-200 px-4 py-3">
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
              placeholder={
                currentStepData.hint || "Tapez votre réponse..."
              }
              disabled={isLoading}
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FF5A1F] focus:ring-opacity-50 disabled:opacity-50 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 bg-[#FF5A1F] rounded-full flex items-center justify-center text-white disabled:opacity-40 hover:bg-[#e64d1a] transition-colors flex-shrink-0"
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
          <p className="text-center text-xs text-gray-400 mt-2">
            Propulsé par Leocare · Vos données sont sécurisées
          </p>
        </div>
      )}
    </div>
  );
}
