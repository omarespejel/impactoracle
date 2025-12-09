import 'dotenv/config'

async function main() {
  // Create mock payment header
  const mockPayment = {
    x402Version: 1,
    scheme: 'exact',
    network: 'base-sepolia',
    payload: {
      signature: '0x' + 'a'.repeat(130),
      authorization: {
        from: '0x' + 'b'.repeat(40),
        to: process.env.PAY_TO_ADDRESS || '0x' + 'a'.repeat(40),
        value: '50000',
        validAfter: Math.floor(Date.now() / 1000) - 60,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: '0x' + 'd'.repeat(64)
      }
    }
  }

  const encodedPayment = Buffer.from(JSON.stringify(mockPayment)).toString('base64')

  console.log('🧪 Testing /v1/verify with mock payment...\n')

  const response = await fetch('http://localhost:3000/v1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': encodedPayment
    },
    body: JSON.stringify({
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orgId: 'ukraine-medical-aid',
      chainId: 84532
    })
  })

  const data = await response.json()
  
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(data, null, 2))
}

main().catch(console.error)

