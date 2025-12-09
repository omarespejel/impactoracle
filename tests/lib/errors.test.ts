import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  PaymentRequiredError,
  ChainError,
  EigenAIError,
  errorToResponse
} from '../../src/lib/errors'

describe('AppError hierarchy', () => {
  it('ValidationError has 400 status', () => {
    const err = new ValidationError('Invalid input', { field: 'txHash' })
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('PaymentRequiredError has 402 status', () => {
    const err = new PaymentRequiredError('Payment needed', {
      price: '$0.05',
      accepts: ['USDC']
    })
    expect(err.statusCode).toBe(402)
    expect(err.details.price).toBe('$0.05')
  })

  it('ChainError includes chain context', () => {
    const err = new ChainError('RPC failed', { chainId: 84532, txHash: '0x...' })
    expect(err.statusCode).toBe(502)
    expect(err.details.chainId).toBe(84532)
  })

  it('EigenAIError includes model context', () => {
    const err = new EigenAIError('Inference failed', { modelId: 'gpt-oss-120b' })
    expect(err.statusCode).toBe(503)
  })
})

describe('errorToResponse', () => {
  it('converts AppError to safe response', () => {
    const err = new ValidationError('Bad input', { field: 'test' })
    const response = errorToResponse(err)

    expect(response.error.code).toBe('VALIDATION_ERROR')
    expect(response.error.message).toBe('Bad input')
    expect(response.error.details.field).toBe('test')
  })

  it('hides internal details for unknown errors', () => {
    const err = new Error('Database connection string: postgres://...')
    const response = errorToResponse(err)

    expect(response.error.code).toBe('INTERNAL_ERROR')
    expect(response.error.message).toBe('An unexpected error occurred')
    expect(response.error.details).toBeUndefined()
  })
})

