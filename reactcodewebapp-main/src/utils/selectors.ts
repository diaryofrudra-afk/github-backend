import type { AppState } from '../types';
import { getExpiryStatus } from './index';

export function normalizeRegistration(r?: string): string {
  return (r || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function getOperatorDisplay(operatorIdOrPhone: string, state: AppState) {
  // First try to find in operators list by phone or id
  const op = state.operators.find(o => o.phone === operatorIdOrPhone || o.id === operatorIdOrPhone);
  if (op && op.name) return op.name;

  // Then try to find in operatorProfiles by key
  const profile = state.operatorProfiles[operatorIdOrPhone];
  if (profile && profile.name) return profile.name;

  return operatorIdOrPhone; // Fallback to whatever ID/phone was provided
}

export function getAssetById(idOrReg: string, state: AppState) {
  return state.cranes.find(c => c.id === idOrReg || c.reg === idOrReg);
}

export function getComplianceAlertsByReg(reg: string, state: AppState): string[] {
  const c = state.compliance[reg] || {};
  const alerts: string[] = [];
  const items: Array<[string, { date: string } | undefined]> = [
    ['Insurance', c.insurance],
    ['Fitness', c.fitness],
  ];
  items.forEach(([label, v]) => {
    if (!v) return;
    const s = getExpiryStatus(v.date);
    if (s.c === 'expired') alerts.push(`${label} expired`);
    else if (s.c === 'warn') alerts.push(`${label}: ${s.l}`);
  });
  return alerts;
}

