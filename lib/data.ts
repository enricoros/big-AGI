export type SystemPurposeId = 'Canada' | 'Quebec' | 'cinqSubventions' | 'uneSubvention' | 'Custom';

type SystemPurposeData = {
  title: string;
  description: string | JSX.Element;
  systemMessage: string;
  symbol: string;
};

export const SystemPurposes: { [key in SystemPurposeId]: SystemPurposeData } = {
  Canada: {
    title: '1 Subvention Canada',
    description: '1 subventions dans lesquelles je peux être potentiellement qualifié au niveau fédéral canadien uniquement.',
    systemMessage:
      "Date actuelle: {{Today}}.\n Instructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\n Donne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune demande qui n'a pas rapport avec les subventions.\n Requête : Donne-moi 1 subventions dans lesquelles je peux être potentiellement qualifié au niveau fédéral canadien uniquement.",
    symbol: '🍁',
  },
  Quebec: {
    title: '1 Subvention Quebec',
    description: '1 subventions dans lesquelles je peux être potentiellement qualifié au niveau provincial quebecois uniquement.',
    systemMessage:
      "Date actuelle: {{Today}}.\n Instructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\n Donne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune demande qui n'a pas rapport avec les subventions.\n Requête : Donne-moi 1 subventions dans lesquelles je peux être potentiellement qualifié au niveau provincial quebecois uniquement.",
    symbol: '⚜️',
  },
  cinqSubventions: {
    title: '5 Subventions',
    description: '5 subventions dans lesquelles je peux être potentiellement qualifié.',
    systemMessage:
      "Date actuelle: {{Today}}.\n Instructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\n Donne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune demande qui n'a pas rapport avec les subventions.\n Requête : Donne-moi 5 subventions dans lesquelles je peux être potentiellement qualifié.",
    symbol: '🚀',
  },
  uneSubvention: {
    title: '1 Subvention',
    description: '1 subventions dans lesquelles je peux être potentiellement qualifié.',
    systemMessage:
      "Date actuelle: {{Today}}.\n Instructions : Tu es un expert en subvention. À l'aide des détails fournis sur mon entreprise et projet, rédige une réponse complète à la requête donnée.\n Donne-moi la réponse selon ce modèle : NOM DE LA SUBVENTION | DESCRIPTION DE LA SUBVENTION | LES EXIGENCES POUR ÊTRE ÉLIGIBLE | MONTANT DE LA SUBVENTION | DATE DE FERMETURE POSTÉRIEUR DES DEMANDES OBLIGATOIREMENT ET UNIQUEMENT EN JOUR/MOIS. N'acceptez aucune demande qui n'a pas rapport avec les subventions.\n Requête : Donne-moi 1 subventions dans lesquelles je peux être potentiellement qualifié.",
    symbol: '🚀',
  },
  Custom: {
    title: 'Personnalisé / Test',
    description: '',
    systemMessage: '',
    symbol: '👨‍💻',
  },
};

export type ChatModelId = 'gpt-3.5-turbo';

export const defaultChatModelId: ChatModelId = 'gpt-3.5-turbo';

type ChatModelData = {
  description: string | JSX.Element;
  title: string;
  fullName: string; // seems unused
  contextWindowSize: number;
};

export const ChatModels: { [key in ChatModelId]: ChatModelData } = {
  'gpt-3.5-turbo': {
    description: 'A good balance between speed and insight',
    title: 'Recherche v1',
    fullName: 'Recherche v1',
    contextWindowSize: 4096,
  },
};
