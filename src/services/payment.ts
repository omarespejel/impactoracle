import { z } from 'zod'
import {
  PaymentPayloadSchema,
  PaymentRequirementsSchema,
  X402Config,
  USDC_ADDRESSES,
  type PaymentPayload,
  type PaymentRequirements,
  type SupportedNetwork
} from '../types/x402'
import { logger } from '../lib/logger'

// === Types ===

export interface PaymentVerificationResult {
  valid: boolean
  payer?: string
  amount?: string
  invalidReason?: string
}

export interface PaymentSettlementResult {
  success: boolean
  txHash?: string
  error?: string
}

export interface FacilitatorClient {
  verify(params: {
    payload: PaymentPayload['payload']
    paymentRequirements: PaymentRequirements
  }): Promise<{ valid: boolean; invalidReason?: string | null }>

  settle(params: {
    payload: PaymentPayload['payload']
    paymentRequirements: PaymentRequirements
  }): Promise<{ success: boolean; txHash?: string; error?: string }>
}

interface PaymentServiceConfig extends X402Config {
  facilitator: FacilitatorClient
}

// === USDC decimal conversion ===

const USDC_DECIMALS = 6

function centsToUSDCUnits(cents: number): string {
  // 1 cent = 10000 units (USDC has 6 decimals, so $0.01 = 10000)
  return (cents * 10000).toString()
}

function usdcUnitsToCents(units: string): number {
  return Math.floor(parseInt(units, 10) / 10000)
}

// === Service Implementation ===

export class PaymentService {
  private config: PaymentServiceConfig
  private requiredAmountUnits: string

  constructor(config: PaymentServiceConfig) {
    this.config = config
    this.requiredAmountUnits = centsToUSDCUnits(config.priceCents)
  }

  async verifyPayment(payload: PaymentPayload): Promise<PaymentVerificationResult> {
    const log = logger.child({
      service: 'payment',
      method: 'verifyPayment',
      payer: payload.payload.authorization.from
    })

    try {
      // 1. Validate payload structure
      const parseResult = PaymentPayloadSchema.safeParse(payload)
      if (!parseResult.success) {
        log.warn({ errors: parseResult.error.issues }, 'Invalid payload structure')
        return {
          valid: false,
          invalidReason: `invalid_payload: ${parseResult.error.issues[0]?.message}`
        }
      }

      const { authorization } = payload.payload

      // 2. Check recipient matches our payTo address
      if (authorization.to.toLowerCase() !== this.config.payTo.toLowerCase()) {
        log.warn({
          expected: this.config.payTo,
          received: authorization.to
        }, 'Wrong recipient address')
        return {
          valid: false,
          invalidReason: 'invalid_recipient: payment to wrong address'
        }
      }

      // 3. Check payment amount meets minimum
      const paymentAmount = BigInt(authorization.value)
      const requiredAmount = BigInt(this.requiredAmountUnits)

      if (paymentAmount < requiredAmount) {
        log.warn({
          required: this.requiredAmountUnits,
          received: authorization.value
        }, 'Insufficient payment amount')
        return {
          valid: false,
          invalidReason: `insufficient_amount: required ${this.requiredAmountUnits}, got ${authorization.value}`
        }
      }

      // 4. Verify with facilitator (signature + balance check)
      const paymentRequirements = this.buildPaymentRequirements(
        this.config.resource || 'https://api.impactoracle.xyz/v1/verify'
      )

      const facilitatorResult = await this.config.facilitator.verify({
        payload: payload.payload,
        paymentRequirements
      })

      if (!facilitatorResult.valid) {
        log.warn({ reason: facilitatorResult.invalidReason }, 'Facilitator rejected payment')
        return {
          valid: false,
          invalidReason: facilitatorResult.invalidReason || 'facilitator_rejected'
        }
      }

      log.info({ payer: authorization.from, amount: authorization.value }, 'Payment verified')

      return {
        valid: true,
        payer: authorization.from,
        amount: authorization.value
      }

    } catch (error) {
      log.error({ error }, 'Payment verification failed')
      return {
        valid: false,
        invalidReason: 'verification failed: internal error'
      }
    }
  }

  async settlePayment(payload: PaymentPayload): Promise<PaymentSettlementResult> {
    const log = logger.child({
      service: 'payment',
      method: 'settlePayment',
      payer: payload.payload.authorization.from
    })

    try {
      const paymentRequirements = this.buildPaymentRequirements(
        this.config.resource || 'https://api.impactoracle.xyz/v1/verify'
      )

      const result = await this.config.facilitator.settle({
        payload: payload.payload,
        paymentRequirements
      })

      if (result.success) {
        log.info({ txHash: result.txHash }, 'Payment settled')
      } else {
        log.warn({ error: result.error }, 'Payment settlement failed')
      }

      return result

    } catch (error) {
      log.error({ error }, 'Settlement error')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'unknown error'
      }
    }
  }

  buildPaymentRequirements(resourceUrl: string): PaymentRequirements {
    return {
      x402Version: 1,
      schemes: ['exact'],
      network: this.config.network,
      payTo: this.config.payTo,
      maxAmountRequired: this.requiredAmountUnits,
      resource: resourceUrl,
      description: this.config.description,
      extra: {
        name: 'impactoracle',
        version: '1.0.0'
      }
    }
  }

  getConfig() {
    return {
      payTo: this.config.payTo,
      network: this.config.network,
      priceCents: this.config.priceCents,
      priceUSDC: this.requiredAmountUnits
    }
  }
}

