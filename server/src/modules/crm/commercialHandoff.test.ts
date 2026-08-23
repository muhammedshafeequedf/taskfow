import { hourlyRateFromQuoteLines, projectKeyFromTitle } from './commercialHandoff.service';

describe('commercialHandoff helpers', () => {
  it('builds a short uppercase project key', () => {
    expect(projectKeyFromTitle('Acme Website Rebuild')).toBe('ACMEWE');
    expect(projectKeyFromTitle('!!!')).toBe('PRJ');
  });

  it('reads hourly rate from quote lines', () => {
    expect(
      hourlyRateFromQuoteLines([
        { billingType: 'fixed', unitPrice: 5000 },
        { billingType: 'hourly', unitPrice: 85 },
      ])
    ).toBe(85);
    expect(hourlyRateFromQuoteLines([{ billingType: 'fixed', unitPrice: 10 }])).toBeUndefined();
  });
});
