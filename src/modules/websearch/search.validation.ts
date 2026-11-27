const domainPattern = /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)*[a-z\d](?:[a-z\d-]*[a-z\d])?$/i;

export function isValidContextSearchDomain(value: string): boolean {
  const domain = value.trim();
  return domain.length <= 253 && (!domain || domainPattern.test(domain));
}
