import {
  computeLeadScore,
  normalizeLeadStatus,
} from './leads.constants';

describe('leads.constants', () => {
  it('maps lost to unqualified', () => {
    expect(normalizeLeadStatus('lost')).toBe('unqualified');
    expect(normalizeLeadStatus('qualified')).toBe('qualified');
  });

  it('scores enterprise RFP leads higher than anonymous web leads', () => {
    const weak = computeLeadScore({ source: 'website' });
    const strong = computeLeadScore({
      contactEmail: 'cto@acme.com',
      companyName: 'Acme',
      website: 'https://acme.com',
      estimatedBudget: 80000,
      companySize: 'enterprise',
      serviceInterest: ['custom_dev'],
      timeline: 'immediate',
      decisionRole: 'decision_maker',
      rfpReceived: true,
      source: 'rfp',
      jobTitle: 'CTO',
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(100);
  });
});
