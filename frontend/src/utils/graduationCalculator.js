/**
 * Graduation Calculator Utility
 * Calculates live graduation percentage for Pump.fun tokens
 */

// Pump.fun bonding curve constants
const BONDING_CURVE_MIN = 206900000; // Minimum base balance for graduation tracking
const BONDING_CURVE_RANGE = 793100000; // Total range to 100% graduation

/**
 * Calculate graduation percentage from base balance
 * Formula: 100 - (((baseBalance - 206900000) * 100) / 793100000)
 * 
 * @param {number} baseBalance - Current base token balance in the pool
 * @returns {number} Graduation percentage (0-100)
 */
export function calculateGraduationPercentage(baseBalance) {
  if (!baseBalance || baseBalance <= 0) {
    return 0;
  }

  // Apply the Pump.fun graduation formula
  const progress = 100 - (((baseBalance - BONDING_CURVE_MIN) * 100) / BONDING_CURVE_RANGE);

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, progress));
}

/**
 * Format graduation percentage for display
 * @param {number} percentage - Graduation percentage
 * @param {number} decimals - Number of decimal places (default 2)
 * @returns {string} Formatted percentage string
 */
export function formatGraduationPercentage(percentage, decimals = 2) {
  if (!percentage && percentage !== 0) {
    return '0.00%';
  }
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Get graduation status label
 * @param {number} percentage - Graduation percentage
 * @returns {string} Status label (now returns empty string for clean design)
 */
export function getGraduationStatus(percentage) {
  // Simplified design - no status text needed
  return '';
}

/**
 * Get graduation status color
 * @param {number} percentage - Graduation percentage
 * @returns {string} CSS color value
 */
export function getGraduationColor(percentage) {
  if (percentage >= 95) return '#10b981'; // Green - almost graduated
  if (percentage >= 90) return '#22c55e'; // Light green
  if (percentage >= 75) return '#eab308'; // Yellow
  if (percentage >= 50) return '#f59e0b'; // Orange
  return '#6b7280'; // Gray - early stage
}
