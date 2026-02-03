
export enum ProjectType {
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  MIXED_USE = 'Mixed-Use',
  VILLA = 'Villa'
}

export enum ArchitecturalStyle {
  MODERN = 'Modern',
  MINIMALIST = 'Minimalist',
  LUXURY = 'Luxury',
  TRADITIONAL = 'Traditional',
  ECO_FRIENDLY = 'Eco-Friendly',
  INDUSTRIAL = 'Industrial'
}

export interface DesignPreferences {
  type: ProjectType;
  style: ArchitecturalStyle;
  floors: number;
  budgetRange: 'Low' | 'Medium' | 'High';
  materials: string[];
}

export interface Room {
  name: string;
  size: string;
  description: string;
}

export interface DesignVersion {
  id: string;
  name: string;
  timestamp: string;
  visualizations: {
    exterior: string;
    interior: string;
    plan: string;
  };
  preferences: DesignPreferences;
}

export interface ArchitecturalDesign {
  id: string;
  name: string;
  description: string;
  siteAnalysis: string;
  preferences: DesignPreferences;
  floorPlanJson: {
    rooms: Room[];
    totalArea: string;
    analysis: string;
  };
  visualizations: {
    exterior: string;
    interior: string;
    plan: string;
  };
  costs: {
    estimatedTotal: number;
    breakdown: { item: string; cost: number }[];
  };
  versions: DesignVersion[];
  createdAt: string;
}

export interface AppState {
  projects: ArchitecturalDesign[];
  currentStep: number;
  uploadImage: string | null;
  preferences: DesignPreferences;
  isGenerating: boolean;
  generatedDesign: ArchitecturalDesign | null;
}
