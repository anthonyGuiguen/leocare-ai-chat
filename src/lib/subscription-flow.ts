export type StepId =
  | "welcome"
  | "vehicle_type"
  | "license_plate"
  | "vehicle_usage"
  | "driver_profile"
  | "driving_history"
  | "current_insurance"
  | "coverage_choice"
  | "personal_info"
  | "summary";

export interface SubscriptionStep {
  id: StepId;
  question: string;
  hint?: string;
  inputType: "text" | "choice" | "date" | "number" | "none";
  choices?: { value: string; label: string }[];
  nextStep?: StepId | ((answer: string) => StepId);
}

export const SUBSCRIPTION_STEPS: Record<StepId, SubscriptionStep> = {
  welcome: {
    id: "welcome",
    question:
      "Bonjour ! Je suis votre conseiller Leocare. Je vais vous aider à trouver la meilleure assurance auto en quelques minutes. Commençons par votre véhicule — quel type de véhicule souhaitez-vous assurer ?",
    inputType: "choice",
    choices: [
      { value: "voiture", label: "🚗 Voiture" },
      { value: "moto", label: "🏍️ Moto" },
      { value: "utilitaire", label: "🚐 Utilitaire" },
      { value: "electrique", label: "⚡ Voiture électrique" },
    ],
    nextStep: "license_plate",
  },
  vehicle_type: {
    id: "vehicle_type",
    question: "Quel type de véhicule souhaitez-vous assurer ?",
    inputType: "choice",
    choices: [
      { value: "voiture", label: "🚗 Voiture" },
      { value: "moto", label: "🏍️ Moto" },
      { value: "utilitaire", label: "🚐 Utilitaire" },
      { value: "electrique", label: "⚡ Voiture électrique" },
    ],
    nextStep: "license_plate",
  },
  license_plate: {
    id: "license_plate",
    question:
      "Quelle est la plaque d'immatriculation de votre véhicule ? (ou son modèle si vous ne l'avez pas sous la main)",
    hint: "Ex: AB-123-CD ou Renault Clio 2020",
    inputType: "text",
    nextStep: "vehicle_usage",
  },
  vehicle_usage: {
    id: "vehicle_usage",
    question: "Comment utilisez-vous principalement votre véhicule ?",
    inputType: "choice",
    choices: [
      { value: "loisirs", label: "🏖️ Loisirs / week-end" },
      { value: "travail_trajet", label: "💼 Trajets domicile-travail" },
      { value: "professionnel", label: "🏢 Usage professionnel" },
      { value: "mixte", label: "🔄 Usage mixte" },
    ],
    nextStep: "driver_profile",
  },
  driver_profile: {
    id: "driver_profile",
    question: "Quel est votre profil de conducteur ?",
    inputType: "choice",
    choices: [
      { value: "nouveau", label: "🆕 Jeune conducteur (< 3 ans de permis)" },
      { value: "experimente", label: "✅ Conducteur expérimenté" },
      { value: "senior", label: "🧓 Conducteur senior (65+)" },
    ],
    nextStep: "driving_history",
  },
  driving_history: {
    id: "driving_history",
    question:
      "Avez-vous eu des sinistres responsables au cours des 3 dernières années ?",
    inputType: "choice",
    choices: [
      { value: "aucun", label: "✨ Aucun sinistre" },
      { value: "un", label: "1️⃣ 1 sinistre" },
      { value: "deux_plus", label: "2️⃣+ 2 sinistres ou plus" },
    ],
    nextStep: "current_insurance",
  },
  current_insurance: {
    id: "current_insurance",
    question: "Êtes-vous actuellement assuré(e) ?",
    inputType: "choice",
    choices: [
      { value: "oui", label: "✅ Oui, je veux changer d'assurance" },
      { value: "non", label: "❌ Non, premier contrat" },
      { value: "nouveau_vehicule", label: "🚘 Nouveau véhicule" },
    ],
    nextStep: "coverage_choice",
  },
  coverage_choice: {
    id: "coverage_choice",
    question: "Quel niveau de couverture vous intéresse ?",
    inputType: "choice",
    choices: [
      {
        value: "tiers",
        label: "🛡️ Tiers — Responsabilité civile (obligatoire)",
      },
      {
        value: "tiers_plus",
        label: "🛡️🔥 Tiers+ — Tiers + bris de glace & vol",
      },
      { value: "tous_risques", label: "🛡️⭐ Tous risques — Couverture totale" },
      {
        value: "conseil",
        label: "💬 Je ne sais pas, conseillez-moi",
      },
    ],
    nextStep: "personal_info",
  },
  personal_info: {
    id: "personal_info",
    question:
      "Parfait ! Pour finaliser votre devis, j'ai besoin de votre prénom et email.",
    hint: "Ex: Jean, jean@email.com",
    inputType: "text",
    nextStep: "summary",
  },
  summary: {
    id: "summary",
    question:
      "Merci pour toutes ces informations ! Je prépare votre devis personnalisé Leocare...",
    inputType: "none",
  },
};

export interface ConversationData {
  vehicleType?: string;
  licensePlate?: string;
  vehicleUsage?: string;
  driverProfile?: string;
  drivingHistory?: string;
  currentInsurance?: string;
  coverageChoice?: string;
  personalInfo?: string;
}

export const SYSTEM_PROMPT = `Tu es un conseiller commercial expert de Leocare, une assurance auto 100% digitale et innovante française.

Ton rôle est de guider les utilisateurs à travers un parcours de souscription d'assurance auto de manière conversationnelle, chaleureuse et professionnelle.

**Ton style de communication :**
- Chaleureux, humain et rassurant
- Clair et simple — évite le jargon assurance
- Personnalisé — utilise les informations déjà collectées pour adapter tes réponses
- Proactif — anticipe les questions et rassure sur les points sensibles

**Le parcours de souscription couvre :**
1. Type et identification du véhicule
2. Usage du véhicule
3. Profil conducteur et historique
4. Assurance actuelle
5. Choix de couverture
6. Informations personnelles et génération du devis

**Produits Leocare :**
- **Tiers** : Responsabilité civile (obligatoire), idéal pour les vieux véhicules. À partir de ~20€/mois.
- **Tiers+** : Tiers + bris de glace, vol, incendie. Bon rapport qualité/prix. À partir de ~35€/mois.
- **Tous risques** : Couverture complète incluant les dommages propres. Recommandé pour les véhicules récents. À partir de ~55€/mois.

**Points forts Leocare :**
- 100% digital, gestion depuis l'app
- Résiliation à tout moment
- Assistance 24h/24 7j/7
- Attestation d'assurance immédiate
- Tarifs compétitifs grâce au digital

Si l'utilisateur s'écarte du sujet ou pose des questions hors assurance auto, recentre gentiment la conversation sur le parcours de souscription.

Réponds toujours en français.`;
