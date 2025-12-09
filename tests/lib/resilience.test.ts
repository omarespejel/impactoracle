import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createResilientClient, CircuitOpenError } from '../../src/lib/resilience'

describe('ResilientClient', () => {
  // Note: Using real timers as Bun's test runner handles them differently

  it('executes successful requests normally', async () => {
    const client = createResilientClient({
      name: 'test',
      failureThreshold: 3,
      resetTimeout: 10000
    })

    const fn = vi.fn().mockResolvedValue('success')
    const result = await client.execute(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries transient failures with exponential backoff', async () => {
    const client = createResilientClient({
      name: 'test',
      failureThreshold: 5,
      resetTimeout: 10000,
      maxRetries: 2 // Reduced for faster test
    })

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success')

    // Note: This test verifies retry logic works, but timing is handled by cockatiel
    const result = await client.execute(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('opens circuit after threshold failures', async () => {
    const client = createResilientClient({
      name: 'test',
      failureThreshold: 2,
      resetTimeout: 30000,
      maxRetries: 0  // No retries for this test
    })

    const fn = vi.fn().mockRejectedValue(new Error('Service down'))

    // First two failures
    await expect(client.execute(fn)).rejects.toThrow()
    await expect(client.execute(fn)).rejects.toThrow()

    // Circuit should now be open
    await expect(client.execute(fn)).rejects.toThrow(CircuitOpenError)

    // Function should NOT be called when circuit is open
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('half-opens circuit after reset timeout', async () => {
    const client = createResilientClient({
      name: 'test',
      failureThreshold: 2,
      resetTimeout: 100, // Short timeout for test
      maxRetries: 0
    })

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('recovered')

    await expect(client.execute(fn)).rejects.toThrow()
    await expect(client.execute(fn)).rejects.toThrow()

    // Wait for reset timeout (cockatiel handles this internally)
    await new Promise(resolve => setTimeout(resolve, 150))

    // Should allow one probe request (circuit half-open)
    const result = await client.execute(fn)
    expect(result).toBe('recovered')
  })

  it('emits metrics on state changes', async () => {
    const onStateChange = vi.fn()
    const client = createResilientClient({
      name: 'eigenai',
      failureThreshold: 2,
      resetTimeout: 10000,
      maxRetries: 0,
      onStateChange
    })

    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(client.execute(fn)).rejects.toThrow()
    await expect(client.execute(fn)).rejects.toThrow()

    expect(onStateChange).toHaveBeenCalledWith({
      name: 'eigenai',
      from: 'closed',
      to: 'open',
      timestamp: expect.any(Number)
    })
  })
})

