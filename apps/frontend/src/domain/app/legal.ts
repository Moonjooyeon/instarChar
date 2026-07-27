const DEFAULT_LEGAL_BASE_URL = "https://alive.imagebgremover.net";

export const LEGAL_BASE_URL = (
  import.meta.env?.VITE_LEGAL_BASE_URL || DEFAULT_LEGAL_BASE_URL
).replace(/\/+$/, "");

export const PRIVACY_POLICY_URL = `${LEGAL_BASE_URL}/privacy/`;
export const TERMS_URL = `${LEGAL_BASE_URL}/terms/`;
export const ACCOUNT_DELETION_URL = `${LEGAL_BASE_URL}/account-deletion/`;
