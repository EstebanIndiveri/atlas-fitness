import { describe, expect, it } from '@jest/globals';
import { shouldSeedQaUser } from './seed-options';

describe('shouldSeedQaUser', () => {
  it('omits the QA user by default', () => {
    expect(shouldSeedQaUser({ NODE_ENV: 'test' })).toBe(false);
  });

  it.each(['test', 'development'])(
    'allows the QA user in %s',
    (nodeEnv) => {
      expect(
        shouldSeedQaUser({
          NODE_ENV: nodeEnv,
          SEED_QA_USER: 'true',
        }),
      ).toBe(true);
    },
  );

  it('rejects the QA user in production', () => {
    expect(() =>
      shouldSeedQaUser({
        NODE_ENV: 'production',
        SEED_QA_USER: 'true',
      }),
    ).toThrow('QA seed is forbidden in production');
  });
});
