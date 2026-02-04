/**
 * API: GET /api/macro-risk
 * 
 * Exposes WARGAMES macro risk data + allocation ceilings.
 * Public endpoint for UI + partner agents.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  fetchMacroRisk, 
  getAllocationCeiling,
  formatRiskSummary,
  type WargamesRisk,
  type AllocationCeiling
} from '../src/lib/wargames';

export interface MacroRiskResponse {
  risk: WargamesRisk;
  ceiling: AllocationCeiling;
  summary: string;
  timestamp: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch live macro risk
    const risk = await fetchMacroRisk();
    
    if (!risk) {
      return res.status(503).json({ 
        error: 'WARGAMES API unavailable',
        fallback: {
          maxDeFiAllocation: 60,
          maxSingleProtocol: 30,
          riskLevel: 'medium',
          reasoning: 'Using conservative defaults'
        }
      });
    }

    // Calculate allocation ceiling
    const ceiling = await getAllocationCeiling();
    const summary = formatRiskSummary(risk, ceiling);

    const response: MacroRiskResponse = {
      risk,
      ceiling,
      summary,
      timestamp: new Date().toISOString()
    };

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Macro risk API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
