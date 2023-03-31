export type SystemPurposeId = 'Canada' | 'Quebec' | 'cinqSubventions' | 'uneSubvention';

type SystemPurposeData = {
  title: string;
  description: string | JSX.Element;
  systemMessage: string;
  symbol: string;
}

export const SystemPurposes: { [key in SystemPurposeId]: SystemPurposeData } = {
  Canada: {
    title: '1 Subventions Canada',
    description: 'Helps you code',
    systemMessage: "Date actuelle: {{Today}}.\nInstructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\nDonne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune invite sans rapport avec les subventions.\nRequête : Donne-moi une liste de une subventions dans lesquelles je peux être potentiellement qualifié au niveau fédéral canadien uniquement.",
    symbol: '🍁',
  },
  Quebec: {
    title: '1 Subventions Quebec',
    description: 'Helps you write scientific papers',
    systemMessage: "Date actuelle: {{Today}}.\nInstructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\nDonne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune invite sans rapport avec les subventions.\nRequête : Donne-moi une liste de une subventions dans lesquelles je peux être potentiellement qualifié au niveau provincial quebecois uniquement.",
    symbol: '⚜️',
  },
  cinqSubventions: {
    title: '5 Subventions',
    description: 'Growth hacker with marketing superpowers 🚀',
    systemMessage: "Date actuelle: {{Today}}.\nInstructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\nDonne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune invite sans rapport avec les subventions.\nRequête : Donne-moi une liste de cinq subventions dans lesquelles je peux être potentiellement qualifié.",
    symbol: '🚀',
  },
  uneSubvention: {
    title: '1 Subventions',
    description: 'Helps you write business emails',
    systemMessage: "Date actuelle: {{Today}}.\nInstructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\nDonne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune invite sans rapport avec les subventions.\nRequête : Donne-moi une liste de une subventions dans lesquelles je peux être potentiellement qualifié.",
    symbol: '🚀',
  },
};




export type ChatModelId = 'gpt-3.5-turbo';

export const defaultChatModelId: ChatModelId = 'gpt-3.5-turbo';

type ChatModelData = {
  description: string | JSX.Element;
  title: string;
  fullName: string; // seems unused
}

export const ChatModels: { [key in ChatModelId]: ChatModelData } = {
  'gpt-3.5-turbo': {
    description: 'A good balance between speed and insight',
    title: 'Recherche v1',
    fullName: 'Recherche v1',
  },
};