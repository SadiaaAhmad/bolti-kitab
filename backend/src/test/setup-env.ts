/**
 * Bolti Kitab — Test Environment Setup
 *
 * Pre-loads environment variables before any application code or config
 * is imported by the test runner.
 */

process.env['NODE_ENV'] = 'test';
process.env['DB_NAME'] = 'bolti_kitab_test';

if (!process.env['LOG_LEVEL']) {
  process.env['LOG_LEVEL'] = 'warn';
}
