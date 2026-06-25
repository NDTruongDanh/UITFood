import { validate } from './env.schema';

describe('Identity environment schema', () => {
  it('defaults local ports and Better Auth public URL', () => {
    const env = validate({
      DATABASE_URL: 'postgresql://identity:identity@localhost:5432/identity',
    });

    expect(env.IDENTITY_TCP_PORT).toBe(4011);
    expect(env.IDENTITY_MANAGEMENT_PORT).toBe(4012);
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:8080');
  });

  it('requires a strong Better Auth secret', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgresql://identity:identity@localhost:5432/identity',
        BETTER_AUTH_SECRET: 'short',
      }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });
});
