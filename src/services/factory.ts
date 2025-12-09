import { EigenAIService, EigenAIConfig } from './eigenai'

export interface ServiceConfig {
  eigenai: EigenAIConfig
}

export interface ServiceContainer {
  eigenai: EigenAIService
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
    eigenai: overrides?.eigenai ?? new EigenAIService(config.eigenai)
  }
}

