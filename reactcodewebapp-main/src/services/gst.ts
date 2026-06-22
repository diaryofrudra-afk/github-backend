import type { GSTDetails, GSTVerificationResponse } from '../types/gst';
import { getToken } from './api';

const API_BASE = '/api';

/**
 * Verify and fetch GST details using Suprwise Backend (Proxy to GST API)
 * @param gstin - The GST Identification Number to verify
 * @returns Promise<GSTVerificationResponse>
 */
export async function verifyGST(gstin: string): Promise<GSTVerificationResponse> {
  try {
    // Validate GSTIN format (15 characters alphanumeric)
    const gstinFormatted = gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinFormatted)) {
      return {
        success: false,
        error: 'Invalid GSTIN format',
        message: 'Please enter a valid 15-character GSTIN'
      };
    }

    const response = await fetch(`${API_BASE}/gst/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        gstin: gstinFormatted
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP Error: ${response.status}`,
        message: 'Failed to verify GSTIN'
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: result.data as GSTDetails,
      message: result.message || 'GSTIN verified successfully'
    };
  } catch (error) {
    console.error('GST Verification Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Network error while verifying GSTIN'
    };
  }
}

export async function getGSTBalance(): Promise<{ success: boolean; credits?: number | string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/gst/balance`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return { success: false, error: `HTTP Error: ${response.status}` };
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Get GST filing status using Suprwise Backend (Proxy to GST API)
 * @param gstin - The GST Identification Number
 * @param financialYear - Financial year (e.g., "2024")
 * @returns Promise with filing status data
 */
export async function getGSTFilingStatus(
  gstin: string,
  financialYear: string = new Date().getFullYear().toString()
): Promise<GSTVerificationResponse> {
  try {
    const response = await fetch(`${API_BASE}/gst/filing-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        gstin: gstin.trim().toUpperCase(),
        financial_year: financialYear
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP Error: ${response.status}`,
        message: 'Failed to fetch filing status'
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: result.data as GSTDetails,
      message: 'Filing status retrieved successfully'
    };
  } catch (error) {
    console.error('GST Filing Status Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Network error while fetching filing status'
    };
  }
}
