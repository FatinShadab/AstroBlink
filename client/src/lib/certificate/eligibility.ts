/**
 * Certificate eligibility, from the user's own stats (not stored; see architecture §7.3).
 * PLACEHOLDER threshold: one full batch of ten fields. The team sets the real number.
 */
export const CERT_MIN_FIELDS = 10;

export function isCertificateEligible(fieldsChecked: number): boolean {
  return fieldsChecked >= CERT_MIN_FIELDS;
}
