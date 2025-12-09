import { EigenAIService, EigenAIConfig } from './eigenai'
import { PaymentService, FacilitatorClient } from './payment'
import { X402Config } from '../types/x402'

export interface ServiceConfig {
  eigenai: EigenAIConfig
  x402: X402Config & { facilitator: FacilitatorClient }
}

export interface ServiceContainer {
  eigenai: EigenAIService
  payment: PaymentService
}

/**
 * Factory for creating services with dependency injection
 * Allows mock injection for testing
 */
export function createServices(
  config: ServiceConfig,
  overrides?: Partial<ServiceContainer>
): ServiceContainer {
  return {
    eigenai: overrides?.eigenai ?? new EigenAIService(config.eigenai),
    payment: overrides?.payment ?? new PaymentService(config.x402)
  }
}

