
import React from 'react';
import { Layout, Home, Building2, Trees, Leaf, Sparkles, Ruler, Coins } from 'lucide-react';
import { ArchitecturalStyle, ProjectType } from './types';

export const STYLE_PRESETS = [
  { 
    id: ArchitecturalStyle.MODERN, 
    name: 'Modern', 
    description: 'Clean lines, large windows, and open spaces.',
    icon: <Layout className="w-5 h-5" />
  },
  { 
    id: ArchitecturalStyle.MINIMALIST, 
    name: 'Minimalist', 
    description: 'Essential functionality with simple aesthetics.',
    icon: <Home className="w-5 h-5" />
  },
  { 
    id: ArchitecturalStyle.LUXURY, 
    name: 'Luxury', 
    description: 'High-end materials and grand architectural features.',
    icon: <Sparkles className="w-5 h-5" />
  },
  { 
    id: ArchitecturalStyle.ECO_FRIENDLY, 
    name: 'Eco-Friendly', 
    description: 'Sustainable materials and energy-efficient design.',
    icon: <Leaf className="w-5 h-5" />
  },
  { 
    id: ArchitecturalStyle.TRADITIONAL, 
    name: 'Traditional', 
    description: 'Classic elements reflecting local heritage.',
    icon: <Trees className="w-5 h-5" />
  }
];

export const PROJECT_TYPES = [
  { id: ProjectType.RESIDENTIAL, name: 'Residential', icon: <Home className="w-5 h-5" /> },
  { id: ProjectType.COMMERCIAL, name: 'Commercial', icon: <Building2 className="w-5 h-5" /> },
  { id: ProjectType.VILLA, name: 'Private Villa', icon: <Sparkles className="w-5 h-5" /> }
];

export const BUDGET_OPTIONS = ['Low', 'Medium', 'High'];
