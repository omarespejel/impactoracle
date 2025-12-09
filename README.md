# impactoracle

> 🔮 Pay-per-call impact verification for charitable donations

[![x402](https://img.shields.io/badge/protocol-x402-blue)](https://x402.org)
[![Base](https://img.shields.io/badge/chain-Base-0052FF)](https://base.org)
[![EigenAI](https://img.shields.io/badge/AI-EigenAI-purple)](https://www.eigenai.com)

**impactoracle** is an API that verifies humanitarian impact from blockchain donations using verifiable AI inference. Pay $0.05 via x402, get a cryptographically attested impact report.

## Why?

- **$530B** donated to charity annually — no API to verify impact
- **GiveWell** does manual research — we automate it at $0.05/call
- **AI hallucinations** plague charity reports — EigenAI provides cryptographic proofs

## Stack

- **x402** — HTTP 402 payment protocol (Coinbase)
- **EigenAI** — Verifiable AI inference (Eigen Labs)
- **Base** — L2 settlement (Coinbase)
- **Hono + Bun** — Edge-native runtime

## Features

- **x402 Payment Middleware**: HTTP 402 Payment Required protocol implementation
- **EigenAI Integration**: AI-powered impact verification with cryptographic proofs
- **Blockchain Integration**: Fetches donation events from Base Sepolia using viem
- **Type-Safe**: Full TypeScript with Zod validation
- **Test-Driven**: Comprehensive test suite with Vitest
- **Production-Grade**: Circuit breaker, retry logic, request signing, audit trails

## Project Structure

```
impact-oracle/
├── src/
│   ├── app.ts              # Hono app setup
│   ├── index.ts            # Entry point
│   ├── types/
│   │   └── impact.ts       # Zod schemas
│   ├── services/
│   │   ├── eigenai.ts      # AI integration
│   │   ├── chain.ts        # Blockchain reads
│   │   └── factory.ts      # Dependency injection
│   ├── middleware/
│   │   └── x402.ts         # Payment gate
│   ├── routes/
│   │   └── verify.ts       # Main endpoint
│   └── lib/
│       ├── config.ts       # Secure config
│       ├── logger.ts       # Audit trail
│       ├── errors.ts       # Error handling
│       ├── resilience.ts   # Circuit breaker
│       └── signing.ts      # Request signing
├── tests/                  # Mirror src/ structure
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

## Setup

### Install Dependencies

```bash
bun install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000

# Payment Configuration (x402)
PAYMENT_PRICE=$0.05
PAY_TO_ADDRESS=0x0000000000000000000000000000000000000000

# Blockchain Configuration
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# EigenAI Configuration
EIGENAI_API_KEY=your_eigenai_api_key_here
EIGENAI_BASE_URL=https://api.eigenai.com

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Get EigenAI API Key

1. Visit the [EigenExplorer Developer Dashboard](https://docs.eigenexplorer.com/api-reference/quickstart/get-started)
2. Sign up or log in
3. Generate an API key in the API Keys section
4. Add it to your `.env` file

### Get Base Sepolia Testnet ETH

1. Visit [Alchemy's Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
2. Sign in to your Alchemy account
3. Enter your wallet address and request testnet ETH

## Development

### Run Tests

```bash
bun test                    # All tests
bun test --coverage         # Coverage report
```

### Run Server

```bash
bun run dev                 # Start server with hot reload
```

### Type Checking

```bash
bun run typecheck           # Type safety check
```

## API Endpoints

### POST /v1/verify

Verifies impact for a donation transaction.

**Headers:**
- `Content-Type: application/json`
- `X-Payment: <payment-proof>` (required, returns 402 if missing)

**Request Body:**
```json
{
  "txHash": "0x...",
  "orgId": "ukraine-aid-001",
  "chainId": 84532
}
```

**Response (200):**
```json
{
  "orgId": "ukraine-aid-001",
  "amount": "1000000",
  "impactMetrics": {
    "livesImpacted": 50,
    "resourceType": "medical"
  },
  "confidence": 85,
  "timestamp": 1234567890,
  "proof": "proof123"
}
```

**Response (402 Payment Required):**
```json
{
  "error": "Payment Required",
  "accepts": ["application/x402"],
  "price": "$0.05",
  "payTo": "0x...",
  "network": "base-sepolia",
  "instructions": "Include X-Payment header with valid payment proof..."
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

## Testing

The project follows a test-driven development approach. Tests are organized to mirror the source structure:

- `tests/types/` - Domain type validation tests
- `tests/services/` - Service layer tests
- `tests/middleware/` - Middleware tests
- `tests/routes/` - API route tests

Run tests after each phase to ensure everything works:

```bash
bun test tests/types          # Phase 1
bun test tests/services      # Phase 2 & 5
bun test tests/middleware    # Phase 3
bun test tests/routes        # Phase 4
```

## Technologies

- **Bun**: Runtime and package manager
- **Hono**: Fast web framework
- **Zod**: Runtime validation
- **viem**: Type-safe Ethereum interactions
- **Vitest**: Testing framework
- **Pino**: Fast logger
- **cockatiel**: Circuit breaker and retry patterns
- **@noble/hashes**: Cryptographic primitives

## Hackathon Submission

This project is a submission for the **x402 Hackathon 2025**.

### What We Built

A production-grade impact verification oracle that:
- Accepts x402 micropayments ($0.05 per verification)
- Uses EigenAI for verifiable AI inference
- Provides cryptographic proofs for impact reports
- Runs on Base Sepolia (ready for mainnet)

### Key Innovations

1. **Pay-per-call API**: First impact verification API with x402 integration
2. **Verifiable AI**: Uses EigenAI's cryptographic proofs to prevent hallucinations
3. **Production-ready**: Circuit breakers, retry logic, audit trails, error handling

## License

MIT

## Contributing

This is a hackathon project. Contributions welcome!

## Related Links

- [x402 Protocol](https://x402.org)
- [EigenAI](https://www.eigenai.com)
- [Base Network](https://base.org)
- [Hono Framework](https://hono.dev)
- [Bun Runtime](https://bun.sh)
