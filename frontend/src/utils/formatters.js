// src/utils/formatters.js

export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return "0.00";
  return Number(num).toFixed(decimals);
};

export const formatDateTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};