import { AppError } from './errors.js';

describe('AppError', () => {
    it('creates error with status code', () => {
        const err = new AppError(404, 'Not found', 'NOT_FOUND');
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('Not found');
        expect(err.code).toBe('NOT_FOUND');
        expect(err).toBeInstanceOf(Error);
    });
});
